from rest_framework import status, permissions
from datetime import timedelta 
import logging
from decimal import Decimal
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Sum, Count
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import uuid
from datetime import datetime
from rest_framework import generics
import requests
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, IntegrityError
from .serializers import (
    MemberSavingsSummarySerializer, PaymentSerializer, ManualPaymentSerializer, ManualPaymentCreateSerializer,
    LoanSerializer, LoanCreateSerializer, CombinedPaymentHistorySerializer,
    GroupAccountSerializer, AdminManualPaymentCreateSerializer,
    GroupAdminCreateSerializer, GroupAdminSerializer, ProcessPaymentSerializer, SavingsPenaltySerializer  # ADDED THESE
)
from .models import (
    Member, Payment, SavingsPenalty, User, CooperativeGroup, ManualPayment, Loan, 
    Savings, FixedDeposit, InvestmentLoan, OutstandingBalance,  # ADD THESE
    ContributionPlan, Transaction, MemberContribution, LoanPayment  # AND THESE
)
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
from django.shortcuts import get_object_or_404  # ADDED THIS IMPORT

logger = logging.getLogger(__name__)

# ========== UTILITY FUNCTIONS ==========
def calculate_financial_summary(member):
    """Calculate comprehensive financial summary for a member using the new models"""
    
    # Get savings from Savings model
    try:
        savings_account = member.savings_account
        total_savings = float(savings_account.balance)  # Convert to float
    except Savings.DoesNotExist:
        total_savings = 0.00
    
    # Get fixed deposits total
    total_fixed_deposits_result = FixedDeposit.objects.filter(
        member=member, 
        is_active=True
    ).aggregate(total=Sum('amount'))['total']
    total_fixed_deposits = float(total_fixed_deposits_result) if total_fixed_deposits_result else 0.00
    
    # Get outstanding REGULAR loans
    outstanding_regular_loans_result = member.loans.filter(
        status='active',
        loan_type='regular'
    ).aggregate(total=Sum('remaining_balance'))['total']
    outstanding_regular_loans = float(outstanding_regular_loans_result) if outstanding_regular_loans_result else 0.00
    
    # Get outstanding INVESTMENT loans
    outstanding_investment_loans_result = member.investment_loans.filter(
        status='active'
    ).aggregate(total=Sum('outstanding_balance'))['total']
    outstanding_investment_loans = float(outstanding_investment_loans_result) if outstanding_investment_loans_result else 0.00
    
    # Calculate weekly and monthly totals using manual payments
    one_week_ago = timezone.now() - timedelta(days=7)
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Total contributions (all confirmed payments excluding registration)
    confirmed_payments = ManualPayment.objects.filter(
        member=member,
        status='confirmed'
    )
    
    total_contributions_result = confirmed_payments.exclude(
        amount=20300  # Exclude registration
    ).aggregate(total=Sum('amount'))['total']
    total_contributions = float(total_contributions_result) if total_contributions_result else 0.00
    
    weekly_contributions_result = confirmed_payments.filter(
        created_at__gte=one_week_ago
    ).exclude(amount=20300).aggregate(total=Sum('amount'))['total']
    weekly_contributions = float(weekly_contributions_result) if weekly_contributions_result else 0.00
    
    monthly_contributions_result = confirmed_payments.filter(
        created_at__gte=month_start
    ).exclude(amount=20300).aggregate(total=Sum('amount'))['total']
    monthly_contributions = float(monthly_contributions_result) if monthly_contributions_result else 0.00
    
    # Weekly and monthly savings only
    weekly_savings_result = confirmed_payments.filter(
        created_at__gte=one_week_ago,
        payment_type='savings'
    ).aggregate(total=Sum('amount'))['total']
    weekly_savings = float(weekly_savings_result) if weekly_savings_result else 0.00
    
    monthly_savings_result = confirmed_payments.filter(
        created_at__gte=month_start,
        payment_type='savings'
    ).aggregate(total=Sum('amount'))['total']
    monthly_savings = float(monthly_savings_result) if monthly_savings_result else 0.00
    
    return {
        'total_savings': total_savings,
        'outstanding_loans': outstanding_regular_loans,  # Only regular loans
        'fixed_deposits': total_fixed_deposits,
        'investment_loans': outstanding_investment_loans,  # Investment loans separate
        'total_contributions': total_contributions,
        'weekly_contributions': weekly_contributions,
        'monthly_contributions': monthly_contributions,
        'weekly_savings': weekly_savings,
        'monthly_savings': monthly_savings,
    }

def get_member_active_obligations(member):
    """Get active loans and fixed deposits for member"""
    active_loans = Loan.objects.filter(member=member, status='active')
    
    loans_data = []
    for loan in active_loans:
        progress = 0
        if loan.amount and loan.remaining_balance:
            paid = float(loan.amount) - float(loan.remaining_balance)
            progress = (paid / float(loan.amount)) * 100
            
        loans_data.append({
            'type': loan.loan_type,
            'total_amount': float(loan.amount),
            'outstanding': float(loan.remaining_balance),
            'progress': round(progress, 1)
        })
    
    # Fixed deposits (treat as obligations)
    fixed_deposits = ManualPayment.objects.filter(
        member=member, 
        payment_type='fixed_deposit',
        status='confirmed'
    )
    
    fixed_deposits_data = []
    for fd in fixed_deposits:
        fixed_deposits_data.append({
            'type': 'fixed_deposit',
            'total_amount': float(fd.amount),
            'outstanding': 0,  # Assuming fixed deposits are fully paid
            'progress': 100
        })
    
    return {
        'loans': loans_data,
        'fixed_deposits': fixed_deposits_data
    }

# ========== REMOVE DUPLICATE FUNCTION - KEEP ONLY ONE VERSION ==========
# Remove the duplicate admin_member_dashboard function view since we have AdminMemberDashboardView class

