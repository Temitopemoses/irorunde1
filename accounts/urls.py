from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView
from .views import GroupAdminCreateMemberView
from .views import get_csrf
from .views import PaymentListView
from .views import flutterwave_webhook
from django.http import JsonResponse


app_name = 'accounts'

urlpatterns = [
    path('accounts/register/', views.RegisterMemberView.as_view(), name='register'),
    path('create-member/', views.CreateMemberView.as_view(), name='create-member'),
    path('groups/', views.GroupListView.as_view(), name='group-list'),
    path('member-login/', views.MemberLoginView.as_view(), name='member-login'),
    path('csrf/', get_csrf, name='get_csrf'),
    path('flutterwave/webhook/', views.flutterwave_webhook, name='flutterwave-webhook'),
     path('flutterwave/initialize/', views.initialize_flutterwave_payment, name='initialize_flutterwave_payment'),
    path('flutterwave/verify/', views.verify_flutterwave_payment, name='verify_flutterwave_payment'),
    path('payments/', PaymentListView.as_view(), name='payment-list'),
    path('flutterwave/webhook/', flutterwave_webhook, name='flutterwave_webhook'),
    path('api/payment-history/', views.payment_history, name='payment_history'),





    
    # FIX: Remove the duplicate 'api/' prefix
    path('accounts/login/', views.GroupAdminLoginView.as_view(), name='group-admin-login'),
    path('accounts/group-admin/members/', GroupAdminCreateMemberView.as_view(), name='group-admin-create-member'),
    path('accounts/groups/', views.get_groups, name='get_groups'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', views.logout_view, name='logout'),
    path('current-user/', views.get_current_user, name='current-user'),
    path('dashboard/', views.MemberDashboardView.as_view(), name='member-dashboard'),
    path('make-contribution/', views.MakeContributionView.as_view(), name='make-contribution'),
    path('contribution-summary/', views.ContributionSummaryView.as_view(), name='contribution-summary'),
    path('superadmin-login/', views.SuperAdminLoginView.as_view(), name='superadmin-login'),
    path('accounts/group-admin/stats/', views.group_admin_stats, name='group_admin_stats'),
    path('accounts/group-admin/members/', views.group_admin_members, name='group_admin_members'),
    path('group-admins/create/', views.CreateGroupAdminView.as_view(), name='create-group-admin'),
    path('group-admins/', views.GroupAdminListView.as_view(), name='group-admin-list'),
    path('group-admins/<int:admin_id>/', views.GroupAdminDetailView.as_view(), name='group-admin-detail'),
]