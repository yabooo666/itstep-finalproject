from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """
    Extends Django's User model with phone number and profile metadata.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(
        max_length=20, 
        unique=True, 
        db_index=True,
        help_text="Georgian phone number (e.g. 591299899 or +995591299899)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.phone_number})"


class Notification(models.Model):
    """
    Stores in-app notifications for users (e.g. car rentals, listing approvals, rejections).
    """
    TYPE_CHOICES = [
        ('rental', 'Rental Booking'),
        ('approval', 'Listing Approved'),
        ('rejection', 'Listing Rejected'),
        ('system', 'System Notification'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=128)
    message = models.TextField()
    notification_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default='system')
    link_url = models.CharField(max_length=255, blank=True, default='')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"[{self.notification_type}] {self.user.username}: {self.title}"


def get_client_ip(request):
    """Extracts client IP address from request."""
    if not request:
        return ''
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


class AdminAuditLog(models.Model):
    """
    Stores immutable security audit trail logs of administrative actions:
    Confirming/rejecting cars, hiding/unhiding cars, deleting cars,
    changing user privileges, banning/unbanning users, and deleting accounts.
    """
    ACTION_CHOICES = [
        ('CONFIRM_VEHICLE', 'Confirmed / Published Vehicle'),
        ('REJECT_VEHICLE', 'Rejected Vehicle Submission'),
        ('HIDE_VEHICLE', 'Temporarily Hid Vehicle'),
        ('UNHIDE_VEHICLE', 'Unhid / Restored Vehicle'),
        ('DELETE_VEHICLE', 'Deleted Vehicle'),
        ('PROMOTE_USER', 'Granted ROOT / Admin Privileges'),
        ('DEMOTE_USER', 'Demoted to Regular Member'),
        ('BAN_USER', 'Banned / Deactivated User'),
        ('UNBAN_USER', 'Unbanned / Activated User'),
        ('DELETE_USER', 'Deleted User Account'),
    ]

    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    target_type = models.CharField(max_length=32, db_index=True)  # e.g. 'Vehicle', 'User'
    target_id = models.CharField(max_length=64, blank=True)
    target_title = models.CharField(max_length=255, blank=True)
    details = models.TextField(blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Admin Audit Log'
        verbose_name_plural = 'Admin Audit Logs'

    def __str__(self):
        admin_name = self.admin.username if self.admin else 'System'
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {admin_name} -> {self.action}: {self.target_title}"


def log_admin_action(request, action, target_type, target_id, target_title, details=''):
    """Helper to cleanly log an admin action into AdminAuditLog."""
    admin_user = request.user if (request and request.user.is_authenticated) else None
    ip = get_client_ip(request) if request else ''
    return AdminAuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        target_title=str(target_title),
        details=str(details),
        ip_address=ip
    )

