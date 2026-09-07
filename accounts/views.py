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


@require_http_methods(["POST"])
def register_view(request):
    """
    Handles user registration via Email & Password.
    Creates an inactive user (is_active=False) and sends an email confirmation token via Resend.
    """
    data = _extract_payload(request)

    email = data.get('email', '').strip().lower()
    full_name = data.get('full_name', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    # 1. Validation
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

    # 2. Check existing users
    existing_user = User.objects.filter(email__iexact=email).first()
    if existing_user:
        if existing_user.is_active:
            return JsonResponse({
                'success': False,
                'error': 'An account with this email address already exists. Please sign in.'
            }, status=400)
        else:
            # User exists but never confirmed email. Update info and resend confirmation.
            user = existing_user
            user.set_password(password)
            if full_name:
                name_parts = full_name.split(None, 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
            user.save()
    else:
        # Create new inactive user
        name_parts = full_name.split(None, 1) if full_name else ['', '']
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=False
        )
        user.set_password(password)
        user.save()

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
            'user_name': user.first_name or user.username
        })
    else:
        return render(request, 'accounts/activation_result.html', {
            'success': False
        })


@require_http_methods(["POST"])
def login_view(request):
    """
    Handles user login using Email & Password.
    Checks that the account is activated before allowing login.
    """
    data = _extract_payload(request)
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return JsonResponse({'success': False, 'error': 'Please enter both email and password.'}, status=400)

    # Find user by email or username
    user = User.objects.filter(email__iexact=email).first() or User.objects.filter(username__iexact=email).first()

    if user is None or not user.check_password(password):
        return JsonResponse({'success': False, 'error': 'Invalid email address or password.'}, status=400)

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
        'username': user.first_name or user.username
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
