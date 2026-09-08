import json
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .models import ChatRoom, ChatMessage
from accounts.models import Notification


@login_required(login_url='/vehicles/?auth=login')
def chat_view(request):
    """
    Renders the live messenger view (/chat/) between customers and vehicle owners.
    """
    user_rooms = (
        ChatRoom.objects.filter(Q(customer=request.user) | Q(seller=request.user))
        .select_related('customer', 'seller', 'vehicle', 'booking')
        .order_by('-updated_at')
    )

    room_id = request.GET.get('room')
    active_room = None
    messages = []

    if room_id:
        active_room = user_rooms.filter(id=room_id).first()
    if not active_room and user_rooms.exists():
        active_room = user_rooms.first()

    if active_room:
        # Mark unread messages as read
        active_room.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        messages = list(active_room.messages.select_related('sender').all())

    # Build room metadata items with partner details and unread badges
    rooms_data = []
    for r in user_rooms:
        partner = r.get_other_user(request.user)
        last_msg = r.get_last_message()
        unread_count = r.get_unread_count_for(request.user)
        rooms_data.append({
            'room': r,
            'partner': partner,
            'last_msg': last_msg,
            'unread_count': unread_count,
            'is_active': active_room and (r.id == active_room.id),
        })

    context = {
        'rooms_data': rooms_data,
        'active_room': active_room,
        'active_partner': active_room.get_other_user(request.user) if active_room else None,
        'messages': messages,
    }
    return render(request, 'chat/chat.html', context)


@login_required(login_url='/vehicles/?auth=login')
@require_http_methods(["POST"])
def send_message_api(request, room_id):
    """
    AJAX endpoint to send a message within a chat room.
    """
    room = get_object_or_404(ChatRoom, pk=room_id)
    if request.user != room.customer and request.user != room.seller:
        return HttpResponseForbidden("Not authorized to post in this room.")

    try:
        data = json.loads(request.body.decode('utf-8'))
        content = data.get('content', '').strip()
    except Exception:
        content = request.POST.get('content', '').strip()

    if not content:
        return JsonResponse({'success': False, 'error': 'Message cannot be empty.'}, status=400)

    msg = ChatMessage.objects.create(
        room=room,
        sender=request.user,
        content=content
    )
    room.updated_at = timezone.now()
    room.save(update_fields=['updated_at'])

    # Create notification for recipient
    recipient = room.get_other_user(request.user)
    car_name = f"{room.vehicle.brand} {room.vehicle.model}" if room.vehicle else "Rental Chat"
    Notification.objects.create(
        user=recipient,
        title=f"New message from {request.user.first_name or request.user.username}",
        message=f"[{car_name}] {content[:80]}",
        notification_type='chat',
        link_url=f"/chat/?room={room.id}"
    )

    return JsonResponse({
        'success': True,
        'message': {
            'id': msg.id,
            'sender_id': msg.sender.id,
            'sender_name': msg.sender.first_name or msg.sender.username,
            'content': msg.content,
            'created_at': msg.created_at.strftime('%H:%M'),
            'is_read': msg.is_read,
            'is_me': True,
        }
    })


@login_required(login_url='/vehicles/?auth=login')
def get_messages_api(request, room_id):
    """
    Polls/fetches new messages in a room since a given message ID and tracks read status.
    """
    room = get_object_or_404(ChatRoom, pk=room_id)
    if request.user != room.customer and request.user != room.seller:
        return HttpResponseForbidden("Not authorized to view this room.")

    # Mark incoming unread messages as read
    room.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

    after_id = request.GET.get('after_id')
    qs = room.messages.select_related('sender').all()
    if after_id:
        try:
            qs = qs.filter(id__gt=int(after_id))
        except ValueError:
            pass

    messages_data = [
        {
            'id': m.id,
            'sender_id': m.sender.id,
            'sender_name': m.sender.first_name or m.sender.username,
            'content': m.content,
            'created_at': m.created_at.strftime('%H:%M'),
            'is_read': m.is_read,
            'is_me': (m.sender == request.user),
        }
        for m in qs
    ]

    # Return list of IDs for my messages that have been marked as read/seen
    my_read_ids = list(
        room.messages.filter(sender=request.user, is_read=True).values_list('id', flat=True)
    )

    return JsonResponse({
        'success': True,
        'messages': messages_data,
        'read_ids': my_read_ids,
        'room_id': room.id
    })
