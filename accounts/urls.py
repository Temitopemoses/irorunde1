from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    GroupAdminCreateMemberView, 
    get_csrf, 
    PaymentListView,
    AdminMemberDashboardView,
    AdminMemberPaymentsView,
    AdminMemberLoansView,
    AdminManualPaymentView,
    AdminGrantLoanView
)

app_name = 'accounts'

urlpatterns = [
    # ===== AUTHENTICATION & TOKEN MANAGEMENT =====
    path('auth/register/', views.RegisterMemberView.as_view(), name='register'),
    path('auth/create-member/', views.CreateMemberView.as_view(), name='create-member'),
    path('auth/member-login/', views.MemberLoginView.as_view(), name='member-login'),
    path('auth/superadmin-login/', views.SuperAdminLoginView.as_view(), name='superadmin-login'),
    path('auth/group-admin-login/', views.GroupAdminLoginView.as_view(), name='group-admin-login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/current-user/', views.get_current_user, name='current-user'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/csrf/', get_csrf, name='get-csrf'),
    path('api/payments/registration/', views.submit_registration_payment, name='registration-payment'),
    
    # ===== USER DASHBOARD & CONTRIBUTIONS =====
    path('user/dashboard/', views.MemberDashboardView.as_view(), name='member-dashboard'),
    path('user/make-contribution/', views.MakeContributionView.as_view(), name='make-contribution'),
    path('user/contribution-summary/', views.ContributionSummaryView.as_view(), name='contribution-summary'),
    path('user/payment-history/', views.payment_history, name='payment-history'),
    path('user/combined-payment-history/', views.combined_payment_history, name='combined-payment-history'),
    path('user/manual-payment/history/', views.manual_payment_history, name='manual-payment-history'),
    
    # ===== MANUAL PAYMENT SYSTEM =====
    path('payments/manual/', views.submit_manual_payment, name='manual-payment'),
    path('payments/group-account/', views.group_account_details, name='group-account'),
    
    # ===== LOAN & PENALTY MANAGEMENT =====
    path('admin/loans/weekly-updates/', views.ProcessWeeklyLoanUpdates.as_view(), name='weekly-loan-updates'),
    path('user/payments/process-with-penalties/', views.ProcessPaymentWithPenaltiesView.as_view(), name='process-payment-penalties'),
    path('admin/members/<int:member_id>/grant-loan/', views.AdminGrantLoanView.as_view(), name='grant-loan'),
    path('admin/members/<int:member_id>/savings-summary/', views.MemberSavingsSummaryView.as_view(), name='member-savings-summary'),
    path('admin/savings-penalties/', views.AdminSavingsPenaltiesView.as_view(), name='savings-penalties'),
    # ===== ADMIN MANAGEMENT =====
    # Group Management
    path('admin/groups/', views.GroupListView.as_view(), name='group-list'),
    # path('admin/groups/', views.get_groups, name='get-groups'),
    # Manual Payment Management
    path('admin/manual-payments/', views.admin_manual_payments, name='admin-manual-payments'),
    path('admin/payments/update-loan-balances/', views.update_loan_balances, name='update_loan_balances'),
    path('admin/manual-payments/<int:payment_id>/confirm/', views.confirm_manual_payment, name='confirm-manual-payment'),
    path('admin/manual-payments/<int:payment_id>/reject/', views.reject_manual_payment, name='reject-manual-payment'),
    path('admin/members/<int:member_id>/fixed-deposits/', views.admin_member_fixed_deposits, name='admin_member_fixed_deposits'),
    path('admin/fixed-deposits/<int:fixed_deposit_id>/collect/', views.collect_fixed_deposit, name='collect_fixed_deposit'),
    
    # Member Management
    path('admin/members/<int:member_id>/dashboard/', AdminMemberDashboardView.as_view(), name='admin-member-dashboard'),
    path('admin/members/<int:member_id>/payments/', AdminMemberPaymentsView.as_view(), name='admin-member-payments'),
    path('admin/members/<int:member_id>/loans/', AdminMemberLoansView.as_view(), name='admin-member-loans'),
    path('admin/members/<int:member_id>/record-payment/', AdminManualPaymentView.as_view(), name='admin-record-payment'),
    path('admin/members/<int:member_id>/grant-loan/', AdminGrantLoanView.as_view(), name='admin-grant-loan'),
    
    # ===== GROUP ADMIN SPECIFIC ENDPOINTS =====
    path('group-admin/stats/', views.group_admin_stats, name='group-admin-stats'),
    path('group-admin/members/', views.group_admin_members, name='group-admin-members'),
    path('group-admin/members/create/', GroupAdminCreateMemberView.as_view(), name='group-admin-create-member'),
    path('group-admin/report/<int:group_id>/', views.group_report, name='group-report'),
   
    # ===== SUPER ADMIN MANAGEMENT =====
    path('super-admin/group-admins/', views.GroupAdminListView.as_view(), name='group-admin-list'),
    path('super-admin/group-admins/create/', views.CreateGroupAdminView.as_view(), name='create-group-admin'),
    path('super-admin/group-admins/<int:admin_id>/', views.GroupAdminDetailView.as_view(), name='group-admin-detail'),
    
    # ===== PAYMENTS & REPORTING =====
    path('payments/', PaymentListView.as_view(), name='payment-list'),
    
    # ===== LEGACY/COMPATIBILITY ENDPOINTS =====
    # Keeping these for backward compatibility
    path('accounts/register/', views.RegisterMemberView.as_view(), name='register-legacy'),
    path('accounts/login/', views.GroupAdminLoginView.as_view(), name='group-admin-login-legacy'),
    path('accounts/groups/', views.get_groups, name='get_groups-legacy'),
    path('accounts/group-admin/stats/', views.group_admin_stats, name='group_admin_stats-legacy'),
    path('accounts/group-admin/members/', views.group_admin_members, name='group_admin_members-legacy'),
    path('api/payment-history/', views.payment_history, name='payment_history-legacy'),
]