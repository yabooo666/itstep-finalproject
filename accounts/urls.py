from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('activate/<str:uidb64>/<str:token>/', views.activate_account_view, name='activate_account'),
    path('resend-activation/', views.resend_activation_view, name='resend_activation'),
    path('notifications/api/list/', views.notifications_api_list, name='notifications_api_list'),
    path('notifications/api/read-all/', views.notifications_api_read_all, name='notifications_api_read_all'),
]
