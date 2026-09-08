"""
Admin & Moderation Views for Gruzin Auto (/boss and /ban)
Accessible only by staff/superuser accounts.
Handles:
- Vehicle listing review (Pending, Approved, Rejected)
- User privilege management (ROOT / Member) and account deletion/ban
- Security Audit Logging (/ban) of all administrative actions
"""

import json
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from vehicles.models import Vehicle, RentalBooking
from accounts.models import Notification, AdminAuditLog, log_admin_action


def admin_required(view_func):
    """Decorator ensuring current user is authenticated and is staff or superuser."""
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('/vehicles/?auth=login')
        if not (request.user.is_staff or request.user.is_superuser):
            return HttpResponseForbidden("Access Denied: ROOT/Admin privileges required.")
        return view_func(request, *args, **kwargs)
    return _wrapped_view


@admin_required
def boss_dashboard(request):
    """
    Renders the ROOT / Boss Moderation Dashboard.
    Provides vehicle review queue (Pending, Approved, Rejected),
    User Management tab (privileges & account ban/delete),
    and high-level platform statistics.
    """
    pending_vehicles = (
        Vehicle.objects.filter(status='pending')
        .select_related('owner')
        .order_by('-created_at')
    )
    approved_vehicles = (
        Vehicle.objects.filter(status='approved')
        .select_related('owner', 'reviewed_by')
        .order_by('-reviewed_at', '-created_at')[:50]
    )
    rejected_vehicles = (
        Vehicle.objects.filter(status='rejected')
        .select_related('owner', 'reviewed_by')
        .order_by('-reviewed_at', '-created_at')[:50]
    )

    # 2. User Management list
    all_users = User.objects.all().select_related('profile').order_by('-date_joined')
    users_data = []
    for u in all_users:
        phone = u.profile.phone_number if hasattr(u, 'profile') else ''
        users_data.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'full_name': u.get_full_name() or u.username,
            'phone': phone,
            'is_staff': u.is_staff,
            'is_superuser': u.is_superuser,
            'is_active': u.is_active,
            'date_joined': u.date_joined,
            'vehicles_count': u.listed_vehicles.count(),
            'rentals_count': RentalBooking.objects.filter(user=u).count(),
        })

    stats = {
        'pending_count': pending_vehicles.count(),
        'approved_count': Vehicle.objects.filter(status='approved').count(),
        'rejected_count': Vehicle.objects.filter(status='rejected').count(),
        'total_count': Vehicle.objects.count(),
        'users_count': len(users_data),
        'admins_count': sum(1 for u in users_data if u['is_staff'] or u['is_superuser']),
    }

    pending_list = [v.to_dict() for v in pending_vehicles]

    context = {
        'pending_vehicles': pending_vehicles,
        'pending_vehicles_json': pending_list,
        'approved_vehicles': approved_vehicles,
        'rejected_vehicles': rejected_vehicles,
        'users_list': users_data,
        'stats': stats,
    }
    return render(request, 'boss/dashboard.html', context)


@require_http_methods(["POST"])
@admin_required
def boss_approve_vehicle(request, vehicle_id):
    """
    Approves a vehicle announcement:
    - Sets status='approved'
    - Sets is_active=True
    - Sets reviewed_by and reviewed_at
    - Logs action into AdminAuditLog
    - Sends in-app notification to the vehicle owner
    """
    vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
    vehicle.status = 'approved'
    vehicle.is_active = True
    vehicle.reviewed_by = request.user
    vehicle.reviewed_at = timezone.now()
    vehicle.rejection_reason = ''
    vehicle.save()

    # Log to AdminAuditLog
    log_admin_action(
        request,
        action='CONFIRM_VEHICLE',
        target_type='Vehicle',
        target_id=vehicle.id,
        target_title=f"{vehicle.brand} {vehicle.model} ({vehicle.year})",
        details=f"Approved and published to public catalog. Owner: {vehicle.owner.username if vehicle.owner else 'System'}."
    )

    # Notify vehicle owner
    if vehicle.owner:
        Notification.objects.create(
            user=vehicle.owner,
            title="Listing Approved!",
            message=f"Congratulations! Your {vehicle.brand} {vehicle.model} ({vehicle.year}) has been verified and published to the catalog.",
            notification_type='approval',
            link_url=f"/vehicles/?q={vehicle.model}"
        )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f"{vehicle.brand} {vehicle.model} has been approved and published.",
            'vehicle_id': vehicle.id
        })

    return redirect('/boss/')


