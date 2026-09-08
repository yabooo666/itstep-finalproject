"""
URL configuration for core project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from accounts import views as accounts_views
from vehicles import views as vehicles_views
from . import views
from . import boss_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('boss/', boss_views.boss_dashboard, name='boss_dashboard'),
    path('boss/approve/<int:vehicle_id>/', boss_views.boss_approve_vehicle, name='boss_approve_vehicle'),
    path('boss/reject/<int:vehicle_id>/', boss_views.boss_reject_vehicle, name='boss_reject_vehicle'),
    path('boss/users/<int:user_id>/toggle-privilege/', boss_views.boss_toggle_user_privilege, name='boss_toggle_user_privilege'),
    path('boss/users/<int:user_id>/toggle-ban/', boss_views.boss_toggle_user_ban, name='boss_toggle_user_ban'),
    path('boss/users/<int:user_id>/delete/', boss_views.boss_delete_user, name='boss_delete_user'),
    path('ban/', boss_views.boss_audit_logs, name='boss_audit_logs'),
    path('accounts/', include('accounts.urls')),
    path('profile/', accounts_views.profile_view, name='profile_direct'),
    path('vehicles/', include('vehicles.urls')),
    path('favourites/', vehicles_views.favourites_view, name='favourites'),
    path('', views.home, name='home'),
    path('notifications/', views.notifications, name='notifications'),
    path('chat/', views.chat, name='chat'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
