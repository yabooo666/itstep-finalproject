// Gruzin Auto - Interactive Split-View Map Controller (Leaflet.js + Tbilisi Coordinates)

let isMapOpen = false;
let mapInstance = null;
let markersLayer = null;
let lastToggleTimestamp = 0;

// Self-invoking initialization supporting any load order
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplitViewMap);
} else {
    initSplitViewMap();
}

// Global click delegation for maximum reliability
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#toggleMapBtn, .show-map-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        toggleSplitMap();
    }
});

// Expose toggle function globally
window.toggleSplitMap = toggleSplitMap;

function toggleSplitMap() {
    const now = Date.now();
    if (now - lastToggleTimestamp < 300) {
        // Prevent double invocation from concurrent click handlers / bubbling
        return;
    }
    lastToggleTimestamp = now;

    const toggleBtn = document.getElementById('toggleMapBtn');
    const contentArea = document.getElementById('vehiclesMainContent');
    const mapPanel = document.getElementById('vehiclesMapPanel');

    if (!contentArea) return;

    isMapOpen = !isMapOpen;

    const btnText = toggleBtn ? toggleBtn.querySelector('.btn-text') : null;

    if (isMapOpen) {
        contentArea.classList.add('split-view-active');
        if (toggleBtn) toggleBtn.classList.add('active');
        if (btnText) btnText.textContent = 'Hide map';

        // Setup Leaflet map on first open
        if (!mapInstance) {
            setupLeafletMap();
        }

        // Multiple invalidates to handle CSS transition smoothly
        [60, 160, 300, 500].forEach(delay => {
            setTimeout(() => {
                if (mapInstance) mapInstance.invalidateSize();
                window.dispatchEvent(new Event('resize'));
            }, delay);
        });
    } else {
        contentArea.classList.remove('split-view-active');
        if (toggleBtn) toggleBtn.classList.remove('active');
        if (btnText) btnText.textContent = 'Show map';

        if (mapPanel && mapPanel.classList.contains('is-fullscreen')) {
            mapPanel.classList.remove('is-fullscreen');
        }

        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 120);
    }
}

function initSplitViewMap() {
    const mapMount = document.getElementById('leafletMapMount');
    if (!mapMount) return;

    const fullscreenBtn = document.getElementById('mapFullscreenBtn');
    const recenterBtn = document.getElementById('mapRecenterBtn');
    const searchInput = document.getElementById('mapSearchInput');
    const mapPanel = document.getElementById('vehiclesMapPanel');

    // Recenter Button
    if (recenterBtn) {
        recenterBtn.addEventListener('click', () => {
            if (mapInstance) {
                mapInstance.flyTo([41.7050, 44.7950], 14, { duration: 0.8 });
            }
        });
    }

    // Fullscreen Toggle Button
    if (fullscreenBtn && mapPanel) {
        fullscreenBtn.addEventListener('click', () => {
            mapPanel.classList.toggle('is-fullscreen');
            setTimeout(() => {
                if (mapInstance) mapInstance.invalidateSize();
            }, 260);
        });
    }

    // Search Input Filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const vehicles = getVehiclesData();
            const filtered = vehicles.filter(v =>
                v.brand.toLowerCase().includes(query) ||
                v.model.toLowerCase().includes(query) ||
                (v.location_name && v.location_name.toLowerCase().includes(query))
            );
            renderMapMarkers(filtered);
            if (filtered.length > 0 && filtered[0].lat && mapInstance) {
                mapInstance.panTo([filtered[0].lat, filtered[0].lng]);
            }
        });
    }
}

function getVehiclesData() {
    const dataElement = document.getElementById('vehiclesJsonData');
    if (dataElement) {
        try {
            let parsed = JSON.parse(dataElement.textContent || '[]');
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            console.error('Error parsing vehicles data:', e);
        }
    }
    return [];
}