@require_http_methods(["POST"])
@admin_required
def boss_reject_vehicle(request, vehicle_id):
    """
    Rejects a vehicle announcement with reason:
    - Sets status='rejected'
    - Sets is_active=False
    - Stores rejection_reason
    - Sets reviewed_by and reviewed_at
    - Logs action into AdminAuditLog
    - Sends in-app notification to the vehicle owner with rejection reason
    """
    vehicle = get_object_or_404(Vehicle, pk=vehicle_id)

    reason = ''
    if request.content_type == 'application/json':
        try:
            body = json.loads(request.body.decode('utf-8'))
            reason = body.get('reason', '').strip()
        except Exception:
            pass
    if not reason:
        reason = request.POST.get('reason', '').strip()
    if not reason:
        reason = "Listing does not satisfy Gruzin Auto vehicle specification or model requirements."

    vehicle.status = 'rejected'
    vehicle.is_active = False
    vehicle.rejection_reason = reason
    vehicle.reviewed_by = request.user
    vehicle.reviewed_at = timezone.now()
    vehicle.save()

    # Log to AdminAuditLog
    log_admin_action(
        request,
        action='REJECT_VEHICLE',
        target_type='Vehicle',
        target_id=vehicle.id,
        target_title=f"{vehicle.brand} {vehicle.model} ({vehicle.year})",
        details=f"Reason: {reason}"
    )

    # Notify vehicle owner
    if vehicle.owner:
        Notification.objects.create(
            user=vehicle.owner,
            title="Listing Rejected",
            message=f"Your submission for {vehicle.brand} {vehicle.model} ({vehicle.year}) was rejected. Reason: {reason}",
            notification_type='rejection',
            link_url="/profile/"
        )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f"{vehicle.brand} {vehicle.model} was rejected.",
            'vehicle_id': vehicle.id,
            'reason': reason
        })

    return redirect('/boss/')


@require_http_methods(["POST"])
@admin_required
def boss_toggle_user_privilege(request, user_id):
    """
    Promotes a user to ROOT (is_staff=True, is_superuser=True)
    or demotes them back to Member (is_staff=False, is_superuser=False).
    Prevents modifying self.
    """
    target_user = get_object_or_404(User, pk=user_id)

    if target_user == request.user:
        return JsonResponse({'success': False, 'error': 'You cannot modify your own administrative privileges.'}, status=400)

    new_is_staff = not target_user.is_staff
    target_user.is_staff = new_is_staff
    target_user.is_superuser = new_is_staff
    target_user.save()

    action = 'PROMOTE_USER' if new_is_staff else 'DEMOTE_USER'
    details = f"Admin privilege {'granted (ROOT)' if new_is_staff else 'revoked (Member)'}."
    log_admin_action(
        request,
        action=action,
        target_type='User',
        target_id=target_user.id,
        target_title=target_user.email or target_user.username,
        details=details
    )

    # Send in-app notification to target user
    Notification.objects.create(
        user=target_user,
        title="Role Privileges Updated",
        message=f"Your account role has been updated to {'ROOT / Administrator' if new_is_staff else 'Regular Member'}.",
        notification_type='system',
        link_url='/boss/' if new_is_staff else '/'
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'user_id': target_user.id,
            'is_staff': target_user.is_staff,
            'message': f"Updated {target_user.username} privileges."
        })

    return redirect('/boss/')


@require_http_methods(["POST"])
@admin_required
def boss_toggle_user_ban(request, user_id):
    """
    Bans (is_active=False) or unbans (is_active=True) a user account.
    Prevents banning self.
    """
    target_user = get_object_or_404(User, pk=user_id)

    if target_user == request.user:
        return JsonResponse({'success': False, 'error': 'You cannot ban your own account.'}, status=400)

    new_active = not target_user.is_active
    target_user.is_active = new_active
    target_user.save()

    action = 'UNBAN_USER' if new_active else 'BAN_USER'
    details = f"Account status set to {'ACTIVE' if new_active else 'BANNED / DEACTIVATED'}."
    log_admin_action(
        request,
        action=action,
        target_type='User',
        target_id=target_user.id,
        target_title=target_user.email or target_user.username,
        details=details
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'user_id': target_user.id,
            'is_active': target_user.is_active,
            'message': f"User {target_user.username} {'unbanned' if new_active else 'banned'}."
        })

    return redirect('/boss/')


@require_http_methods(["POST"])
@admin_required
def boss_delete_user(request, user_id):
    """
    Permanently deletes a user account.
    Prevents deleting self.
    """
    target_user = get_object_or_404(User, pk=user_id)

    if target_user == request.user:
        return JsonResponse({'success': False, 'error': 'You cannot delete your own account.'}, status=400)

    user_repr = target_user.email or target_user.username
    log_admin_action(
        request,
        action='DELETE_USER',
        target_type='User',
        target_id=target_user.id,
        target_title=user_repr,
        details="Permanently deleted user account from database."
    )
    target_user.delete()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f"User {user_repr} deleted permanently."
        })

    return redirect('/boss/')


@admin_required
def boss_audit_logs(request):
    """
    Renders the Audit Logs view at /ban.
    Displays immutable timeline of all administrative actions:
    who did what, action type, target item, IP address, and details.
    """
    logs_qs = AdminAuditLog.objects.select_related('admin').all()

    # Filter by action type
    action_filter = request.GET.get('action', '').strip()
    if action_filter:
        logs_qs = logs_qs.filter(action=action_filter)

    # Search keyword
    q = request.GET.get('q', '').strip()
    if q:
        logs_qs = logs_qs.filter(
            Q(target_title__icontains=q) |
            Q(details__icontains=q) |
            Q(admin__username__icontains=q) |
            Q(admin__email__icontains=q) |
            Q(ip_address__icontains=q)
        )

    logs = logs_qs[:100]

    context = {
        'logs': logs,
        'logs_count': logs_qs.count(),
        'action_choices': AdminAuditLog.ACTION_CHOICES,
        'selected_action': action_filter,
        'search_query': q,
    }
    return render(request, 'boss/logs.html', context)
