import os
import json
import resend
from django.conf import settings
from django.contrib.auth import login as auth_login, logout as auth_logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.http import require_http_methods


def _extract_payload(request):
    """Helper to parse JSON or standard form POST data."""
    if request.content_type == 'application/json':
        try:
            return json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}
    return request.POST


def _send_confirmation_email(user, activation_url, is_resend=False):
    """
    Sends confirmation email using the Resend API (resend.Emails.send).
    Falls back gracefully to Django's send_mail if Resend is not configured or throws an error.
    """
    subject = "Confirm Your Auto Ultimate Account (Resent)" if is_resend else "Confirm Your Auto Ultimate Account"
    context = {
        'user_name': user.first_name or user.username.split('@')[0],
        'activation_url': activation_url,
    }
    html_content = render_to_string('accounts/activation_email.html', context)
    text_content = render_to_string('accounts/activation_email.txt', context)

    # 1. Primary: Resend API
    resend_api_key = getattr(settings, 'RESEND_API_KEY', '') or os.getenv('RESEND_API_KEY', '')
    if resend_api_key:
        try:
            resend.api_key = resend_api_key
            from_email = getattr(settings, 'RESEND_FROM_EMAIL', 'Auto Ultimate <onboarding@resend.dev>')
            response = resend.Emails.send({
                "from": from_email,
                "to": [user.email],
                "subject": subject,
                "html": html_content,
                "text": text_content,
            })
            print(f"[RESEND SUCCESS] Activation email sent to {user.email}: {response}")
            return True
        except Exception as err:
            print(f"[RESEND ERROR] Failed to send via Resend: {err}. Falling back to Django send_mail...")

    # 2. Fallback: Django send_mail
    try:
        send_mail(
            subject=subject,
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False
        )
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send activation email to {user.email}: {e}")
        return False


from .models import UserProfile
import re


def _clean_phone(raw_phone):
    """Normalizes phone number string to standard digits or +995 format."""
    if not raw_phone:
        return ''
    cleaned = re.sub(r'[^\d+]', '', raw_phone.strip())
    # If user types 9-digit local Georgian format like 591299899, keep standard
    return cleaned


@require_http_methods(["POST"])
def register_view(request):
    """
    Handles user registration via 5 fields per project specification:
    First Name, Last Name, Phone Number, Email, and Password.
    Creates an inactive user and sends email confirmation token via Resend.
    """
    data = _extract_payload(request)

    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    full_name = data.get('full_name', '').strip()
    raw_phone = data.get('phone_number', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    # If user supplied full_name instead of separate first/last
    if not first_name and full_name:
        parts = full_name.split(None, 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

    # 1. Validation
    if not first_name:
        return JsonResponse({'success': False, 'error': 'First name is required.'}, status=400)

    phone_number = _clean_phone(raw_phone)
    if not phone_number or len(re.sub(r'\D', '', phone_number)) < 9:
        return JsonResponse({
            'success': False, 
            'error': 'Please enter a valid phone number (e.g. 591 29 98 99 or +995...)'
        }, status=400)

    if not email:
        return JsonResponse({'success': False, 'error': 'Email address is required.'}, status=400)

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'success': False, 'error': 'Please enter a valid email address.'}, status=400)

    if not password:
        return JsonResponse({'success': False, 'error': 'Password is required.'}, status=400)

    if len(password) < 8:
        return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters long.'}, status=400)

    if confirm_password and password != confirm_password:
        return JsonResponse({'success': False, 'error': 'Passwords do not match.'}, status=400)

    # Check duplicate phone number in active profiles
    existing_profile = UserProfile.objects.filter(phone_number=phone_number).first()
    if existing_profile and existing_profile.user.is_active:
        return JsonResponse({
            'success': False,
            'error': 'An account with this phone number already exists. Please sign in.'
        }, status=400)

    # 2. Check existing users
    existing_user = User.objects.filter(email__iexact=email).first()
    if existing_user:
        if existing_user.is_active:
            return JsonResponse({
                'success': False,
                'error': 'An account with this email address already exists. Please sign in.'
            }, status=400)
        else:
            # User exists but unconfirmed: update credentials
            user = existing_user
            user.set_password(password)
            user.first_name = first_name
            user.last_name = last_name
            user.save()
            UserProfile.objects.update_or_create(user=user, defaults={'phone_number': phone_number})
    else:
        # Create new inactive user
        user = User(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=False
        )
        user.set_password(password)
        user.save()
        UserProfile.objects.create(user=user, phone_number=phone_number)

    # 3. Generate Email Confirmation Token
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activation_url = request.build_absolute_uri(
        reverse('activate_account', kwargs={'uidb64': uidb64, 'token': token})
    )

    # 4. Send Confirmation Email via Resend
    _send_confirmation_email(user, activation_url, is_resend=False)

    return JsonResponse({
        'success': True,
        'email': email,
        'phone_number': phone_number,
        'message': f'Confirmation link sent to {email}. Please check your inbox to activate your account.'
    })


