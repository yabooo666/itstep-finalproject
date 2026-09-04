"""
URL configuration for core project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('vehicles/', views.vehicles, name='vehicles'),
    path('favourites/', views.favourites, name='favourites'),
    path('notifications/', views.notifications, name='notifications'),
    path('chat/', views.chat, name='chat'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