# =============================
# MANUAL PAYMENT VIEWS
# =============================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_account_details(request):
    """Get bank account details for the user's group"""
    try:
        member = request.user.member_profile
        group = member.group
        
        if not group:
            return Response(
                {'error': 'You are not assigned to any group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = GroupAccountSerializer(group)
        return Response(serializer.data)
    
    except Member.DoesNotExist:
        return Response(
            {'error': 'Member profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_manual_payment(request):
    """Submit a manual payment request with payment category"""
    try:
        member = request.user.member_profile
        
        # Validate that user has a group
        if not member.group:
            return Response(
                {'error': 'You are not assigned to any group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate minimum amount
        amount = request.data.get('amount')
        if float(amount) < 1100:
            return Response(
                {'error': 'Minimum contribution is ₦1100'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ManualPaymentCreateSerializer(data=request.data)
        if serializer.is_valid():
            # Add member and group to the payment
            manual_payment = serializer.save(
                member=member,
                group=member.group,
                status='pending'
            )
            
            # Return the full payment details
            response_serializer = ManualPaymentSerializer(manual_payment)
            return Response({
                'message': 'Payment submitted successfully! Awaiting admin confirmation.',
                'payment': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Member.DoesNotExist:
        return Response(
            {'error': 'Member profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
@api_view(['POST'])
@permission_classes([AllowAny])
def submit_registration_payment(request):
    """Submit registration payment for new members (public endpoint)"""
    print("🔄 Registration payment submission")
    
    try:
        # Extract payment data
        amount = request.data.get('amount')
        bank_name = request.data.get('bank_name')
        transaction_reference = request.data.get('transaction_reference')
        transfer_date = request.data.get('transfer_date')
        
        # Registration details for linking
        registration_phone = request.data.get('registration_phone')
        registration_name = request.data.get('registration_name')
        registration_email = request.data.get('registration_email')
        registration_card_number = request.data.get('registration_card_number')
        group_id = request.data.get('group_id')
        
        print(f"📝 Registration payment for: {registration_name} ({registration_phone})")
        
        # Validate required fields
        if not all([amount, bank_name, transaction_reference, registration_phone, registration_name]):
            return Response({
                'error': 'Missing required fields'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get group
        try:
            group = CooperativeGroup.objects.get(id=group_id)
        except CooperativeGroup.DoesNotExist:
            return Response({
                'error': 'Selected group does not exist'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create manual payment record
        manual_payment = ManualPayment.objects.create(
            # For registration payments, we don't have a member yet
            member=None,  # Will be linked later when member is created
            group=group,
            amount=amount,
            payment_type='registration',
            bank_name=bank_name,
            transaction_reference=transaction_reference,
            transfer_date=transfer_date,
            status='pending',
            admin_notes=f'Registration payment for {registration_name} ({registration_phone}). Email: {registration_email}, Card: {registration_card_number}'
        )
        
        print(f"✅ Created registration payment: {manual_payment.reference_number}")
        
        serializer = ManualPaymentSerializer(manual_payment)
        return Response({
            'message': 'Registration payment submitted successfully! Please complete your registration.',
            'payment': serializer.data,
            'payment_id': manual_payment.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print(f"❌ Registration payment error: {str(e)}")
        return Response({
            'error': f'Error submitting payment: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_manual_payment(request, payment_id):
    """Confirm a manual payment and update relevant balances"""
    print("🔄 ===== confirm_manual_payment CALLED =====")
    print(f"🔄 Payment ID: {payment_id}")
    print(f"🔄 User: {request.user.username}")
    print(f"🔄 User role: {request.user.role}")
    print(f"🔄 Is super admin: {request.user.is_super_admin()}")
    print(f"🔄 Is group admin: {request.user.is_group_admin()}")
    
    if not (request.user.is_group_admin() or request.user.is_super_admin()):
        print("❌ Permission denied - User is not group admin or super admin")
        return Response(
            {'error': 'Permission denied'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        payment = ManualPayment.objects.get(id=payment_id)
        print(f"✅ Found payment: {payment.id}, Type: {payment.payment_type}, Amount: ₦{payment.amount}")
        print(f"✅ Payment group: {payment.group}, User managed group: {getattr(request.user, 'managed_group', None)}")
        
        # Check if group admin has permission for this payment's group
        if (request.user.is_group_admin() and 
            payment.group != request.user.managed_group):
            print("❌ Admin can only confirm payments for their group")
            return Response(
                {'error': 'You can only confirm payments for your managed group'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if payment.status != 'pending':
            print("❌ Payment not pending")
            return Response(
                {'error': 'Payment is not pending'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use database transaction
        with transaction.atomic():
            # Update payment status FIRST
            payment.status = 'confirmed'
            payment.confirmed_by = request.user
            payment.confirmed_at = timezone.now()
            payment.save()
            print("✅ Payment status updated to 'confirmed'")
            
            # 🚨 PROCESS PAYMENT BASED ON PAYMENT TYPE
            print("🔄 Calling process_payment_by_type...")
            process_payment_by_type(payment)
            print("✅ Payment processing completed")
            
            # Create a Payment record
            payment_record = Payment.objects.create(
                member=payment.member,
                group=payment.group,
                amount=payment.amount,
                payment_method='manual',
                card_number_reference=payment.member.card_number,
                is_successful=True,
                manual_payment=payment
            )
            print("✅ Payment record created")
            
            # Create transaction record
            transaction_record = Transaction.objects.create(
                member=payment.member,
                transaction_type=payment.payment_type,
                amount=payment.amount,
                description=f"Manual payment confirmed - {payment.reference_number}",
                status='completed',
                reference=f"MANUAL{payment.id}"
            )
            print("✅ Transaction record created")
        
        print("🎉 Payment confirmation COMPLETE!")
        
        # Return updated payment data
        payment.refresh_from_db()
        serializer = ManualPaymentSerializer(payment)
        
        return Response({
            'message': 'Payment confirmed successfully and balances updated!',
            'payment': serializer.data
        })
    
    except ManualPayment.DoesNotExist:
        print(f"❌ Payment not found: {payment_id}")
        return Response(
            {'error': 'Payment not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"❌ ERROR in confirm_manual_payment: {str(e)}")
        import traceback
        print("FULL TRACEBACK:")
        print(traceback.format_exc())
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
def update_loan_balances(payment):
    """Update loan balances when a loan payment is confirmed"""
    print("🔄 ===== update_loan_balances CALLED =====")
    print(f"🔄 Payment ID: {payment.id}, Type: {payment.payment_type}, Amount: ₦{payment.amount}")
    
    try:
        # Check if this is a loan payment
        if payment.payment_type == 'outstanding_balance':
            print("🔍 This is a REGULAR loan payment")
            loan_type = 'regular'
        elif payment.payment_type == 'investment_loan':
            print("🔍 This is an INVESTMENT loan payment")  
            loan_type = 'investment'
        else:
            print(f"❌ Not a loan payment: {payment.payment_type} - No action needed")
            return False

        print(f"🎯 Looking for {loan_type} loans for member: {payment.member.full_name}")
        
        # Get active loans
        active_loans = Loan.objects.filter(
            member=payment.member,
            loan_type=loan_type,
            status='active',
            remaining_balance__gt=0
        )
        
        print(f"📊 Found {active_loans.count()} active {loan_type} loans with remaining balance > 0")
        
        if not active_loans.exists():
            print(f"❌ No applicable loans found!")
            return False
        
        remaining_amount = float(payment.amount)
        print(f"💰 Starting with amount: ₦{remaining_amount}")
        
        loans_updated = []
        
        for loan in active_loans:
            if remaining_amount <= 0:
                break
                
            current_balance = float(loan.remaining_balance)
            print(f"💳 Processing Loan {loan.id}:")
            print(f"   Current balance: ₦{current_balance}")
            
            if current_balance > 0:
                deduction = min(remaining_amount, current_balance)
                print(f"   ➖ Deducting: ₦{deduction}")
                
                # Update the loan balance
                loan.remaining_balance -= deduction
                print(f"   📝 New balance: ₦{loan.remaining_balance}")
                
                # CORRECTED: Create loan payment record WITH manual_payment
                LoanPayment.objects.create(
                    loan=loan,
                    manual_payment=payment,  # Link to the manual payment
                    amount=deduction,
                    payment_type='repayment',
                    description=f"Loan repayment from manual payment {payment.reference_number}"
                )
                
                # If loan is fully paid, update status
                if loan.remaining_balance <= 0:
                    loan.remaining_balance = 0
                    loan.status = 'completed'
                    print(f"   🎉 Loan fully paid! Status changed to 'completed'")
                
                print(f"   💾 Saving loan...")
                loan.save()
                print(f"   ✅ Loan saved successfully!")
                
                loans_updated.append(loan.id)
                remaining_amount -= deduction
                
                print(f"   💰 Remaining payment amount: ₦{remaining_amount}")
        
        print(f"📈 FINAL RESULT:")
        print(f"   Updated {len(loans_updated)} loans: {loans_updated}")
        print(f"   Total applied: ₦{float(payment.amount) - remaining_amount}")
        print(f"   Payment remaining: ₦{remaining_amount}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR in update_loan_balances: {str(e)}")
        import traceback
        print("FULL TRACEBACK:")
        print(traceback.format_exc())
        return False
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_manual_payment(request, payment_id):
    """Reject a manual payment (admin only)"""
    if not (request.user.is_group_admin() or request.user.is_super_admin()):
        return Response(
            {'error': 'Permission denied'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        payment = ManualPayment.objects.get(id=payment_id)
        
        # Check if group admin has permission for this payment's group
        if (request.user.is_group_admin() and 
            payment.group != request.user.managed_group):
            return Response(
                {'error': 'You can only reject payments for your managed group'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if payment.status != 'pending':
            return Response(
                {'error': 'Payment is not pending'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment.status = 'rejected'
        payment.admin_notes = request.data.get('admin_notes', '')
        payment.save()
        
        serializer = ManualPaymentSerializer(payment)
        return Response(serializer.data)
    
    except ManualPayment.DoesNotExist:
        return Response(
            {'error': 'Payment not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def combined_payment_history(request):
    """Get combined payment history (both manual and regular payments)"""
    try:
        member = request.user.member_profile
        
        # Get all manual payments for the member
        manual_payments = ManualPayment.objects.filter(member=member).order_by('-created_at')
        
        # Combine data from different sources
        combined_data = []
        for payment in manual_payments:
            combined_data.append({
                'id': payment.id,
                'date': payment.created_at,
                'payment_type': payment.payment_type,
                'amount': float(payment.amount),
                'status': payment.status,
                'reference_number': payment.reference_number,
                'bank_name': payment.bank_name,
                'transaction_reference': payment.transaction_reference,
                'is_successful': payment.status == 'confirmed',
                'payment_source': 'manual'
            })
        
        # Also include regular payments if needed
        regular_payments = Payment.objects.filter(member=member).exclude(manual_payment__isnull=False)
        for payment in regular_payments:
            combined_data.append({
                'id': payment.id,
                'date': payment.created_at,
                'payment_type': 'contribution',
                'amount': float(payment.amount),
                'status': 'confirmed' if payment.is_successful else 'failed',
                'reference_number': payment.card_number_reference,
                'bank_name': None,
                'transaction_reference': None,
                'is_successful': payment.is_successful,
                'payment_source': 'regular'
            })
        
        # Sort by date descending
        combined_data.sort(key=lambda x: x['date'], reverse=True)
        
        serializer = CombinedPaymentHistorySerializer(combined_data, many=True)
        return Response(serializer.data)
    
    except Member.DoesNotExist:
        return Response(
            {'error': 'Member profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )

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
    
    # Payment stats - using manual payments
    total_payments = ManualPayment.objects.filter(group=group, status='confirmed').count()
    pending_payments = ManualPayment.objects.filter(group=group, status='pending').count()
    
    return Response({
        'totalMembers': total_members,
        'activeMembers': active_members,
        'totalPayments': total_payments,
        'pendingPayments': pending_payments,
    })

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
# EXISTING VIEWS (UPDATED FOR MANUAL PAYMENTS)
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
            
            # Get financial summary with payment categories
            financial_summary = calculate_financial_summary(member)
            
            # Get active obligations
            active_obligations = get_member_active_obligations(member)
            
            dashboard_data = {
                'member_info': {
                    'name': f"{request.user.first_name} {request.user.last_name}",
                    'card_number': member.card_number,
                    'group': member.group.name if member.group else 'No Group',
                    'group_id': member.group.id if member.group else None,
                    'status': member.status,
                    'passport_photo': passport_photo_url,
                    'has_photo': bool(member.passport_photo),
                    'phone': member.phone,
                },
                'financial_summary': financial_summary,
                'active_obligations': active_obligations
            }
            
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
            
            # Use manual payment instead of direct contribution
            serializer = ManualPaymentCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                data = serializer.validated_data
                
                # Create manual payment record
                manual_payment = ManualPayment.objects.create(
                    member=member,
                    group=member.group,
                    amount=data['amount'],
                    payment_type='savings',  # Default to savings for contributions
                    bank_name=data.get('bank_name', ''),
                    transaction_reference=data.get('transaction_reference', ''),
                    transfer_date=data.get('transfer_date')
                )
                
                return Response({
                    'message': 'Contribution submitted successfully! Please transfer funds and await admin confirmation.',
                    'payment_id': manual_payment.id,
                    'reference_number': manual_payment.reference_number,
                    'amount': data['amount']
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
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
            
            # Monthly summary - using confirmed manual payments
            monthly_summary = ManualPayment.objects.filter(
                member=member,
                status='confirmed',
                payment_type='contribution',
                created_at__year=current_year
            ).extra({'month': "EXTRACT(month FROM created_at)"}).values('month').annotate(
                total_amount=Sum('amount'),
                payment_count=Count('id')
            ).order_by('month')
            
            # Weekly summary for current month
            weekly_summary = ManualPayment.objects.filter(
                member=member,
                status='confirmed',
                payment_type='contribution',
                created_at__year=current_year,
                created_at__month=current_month
            ).extra({'week': "EXTRACT(week FROM created_at)"}).values('week').annotate(
                total_amount=Sum('amount'),
                payment_count=Count('id')
            ).order_by('week')
            
            # Yearly total
            yearly_total = ManualPayment.objects.filter(
                member=member,
                status='confirmed',
                payment_type='contribution',
                created_at__year=current_year
            ).aggregate(total=Sum('amount'))['total'] or 0
            
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
                        "card_number": member.card_number,
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
            'card_number': member.card_number,
            'member_id': member.id,
            'group': member.group.name if member.group else 'No Group',
            'status': member.status,
            'message': f'Welcome back, {user.first_name} {user.last_name}!'
        }
        
        return Response(user_data, status=status.HTTP_200_OK)

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
                    'card_number': member.card_number,
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
        try:
            print("🔄 GroupListView called - fetching all active groups")
            groups = CooperativeGroup.objects.filter(is_active=True)
            print(f"✅ Found {groups.count()} active groups")
            
            # Debug: print group details
            for group in groups:
                print(f"   Group: {group.name}, Bank: {group.bank_name}, Account: {group.account_number}")
            
            serializer = GroupSerializer(groups, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            print(f"❌ Error in GroupListView: {str(e)}")
            return Response(
                {'error': 'Failed to fetch groups'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        'card_number': member.card_number if member else None,
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

class PaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'group_admin':
            return Payment.objects.filter(group=user.managed_group)
        return Payment.objects.none()

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
            'card_number': member.card_number,
            'registration_date': member.registration_date.isoformat(),
            'email': member.user.email,
        })
    
    return Response(member_data)
    
class GroupAdminCreateMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
                "card_number": member.card_number,
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_history(request):
    user = request.user

    try:
        # ✅ If the user is a member, show only their payments
        if hasattr(user, 'member_profile'):
            payments = Payment.objects.filter(member=user.member_profile)
        # ✅ If the user is a group admin, show all payments for their group
        elif hasattr(user, 'managed_group') and user.role == 'group_admin':
            payments = Payment.objects.filter(group=user.managed_group)
        # ✅ Superadmins see all payments
        elif user.is_superuser:
            payments = Payment.objects.all()
        else:
            payments = Payment.objects.none()

        serializer = PaymentSerializer(payments, many=True)
        return JsonResponse(serializer.data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_report(request, group_id):
    try:
        group = CooperativeGroup.objects.get(id=group_id)
        
        total_members = group.member_set.count()
        
        # Use manual payments for contributions
        total_contributions = ManualPayment.objects.filter(
            group=group, 
            status='confirmed',
            payment_type='contribution'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        total_payments = ManualPayment.objects.filter(group=group, status='confirmed').count()
        
        # Top contributors
        top_contributors = (
            ManualPayment.objects.filter(group=group, status='confirmed', payment_type='contribution')
            .values('member__user__first_name', 'member__user__last_name')
            .annotate(total_paid=Sum('amount'))
            .order_by('-total_paid')[:3]
        )
        
        # Recent payments
        recent_payments = (
            ManualPayment.objects.filter(group=group, status='confirmed')
            .select_related('member__user')
            .order_by('-created_at')[:5]
            .values('member__user__first_name', 'member__user__last_name', 'amount', 'created_at')
        )

        # Average contribution
        avg_contribution = total_contributions / total_members if total_members > 0 else 0

        data = {
            "group": group.name,
            "total_members": total_members,
            "total_contributions": total_contributions,
            "total_payments": total_payments,
            "average_contribution": avg_contribution,
            "top_contributors": list(top_contributors),
            "recent_payments": list(recent_payments),
        }
        return Response(data)
    except CooperativeGroup.DoesNotExist:
        return Response({"error": "Group not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_member_dashboard(request, member_id):
    """Admin view of member dashboard - UPDATED FOR MANUAL PAYMENTS"""
    try:
        # Check if user is a Group Administrator using your role system
        if not (request.user.role == 'group_admin' or request.user.is_super_admin()):
            return Response({'error': 'Group admin access required'}, status=403)
        
        # Get the admin's managed group
        admin_managed_group = request.user.managed_group
        if not admin_managed_group:
            return Response({'error': 'No group assigned to admin'}, status=403)
        
        # Get the target member
        member = Member.objects.select_related('user', 'group').get(id=member_id)
        
        # Ensure admin can only view members from their managed group
        if member.group != admin_managed_group:
            return Response({'error': 'Can only view members from your managed group'}, status=403)
        
        # Calculate financial summary using manual payments
        financial_summary = calculate_financial_summary(member)
        
        # Prepare member info
        member_info = {
            'name': f"{member.user.first_name} {member.user.last_name}",
            'card_number': member.card_number,
            'group': member.group.name if member.group else 'No Group',
            'group_id': member.group.id if member.group else None,
            'status': member.status,
            'passport_photo': request.build_absolute_uri(member.passport_photo.url) if member.passport_photo else None,
            'has_photo': bool(member.passport_photo),
            'phone': member.phone
        }
        
        # Get pending manual payments for this member
        pending_payments = ManualPayment.objects.filter(
            member=member, 
            status='pending'
        ).order_by('-created_at')
        
        pending_payments_data = ManualPaymentSerializer(pending_payments, many=True).data
        
        return Response({
            'member_info': member_info,
            'financial_summary': financial_summary,
            'pending_payments': pending_payments_data
        })
        
    except Member.DoesNotExist:
        return Response({'error': 'Member not found'}, status=404)
    except Exception as e:
        logger.error(f"Admin member dashboard error: {str(e)}")
        return Response({'error': 'Internal server error'}, status=500)
    
class AdminMemberDashboardView(APIView):
    """Admin view of member dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, member_id):
        # Check if user is group admin or superadmin
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For group admins, ensure they only access members from their managed group
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            # Super admin can access any member
            member = get_object_or_404(Member, id=member_id)
        
        # Get passport photo URL
        passport_photo_url = None
        if member.passport_photo:
            passport_photo_url = request.build_absolute_uri(member.passport_photo.url)
        
        # Use same logic as member dashboard but for specific member
        financial_summary = calculate_financial_summary(member)
        active_obligations = get_member_active_obligations(member)
        
        member_info = {
            'name': f"{member.user.first_name} {member.user.last_name}",
            'card_number': member.card_number,
            'group': member.group.name if member.group else 'No Group',
            'group_id': member.group.id if member.group else None,
            'status': member.status,
            'passport_photo': passport_photo_url,
            'has_photo': bool(member.passport_photo),
            'phone': member.phone,
        }
        
        return Response({
            'member_info': member_info,
            'financial_summary': financial_summary,
            'active_obligations': active_obligations
        })

class AdminMemberPaymentsView(APIView):
    """Get payment history for a specific member (admin view)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, member_id):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For group admins, ensure they only access members from their managed group
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            member = get_object_or_404(Member, id=member_id)
        
        # Get all manual payments for the member
        manual_payments = ManualPayment.objects.filter(member=member).order_by('-created_at')
        
        # Combine data
        combined_data = []
        for payment in manual_payments:
            combined_data.append({
                'id': payment.id,
                'date': payment.created_at,
                'payment_type': payment.payment_type,
                'amount': float(payment.amount),
                'status': payment.status,
                'reference_number': payment.reference_number,
                'bank_name': payment.bank_name,
                'transaction_reference': payment.transaction_reference,
                'is_successful': payment.status == 'confirmed',
                'payment_source': 'manual'
            })
        
        serializer = CombinedPaymentHistorySerializer(combined_data, many=True)
        return Response(serializer.data)

class AdminMemberLoansView(APIView):
    """Get all loans (regular + investment) for a specific member (admin view)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, member_id):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For group admins, ensure they only access members from their managed group
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            member = get_object_or_404(Member, id=member_id)
        
        # Get regular loans (already ordered by -created_at)
        regular_loans = Loan.objects.filter(member=member).order_by('-created_at')
        regular_serializer = LoanSerializer(regular_loans, many=True)
        
        # Get investment loans (already ordered by -created_at)
        investment_loans = InvestmentLoan.objects.filter(member=member).order_by('-created_at')
        
        # Serialize investment loans
        investment_data = []
        for loan in investment_loans:
            investment_data.append({
                'id': loan.id,
                'member': loan.member.id,
                'group': loan.group.id,
                'loan_type': 'investment',
                'amount': float(loan.amount),
                'amount_granted': float(loan.amount),
                'remaining_balance': float(loan.outstanding_balance),
                'outstanding_balance': float(loan.outstanding_balance),
                'interest_rate': float(loan.interest_rate) if loan.interest_rate else 0.0,
                'purpose': loan.purpose,
                'status': loan.status,
                'created_at': loan.created_at,
                'updated_at': loan.updated_at,
                'is_investment_loan': True
            })
        
        # Combine both loan types - they're already individually sorted
        all_loans = regular_serializer.data + investment_data
        
        # Remove the problematic sorting line
        return Response(all_loans)

class AdminManualPaymentView(APIView):
    """Admin records payment for member"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, member_id):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For group admins, ensure they only access members from their managed group
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            member = get_object_or_404(Member, id=member_id)
        
        # Create auto-confirmed payment
        payment_data = {
            'amount': request.data.get('amount'),
            'payment_type': request.data.get('payment_type', 'savings'),
            'bank_name': request.data.get('bank_name'),
            'transaction_reference': request.data.get('transaction_reference'),
            'transfer_date': request.data.get('transfer_date'),
            'admin_notes': request.data.get('admin_notes', f'Payment recorded by admin {request.user.get_full_name()}')
        }
        
        serializer = AdminManualPaymentCreateSerializer(data=payment_data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    # Create the manual payment as confirmed
                    manual_payment = ManualPayment.objects.create(
                        member=member,
                        group=member.group,
                        amount=payment_data['amount'],
                        payment_type=payment_data['payment_type'],
                        bank_name=payment_data.get('bank_name', ''),
                        transaction_reference=payment_data.get('transaction_reference', ''),
                        transfer_date=payment_data.get('transfer_date'),
                        status='confirmed',
                        confirmed_by=request.user,
                        confirmed_at=timezone.now(),
                        admin_notes=payment_data.get('admin_notes', '')
                    )
                    print(f"✅ Admin created manual payment: {manual_payment.id}, Type: {manual_payment.payment_type}")
                    
                    # 🚨 PROCESS THE PAYMENT TO UPDATE BALANCES
                    process_payment_by_type(manual_payment)
                    print("✅ Payment processing completed")
                    
                    # Create a Payment record
                    Payment.objects.create(
                        member=member,
                        group=member.group,
                        amount=manual_payment.amount,
                        payment_method='manual',
                        manual_payment=manual_payment,
                        is_successful=True
                    )
                    print("✅ Payment record created")
                    
                    # Create transaction record
                    Transaction.objects.create(
                        member=member,
                        transaction_type=manual_payment.payment_type,
                        amount=manual_payment.amount,
                        description=f"Admin recorded payment - {manual_payment.reference_number}",
                        status='completed',
                        reference=f"ADMIN{manual_payment.id}"
                    )
                    print("✅ Transaction record created")
                
                # Return full payment details
                full_serializer = ManualPaymentSerializer(manual_payment)
                return Response({
                    'message': 'Payment recorded successfully and balances updated!',
                    'payment': full_serializer.data
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                print(f"❌ Error in admin payment recording: {str(e)}")
                return Response({
                    'error': f'Error recording payment: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminGrantLoanView(APIView):
    """Admin grants loan to member"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, member_id):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response({'error': 'Permission denied'}, status=403)
        
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            member = get_object_or_404(Member, id=member_id)
        
        serializer = LoanCreateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    loan_data = serializer.validated_data
                    loan_type = loan_data['loan_type']
                    amount = loan_data['amount']

                     # Handle historical loan parameters
                    is_historical_loan = loan_data.get('is_historical', False)
                    historical_weeks = loan_data.get('historical_weeks', 0)
                    first_interest_applied = loan_data.get('first_interest_applied', False)
                    loan_start_date = loan_data.get('loan_start_date')

                    
                    # Handle different loan types
                    if loan_type == 'regular':
                        # Create regular loan
                        loan = Loan.objects.create(
                            member=member,
                            group=member.group,
                            loan_type='regular',
                            amount=amount,
                            amount_granted=amount,
                            remaining_balance=amount,
                            purpose=loan_data.get('purpose', ''),
                            admin_notes=loan_data.get('admin_notes', ''),
                            status='active',
                            granted_by=request.user,
                            granted_at=timezone.now(),
                            last_interest_date=timezone.now()
                        )
                        
                        response_data = {
                            'message': 'Regular loan granted successfully',
                            'loan_id': loan.id,
                            'loan_type': 'regular',
                            'details': {
                                'amount_granted': float(loan.amount_granted),
                                'remaining_balance': float(loan.remaining_balance),
                                'first_interest_will_be_applied': 'After 4 weeks (2% of amount granted)',
                                'subsequent_interest': 'Every 4 weeks (2% of current balance)',
                                'penalty': '₦2,500 weekly for missed payments'
                            },
                            'loan': LoanSerializer(loan).data
                        }
                        
                    elif loan_type == 'investment':
                        # Create investment loan using InvestmentLoan model
                        investment_loan = InvestmentLoan.objects.create(
                            member=member,
                            group=member.group,
                            amount=amount,
                            outstanding_balance=amount,
                            interest_rate=Decimal('0.00'),  # No interest for investment loans
                            purpose=loan_data.get('purpose', ''),
                            status='active'
                        )
                        
                        response_data = {
                            'message': 'Investment loan granted successfully',
                            'loan_id': investment_loan.id,
                            'loan_type': 'investment',
                            'details': {
                                'amount_granted': float(investment_loan.amount),
                                'outstanding_balance': float(investment_loan.outstanding_balance),
                                'interest_rate': '0% (No interest applied)',
                                'notes': 'Investment loans have no interest or weekly penalties'
                            },
                            'loan': {
                                'id': investment_loan.id,
                                'amount': float(investment_loan.amount),
                                'outstanding_balance': float(investment_loan.outstanding_balance),
                                'interest_rate': float(investment_loan.interest_rate),
                                'purpose': investment_loan.purpose,
                                'status': investment_loan.status,
                                'created_at': investment_loan.created_at,
                                'loan_type': 'investment'
                            }
                        }
                    
                    else:
                        return Response({'error': 'Invalid loan type'}, status=400)
                    
                    return Response(response_data, status=status.HTTP_201_CREATED)
                    
            except Exception as e:
                return Response({'error': f'Error granting loan: {str(e)}'}, status=400)
        
        return Response(serializer.errors, status=400)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_manual_payments(request):
    """Get all manual payments for admin review (filtered by admin's group)"""
    if not (request.user.is_group_admin() or request.user.is_super_admin()):
        return Response(
            {'error': 'Permission denied'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Filter by admin's managed group if they are a group admin
    if request.user.is_group_admin():
        payments = ManualPayment.objects.filter(group=request.user.managed_group)
    else:
        payments = ManualPayment.objects.all()
    
    payments = payments.order_by('-created_at')
    serializer = ManualPaymentSerializer(payments, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manual_payment_history(request):
    """Get manual payment history for the current user"""
    try:
        member = request.user.member_profile
        payments = ManualPayment.objects.filter(member=member).order_by('-created_at')
        serializer = ManualPaymentSerializer(payments, many=True)
        return Response(serializer.data)
    
    except Member.DoesNotExist:
        return Response(
            {'error': 'Member profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )

def process_payment_by_type(payment):
    """Process payment based on payment type and update relevant balances"""
    try:
        member = payment.member
        amount = float(payment.amount)
        
        print(f"🔄 Processing {payment.payment_type} payment of ₦{amount} for {member.full_name}")
        
        # Check if payment is already processed
        if hasattr(payment, 'processed') and payment.processed:
            print("⚠️ Payment already processed, skipping...")
            return
        
        if payment.payment_type == 'outstanding_balance':
            print("🎯 Processing OUTSTANDING BALANCE payment")
            
            with transaction.atomic():
                remaining_payment = amount
                
                # Get active regular loans with balance
                active_loans = member.loans.filter(
                    status='active', 
                    loan_type='regular',
                    remaining_balance__gt=0
                ).order_by('created_at')
                
                print(f"📊 Found {active_loans.count()} active regular loans with balance")
                
                if not active_loans.exists():
                    print("❌ No active regular loans found for this member")
                    return
                
                loans_updated = []
                
                for loan in active_loans:
                    if remaining_payment <= 0:
                        break
                        
                    current_balance = float(loan.remaining_balance)
                    print(f"💳 Processing Loan {loan.id}: Balance=₦{current_balance}")
                    
                    if current_balance > 0:
                        payment_amount = min(remaining_payment, current_balance)
                        
                        # Update loan balance
                        loan.remaining_balance = current_balance - payment_amount
                        remaining_payment -= payment_amount
                        
                        # Create payment record
                        LoanPayment.objects.create(
                            loan=loan,
                            manual_payment=payment,
                            amount=payment_amount,
                            payment_type='repayment',
                            description=f"Payment from {payment.reference_number}"
                        )
                        
                        # Check if loan is paid off
                        if loan.remaining_balance <= 0:
                            loan.remaining_balance = 0
                            loan.status = 'completed'
                            print(f"🎉 Loan {loan.id} fully paid!")
                        
                        loan.save()
                        loans_updated.append(loan.id)
                        
                        print(f"✅ Applied ₦{payment_amount} to loan {loan.id}, New balance: ₦{loan.remaining_balance}")
                
                print(f"📈 Payment processing complete:")
                print(f"   Total applied: ₦{amount - remaining_payment}")
                print(f"   Remaining: ₦{remaining_payment}")
                print(f"   Loans updated: {loans_updated}")
                
        elif payment.payment_type == 'savings':
            print("💰 Processing SAVINGS payment")
            
            with transaction.atomic():
                # Get or create savings account
                savings_account, created = Savings.objects.get_or_create(member=member)
                
                print(f"📊 Current savings balance: ₦{savings_account.balance}")
                print(f"💵 Adding savings amount: ₦{amount}")
                
                # Update savings balance
                old_balance = savings_account.balance
                savings_account.balance += Decimal(amount)
                savings_account.save()
                
                print(f"✅ Savings updated:")
                print(f"   Previous: ₦{old_balance}")
                print(f"   New: ₦{savings_account.balance}")
                
        elif payment.payment_type == 'fixed_deposit':
            print("🏦 Processing FIXED DEPOSIT payment")
            
            with transaction.atomic():
                from datetime import timedelta
                from django.utils import timezone
                
                # Create fixed deposit
                fixed_deposit = FixedDeposit.objects.create(
                    member=member,
                    amount=Decimal(amount),
                    interest_rate=Decimal('5.00'),  # Default interest rate
                    duration_months=12,  # Default duration
                    start_date=timezone.now().date(),
                    is_active=True
                )
                
                # Calculate and set maturity date
                fixed_deposit.maturity_date = fixed_deposit.start_date + timedelta(days=fixed_deposit.duration_months * 30)
                fixed_deposit.save()
                
                print(f"✅ Fixed deposit created successfully:")
                print(f"   ID: {fixed_deposit.id}")
                print(f"   Amount: ₦{fixed_deposit.amount}")
                print(f"   Duration: {fixed_deposit.duration_months} months")
                print(f"   Interest: {fixed_deposit.interest_rate}%")
                print(f"   Matures: {fixed_deposit.maturity_date}")
                
        # FIXED: Investment Loan Payment Processing - DEDUCT FROM EXISTING LOANS
        elif payment.payment_type == 'investment_loan':
            print("📈 Processing INVESTMENT LOAN PAYMENT (repayment)")
            
            with transaction.atomic():
                remaining_payment = amount
                
                # Get active investment loans with outstanding balance
                active_investment_loans = member.investment_loans.filter(
                    status='active',
                    outstanding_balance__gt=0
                ).order_by('created_at')
                
                print(f"📊 Found {active_investment_loans.count()} active investment loans with balance")
                
                if not active_investment_loans.exists():
                    print("❌ No active investment loans found for this member")
                    # Optionally, you could create a new investment loan here if that's the intended behavior
                    # But for repayment, we expect existing loans
                    return
                
                loans_updated = []
                
                for investment_loan in active_investment_loans:
                    if remaining_payment <= 0:
                        break
                        
                    current_balance = float(investment_loan.outstanding_balance)
                    print(f"💳 Processing Investment Loan {investment_loan.id}: Balance=₦{current_balance}")
                    
                    if current_balance > 0:
                        payment_amount = min(remaining_payment, current_balance)
                        
                        # Update investment loan balance
                        investment_loan.outstanding_balance = current_balance - payment_amount
                        remaining_payment -= payment_amount
                        
                        # Create payment record (you might want to create a separate InvestmentLoanPayment model)
                        # For now, we'll use ManualPayment reference
                        print(f"💾 Recording payment of ₦{payment_amount} for investment loan {investment_loan.id}")
                        
                        # Check if investment loan is paid off
                        if investment_loan.outstanding_balance <= 0:
                            investment_loan.outstanding_balance = 0
                            investment_loan.status = 'completed'
                            print(f"🎉 Investment Loan {investment_loan.id} fully paid!")
                        
                        investment_loan.save()
                        loans_updated.append(investment_loan.id)
                        
                        print(f"✅ Applied ₦{payment_amount} to investment loan {investment_loan.id}, New balance: ₦{investment_loan.outstanding_balance}")
                
                print(f"📈 Investment loan payment processing complete:")
                print(f"   Total applied: ₦{amount - remaining_payment}")
                print(f"   Remaining: ₦{remaining_payment}")
                print(f"   Investment loans updated: {loans_updated}")
                
                if remaining_payment > 0:
                    print(f"💡 Excess payment ₦{remaining_payment} available for other investment loans")
                    
        else:
            print(f"⚠️ Payment type {payment.payment_type} not handled")
            return
        
        # Mark payment as processed after successful processing
        if hasattr(payment, 'processed'):
            payment.processed = True
            payment.save(update_fields=['processed'])
            print("✅ Payment marked as processed")
            
    except Exception as e:
        print(f"❌ ERROR in process_payment_by_type: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise

class MemberSavingsSummaryView(APIView):
    """Get savings summary and penalties for a member"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, member_id):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response({'error': 'Permission denied'}, status=403)
        
        if request.user.is_group_admin():
            member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
        else:
            member = get_object_or_404(Member, id=member_id)
        
        serializer = MemberSavingsSummarySerializer(member)
        return Response(serializer.data)

class AdminSavingsPenaltiesView(APIView):
    """Get all savings penalties (admin view)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if not (request.user.is_super_admin() or request.user.is_group_admin()):
            return Response({'error': 'Permission denied'}, status=403)
        
        if request.user.is_group_admin():
            penalties = SavingsPenalty.objects.filter(member__group=request.user.managed_group)
        else:
            penalties = SavingsPenalty.objects.all()
        
        penalties = penalties.order_by('-created_at')
        serializer = SavingsPenaltySerializer(penalties, many=True)
        
        return Response({
            'penalties': serializer.data,
            'total_count': penalties.count(),  # FIXED: was 'peenalties'
            'total_amount': penalties.aggregate(total=Sum('amount'))['total'] or 0
        })
class ProcessWeeklyLoanUpdates(APIView):
    """Process weekly updates for all active loans and savings"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        if not request.user.is_super_admin():
            return Response({'error': 'Permission denied'}, status=403)
        
        try:
            # Get all active loans (both regular and investment)
            active_regular_loans = Loan.objects.filter(status='active', loan_type='regular')
            active_investment_loans = InvestmentLoan.objects.filter(status='active')
            active_members = Member.objects.filter(status='active')
            
            results = {
                'first_interest_added': 0,
                'subsequent_interest_added': 0,
                'pending_loan_penalties': 0,
                'pending_savings_penalties': 0,
                'updated_loans': [],
                'penalized_members': []
            }
            
            current_week = timezone.now().isocalendar()[1]
            one_week_ago = timezone.now() - timedelta(days=7)
            
            # Process REGULAR loans only (investment loans don't have interest/penalties)
            for loan in active_regular_loans:
                updated = False
                
                # Increment interest weeks counter
                loan.interest_weeks += 1

                
                
                # Apply first interest after 4 weeks (based on amount granted)
                if loan.interest_weeks == 4 and not loan.first_interest_applied:
                    first_interest = loan.calculate_first_interest()
                    if first_interest > 0:
                        results['first_interest_added'] += 1
                        updated = True
                
                # Apply subsequent interest every 4 weeks after first (based on current balance)
                elif loan.interest_weeks >= 4 and loan.first_interest_applied:
                    if loan.interest_weeks % 4 == 0:
                        subsequent_interest = loan.calculate_subsequent_interest()
                        if subsequent_interest > 0:
                            results['subsequent_interest_added'] += 1
                            updated = True
                
                # Check if loan payment was made this week for REGULAR loans only
                recent_loan_payments = LoanPayment.objects.filter(
                    loan=loan,
                    created_at__gte=one_week_ago,
                    payment_type='repayment'
                )
                
                if not recent_loan_payments.exists():
                    # Accumulate ₦2500 penalty for regular loans only
                    loan.pending_penalty += Decimal('2500.00')
                    
                    LoanPayment.objects.create(
                        loan=loan,
                        amount=Decimal('2500.00'),
                        payment_type='penalty',
                        week_number=loan.interest_weeks,
                        is_pending=True,
                        description="Weekly penalty for missed loan payment"
                    )
                    results['pending_loan_penalties'] += 1
                    updated = True
                
                if updated:
                    loan.save()
                    results['updated_loans'].append({
                        'loan_id': loan.id,
                        'member': loan.member.full_name,
                        'loan_type': 'regular',
                        'remaining_balance': float(loan.remaining_balance)
                    })
            
            # Process savings penalties for ALL active members
            for member in active_members:
                # Check if ANY payment was made this week (not just savings)
                recent_payments = ManualPayment.objects.filter(
                    member=member,
                    status='confirmed',
                    created_at__gte=one_week_ago
                )
                
                if not recent_payments.exists():
                    # Only apply savings penalty if NO payments were made at all
                    member.pending_savings_penalty += Decimal('500.00')
                    
                    SavingsPenalty.objects.create(
                        member=member,
                        amount=Decimal('500.00'),
                        week_number=current_week,
                        is_pending=True,
                        description="Weekly penalty for missed savings contribution"
                    )
                    
                    member.last_savings_date = timezone.now()
                    member.save()
                    results['pending_savings_penalties'] += 1
                    results['penalized_members'].append({
                        'member_id': member.id,
                        'name': member.full_name
                    })
            
            return Response({
                'message': 'Weekly updates processed successfully',
                'results': results,
                'summary': {
                    'total_regular_loans_processed': active_regular_loans.count(),
                    'total_investment_loans': active_investment_loans.count(),  # For info only
                    'total_members_processed': active_members.count(),
                    'first_interest_added': results['first_interest_added'],
                    'subsequent_interest_added': results['subsequent_interest_added'],
                    'pending_loan_penalties': results['pending_loan_penalties'],
                    'pending_savings_penalties': results['pending_savings_penalties']
                }
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error processing weekly updates: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ========== PAYMENT PROCESSING ==========
class ProcessPaymentWithPenaltiesView(APIView):
    """Process payment while deducting any pending penalties first"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            member = request.user.member_profile
            serializer = ProcessPaymentSerializer(data=request.data)
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)
                
            data = serializer.validated_data
            payment_type = data['payment_type']
            amount = data['amount']
            
            with transaction.atomic():
                total_penalties = Decimal('0.00')
                applied_to_purpose = amount
                penalty_details = []
                
                # 1. First, deduct savings penalty if any
                if member.pending_savings_penalty > 0:
                    savings_penalty_deduction = min(amount, member.pending_savings_penalty)
                    if savings_penalty_deduction > 0:
                        amount -= savings_penalty_deduction
                        member.pending_savings_penalty -= savings_penalty_deduction
                        member.total_savings_penalties_paid += savings_penalty_deduction
                        total_penalties += savings_penalty_deduction
                        
                        # Mark the oldest pending savings penalty as paid
                        pending_penalty = member.savings_penalties.filter(is_pending=True).first()
                        if pending_penalty:
                            pending_penalty.is_pending = False
                            pending_penalty.paid_amount = savings_penalty_deduction
                            pending_penalty.paid_date = timezone.now()
                            pending_penalty.save()
                        
                        penalty_details.append({
                            'type': 'savings_penalty',
                            'amount': float(savings_penalty_deduction),
                            'description': '₦500 weekly savings penalty'
                        })
                
                # 2. If payment is for loan, deduct loan penalties
                if payment_type in ['outstanding_balance', 'investment_loan'] and amount > 0:
                    loan = None
                    is_investment = (payment_type == 'investment_loan')
                    
                    if is_investment:
                        # Get active investment loan
                        loan = member.investment_loans.filter(status='active').first()
                    else:
                        # Get active regular loan
                        loan = member.loans.filter(loan_type='regular', status='active').first()
                    
                    if loan and hasattr(loan, 'pending_penalty') and loan.pending_penalty > 0:
                        loan_penalty_deduction = min(amount, loan.pending_penalty)
                        if loan_penalty_deduction > 0:
                            amount -= loan_penalty_deduction
                            loan.pending_penalty -= loan_penalty_deduction
                            
                            if hasattr(loan, 'total_penalties_paid'):
                                loan.total_penalties_paid += loan_penalty_deduction
                                
                            total_penalties += loan_penalty_deduction
                            
                            # Handle penalty payment record based on loan type
                            if is_investment:
                                # For investment loans, you might want to create a different record
                                print(f"💳 Paid ₦{loan_penalty_deduction} investment loan penalty")
                            else:
                                # For regular loans, update LoanPayment record
                                pending_penalty_payment = loan.payments.filter(
                                    payment_type='penalty', 
                                    is_pending=True
                                ).first()
                                if pending_penalty_payment:
                                    pending_penalty_payment.is_pending = False
                                    pending_penalty_payment.paid_amount = loan_penalty_deduction
                                    pending_penalty_payment.paid_date = timezone.now()
                                    pending_penalty_payment.save()
                            
                            penalty_details.append({
                                'type': 'loan_penalty',
                                'amount': float(loan_penalty_deduction),
                                'description': '₦2,500 weekly loan penalty',
                                'loan_type': 'investment' if is_investment else 'regular'
                            })
                
                # 3. Apply remaining amount to the intended purpose
                remaining_amount = amount
                purpose_details = {}
                
                if remaining_amount > 0:
                    if payment_type == 'savings':
                        savings, created = Savings.objects.get_or_create(
                            member=member, 
                            defaults={'balance': Decimal('0.00')}
                        )
                        savings.balance += Decimal(remaining_amount)
                        savings.save()
                        purpose_details = {
                            'type': 'savings',
                            'amount': float(remaining_amount),
                            'new_balance': float(savings.balance)
                        }
                        
                    elif payment_type == 'outstanding_balance':
                        # Process regular loan payment
                        loan = member.loans.filter(loan_type='regular', status='active').first()
                        if loan:
                            payment_amount = min(remaining_amount, float(loan.remaining_balance))
                            
                            loan.remaining_balance -= Decimal(payment_amount)
                            
                            LoanPayment.objects.create(
                                loan=loan,
                                amount=Decimal(payment_amount),
                                payment_type='repayment',
                                description=f"Loan repayment from member payment"
                            )
                            
                            if loan.remaining_balance <= 0:
                                loan.remaining_balance = Decimal('0.00')
                                loan.status = 'completed'
                                print(f"🎉 Regular loan {loan.id} fully paid!")
                            
                            loan.save()
                            purpose_details = {
                                'type': 'loan_repayment',
                                'loan_type': 'regular',
                                'loan_id': loan.id,
                                'amount': float(payment_amount),
                                'remaining_balance': float(loan.remaining_balance)
                            }
                            
                    elif payment_type == 'investment_loan':
                        # Process investment loan payment
                        investment_loan = member.investment_loans.filter(status='active').first()
                        if investment_loan:
                            payment_amount = min(remaining_amount, float(investment_loan.outstanding_balance))
                            
                            investment_loan.outstanding_balance -= Decimal(payment_amount)
                            
                            # Create investment loan payment record (you might want a separate model)
                            print(f"💳 Investment loan payment: ₦{payment_amount} for loan {investment_loan.id}")
                            
                            if investment_loan.outstanding_balance <= 0:
                                investment_loan.outstanding_balance = Decimal('0.00')
                                investment_loan.status = 'completed'
                                print(f"🎉 Investment loan {investment_loan.id} fully paid!")
                            
                            investment_loan.save()
                            purpose_details = {
                                'type': 'loan_repayment',
                                'loan_type': 'investment',
                                'loan_id': investment_loan.id,
                                'amount': float(payment_amount),
                                'remaining_balance': float(investment_loan.outstanding_balance)
                            }
                
                member.save()
                
                manual_payment = ManualPayment.objects.create(
                    member=member,
                    group=member.group,
                    amount=applied_to_purpose,
                    payment_type=payment_type,
                    bank_name=data.get('bank_name', ''),
                    transaction_reference=data.get('transaction_reference', ''),
                    transfer_date=data.get('transfer_date'),
                    status='pending',  # This will be confirmed by admin later
                    penalty_details=penalty_details,
                    applied_to_purpose=purpose_details
                )
                
                return Response({
                    'message': 'Payment processed successfully',
                    'payment_details': {
                        'original_amount': float(applied_to_purpose),
                        'penalties_deducted': float(total_penalties),
                        'applied_to_purpose': float(remaining_amount),
                        'penalty_breakdown': penalty_details,
                        'purpose_breakdown': purpose_details,
                        'payment_id': manual_payment.id,
                        'reference_number': manual_payment.reference_number
                    }
                })
                
        except Member.DoesNotExist:
            return Response({'error': 'Member profile not found'}, status=404)
        except Exception as e:
            return Response(
                {'error': f'Error processing payment: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
# In your views.py - Add these endpoints

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_member_fixed_deposits(request, member_id):
    """Get all fixed deposits for a specific member (admin view)"""
    if not (request.user.is_super_admin() or request.user.is_group_admin()):
        return Response({'error': 'Permission denied'}, status=403)
    
    # For group admins, ensure they only access members from their managed group
    if request.user.is_group_admin():
        member = get_object_or_404(Member, id=member_id, group=request.user.managed_group)
    else:
        member = get_object_or_404(Member, id=member_id)
    
    # Get all fixed deposits for the member
    fixed_deposits = FixedDeposit.objects.filter(member=member).order_by('-created_at')
    
    # Serialize the data
    fixed_deposits_data = []
    for fd in fixed_deposits:
        fixed_deposits_data.append({
            'id': fd.id,
            'amount': float(fd.amount),
            'duration_months': fd.duration_months,
            'interest_rate': float(fd.interest_rate) if fd.interest_rate else 0.0,
            'start_date': fd.start_date,
            'maturity_date': fd.maturity_date,
            'is_active': fd.is_active,
            'collected_at': fd.collected_at,
            'created_at': fd.created_at,
        })
    
    return Response(fixed_deposits_data)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collect_fixed_deposit(request, fixed_deposit_id):
    """Mark a fixed deposit as collected"""
    if not (request.user.is_super_admin() or request.user.is_group_admin()):
        return Response({'error': 'Permission denied'}, status=403)

    try:
        fixed_deposit = FixedDeposit.objects.get(id=fixed_deposit_id)

        # Check if group admin has permission for this member's group
        if (request.user.is_group_admin() and
            fixed_deposit.member.group != request.user.managed_group):
            return Response({'error': 'You can only collect fixed deposits for your managed group'}, status=403)

        if not fixed_deposit.is_active:
            return Response({'error': 'Fixed deposit is already collected'}, status=400)

        # Mark as collected
        fixed_deposit.is_active = False
        fixed_deposit.collected_at = timezone.now()
        fixed_deposit.status = 'collected'  # Add this line
        fixed_deposit.save()

        return Response({
            'message': 'Fixed deposit marked as collected successfully',
            'fixed_deposit': {
                'id': fixed_deposit.id,
                'amount': float(fixed_deposit.amount),
                'collected_at': fixed_deposit.collected_at,
                'is_active': fixed_deposit.is_active,  # Add this
                'status': fixed_deposit.status  # Add this
            }
        })

    except FixedDeposit.DoesNotExist:
        return Response({'error': 'Fixed deposit not found'}, status=404)