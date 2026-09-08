import os
import json
from django.db.models import Q, F
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_http_methods
from .models import Vehicle, UserFavourite, UserRecentView, RentalBooking


def catalog_view(request):
    """
    Renders the vehicles catalog with real database records, search filters,
    and user-specific favourite state.
    """
    qs = Vehicle.objects.filter(is_active=True)

    # 1. Search & Filter Parameters
    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(
            Q(brand__icontains=q) |
            Q(model__icontains=q) |
            Q(trim__icontains=q) |
            Q(location_name__icontains=q) |
            Q(city__icontains=q)
        )

    city = request.GET.get('city', '').strip()
    if city and city.lower() != 'all':
        qs = qs.filter(city__iexact=city)

    brand = request.GET.get('brand', '').strip()
    if brand and brand.lower() != 'all':
        qs = qs.filter(brand__icontains=brand)

    model_q = request.GET.get('model', '').strip()
    if model_q:
        qs = qs.filter(model__icontains=model_q)

    transmission = request.GET.get('transmission', '').strip()
    if transmission and transmission.lower() != 'any':
        qs = qs.filter(transmission__iexact=transmission)

    capacity = request.GET.get('capacity', '').strip()
    if capacity and capacity.lower() != 'any':
        try:
            min_seats = int(capacity)
            qs = qs.filter(seats__gte=min_seats)
        except ValueError:
            pass

    year_min = request.GET.get('year_min', '').strip()
    if year_min:
        try:
            ymin = int(year_min)
            qs = qs.filter(year__gte=ymin)
        except ValueError:
            pass

    year_max = request.GET.get('year_max', '').strip()
    if year_max:
        try:
            ymax = int(year_max)
            qs = qs.filter(year__lte=ymax)
        except ValueError:
            pass

    price_min = request.GET.get('price_min', '').strip()
    if price_min:
        try:
            pmin = float(price_min)
            qs = qs.filter(daily_price__gte=pmin)
        except ValueError:
            pass

    price_max = request.GET.get('price_max', '').strip()
    if price_max:
        try:
            pmax = float(price_max)
            qs = qs.filter(daily_price__lte=pmax)
        except ValueError:
            pass

    # 2. Sorting
    sort_by = request.GET.get('sort', '').strip()
    if sort_by == 'popular':
        qs = qs.order_by('-views_count', '-id')
    elif sort_by == 'random':
        qs = qs.order_by('?')
    elif sort_by == 'price_low':
        qs = qs.order_by('daily_price')
    elif sort_by == 'price_high':
        qs = qs.order_by('-daily_price')
    elif sort_by == 'year':
        qs = qs.order_by('-year')
    else:
        qs = qs.order_by('-id')

    vehicles_list = list(qs)

    # Optional server-side distance sorting if user GPS coordinates are provided
    user_lat = request.GET.get('user_lat')
    user_lng = request.GET.get('user_lng')
    if sort_by == 'nearest' and user_lat and user_lng:
        try:
            ulat = float(user_lat)
            ulng = float(user_lng)
            import math
            def haversine(v):
                R = 6371.0
                dlat = math.radians(v.lat - ulat)
                dlng = math.radians(v.lng - ulng)
                a = math.sin(dlat / 2)**2 + math.cos(math.radians(ulat)) * math.cos(math.radians(v.lat)) * math.sin(dlng / 2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                return R * c
            vehicles_list.sort(key=haversine)
        except (ValueError, TypeError):
            pass

    # 3. Dynamic distinct values for filter dropdowns
    all_active = Vehicle.objects.filter(is_active=True)
    available_brands = sorted(list(set(all_active.values_list('brand', flat=True).distinct())))
    available_cities = sorted(list(set(all_active.values_list('city', flat=True).distinct())))

    # 4. Annotate is_favourite for Current User
    favourite_ids = set()
    if request.user.is_authenticated:
        favourite_ids = set(
            UserFavourite.objects.filter(user=request.user, vehicle__in=vehicles_list)
            .values_list('vehicle_id', flat=True)
        )

    for v in vehicles_list:
        v.is_favourite = v.id in favourite_ids

    vehicles_dict_list = [v.to_dict(is_favourite=v.is_favourite) for v in vehicles_list]

    context = {
        'vehicles': vehicles_list,
        'vehicles_count': len(vehicles_list),
        'vehicles_json': vehicles_dict_list,
        'is_favourites_page': False,
        'available_brands': available_brands,
        'available_cities': available_cities,
        'selected_q': q,
        'selected_city': city,
        'selected_brand': brand,
        'selected_model': model_q,
        'selected_transmission': transmission,
        'selected_capacity': capacity,
        'selected_year_min': year_min,
        'selected_year_max': year_max,
        'selected_price_min': price_min,
        'selected_price_max': price_max,
        'selected_sort': sort_by,
    }
    return render(request, 'vehicles.html', context)


def favourites_view(request):
    """
    Renders user's saved favourite vehicles from the database.
    """
    if not request.user.is_authenticated:
        # Prompt login or display empty state with login CTA
        context = {
            'vehicles': [],
            'vehicles_count': 0,
            'vehicles_json': [],
            'is_favourites_page': True,
            'login_required_notice': True,
        }
        return render(request, 'vehicles.html', context)

    favourited_records = (
        UserFavourite.objects.filter(user=request.user, vehicle__is_active=True)
        .select_related('vehicle')
        .order_by('-created_at')
    )
    vehicles_list = [f.vehicle for f in favourited_records]
    for v in vehicles_list:
        v.is_favourite = True

    vehicles_dict_list = [v.to_dict(is_favourite=True) for v in vehicles_list]

    context = {
        'vehicles': vehicles_list,
        'vehicles_count': len(vehicles_list),
        'vehicles_json': vehicles_dict_list,
        'is_favourites_page': True,
        'login_required_notice': False,
    }
    return render(request, 'vehicles.html', context)


@require_http_methods(["POST"])
def toggle_favourite_view(request, vehicle_id):
    """
    AJAX endpoint to add or remove a vehicle from the user's favourites.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'success': False, 
            'login_required': True, 
            'error': 'Please sign in to save vehicles to your favourites.'
        }, status=401)

    vehicle = get_object_or_404(Vehicle, pk=vehicle_id, is_active=True)
    fav = UserFavourite.objects.filter(user=request.user, vehicle=vehicle).first()

    if fav:
        fav.delete()
        is_favourite = False
    else:
        UserFavourite.objects.create(user=request.user, vehicle=vehicle)
        is_favourite = True

    fav_count = UserFavourite.objects.filter(user=request.user).count()

    return JsonResponse({
        'success': True,
        'is_favourite': is_favourite,
        'vehicle_id': vehicle.id,
        'brand': vehicle.brand,
        'model': vehicle.model,
        'total_favourites': fav_count,
    })


@require_http_methods(["POST"])
def track_recent_view(request, vehicle_id):
    """
    Records a vehicle view for the authenticated user or guest session key.
    """
    vehicle = get_object_or_404(Vehicle, pk=vehicle_id, is_active=True)

    # Ensure session key exists for guest tracking
    if not request.session.session_key:
        request.session.save()
    session_key = request.session.session_key

    # Increment global views count for vehicle popularity
    Vehicle.objects.filter(pk=vehicle.pk).update(views_count=F('views_count') + 1)

    if request.user.is_authenticated:
        obj, created = UserRecentView.objects.update_or_create(
            user=request.user,
            vehicle=vehicle,
            defaults={'session_key': session_key}
        )
    else:
        obj, created = UserRecentView.objects.update_or_create(
            session_key=session_key,
            vehicle=vehicle,
            defaults={'user': None}
        )

    # Return top 4 recent vehicles for real-time DOM update
    recents = (
        UserRecentView.objects.filter(user=request.user if request.user.is_authenticated else None, session_key=session_key if not request.user.is_authenticated else None)
        .select_related('vehicle')
        .order_by('-viewed_at')[:4]
    )
    recents_data = [
        {
            'id': r.vehicle.id,
            'brand': r.vehicle.brand,
            'model': r.vehicle.model,
            'price_per_hour': str(r.vehicle.price_per_hour),
        } for r in recents if r.vehicle and r.vehicle.is_active
    ]

    return JsonResponse({
        'success': True,
        'recents': recents_data
    })


@require_http_methods(["GET", "POST"])
def add_vehicle_view(request):
    """
    Renders and processes the Add Vehicle form (/vehicles/add/)
    with 10 fields matching Course Project 3 specifications.
    Auto-fills owner phone number from UserProfile.
    """
    if not request.user.is_authenticated:
        return redirect('/vehicles/')

    user_phone = ''
    if hasattr(request.user, 'profile'):
        user_phone = request.user.profile.phone_number

    if request.method == 'POST':
        brand = request.POST.get('brand', '').strip()
        model = request.POST.get('model', '').strip()
        trim = request.POST.get('trim', '').strip()
        city = request.POST.get('city', 'Tbilisi').strip()
        transmission = request.POST.get('transmission', 'Automatic')

        try:
            year = int(request.POST.get('year', 2024))
        except ValueError:
            year = 2024

        try:
            daily_price = float(request.POST.get('daily_price', 90))
        except ValueError:
            daily_price = 90.0

        try:
            seats = int(request.POST.get('seats', 4))
        except ValueError:
            seats = 4

        try:
            fuel_capacity = int(request.POST.get('fuel_capacity', 60))
        except ValueError:
            fuel_capacity = 60

        try:
            lat = float(request.POST.get('lat', 41.7151))
            lng = float(request.POST.get('lng', 44.8271))
        except ValueError:
            lat, lng = 41.7151, 44.8271

        location_name = request.POST.get('location_name', '').strip() or f"{city} Center"

        if not brand or not model:
            return render(request, 'vehicles/add_vehicle.html', {
                'error': 'Brand and model are required.',
                'user_phone': user_phone
            })

        model_3d_file = request.FILES.get('model_3d_file')

        vehicle = Vehicle.objects.create(
            owner=request.user,
            owner_phone=user_phone,
            brand=brand,
            model=model,
            trim=trim,
            year=year,
            daily_price=daily_price,
            price_per_hour=round(daily_price / 6, 2),
            seats=seats,
            transmission=transmission,
            fuel_capacity=fuel_capacity,
            city=city,
            location_name=location_name,
            lat=lat,
            model_3d_file=model_3d_file,
            status='pending',
            is_active=False
        )

        # Dispatch Discord Webhook notification
        webhook_url = os.getenv('WEBHOOK_DISCORD')
        if webhook_url:
            try:
                import requests
                requests.post(webhook_url, json={
                    "content": "+1 announcement on gruzinauto. <@384838698883350539>"
                }, timeout=5)
            except Exception as e:
                print(f"Discord webhook notice error: {e}")

        # In-app confirmation for vehicle owner
        from accounts.models import Notification
        Notification.objects.create(
            user=request.user,
            title="Listing Submitted for Review",
            message=f"Your {brand} {model} ({year}) was submitted and is currently pending review by the moderation team.",
            notification_type='system',
            link_url='/profile/'
        )

        return redirect('/profile/?submitted=1')

    return render(request, 'vehicles/add_vehicle.html', {
        'user_phone': user_phone
    })


def vehicle_detail_view(request, vehicle_id):
    """
    Renders detailed specifications, 3 photos gallery, Leaflet map,
    and interactive rental booking calculator (/vehicles/<id>/).
    """
    vehicle = get_object_or_404(Vehicle, pk=vehicle_id, is_active=True)

    # Increment views count for vehicle popularity
    Vehicle.objects.filter(pk=vehicle.pk).update(views_count=F('views_count') + 1)
    vehicle.refresh_from_db(fields=['views_count'])

    # Track recent view
    if not request.session.session_key:
        request.session.save()
    session_key = request.session.session_key
    if request.user.is_authenticated:
        UserRecentView.objects.update_or_create(user=request.user, vehicle=vehicle, defaults={'session_key': session_key})
    else:
        UserRecentView.objects.update_or_create(session_key=session_key, vehicle=vehicle, defaults={'user': None})

    is_favourite = False
    if request.user.is_authenticated:
        is_favourite = UserFavourite.objects.filter(user=request.user, vehicle=vehicle).exists()

    context = {
        'vehicle': vehicle,
        'is_favourite': is_favourite,
    }
    return render(request, 'vehicles/vehicle_detail.html', context)


@require_http_methods(["POST"])
def rent_vehicle_view(request, vehicle_id):
    """
    Processes rental booking for a vehicle.
    Calculates total price (rental_days * daily_price) and saves to RentalBooking.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'success': False,
            'login_required': True,
            'error': 'Please sign in to rent this vehicle.'
        }, status=401)

    vehicle = get_object_or_404(Vehicle, pk=vehicle_id, is_active=True)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        data = request.POST

    city = data.get('city', vehicle.city).strip() or vehicle.city
    try:
        rental_days = max(1, int(data.get('rental_days', 1)))
    except (TypeError, ValueError):
        rental_days = 1

    daily_price = float(vehicle.daily_price or 90.0)
    total_price = round(rental_days * daily_price, 2)

    booking = RentalBooking.objects.create(
        user=request.user,
        vehicle=vehicle,
        city=city,
        rental_days=rental_days,
        daily_price=daily_price,
        total_price=total_price,
        status='Confirmed'
    )

    # Notify vehicle owner of new booking
    from accounts.models import Notification
    if vehicle.owner and vehicle.owner != request.user:
        Notification.objects.create(
            user=vehicle.owner,
            title="Vehicle Rented!",
            message=f"{request.user.get_full_name() or request.user.username} rented your {vehicle.brand} {vehicle.model} in {city} for {rental_days} day(s) (Total: ₾{total_price}).",
            notification_type='rental',
            link_url='/profile/'
        )

    return JsonResponse({
        'success': True,
        'booking_id': booking.id,
        'vehicle_id': vehicle.id,
        'city': city,
        'rental_days': rental_days,
        'total_price': str(total_price),
        'message': f'Successfully rented {vehicle.brand} {vehicle.model} for {rental_days} day(s).'
    })


