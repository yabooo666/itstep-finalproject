from django.db import models
from django.contrib.auth.models import User
from vehicles.models import Vehicle, RentalBooking


class ChatRoom(models.Model):
    """
    Direct communication room between a rental customer and vehicle owner.
    Optionally linked to a specific RentalBooking and Vehicle.
    """
    booking = models.ForeignKey(
        RentalBooking, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='chat_rooms'
    )
    vehicle = models.ForeignKey(
        Vehicle, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='chat_rooms'
    )
    customer = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='customer_rooms'
    )
    seller = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='seller_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Chat Room'
        verbose_name_plural = 'Chat Rooms'

    def __str__(self):
        car_str = f"{self.vehicle.brand} {self.vehicle.model}" if self.vehicle else "Vehicle Inquiry"
        return f"Chat #{self.id}: {self.customer.username} & {self.seller.username} ({car_str})"

    def get_other_user(self, current_user):
        """Returns the conversation partner for the provided user."""
        if current_user == self.customer:
            return self.seller
        return self.customer

    def get_unread_count_for(self, user):
        """Returns count of unread messages for the given user in this room."""
        return self.messages.filter(is_read=False).exclude(sender=user).count()

    def get_last_message(self):
        """Returns the most recent message in this room."""
        return self.messages.order_by('-created_at').first()


class ChatMessage(models.Model):
    """
    Individual message sent within a ChatRoom.
    """
    room = models.ForeignKey(
        ChatRoom, 
        on_delete=models.CASCADE, 
        related_name='messages'
    )
    sender = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='sent_chat_messages'
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'

    def __str__(self):
        return f"[{self.created_at.strftime('%H:%M')}] {self.sender.username}: {self.content[:30]}"
