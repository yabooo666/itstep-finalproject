from .models import Vehicle, UserRecentView


def sidebar_recents(request):
    """
    Context processor that supplies recent vehicles to all templates for the sidebar.
    Looks up views by authenticated user, or by session key for guests.
    Falls back to first 3 active vehicles if the user has no history yet.
    """
    recent_vehicles = []

    try:
        if request.user.is_authenticated:
            records = (
                UserRecentView.objects.filter(user=request.user)
                .select_related('vehicle')
                .order_by('-viewed_at')[:4]
            )
            recent_vehicles = [r.vehicle for r in records if r.vehicle and r.vehicle.is_active]
        elif request.session.session_key:
            records = (
                UserRecentView.objects.filter(session_key=request.session.session_key)
                .select_related('vehicle')
                .order_by('-viewed_at')[:4]
            )
            recent_vehicles = [r.vehicle for r in records if r.vehicle and r.vehicle.is_active]

        # If user has no recent history, show default showcase vehicles
        if not recent_vehicles:
            recent_vehicles = list(Vehicle.objects.filter(is_active=True).order_by('id')[:3])
    except Exception as e:
        # Guard against DB issues during early setup
        recent_vehicles = []

    return {
        'recent_vehicles': recent_vehicles
    }