@require_http_methods(["POST"])
def toggle_hide_vehicle_view(request, vehicle_id):
    """
    Temporarily hides or unhides a vehicle from the public catalog.
    Only the vehicle owner or an administrator (staff/superuser) can toggle visibility.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required.'}, status=401)

    vehicle = get_object_or_404(Vehicle, pk=vehicle_id)

    # Permission check: owner or admin
    if vehicle.owner != request.user and not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    vehicle.is_active = not vehicle.is_active
    vehicle.save()

    # Log to AdminAuditLog
    from accounts.models import log_admin_action
    action = 'UNHIDE_VEHICLE' if vehicle.is_active else 'HIDE_VEHICLE'
    details = f"Vehicle was {'unhidden / restored to catalog' if vehicle.is_active else 'temporarily hidden from public view'}."
    log_admin_action(
        request,
        action=action,
        target_type='Vehicle',
        target_id=vehicle.id,
        target_title=f"{vehicle.brand} {vehicle.model} ({vehicle.year})",
        details=details
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'vehicle_id': vehicle.id,
            'is_active': vehicle.is_active,
            'message': f"{vehicle.brand} {vehicle.model} is now {'visible' if vehicle.is_active else 'temporarily hidden'}."
        })

    referer = request.META.get('HTTP_REFERER')
    if referer:
        return redirect(referer)
    return redirect('profile')


@require_http_methods(["POST"])
def delete_vehicle_view(request, vehicle_id):
    """
    Permanently deletes a vehicle from the database.
    Only the vehicle owner or an administrator (staff/superuser) can perform deletion.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required.'}, status=401)

    vehicle = get_object_or_404(Vehicle, pk=vehicle_id)

    # Permission check: owner or admin
    if vehicle.owner != request.user and not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    car_name = f"{vehicle.brand} {vehicle.model}"
    car_id = vehicle.id
    car_year = vehicle.year
    vehicle.delete()

    # Log to AdminAuditLog
    from accounts.models import log_admin_action
    log_admin_action(
        request,
        action='DELETE_VEHICLE',
        target_type='Vehicle',
        target_id=car_id,
        target_title=f"{car_name} ({car_year})",
        details="Permanently deleted vehicle record."
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': f"{car_name} was deleted permanently."
        })

    referer = request.META.get('HTTP_REFERER')
    if referer and str(vehicle_id) not in referer:
        return redirect(referer)
    return redirect('profile')


