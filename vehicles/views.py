import json
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.views.decorators.http import require_http_methods
from .models import Vehicle, UserFavourite, UserRecentView


def catalog_view(request):
    """
    Renders the vehicles catalog with real database records, search filters,
    and user-specific favourite state.
    """
    qs = Vehicle.objects.filter(is_active=True)

    # 1. Search Filters
    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(
            Q(brand__icontains=q) |
            Q(model__icontains=q) |
            Q(trim__icontains=q) |
            Q(location_name__icontains=q)
        )

    city = request.GET.get('city', '').strip()
    if city and city.lower() != 'all':
        qs = qs.filter(city__iexact=city)

    brand = request.GET.get('brand', '').strip()
    if brand:
        qs = qs.filter(brand__icontains=brand)

    capacity = request.GET.get('capacity', '').strip()
    if capacity:
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

    vehicles_list = list(qs)

    # 2. Annotate is_favourite for Current User
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
