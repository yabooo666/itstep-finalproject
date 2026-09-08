from django.db import models
from django.contrib.auth.models import User


class Vehicle(models.Model):
    """
    Represents a rental vehicle in the Gruzin Auto catalog.
    """
    TRANSMISSION_CHOICES = [
        ('Automatic', 'Automatic'),
        ('Manual', 'Manual'),
        ('Tiptronic', 'Tiptronic'),
    ]

    owner = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='listed_vehicles'
    )
    owner_phone = models.CharField(
        max_length=20, 
        blank=True, 
        help_text="Contact phone number auto-filled from owner profile"
    )
    brand = models.CharField(max_length=64, db_index=True)
    model = models.CharField(max_length=64, db_index=True)
    trim = models.CharField(max_length=128, blank=True)
    price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=15.00)
    daily_price = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        default=90.00,
        help_text="Daily rental price in GEL (₾)"
    )
    transmission = models.CharField(
        max_length=32, 
        choices=TRANSMISSION_CHOICES, 
        default='Automatic'
    )
    fuel_capacity = models.PositiveIntegerField(
        default=60, 
        help_text="Fuel tank capacity in Liters (L)"
    )
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=5.0)
    review_count = models.PositiveIntegerField(default=0)
    model_3d = models.CharField(
        max_length=255, 
        blank=True,
        help_text="Path under static/ (e.g. models/bmw_m4_convertible_g83_2021.glb)"
    )
    model_3d_file = models.FileField(
        upload_to='models/', 
        blank=True, 
        null=True, 
        help_text="Uploaded .glb 3D car model"
    )
    image_1 = models.ImageField(upload_to='vehicles/', blank=True, null=True)
    image_2 = models.ImageField(upload_to='vehicles/', blank=True, null=True)
    image_3 = models.ImageField(upload_to='vehicles/', blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, default='images/bmw_m4.png')
    lat = models.FloatField(help_text="Latitude coordinate for map pin", default=41.7151)
    lng = models.FloatField(help_text="Longitude coordinate for map pin", default=44.8271)
    location_name = models.CharField(max_length=128, default="Rustaveli Ave, Tbilisi")
    city = models.CharField(max_length=64, default="Tbilisi", db_index=True)
    year = models.PositiveIntegerField(default=2024)
    seats = models.PositiveIntegerField(default=4)
    distance = models.CharField(max_length=32, default="100m")
    walk_time = models.CharField(max_length=32, default="3 min")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        verbose_name = 'Vehicle'
        verbose_name_plural = 'Vehicles'

    def __str__(self):
        return f"{self.brand} {self.model} ({self.year})"

    def get_model_url(self):
        """Returns the runtime URL for the .glb 3D model."""
        if self.model_3d_file:
            return self.model_3d_file.url
        if self.model_3d:
            if self.model_3d.startswith('/') or self.model_3d.startswith('http'):
                return self.model_3d
            return f"/static/{self.model_3d}"
        return "/static/models/bmw_m4_convertible_g83_2021.glb"

    def get_images(self):
        """Returns a list of image URLs (up to 3) for galleries and cards."""
        images = []
        if self.image_1:
            images.append(self.image_1.url)
        if self.image_2:
            images.append(self.image_2.url)
        if self.image_3:
            images.append(self.image_3.url)
        if not images and self.image_url:
            images.append(f"/static/{self.image_url}")
        return images

    def get_primary_image(self):
        images = self.get_images()
        return images[0] if images else "/static/images/bmw_m4.png"

    def to_dict(self, is_favourite=False):
        """Converts vehicle record to JSON-serializable dictionary for templates & map."""
        return {
            'id': self.id,
            'brand': self.brand,
            'model': self.model,
            'trim': self.trim,
            'price_per_hour': str(self.price_per_hour),
            'daily_price': str(self.daily_price),
            'transmission': self.transmission,
            'fuel_capacity': self.fuel_capacity,
            'rating': str(self.rating),
            'review_count': self.review_count,
            'model_3d': self.get_model_url(),
            'primary_image': self.get_primary_image(),
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


class RentalBooking(models.Model):
    """
    Stores car rental orders created by users.
    Tracks city, rental duration, and calculated total amount paid.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rentals')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='bookings')
    city = models.CharField(max_length=64, help_text="City where the car is rented")
    rental_days = models.PositiveIntegerField(default=1, help_text="Rental duration in days")
    daily_price = models.DecimalField(max_digits=8, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total calculated price")
    status = models.CharField(max_length=32, default='Confirmed')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Rental Booking'
        verbose_name_plural = 'Rental Bookings'

    def __str__(self):
        return f"Booking #{self.id}: {self.user.username} - {self.vehicle} ({self.rental_days} days in {self.city})"


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
