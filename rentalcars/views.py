from django.shortcuts import render

def home(request):
    """
    Renders the home page with the search template.
    """
    return render(request, 'home.html')

def vehicles(request):
    """
    Renders the vehicles catalog and filter page with design mock data.
    """
    mock_vehicles = [
        {
            'id': 1,
            'brand': 'BMW',
            'model': 'E34 Stance Edition',
            'trim': '2.5L Inline-6 (192 hp, RWD)',
            'price_per_hour': '35.00',
            'distance': '70m',
            'walk_time': '2 min',
            'rating': '5.0',
            'review_count': 342,
            'model_3d': 'models/bmw_e34_stance_style.glb',
            'is_favourite': True,
            'lat': 41.6975,
            'lng': 44.7995,
            'location_name': 'Rustaveli Ave',
        },
        {
            'id': 2,
            'brand': 'BMW',
            'model': 'M4 Convertible G83',
            'trim': '3.0L M TwinPower Turbo (503 hp, M xDrive)',
            'price_per_hour': '75.00',
            'distance': '110m',
            'walk_time': '3 min',
            'rating': '5.0',
            'review_count': 618,
            'model_3d': 'models/bmw_m4_convertible_g83_2021.glb',
            'is_favourite': True,
            'lat': 41.7050,
            'lng': 44.7880,
            'location_name': 'Vera / Philharmonic',
        },
        {
            'id': 3,
            'brand': 'Audi',
            'model': 'R8 V10 Plus',
            'trim': '5.2L FSI V10 (610 hp, Quattro)',
            'price_per_hour': '55.00',
            'distance': '60m',
            'walk_time': '2 min',
            'rating': '5.0',
            'review_count': 328,
            'model_3d': 'models/audi_r8/Models/Audi R8.dae',
            'is_favourite': False,
            'lat': 41.7100,
            'lng': 44.7650,
            'location_name': 'Vake / Chavchavadze',
        },
        {
            'id': 4,
            'brand': 'Mercedes-Benz',
            'model': 'GLS 580 4MATIC',
            'trim': '4.0L V8 Biturbo EQ Boost (483 hp, AWD)',
            'price_per_hour': '65.00',
            'distance': '50m',
            'walk_time': '2 min',
            'rating': '5.0',
            'review_count': 512,
            'model_3d': 'models/mercedes_gls/mercedes_gls_580.fbx',
            'is_favourite': False,
            'lat': 41.7220,
            'lng': 44.7730,
            'location_name': 'Saburtalo / Pekini',
        },
        {
            'id': 5,
            'brand': 'BMW',
            'model': 'M4 Competition G83',
            'trim': '3.0L Twin-Turbo (503 hp, Dravit Grey)',
            'price_per_hour': '79.00',
            'distance': '90m',
            'walk_time': '3 min',
            'rating': '5.0',
            'review_count': 415,
            'model_3d': 'models/bmw_m4_convertible_g83_2021.glb',
            'is_favourite': False,
            'lat': 41.6930,
            'lng': 44.8015,
            'location_name': 'Freedom Square',
        },
        {
            'id': 6,
            'brand': 'BMW',
            'model': 'E34 Classic Motorsport',
            'trim': '2.5L M-Tech Suspension (192 hp, RWD)',
            'price_per_hour': '38.00',
            'distance': '150m',
            'walk_time': '5 min',
            'rating': '4.9',
            'review_count': 287,
            'model_3d': 'models/bmw_e34_stance_style.glb',
            'is_favourite': False,
            'lat': 41.7030,
            'lng': 44.8150,
            'location_name': 'Marjanishvili St',
            'city': 'Tbilisi',
            'year': 1993,
            'seats': 5,
        },
    ]

    # Add attributes to the other vehicles if not set
    attrs = [
        {'city': 'Tbilisi', 'year': 1995, 'seats': 5},
        {'city': 'Tbilisi', 'year': 2021, 'seats': 4},
        {'city': 'Tbilisi', 'year': 2018, 'seats': 2},
        {'city': 'Tbilisi', 'year': 2022, 'seats': 7},
        {'city': 'Tbilisi', 'year': 2021, 'seats': 4},
        {'city': 'Tbilisi', 'year': 1993, 'seats': 5},
    ]
    for i, car in enumerate(mock_vehicles):
        for k, v in attrs[i].items():
            car.setdefault(k, v)

    # Filter by Query (q)
    q = request.GET.get('q', '').strip().lower()
    city = request.GET.get('city', '').strip()
    capacity = request.GET.get('capacity', '').strip()
    year_min = request.GET.get('year_min', '').strip()
    year_max = request.GET.get('year_max', '').strip()
    brand = request.GET.get('brand', '').strip().lower()

    filtered = mock_vehicles
    if q:
        filtered = [c for c in filtered if (
            q in c['brand'].lower() or 
            q in c['model'].lower() or 
            q in c['trim'].lower() or 
            q in c.get('location_name', '').lower()
        )]

    if city and city.lower() != 'all':
        filtered = [c for c in filtered if c.get('city', '').lower() == city.lower()]

    if brand:
        filtered = [c for c in filtered if brand in c['brand'].lower()]

    if capacity:
        try:
            min_seats = int(capacity)
            filtered = [c for c in filtered if c.get('seats', 0) >= min_seats]
        except ValueError:
            pass

    if year_min:
        try:
            ymin = int(year_min)
            filtered = [c for c in filtered if c.get('year', 0) >= ymin]
        except ValueError:
            pass

    if year_max:
        try:
            ymax = int(year_max)
            filtered = [c for c in filtered if c.get('year', 0) <= ymax]
        except ValueError:
            pass

    context = {
        'vehicles': filtered,
        'vehicles_count': len(filtered),
        'vehicles_json': filtered,
    }
    return render(request, 'vehicles.html', context)


def favourites(request):
    """
    Renders the favourites catalog view.
    """
    # Reuse vehicles logic filtered to favourites
    return vehicles(request)


def notifications(request):
    """
    Renders notifications page or redirects to vehicles with message.
    """
    return vehicles(request)


def chat(request):
    """
    Renders live chat support view.
    """
    return vehicles(request)


