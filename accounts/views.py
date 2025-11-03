from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import uuid
from datetime import datetime
import requests
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, IntegrityError
from .models import Member, Payment, User, CooperativeGroup
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    MemberRegistrationSerializer, 
    AdminMemberCreateSerializer,
    MemberSerializer,
    GroupSerializer,
    
)
import os
from django.conf import settings

from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from .models import ContributionPlan, Transaction, MemberContribution
from django.contrib.auth import authenticate
from rest_framework.decorators import action


# =============================
# GROUP ADMIN DASHBOARD VIEWS
# =============================

@api_view(['GET'])
@permission_classes([AllowAny])
def group_admin_stats(request):
    """Get statistics for group admin dashboard"""
    if request.user.role != 'group_admin' or not request.user.managed_group:
        return Response({"error": "Access denied"}, status=403)
    
    group = request.user.managed_group
    
    # Calculate stats
    total_members = Member.objects.filter(group=group).count()
    active_members = Member.objects.filter(group=group, status='active').count()
    total_payments = Payment.objects.filter(member__group=group, is_successful=True).count()
    pending_payments = Payment.objects.filter(member__group=group, is_successful=False).count()
    
    return Response({
        'totalMembers': total_members,
        'activeMembers': active_members,
        'totalPayments': total_payments,
        'pendingPayments': pending_payments,
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def group_admin_members(request):
    """Get members for group admin dashboard"""
    if request.user.role != 'group_admin' or not request.user.managed_group:
        return Response({"error": "Access denied"}, status=403)
    
    group = request.user.managed_group
    members = Member.objects.filter(group=group).select_related('user').order_by('-registration_date')
    
    member_data = []
    for member in members:
        member_data.append({
            'id': member.id,
            'user': {
                'first_name': member.user.first_name,
                'last_name': member.user.last_name,
            },
            'phone': member.phone,
            'status': member.status,
            'membership_number': member.membership_number,
            'registration_date': member.registration_date,
        })
    
    return Response(member_data)


class GroupAdminLoginView(APIView):
    def post(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')
            
            if not username or not password:
                return Response({
                    'error': 'Username and password are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            user = authenticate(username=username, password=password)
            
            if user is not None:
                if user.is_active and (user.role == 'group_admin' or user.is_staff or user.is_superuser):
  
                    # Generate JWT tokens
                    refresh = RefreshToken.for_user(user)
                    
                    return Response({
                        'token': str(refresh.access_token),
                        'refresh': str(refresh),
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'email': user.email,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                            'role': 'group_admin',
                            'is_staff': user.is_staff,
                            'is_superuser': user.is_superuser
                        }
                    })
                else:
                    return Response({
                        'error': 'Account not authorized for group admin access'
                    }, status=status.HTTP_403_FORBIDDEN)
            else:
                return Response({
                    'error': 'Invalid username or password'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            return Response({
                'error': f'Login failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================
# EXISTING VIEWS (KEEP AS-IS)
# =============================

class MemberDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            # Check if user has member profile
            if not hasattr(request.user, 'member_profile'):
                return Response({
                    'error': 'No member profile found for this user'
                }, status=status.HTTP_404_NOT_FOUND)
            
            member = request.user.member_profile
            
            # Get passport photo URL
            passport_photo_url = None
            if member.passport_photo:
                passport_photo_url = request.build_absolute_uri(member.passport_photo.url)
            
            # Get current date info
            now = timezone.now()
            current_week = now.isocalendar()[1]
            current_month = now.month
            current_year = now.year
            
            # Calculate totals
            total_contributions = Transaction.objects.filter(
                member=member, 
                transaction_type='contribution',
                status='completed'
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Weekly contributions (current week)
            weekly_contributions = Transaction.objects.filter(
                member=member,
                transaction_type='contribution',
                status='completed',
                transaction_date__week=current_week,
                transaction_date__year=current_year
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Monthly contributions (current month)
            monthly_contributions = Transaction.objects.filter(
                member=member,
                transaction_type='contribution',
                status='completed',
                transaction_date__month=current_month,
                transaction_date__year=current_year
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Recent transactions (last 10)
            recent_transactions = Transaction.objects.filter(
                member=member
            ).select_related('member__user')[:10]
            
            # Available contribution plans
            contribution_plans = ContributionPlan.objects.filter(is_active=True)
            
            dashboard_data = {
                'member_info': {
                    'name': f"{request.user.first_name} {request.user.last_name}",
                    'membership_number': member.membership_number,
                    'group': member.group.name if member.group else 'No Group',
                    'group_id': member.group.id if member.group else None,  # ✅ Add this line
                    'status': member.status,
                    'passport_photo': passport_photo_url,  # Add photo URL here
                    'has_photo': bool(member.passport_photo),
                },
                'financial_summary': {
                    'total_contributions': float(total_contributions),
                    'weekly_contributions': float(weekly_contributions),
                    'monthly_contributions': float(monthly_contributions),
                },
                'recent_transactions': [],
                'contribution_plans': [],
            }
            
            # Add transactions data
            try:
                from .serializers import TransactionSerializer
                dashboard_data['recent_transactions'] = TransactionSerializer(recent_transactions, many=True).data
            except:
                # Fallback
                dashboard_data['recent_transactions'] = [
                    {
                        'id': t.id,
                        'transaction_type': t.transaction_type,
                        'amount': float(t.amount),
                        'status': t.status,
                        'transaction_date': t.transaction_date.isoformat(),
                        'description': t.description
                    }
                    for t in recent_transactions
                ]
            
            # Add plans data
            try:
                from .serializers import ContributionPlanSerializer
                dashboard_data['contribution_plans'] = ContributionPlanSerializer(contribution_plans, many=True).data
            except:
                # Fallback
                dashboard_data['contribution_plans'] = [
                    {
                        'id': p.id,
                        'name': p.name,
                        'amount': float(p.amount),
                        'frequency': p.frequency,
                        'description': p.description
                    }
                    for p in contribution_plans
                ]
            
            return Response(dashboard_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Dashboard error: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({
                'error': f'Error loading dashboard: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MakeContributionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            member = request.user.member_profile
            serializer = ContributionPaymentSerializer(data=request.data)
            
            if serializer.is_valid():
                data = serializer.validated_data
                plan = ContributionPlan.objects.get(id=data['plan_id'])
                
                # Check if contribution already exists for this week
                existing_contribution = MemberContribution.objects.filter(
                    member=member,
                    plan=plan,
                    week_number=data['week_number'],
                    year=data['year']
                ).exists()
                
                if existing_contribution:
                    return Response({
                        'error': 'Contribution already made for this week'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Create transaction
                transaction = Transaction.objects.create(
                    member=member,
                    transaction_type='contribution',
                    amount=data['amount'],
                    description=f"Weekly contribution - {plan.name}",
                    status='completed'
                )
                
                # Create contribution record
                contribution = MemberContribution.objects.create(
                    member=member,
                    plan=plan,
                    amount_paid=data['amount'],
                    week_number=data['week_number'],
                    month=data['month'],
                    year=data['year'],
                    transaction=transaction
                )
                
                return Response({
                    'message': 'Contribution successful!',
                    'contribution_id': contribution.id,
                    'transaction_reference': transaction.reference,
                    'amount': data['amount'],
                    'week': data['week_number']
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except ContributionPlan.DoesNotExist:
            return Response({
                'error': 'Contribution plan not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error processing contribution: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ContributionSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            member = request.user.member_profile
            
            # Get current year and month
            now = timezone.now()
            current_year = now.year
            current_month = now.month
            
            # Monthly summary
            monthly_summary = MemberContribution.objects.filter(
                member=member,
                year=current_year
            ).values('month').annotate(
                total_amount=Sum('amount_paid'),
                contribution_count=Count('id')
            ).order_by('month')
            
            # Weekly summary for current month
            weekly_summary = MemberContribution.objects.filter(
                member=member,
                year=current_year,
                month=current_month
            ).values('week_number').annotate(
                total_amount=Sum('amount_paid'),
                contribution_count=Count('id')
            ).order_by('week_number')
            
            # Yearly total
            yearly_total = MemberContribution.objects.filter(
                member=member,
                year=current_year
            ).aggregate(total=Sum('amount_paid'))['total'] or 0
            
            return Response({
                'monthly_summary': list(monthly_summary),
                'weekly_summary': list(weekly_summary),
                'yearly_total': yearly_total,
                'current_year': current_year,
                'current_month': current_month
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'Error loading contribution summary: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Test endpoint
class RegisterMemberView(APIView):
    permission_classes = []  # Allow anyone to register (public endpoint)

    def post(self, request, *args, **kwargs):
        print("🟢 Incoming registration data:", request.data)

        serializer = MemberRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            try:
                group_id = request.data.get("group")
                if group_id:
                    serializer.validated_data["group_id"] = group_id

                member = serializer.save()
                print(f"✅ Member created successfully: {member}")

                return Response(
                    {
                        "message": "Member registered successfully",
                        "member_id": member.id,
                        "membership_number": member.membership_number,
                        "group": str(member.group) if member.group else None,
                    },
                    status=status.HTTP_201_CREATED
                )

            except Exception as e:
                print(f"❌ Error during save: {str(e)}")
                return Response(
                    {"error": f"Failed to create member: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # if serializer is invalid
        print("❌ Serializer validation errors:", serializer.errors)
        return Response(
            {
                "error": "Invalid registration data",
                "details": serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )

class MemberLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        phone = request.data.get('phone', '').strip()
        surname = request.data.get('surname', '').strip()
        
        if not phone or not surname:
            return Response({
                'error': 'Both phone number and surname are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(phone=phone, last_name__iexact=surname)
            
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid phone number or surname.'
            }, status=status.HTTP_400_BAD_REQUEST)

        member = getattr(user, 'member_profile', None)
        if not member:
            return Response({
                'error': 'No member profile found.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        refresh = RefreshToken.for_user(user)
        
        user_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'user_id': user.id,
            'phone': user.phone,
            'membership_number': member.membership_number,
            'member_id': member.id,
            'group': member.group.name if member.group else 'No Group',
            'status': member.status,
            'message': f'Welcome back, {user.first_name} {user.last_name}!'
        }
        
        return Response(user_data, status=status.HTTP_200_OK)

# Keep your other views as they are...
class CreateMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            return Response({
                'error': 'You do not have permission to perform this action'
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = AdminMemberCreateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    member = serializer.save()
                
                return Response({
                    'message': 'Member created successfully!',
                    'member_id': member.id,
                    'membership_number': member.membership_number,
                    'status': 'active'
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                return Response({
                    'error': f'Error creating member: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'error': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class GroupListView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        groups = CooperativeGroup.objects.filter(is_active=True)
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    return Response({'message': 'Logout successful'})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_user(request):
    user = request.user
    member = getattr(user, 'member_profile', None)
    
    user_data = {
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'role': user.role,
        'phone': user.phone,
        'user_id': user.id,
        'group': member.group.name if member and member.group else None,
        'membership_number': member.membership_number if member else None,
        'status': member.status if member else None,
    }
    
    return Response(user_data)



class SuperAdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get_client_ip(self, request):
        """Extract client IP with proper header handling"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def is_allowed_ip(self, ip):
        """Check if IP is in allowed list from environment"""
        allowed_ips = os.getenv('ALLOWED_ADMIN_IPS', '127.0.0.1').split(',')
        return ip in [i.strip() for i in allowed_ips]
    
    def check_rate_limit(self, ip, username):
        """Implement rate limiting"""
        from django.core.cache import cache
        
        cache_key = f"admin_login_attempts_{ip}_{username}"
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 5:  # Max 5 attempts per 15 minutes
            return False
            
        cache.set(cache_key, attempts + 1, 900)  # 15 minutes
        return True
    
    def post(self, request):
        # Security layer 1: IP restriction
        client_ip = self.get_client_ip(request)
        if not self.is_allowed_ip(client_ip):
            print(f"🚫 Blocked admin login attempt from IP: {client_ip}")
            return Response({
                'error': 'Access denied.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        
        if not username or not password:
            return Response({
                'error': 'Both username and password are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Security layer 2: Rate limiting
        if not self.check_rate_limit(client_ip, username):
            return Response({
                'error': 'Too many login attempts. Please try again in 15 minutes.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        try:
            # Security layer 3: Authentication
            user = authenticate(username=username, password=password)
            
            if not user:
                print(f"❌ Failed admin login attempt for user: {username} from IP: {client_ip}")
                return Response({
                    'error': 'Invalid credentials.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Security layer 4: Role verification
            if user.role != 'superadmin' and not user.is_superuser:
                print(f"🚫 Non-admin user attempted admin login: {username}")
                return Response({
                    'error': 'Access denied.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Security layer 5: Check if user is active
            if not user.is_active:
                return Response({
                    'error': 'Account deactivated.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            user_data = {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'user_id': user.id,
                'email': user.email,
                'is_superuser': user.is_superuser,
            }
            
            # Log successful login
            print(f"✅ Successful admin login: {username} from IP: {client_ip}")
            
            return Response(user_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"🚨 Admin login error for {username}: {str(e)}")
            return Response({
                'error': 'Authentication failed.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CreateGroupAdminView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        # Check if user is superadmin
        if request.user.role != 'superadmin' and not request.user.is_superuser:
            return Response({
                'error': 'Only superadmin can create group admins.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = GroupAdminCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                group_admin = serializer.save()
                
                return Response({
                    'message': f'Group admin {group_admin.username} created successfully!',
                    'admin_id': group_admin.id,
                    'username': group_admin.username,
                    'group': group_admin.managed_group.name,
                    'role': group_admin.role
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                return Response({
                    'error': f'Error creating group admin: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class GroupAdminListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        # Check if user is superadmin
        if request.user.role != 'superadmin' and not request.user.is_superuser:
            return Response({
                'error': 'Only superadmin can view group admins.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        group_admins = User.objects.filter(role='admin').select_related('managed_group')
        serializer = GroupAdminSerializer(group_admins, many=True)
        
        return Response({
            'group_admins': serializer.data,
            'total_count': group_admins.count()
        }, status=status.HTTP_200_OK)

class GroupAdminDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, admin_id):
        if request.user.role != 'superadmin' and not request.user.is_superuser:
            return Response({
                'error': 'Only superadmin can view group admin details.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            group_admin = User.objects.get(id=admin_id, role='admin')
            serializer = GroupAdminSerializer(group_admin)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({
                'error': 'Group admin not found.'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def delete(self, request, admin_id):
        if request.user.role != 'superadmin' and not request.user.is_superuser:
            return Response({
                'error': 'Only superadmin can delete group admins.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            group_admin = User.objects.get(id=admin_id, role='admin')
            username = group_admin.username
            group_admin.delete()
            
            return Response({
                'message': f'Group admin {username} deleted successfully!'
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({
                'error': 'Group admin not found.'
            }, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_groups(request):
    groups = CooperativeGroup.objects.filter(is_active=True)
    data = [{"id": group.id, "name": group.name} for group in groups]
    return Response(data)

@action(detail=True, methods=['get'])
def member_details(self, request, pk=None):
    # Member detail view
    pass

@action(detail=True, methods=['put'])
def update_member(self, request, pk=None):
    # Member update functionality
    pass

@action(detail=False, methods=['get'])
def all_members(self, request):
    # Paginated list of all members
    pass

@action(detail=False, methods=['get'])
def generate_report(self, request):
    # Report generation
    pass

@ensure_csrf_cookie
def get_csrf(request):
    return JsonResponse({"detail": "CSRF cookie set"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_admin_members(request):
    if request.user.role != 'group_admin' or not request.user.managed_group:
        return Response({"error": "Access denied"}, status=403)
    
    group = request.user.managed_group
    since = request.query_params.get('since')  # Optional ISO timestamp

    members = Member.objects.filter(group=group).select_related('user').order_by('-registration_date')
    
    if since:
        try:
            since_dt = timezone.datetime.fromisoformat(since)
            members = members.filter(registration_date__gt=since_dt)
        except Exception:
            pass  # ignore invalid format

    member_data = []
    for member in members:
        member_data.append({
            'id': member.id,
            'user': {
                'first_name': member.user.first_name,
                'last_name': member.user.last_name,
            },
            'phone': member.phone,
            'status': member.status,
            'membership_number': member.membership_number,
            'registration_date': member.registration_date.isoformat(),
        })
    
    return Response(member_data)
    
class GroupAdminCreateMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]  # Only logged-in users
    # You can create a custom permission to check role='group_admin'

    def post(self, request):
        # Ensure only group admins can create members
        if request.user.role != 'group_admin':
            return Response({"detail": "You do not have permission to create members."},
                            status=status.HTTP_403_FORBIDDEN)
        
        serializer = AdminMemberCreateSerializer(
            data=request.data,
            context={'group_admin': request.user}  # Pass the admin context
        )
        
        if serializer.is_valid():
            member = serializer.save()
            return Response({
                "detail": "Member created successfully",
                "membership_number": member.membership_number,
                "phone": member.phone
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        # Only members managed by this group admin
        if request.user.role != 'group_admin':
            return Response({"detail": "You do not have permission."}, status=status.HTTP_403_FORBIDDEN)

        members = Member.objects.filter(group=request.user.managed_group)
        serializer = MemberSerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings
from datetime import datetime
import requests

@api_view(["POST"])
@permission_classes([AllowAny])  # Allow both guests and logged-in users
def initialize_flutterwave_payment(request):
    user = request.user if request.user.is_authenticated else None

    amount = request.data.get("amount")
    payment_type = request.data.get("payment_type", "membership")
    group_id = request.data.get("group_id")
    name = request.data.get("name") or (f"{user.first_name} {user.last_name}" if user else "Guest User")
    email = request.data.get("email") or (user.email if user and user.email else f"guest_{datetime.now().strftime('%Y%m%d%H%M%S')}@irorunde.local")
    phone = request.data.get("phone")

    # ✅ Basic Validation
    if not amount:
        return Response({"error": "Amount is required"}, status=400)
    try:
        amount = float(amount)
    except ValueError:
        return Response({"error": "Invalid amount"}, status=400)

    # ✅ Enforce minimum for contributions
    if payment_type == "contribution" and amount < 1100:
        return Response({"error": "Minimum contribution amount is ₦1,100"}, status=400)

    tx_ref = f"IROR-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    payload = {
        "tx_ref": tx_ref,
        "amount": amount,
        "currency": "NGN",
        "redirect_url": f"{settings.FRONTEND_URL}/payment/verify",
        "customer": {
            "email": email,
            "name": name,
            "phonenumber": phone,
        },
        "meta": {
            "payment_type": payment_type,
            "group_id": group_id,
            "user_id": user.id if user else None,
            "name": name,
            "phone": phone,
        },
        "customizations": {
            "title": "Irorunde Cooperative Payment",
            "description": (
                "Membership registration payment"
                if payment_type == "membership"
                else "Contribution payment"
            ),
            "logo": f"{settings.FRONTEND_URL}/logo.png",
        },
    }

    headers = {
        "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    url = "https://api.flutterwave.com/v3/payments"

    try:
        res = requests.post(url, headers=headers, json=payload)
        res_data = res.json()
        print("FLW INIT RESPONSE:", res.status_code, res_data)

        if res.status_code == 200 and res_data.get("status") == "success":
            return Response({
                "payment_link": res_data["data"]["link"],
                "tx_ref": tx_ref
            })
        else:
            return Response(
                {"error": res_data.get("message", "Failed to initialize payment")},
                status=400,
            )
    except Exception as e:
        print("INIT ERROR:", e)
        return Response({"error": str(e)}, status=500)



@api_view(['POST'])
@permission_classes([AllowAny])
def flutterwave_webhook(request):
    secret_hash = settings.FLUTTERWAVE_SECRET_KEY
    signature = request.headers.get('verif-hash')

    # Verify webhook signature
    if signature != secret_hash:
        return Response({"error": "Invalid signature"}, status=403)

    payload = json.loads(request.body)
    tx_ref = payload.get('data', {}).get('tx_ref')
    status = payload.get('data', {}).get('status')

    try:
        payment = Payment.objects.get(tx_ref=tx_ref)
    except Payment.DoesNotExist:
        return Response({"error": "Payment not found"}, status=404)

    if status == 'successful':
        payment.status = 'successful'
        payment.is_successful = True
        payment.save()

    return Response({"message": "Webhook received"}, status=200)

@api_view(['GET'])
def verify_flutterwave_payment(request):
    tx_ref = request.query_params.get('tx_ref')
    if not tx_ref:
        return Response({"error": "tx_ref is required"}, status=400)

    headers = {
        "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    url = f"https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref={tx_ref}"

    response = requests.get(url, headers=headers)
    res_data = response.json()
    print("FLW VERIFY RESPONSE:", response.status_code, res_data)

    if response.status_code == 200 and res_data.get("status") == "success":
        flw_data = res_data.get("data", {})
        if flw_data.get("status") == "successful":
            # ✅ Payment verified
            # You can mark user as paid or register them now
            return Response(
                {"message": "Payment verified successfully", "data": flw_data},
                status=200,
            )
        else:
            return Response(
                {"error": "Payment not successful yet"},
                status=400,
            )

    return Response({"error": "Verification failed"}, status=400)