function setupLeafletMap() {
    if (!window.L) {
        console.error('Leaflet library is not available yet');
        return;
    }

    const mapMount = document.getElementById('leafletMapMount');
    if (!mapMount || mapInstance) return;

    const tbilisiCenter = [41.7050, 44.7950];

    try {
        mapInstance = L.map(mapMount, {
            center: tbilisiCenter,
            zoom: 14,
            zoomControl: false,
            attributionControl: false,
        });

        // Add Zoom Control at bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

        // ESRI World Dark Gray Canvas Basemap (Free, Clean, No API Key Required)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            maxNativeZoom: 16,
            attribution: 'Tiles &copy; Esri',
        }).addTo(mapInstance);

        // ESRI Dark Gray Reference Layer (Streets and English/Georgian Labels)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            maxNativeZoom: 16,
            attribution: '',
        }).addTo(mapInstance);

        markersLayer = L.layerGroup().addTo(mapInstance);

        const vehicles = getVehiclesData();
        renderMapMarkers(vehicles);

        // Render customer location on map (synced with cards)
        const initialCoords = window.getCustomerActiveCoords ? window.getCustomerActiveCoords() : [41.7151, 44.8271];
        renderCustomerLocation(initialCoords[0], initialCoords[1]);

        // Map click anywhere updates customer location
        mapInstance.on('click', function(e) {
            if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.map-car-pin, .leaflet-popup')) {
                return; // Ignore clicks on car markers or popups
            }
            if (window.updateCustomerGlobalLocation) {
                window.updateCustomerGlobalLocation(e.latlng.lat, e.latlng.lng, false);
            }
        });

        mapInstance.invalidateSize();
    } catch (err) {
        console.error('Error setting up Leaflet map:', err);
    }
}

