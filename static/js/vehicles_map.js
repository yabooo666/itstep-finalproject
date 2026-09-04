// Auto Ultimate - Interactive Split-View Map Controller (Leaflet.js + Tbilisi Coordinates)

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
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error('Error parsing vehicles data:', e);
        }
    }

    // Robust Fallback vehicles data with real Tbilisi coordinates
    return [
        { id: 1, brand: 'BMW', model: 'E34 Stance Edition', trim: '2.5L Inline-6 (192 hp)', rating: '5.0', review_count: 342, price_per_hour: '35.00', lat: 41.6975, lng: 44.7995, is_favourite: true },
        { id: 2, brand: 'BMW', model: 'M4 Convertible G83', trim: '3.0L M TwinPower Turbo (503 hp)', rating: '5.0', review_count: 618, price_per_hour: '75.00', lat: 41.7050, lng: 44.7880, is_favourite: true },
        { id: 3, brand: 'Audi', model: 'R8 V10 Plus', trim: '5.2L FSI V10 (610 hp)', rating: '5.0', review_count: 328, price_per_hour: '55.00', lat: 41.7100, lng: 44.7650, is_favourite: false },
        { id: 4, brand: 'Mercedes-Benz', model: 'GLS 580 4MATIC', trim: '4.0L V8 Biturbo EQ Boost (483 hp)', rating: '5.0', review_count: 512, price_per_hour: '65.00', lat: 41.7220, lng: 44.7730, is_favourite: false },
        { id: 5, brand: 'BMW', model: 'M4 Competition G83', trim: '3.0L Twin-Turbo (503 hp)', rating: '5.0', review_count: 415, price_per_hour: '79.00', lat: 41.6930, lng: 44.8015, is_favourite: false },
        { id: 6, brand: 'BMW', model: 'E34 Classic Motorsport', trim: '2.5L M-Tech Suspension (192 hp)', rating: '4.9', review_count: 287, price_per_hour: '38.00', lat: 41.7030, lng: 44.8150, is_favourite: false },
    ];
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
        renderWalkingRoute(tbilisiCenter);

        mapInstance.invalidateSize();
    } catch (err) {
        console.error('Error setting up Leaflet map:', err);
    }
}

function renderMapMarkers(list) {
    if (!markersLayer || !window.L) return;
    markersLayer.clearLayers();

    const safeList = Array.isArray(list) ? list : getVehiclesData();

    // 1. Cluster Badges (matching screenshot)
    const clusters = [
        { count: 2, lat: 41.7160, lng: 44.7550 },
        { count: 3, lat: 41.6980, lng: 44.8250 },
        { count: 6, lat: 41.7280, lng: 44.7890 },
        { count: 5, lat: 41.6880, lng: 44.8080 },
    ];

    clusters.forEach(c => {
        const clusterIcon = L.divIcon({
            className: 'custom-map-cluster',
            html: `<div class="map-cluster-bubble">${c.count}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });
        L.marker([c.lat, c.lng], { icon: clusterIcon }).addTo(markersLayer);
    });

    // 2. Individual Vehicle Pins
    safeList.forEach((car, index) => {
        if (!car.lat || !car.lng) return;

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

        // Rich Custom Popup Card matching user mockup
        const popupHtml = `
            <div class="map-vehicle-card-popup">
                <div class="popup-top-meta">
                    <div class="popup-rating">
                        <svg viewBox="0 0 24 24" fill="#eab308" class="star-svg">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span class="score">${car.rating || '5.0'}</span>
                        <span class="count">(${car.review_count || 120})</span>
                    </div>
                    <button type="button" class="popup-heart ${car.is_favourite ? 'favourited' : ''}" onclick="this.classList.toggle('favourited')">
                        <svg viewBox="0 0 24 24" fill="${car.is_favourite ? '#ef4444' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                </div>

                <div class="popup-car-header">
                    <h4 class="popup-car-name">${car.brand} ${car.model}</h4>
                    <p class="popup-car-trim">${car.trim || ''}</p>
                </div>

                <div class="popup-action-row">
                    <button type="button" class="popup-book-btn" onclick="window.openAuthModal ? window.openAuthModal('login') : null">
                        <span>Book</span>
                    </button>
                    <div class="popup-price-tag">
                        <span class="price-num">₾${car.price_per_hour}</span>
                        <span class="price-unit">/ h</span>
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

        if (index === 0) {
            setTimeout(() => marker.openPopup(), 450);
        }
    });
}

function renderWalkingRoute(center) {
    if (!markersLayer || !window.L) return;

    const userLoc = [41.7010, 44.7920];
    const carLoc = [41.6975, 44.7995];

    const pathPoints = [
        userLoc,
        [41.7005, 44.7935],
        [41.6990, 44.7950],
        [41.6980, 44.7975],
        carLoc,
    ];

    L.polyline(pathPoints, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '5, 8',
        opacity: 0.85,
        lineCap: 'round',
    }).addTo(markersLayer);

    const midPoint = [41.6990, 44.7950];
    const walkingTagIcon = L.divIcon({
        className: 'walking-time-badge-wrapper',
        html: `
            <div class="walking-time-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="4" r="2"/>
                    <path d="M15 22v-6l-3-3l-2 2v7"/>
                    <path d="M9 13l2-3l3 2l3-2"/>
                </svg>
                <span>2 min</span>
            </div>
        `,
        iconSize: [68, 26],
        iconAnchor: [34, 13],
    });

    L.marker(midPoint, { icon: walkingTagIcon }).addTo(markersLayer);

    const userPulseIcon = L.divIcon({
        className: 'user-location-pulse-wrapper',
        html: `<div class="user-pulse-center"></div><div class="user-pulse-wave"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });

    L.marker(userLoc, { icon: userPulseIcon }).addTo(markersLayer);
}
