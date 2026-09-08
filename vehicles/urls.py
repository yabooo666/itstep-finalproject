from django.urls import path
from . import views

urlpatterns = [
    path('', views.catalog_view, name='vehicles'),
    path('add/', views.add_vehicle_view, name='add_vehicle'),
    path('favourites/', views.favourites_view, name='favourites'),
    path('<int:vehicle_id>/', views.vehicle_detail_view, name='vehicle_detail'),
    path('<int:vehicle_id>/rent/', views.rent_vehicle_view, name='rent_vehicle'),
    path('<int:vehicle_id>/favourite/', views.toggle_favourite_view, name='toggle_favourite'),
    path('<int:vehicle_id>/track-view/', views.track_recent_view, name='track_recent_view'),
]