let customerMarker = null;
let customerRouteLine = null;
let customerRouteBadge = null;

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function renderCustomerLocation(lat, lng) {
    if (!markersLayer || !window.L) return;

    if (customerMarker) {
        markersLayer.removeLayer(customerMarker);
        customerMarker = null;
    }

    const userPulseIcon = L.divIcon({
        className: 'user-location-pulse-wrapper',
        html: `
            <div class="user-pulse-center" style="background: #ffffff; width: 14px; height: 14px; border: 2px solid #000000; border-radius: 50%;"></div>
            <div class="user-pulse-wave" style="border-color: rgba(255,255,255,0.7);"></div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });

    customerMarker = L.marker([lat, lng], { 
        icon: userPulseIcon, 
        draggable: true,
        zIndexOffset: 1000 
    }).addTo(markersLayer);

    customerMarker.bindPopup('<b>📍 Your Location (Customer)</b><br><span style="font-size:11px;color:#a1a1aa;">Drag to change location</span>');

    customerMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        if (window.updateCustomerGlobalLocation) {
            window.updateCustomerGlobalLocation(pos.lat, pos.lng, false);
        }
    });

    drawRouteToNearestCar(lat, lng);
}

window.syncMapCustomerLocation = function(lat, lng) {
    if (mapInstance && markersLayer) {
        renderCustomerLocation(lat, lng);
        mapInstance.panTo([lat, lng], { animate: true, duration: 0.6 });
    }
};

function drawRouteToNearestCar(userLat, userLng) {
    if (!markersLayer || !window.L) return;

    if (customerRouteLine) {
        markersLayer.removeLayer(customerRouteLine);
        customerRouteLine = null;
    }
    if (customerRouteBadge) {
        markersLayer.removeLayer(customerRouteBadge);
        customerRouteBadge = null;
    }

    const vehicles = getVehiclesData();
    let nearestCar = null;
    let minDistance = Infinity;

    vehicles.forEach(car => {
        if (car.lat && car.lng) {
            const d = calculateDistanceKm(userLat, userLng, car.lat, car.lng);
            if (d < minDistance) {
                minDistance = d;
                nearestCar = car;
            }
        }
    });

    if (nearestCar && minDistance < 500) {
        const pathPoints = [
            [userLat, userLng],
            [nearestCar.lat, nearestCar.lng]
        ];

        customerRouteLine = L.polyline(pathPoints, {
            color: '#ffffff',
            weight: 2.2,
            dashArray: '6, 8',
            opacity: 0.85,
            lineCap: 'round',
        }).addTo(markersLayer);

        const midLat = (userLat + nearestCar.lat) / 2;
        const midLng = (userLng + nearestCar.lng) / 2;

        let tagText = minDistance < 1 
            ? `${Math.round(minDistance * 1000)}m (~${Math.max(1, Math.round(minDistance * 1000 / 80))} min walk)` 
            : `${minDistance.toFixed(1)} km (~${Math.max(1, Math.round(minDistance / 40 * 60))} min drive)`;

        const walkingTagIcon = L.divIcon({
            className: 'walking-time-badge-wrapper',
            html: `
                <div class="walking-time-tag" style="background:#09090c; color:#ffffff; border:1px solid rgba(255,255,255,0.25); padding:4px 9px; border-radius:6px; font-size:11.5px; font-weight:700; white-space:nowrap; box-shadow:0 4px 14px rgba(0,0,0,0.85);">
                    <span>📍 Nearest: ${tagText}</span>
                </div>
            `,
            iconSize: [140, 26],
            iconAnchor: [70, 13],
        });

        customerRouteBadge = L.marker([midLat, midLng], { icon: walkingTagIcon }).addTo(markersLayer);
    }
}

function renderMapMarkers(list) {
    if (!markersLayer || !window.L) return;
    markersLayer.clearLayers();

    const safeList = Array.isArray(list) ? list : getVehiclesData();
    const points = [];

    // Render Individual Vehicle Pins directly from catalog data
    safeList.forEach((car, index) => {
        if (!car.lat || !car.lng) return;
        points.push([car.lat, car.lng]);

        const carIcon = L.divIcon({
            className: 'custom-car-pin-wrapper',
            html: `
                <div class="map-car-pin" data-car-id="${car.id}">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="car-svg">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z"/>
                        <circle cx="7.5" cy="14.5" r="1.5"/>
                        <circle cx="16.5" cy="14.5" r="1.5"/>
                    </svg>
                </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
        });

        const marker = L.marker([car.lat, car.lng], { icon: carIcon }).addTo(markersLayer);

        // Rich Custom Popup Card
        const popupHtml = `
            <div class="map-vehicle-card-popup">
                <div class="popup-top-meta">
                    <div class="popup-rating">
                        <span class="score">${car.views_count || 0} views</span>
                    </div>
                    <button type="button" class="popup-heart ${car.is_favourite ? 'favourited' : ''}" onclick="this.classList.toggle('favourited')">
                        <svg viewBox="0 0 24 24" fill="${car.is_favourite ? '#ffffff' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                </div>

                <div class="popup-car-header">
                    <h4 class="popup-car-name">${car.brand} ${car.model}</h4>
                    <p class="popup-car-trim">${car.trim || ''}</p>
                </div>

                <div class="popup-action-row">
                    <a href="/vehicles/${car.id}/" class="popup-book-btn" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">
                        <span>View 3D</span>
                    </a>
                    <div class="popup-price-tag">
                        <span class="price-num">₾${car.daily_price || car.price_per_hour}</span>
                        <span class="price-unit">${car.daily_price ? '/ day' : '/ hr'}</span>
                    </div>
                </div>
            </div>
        `;

        marker.bindPopup(popupHtml, {
            className: 'custom-leaflet-popup',
            maxWidth: 260,
            minWidth: 240,
            closeButton: false,
            offset: [0, -10],
        });

        // Clicking a car marker shows route from customer to this car
        marker.on('click', () => {
            const customerCoords = window.getCustomerActiveCoords ? window.getCustomerActiveCoords() : [41.7151, 44.8271];
            if (customerRouteLine) markersLayer.removeLayer(customerRouteLine);
            if (customerRouteBadge) markersLayer.removeLayer(customerRouteBadge);

            const dist = calculateDistanceKm(customerCoords[0], customerCoords[1], car.lat, car.lng);
            const pathPoints = [customerCoords, [car.lat, car.lng]];
            customerRouteLine = L.polyline(pathPoints, {
                color: '#ffffff',
                weight: 2.2,
                dashArray: '6, 8',
                opacity: 0.85,
            }).addTo(markersLayer);

            const midLat = (customerCoords[0] + car.lat) / 2;
            const midLng = (customerCoords[1] + car.lng) / 2;
            const tagText = dist < 1 
                ? `${Math.round(dist * 1000)}m (~${Math.max(1, Math.round(dist * 1000 / 80))} min walk)` 
                : `${dist.toFixed(1)} km (~${Math.max(1, Math.round(dist / 40 * 60))} min drive)`;

            const badgeIcon = L.divIcon({
                className: 'walking-time-badge-wrapper',
                html: `
                    <div class="walking-time-tag" style="background:#09090c; color:#ffffff; border:1px solid rgba(255,255,255,0.25); padding:4px 9px; border-radius:6px; font-size:11.5px; font-weight:700; white-space:nowrap; box-shadow:0 4px 14px rgba(0,0,0,0.85);">
                        <span>📍 ${tagText}</span>
                    </div>
                `,
                iconSize: [140, 26],
                iconAnchor: [70, 13],
            });
            customerRouteBadge = L.marker([midLat, midLng], { icon: badgeIcon }).addTo(markersLayer);
        });

        if (index === 0) {
            setTimeout(() => marker.openPopup(), 450);
        }
    });

    if (points.length > 0 && mapInstance) {
        if (points.length === 1) {
            mapInstance.setView(points[0], 14);
        } else {
            const bounds = L.latLngBounds(points);
            mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }
}
