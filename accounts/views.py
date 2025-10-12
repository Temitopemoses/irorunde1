from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
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

from django.db.models import Sum, Count
from django.utils import timezone
from datetime import datetime, timedelta
from .models import ContributionPlan, Transaction, MemberContribution

from django.db.models import Sum, Count
from django.utils import timezone
from datetime import datetime, timedelta
from .models import ContributionPlan, Transaction, MemberContribution

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
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = MemberRegistrationSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    member = serializer.save()
                
                return Response({
                    'message': 'Registration successful!',
                    'member_id': member.id,
                    'membership_number': member.membership_number,
                    'status': 'active',
                }, status=status.HTTP_201_CREATED)
                
            except IntegrityError as e:
                if 'UNIQUE constraint' in str(e):
                    return Response({
                        'error': 'This user is already registered as a member. Please check your account or contact support.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        'error': f'Registration error: {str(e)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except Exception as e:
                return Response({
                    'error': f'Error during registration: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'error': 'Invalid data provided',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

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
        groups = Group.objects.filter(is_active=True)
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
    permission_classes = [permissions.IsAuthenticated]
    
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