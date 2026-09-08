import json
from django.db.models import Q
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
    if sort_by == 'price_low':
        qs = qs.order_by('daily_price')
    elif sort_by == 'price_high':
        qs = qs.order_by('-daily_price')
    elif sort_by == 'rating':
        qs = qs.order_by('-rating', '-review_count')
    elif sort_by == 'year':
        qs = qs.order_by('-year')
    else:
        qs = qs.order_by('-id')

    vehicles_list = list(qs)

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
            lng=lng,
            model_3d_file=model_3d_file,
            is_active=True
        )
        return redirect('vehicle_detail', vehicle_id=vehicle.id)

    return render(request, 'vehicles/add_vehicle.html', {
        'user_phone': user_phone
    })


def vehicle_detail_view(request, vehicle_id):
    """
    Renders detailed specifications, 3 photos gallery, Leaflet map,
    and interactive rental booking calculator (/vehicles/<id>/).
    """
    vehicle = get_object_or_404(Vehicle, pk=vehicle_id, is_active=True)

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

    images = vehicle.get_images()
    primary_image = images[0] if images else "/static/images/bmw_m4.png"

    context = {
        'vehicle': vehicle,
        'images': images,
        'primary_image': primary_image,
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

    return JsonResponse({
        'success': True,
        'booking_id': booking.id,
        'vehicle_id': vehicle.id,
        'city': city,
        'rental_days': rental_days,
        'total_price': str(total_price),
        'message': f'Successfully rented {vehicle.brand} {vehicle.model} for {rental_days} day(s).'
    })

