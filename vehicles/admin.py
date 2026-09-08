from django.contrib import admin
from .models import Vehicle, UserFavourite, UserRecentView, RentalBooking


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('id', 'brand', 'model', 'year', 'daily_price', 'price_per_hour', 'transmission', 'city', 'is_active')
    list_filter = ('brand', 'city', 'year', 'transmission', 'is_active')
    search_fields = ('brand', 'model', 'trim', 'location_name', 'owner_phone')
    list_editable = ('daily_price', 'is_active')


@admin.register(RentalBooking)
class RentalBookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'vehicle', 'city', 'rental_days', 'daily_price', 'total_price', 'status', 'created_at')
    list_filter = ('city', 'status', 'created_at')
    search_fields = ('user__username', 'vehicle__brand', 'vehicle__model', 'city')


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

