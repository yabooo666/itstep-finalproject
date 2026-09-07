from django.db import models
from django.contrib.auth.models import User


class Vehicle(models.Model):
    """
    Represents a rental vehicle in the Gruzin Auto catalog.
    """
    brand = models.CharField(max_length=64, db_index=True)
    model = models.CharField(max_length=64, db_index=True)
    trim = models.CharField(max_length=128, blank=True)
    price_per_hour = models.DecimalField(max_digits=8, decimal_places=2)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=5.0)
    review_count = models.PositiveIntegerField(default=0)
    model_3d = models.CharField(
        max_length=255, 
        help_text="Path under static/ (e.g. models/bmw_m4_convertible_g83_2021.glb)"
    )
    lat = models.FloatField(help_text="Latitude coordinate for map pin")
    lng = models.FloatField(help_text="Longitude coordinate for map pin")
    location_name = models.CharField(max_length=128, help_text="Street or district in Tbilisi")
    city = models.CharField(max_length=64, default="Tbilisi", db_index=True)
    year = models.PositiveIntegerField(default=2024)
    seats = models.PositiveIntegerField(default=4)
    distance = models.CharField(max_length=32, default="100m")
    walk_time = models.CharField(max_length=32, default="3 min")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'Vehicle'
        verbose_name_plural = 'Vehicles'

    def __str__(self):
        return f"{self.brand} {self.model} ({self.year})"

    def to_dict(self, is_favourite=False):
        """Converts vehicle record to JSON-serializable dictionary for templates & map."""
        return {
            'id': self.id,
            'brand': self.brand,
            'model': self.model,
            'trim': self.trim,
            'price_per_hour': str(self.price_per_hour),
            'rating': str(self.rating),
            'review_count': self.review_count,
            'model_3d': self.model_3d,
            'lat': self.lat,
            'lng': self.lng,
            'location_name': self.location_name,
            'city': self.city,
            'year': self.year,
            'seats': self.seats,
            'distance': self.distance,
            'walk_time': self.walk_time,
            'is_favourite': is_favourite,
        }


class UserFavourite(models.Model):
    """
    Stores saved favourite vehicles for a registered user.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favourite_records')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='favourited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'vehicle')
        ordering = ['-created_at']
        verbose_name = 'User Favourite'
        verbose_name_plural = 'User Favourites'

    def __str__(self):
        return f"{self.user.username} ❤️ {self.vehicle}"


class UserRecentView(models.Model):
    """
    Tracks vehicle views for logged-in users and guest sessions in real time.
    """
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='recent_views'
    )
    session_key = models.CharField(max_length=40, null=True, blank=True, db_index=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='recent_view_records')
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-viewed_at']
        verbose_name = 'Recent Vehicle View'
        verbose_name_plural = 'Recent Vehicle Views'

    def __str__(self):
        actor = self.user.username if self.user else f"Session:{self.session_key[:8]}"
        return f"{actor} viewed {self.vehicle} at {self.viewed_at.strftime('%H:%M:%S')}"