def activate_account_view(request, uidb64, token):
    """
    Validates token and activates user account when clicked from verification email.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        # Automatically log user in upon successful activation
        auth_login(request, user)
        return render(request, 'accounts/activation_result.html', {
            'success': True,
            'user_name': user.get_full_name() or user.username
        })
    else:
        return render(request, 'accounts/activation_result.html', {
            'success': False
        })


@require_http_methods(["POST"])
def login_view(request):
    """
    Handles user login using Phone Number & Password (matching IT Step Academy Course Project 3).
    Checks that the account is activated before allowing login.
    """
    data = _extract_payload(request)
    raw_phone = data.get('phone_number', '').strip() or data.get('email', '').strip()
    password = data.get('password', '')

    if not raw_phone or not password:
        return JsonResponse({'success': False, 'error': 'Please enter both phone number and password.'}, status=400)

    clean_phone = _clean_phone(raw_phone)
    raw_digits = re.sub(r'\D', '', clean_phone)

    # Find user profile by phone number (exact match, or ending with local 9 digits)
    profile = UserProfile.objects.filter(phone_number=clean_phone).select_related('user').first()
    if not profile and len(raw_digits) >= 9:
        profile = UserProfile.objects.filter(phone_number__endswith=raw_digits[-9:]).select_related('user').first()

    # Fallback to email search in case of admin/existing account
    user = profile.user if profile else User.objects.filter(email__iexact=raw_phone).first() or User.objects.filter(username__iexact=raw_phone).first()

    if user is None or not user.check_password(password):
        return JsonResponse({'success': False, 'error': 'Invalid phone number or password.'}, status=400)

    # Check activation status
    if not user.is_active:
        return JsonResponse({
            'success': False,
            'needs_activation': True,
            'email': user.email,
            'error': 'Please confirm your email address before signing in. Check your inbox for the activation link.'
        }, status=403)

    auth_login(request, user)
    return JsonResponse({
        'success': True,
        'redirect_url': '/vehicles/',
        'username': user.get_full_name() or user.username
    })


@require_http_methods(["POST"])
def resend_activation_view(request):
    """
    Resends activation email for an unconfirmed user account.
    """
    data = _extract_payload(request)
    email = data.get('email', '').strip().lower()

    if not email:
        return JsonResponse({'success': False, 'error': 'Email address is required.'}, status=400)

    user = User.objects.filter(email__iexact=email).first()
    if user and not user.is_active:
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        activation_url = request.build_absolute_uri(
            reverse('activate_account', kwargs={'uidb64': uidb64, 'token': token})
        )

        _send_confirmation_email(user, activation_url, is_resend=True)

    # Return success regardless of whether email exists to prevent email enumeration
    return JsonResponse({
        'success': True,
        'message': f'If an unconfirmed account exists for {email}, a new confirmation link was sent.'
    })


def logout_view(request):
    """
    Logs out the current user session and redirects to home.
    """
    auth_logout(request)
    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({'success': True, 'redirect_url': '/'})
    return redirect('home')


def profile_view(request):
    """
    Renders the authenticated user's profile with:
    - User details (First Name, Last Name, Phone Number, Email)
    - Rented cars history (City, Duration, Total Amount Paid)
    - Liked / Favourite cars
    - Listed cars published by the user
    All in English, adhering strictly to white/black/gray OLED luxury design.
    """
    if not request.user.is_authenticated:
        return redirect('/vehicles/?auth=login')

    user = request.user
    user_phone = ''
    if hasattr(user, 'profile'):
        user_phone = user.profile.phone_number

    from vehicles.models import Vehicle, RentalBooking, UserFavourite

    # 1. Rented cars history
    rented_bookings = (
        RentalBooking.objects.filter(user=user)
        .select_related('vehicle')
        .order_by('-created_at')
    )
    total_spent = sum(float(b.total_price) for b in rented_bookings)

    # 2. Saved favourite vehicles
    favourite_records = (
        UserFavourite.objects.filter(user=user, vehicle__is_active=True)
        .select_related('vehicle')
        .order_by('-created_at')
    )
    favourite_vehicles = [f.vehicle for f in favourite_records]
    for v in favourite_vehicles:
        v.is_favourite = True

    # 3. Listed vehicles published by current user
    my_vehicles = Vehicle.objects.filter(owner=user).order_by('-created_at')
    for v in my_vehicles:
        v.is_favourite = any(fv.id == v.id for fv in favourite_vehicles)

    context = {
        'user': user,
        'user_phone': user_phone,
        'rented_bookings': rented_bookings,
        'rentals_count': rented_bookings.count(),
        'total_spent': f"{total_spent:,.2f}",
        'favourite_vehicles': favourite_vehicles,
        'favourites_count': len(favourite_vehicles),
        'my_vehicles': my_vehicles,
        'my_vehicles_count': my_vehicles.count(),
    }
    return render(request, 'accounts/profile.html', context)


@require_http_methods(["GET"])
def notifications_api_list(request):
    """
    Returns JSON list of notifications for authenticated user,
    along with unread count.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'notifications': [], 'unread_count': 0})

    from .models import Notification
    notifs = Notification.objects.filter(user=request.user).order_by('-created_at')[:30]
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()

    notif_data = [
        {
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'notification_type': n.notification_type,
            'link_url': n.link_url,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%b %d, %H:%M'),
            'created_at_iso': n.created_at.isoformat(),
        }
        for n in notifs
    ]

    return JsonResponse({
        'success': True,
        'notifications': notif_data,
        'unread_count': unread_count,
    })


@require_http_methods(["POST"])
def notifications_api_read_all(request):
    """
    Marks all notifications for authenticated user as read.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    from .models import Notification
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return JsonResponse({'success': True, 'unread_count': 0})

