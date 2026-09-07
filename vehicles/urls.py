from django.urls import path
from . import views

urlpatterns = [
    path('', views.catalog_view, name='vehicles'),
    path('favourites/', views.favourites_view, name='favourites'),
    path('<int:vehicle_id>/favourite/', views.toggle_favourite_view, name='toggle_favourite'),
    path('<int:vehicle_id>/track-view/', views.track_recent_view, name='track_recent_view'),
]
