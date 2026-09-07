from django.contrib import admin
from .models import Vehicle, UserFavourite, UserRecentView


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('id', 'brand', 'model', 'year', 'price_per_hour', 'rating', 'city', 'is_active')
    list_filter = ('brand', 'city', 'year', 'is_active')
    search_fields = ('brand', 'model', 'trim', 'location_name')
    list_editable = ('price_per_hour', 'is_active')


@admin.register(UserFavourite)
class UserFavouriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle', 'created_at')
    search_fields = ('user__username', 'user__email', 'vehicle__brand', 'vehicle__model')
    list_filter = ('created_at',)


@admin.register(UserRecentView)
class UserRecentViewAdmin(admin.ModelAdmin):
    list_display = ('user', 'session_key', 'vehicle', 'viewed_at')
    search_fields = ('user__username', 'vehicle__brand', 'vehicle__model', 'session_key')
    list_filter = ('viewed_at',)
