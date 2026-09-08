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

urlpatterns = [
    path('admin/', admin.site.urls),
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
