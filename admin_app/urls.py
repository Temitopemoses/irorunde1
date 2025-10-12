from django.urls import path
from .views import admin_dashboard, create_member
from django.urls import path, include



urlpatterns = [
    path('dashboard/', admin_dashboard, name='admin_dashboard'),
    path('create-member/', create_member, name='create_member'),
      path('api/accounts/', include('accounts.urls')),
    path('api/admin/', include('admin_app.urls')),  

]
