from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView


app_name = 'accounts'

urlpatterns = [
    path('accounts/register/', views.RegisterMemberView.as_view(), name='register'),
    path('create-member/', views.CreateMemberView.as_view(), name='create-member'),
    path('groups/', views.GroupListView.as_view(), name='group-list'),
    path('member-login/', views.MemberLoginView.as_view(), name='member-login'),
    path('api/accounts/groups/', views.get_groups, name='get_groups'),
    # Keep these for token management
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', views.logout_view, name='logout'),
    path('current-user/', views.get_current_user, name='current-user'),
    
    # Dashboard endpoints
    path('dashboard/', views.MemberDashboardView.as_view(), name='member-dashboard'),
    path('make-contribution/', views.MakeContributionView.as_view(), name='make-contribution'),
    path('contribution-summary/', views.ContributionSummaryView.as_view(), name='contribution-summary'),
    path('superadmin-login/', views.SuperAdminLoginView.as_view(), name='superadmin-login'),

    # Admin management endpoints
path('group-admins/create/', views.CreateGroupAdminView.as_view(), name='create-group-admin'),
path('group-admins/', views.GroupAdminListView.as_view(), name='group-admin-list'),
path('group-admins/<int:admin_id>/', views.GroupAdminDetailView.as_view(), name='group-admin-detail'),

]