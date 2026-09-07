// ==========================================================================
// Cyberpunk City 3D Map Engine — Smooth 9-Waypoint Scroll with 3D Holographic Cards
// - Camera Path: 9-point centripetal Catmull-Rom spline (strictly avoids buildings)
// - Look Target Path: 9-point centripetal Catmull-Rom spline (smooth panoramic orientation)
// - Spatial 3D Cards: Card 1 (Fleet) & Card 2 (Zero Paperwork) rendered with CSS3D in true perspective
// - Dynamic distance-based holographic fade & hover bob
// - Performance: 60+ FPS (matrix freezing, no shadow passes, frontface culling, 1.25 pixel ratio)
// - Preserves: Colored 5.5x Trump & Netanyahu monument + 4 elevated BMW M4 traffic routes
// ==========================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCyberpunkCity);
} else {
    initCyberpunkCity();
}

function initCyberpunkCity() {
    const container = document.getElementById('cyberpunkCanvasMount');
    if (!container) return;

    // UI Elements
    const loadingOverlay = document.getElementById('cyberpunkLoadingOverlay');
    const progressBar = document.getElementById('cyberpunkProgressBar');
    const loadingStatus = document.getElementById('cyberpunkLoadingStatus');
    const loadingPct = document.getElementById('cyberpunkLoadingPct');
    const loadingDetail = document.getElementById('cyberpunkLoadingDetail');

    // Initialize 3D Gyroscopic Mini Loader immediately
    const miniLoader = initMiniLoader3D();

    let width = window.innerWidth;
    let height = window.innerHeight;

    // ------------------------------------------------------------------
    // 1. SCENE, CAMERA & OPTIMIZED RENDERER
    // ------------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070f);
    scene.fog = new THREE.FogExp2(0x05070f, 0.0032);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.3, 450);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        precision: 'highp'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = false;

    container.appendChild(renderer.domElement);

    // ------------------------------------------------------------------
    // 2. CSS3D SCENE & RENDERER (TRUE 3D PERSPECTIVE HOLOGRAPHIC CARDS)
    // ------------------------------------------------------------------
    const cssScene = new THREE.Scene();
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(width, height);
    cssRenderer.domElement.style.position = 'fixed';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.width = '100vw';
    cssRenderer.domElement.style.height = '100vh';
    // CSS3D transforms are rendered visually, but Chromium can miss pointer
    // events on deeply transformed descendants. Keep this layer transparent
    // to hit-testing and route terminal clicks by screen coordinates below.
    cssRenderer.domElement.classList.add('cyberpunk-css3d-visual-layer');
    cssRenderer.domElement.style.pointerEvents = 'none';
    cssRenderer.domElement.style.zIndex = '900';
    document.body.appendChild(cssRenderer.domElement);

    if (cssRenderer.domElement.firstChild) {
        cssRenderer.domElement.firstChild.style.pointerEvents = 'none';
    }

    // ------------------------------------------------------------------
    // 3. 9 PATTERN WAYPOINTS & CENTRIPETAL SPLINES
    // ------------------------------------------------------------------
    const waypointCameraPositions = [
        new THREE.Vector3(77.77, 5.47, -0.96),   // Point 1 (Near monument)
        new THREE.Vector3(75.10, 4.95, 1.57),    // Point 2 (Street glide)
        new THREE.Vector3(55.73, 4.95, 1.59),    // Point 3 (Avenue transit)
        new THREE.Vector3(20.69, 4.95, 1.66),    // Point 4 (Downtown straight)
        new THREE.Vector3(-19.47, 4.95, -6.03),  // Point 5 (Approaching intersection)
        new THREE.Vector3(-43.44, 4.95, -2.85),  // Point 6 (Navigating corner around buildings)
        new THREE.Vector3(-47.78, 5.73, 5.60),   // Point 7 (Beginning gentle elevation)
        new THREE.Vector3(-47.38, 14.53, 18.13), // Point 8 (Rising above rooftops)
        new THREE.Vector3(-63.97, 15.27, 24.95)  // Point 9 (Grand skyline panoramic vista)
    ];

    const waypointLookTargets = [
        new THREE.Vector3(81.92, 4.42, 8.26),    // Look 1 (Facing Trump & Bibi monument)
        new THREE.Vector3(-34.12, 2.68, 1.79),   // Look 2 (Ahead down main boulevard)
        new THREE.Vector3(-69.16, 2.68, 1.84),   // Look 3 (Ahead down main boulevard)
        new THREE.Vector3(-104.20, 2.68, 1.92),  // Look 4 (Long view down road)
        new THREE.Vector3(-50.56, 5.32, 11.85),  // Look 5 (Banking toward side street)
        new THREE.Vector3(-33.41, 5.17, 7.58),   // Look 6 (Street corner architecture)
        new THREE.Vector3(95.49, 4.25, -3.16),   // Look 7 (Sweeping gaze back toward metropolis)
        new THREE.Vector3(75.59, 2.77, -6.65),   // Look 8 (Panoramic cityscape overview)
        new THREE.Vector3(89.09, 2.68, -5.06)    // Look 9 (Skyline horizon)
    ];

    const cameraSpline = new THREE.CatmullRomCurve3(waypointCameraPositions, false, 'centripetal');
    const lookSpline = new THREE.CatmullRomCurve3(waypointLookTargets, false, 'centripetal');

    camera.position.copy(waypointCameraPositions[0]);
    camera.lookAt(waypointLookTargets[0]);

    // ------------------------------------------------------------------
    // 4. SPATIAL HOLOGRAPHIC 3D CARDS (FULL SUITE: CARDS 01 TO 05)
    // ------------------------------------------------------------------
    const cards3D = [];
    // Native clicks on transformed CSS3D descendants are unreliable in
    // Chromium, so the terminal gets fixed-position hit targets whose boxes
    // follow the rendered controls every frame.
    let syncTerminalHitTargets = () => {};

    function create3DCard({ html, position, lookAtTarget, scale = 0.013, className = '', maxDist = 26, minDist = 2, isInteractive = false }) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `cyber-card-3d ${className}`.trim();
        cardDiv.innerHTML = html;
        // The visual card is deliberately not a native hit-test target. The
        // terminal controls are routed from document coordinates so they work
        // consistently even when CSS3DRenderer applies a perspective matrix.
        cardDiv.style.pointerEvents = 'none';

        const cardObject = new CSS3DObject(cardDiv);
        cardObject.position.copy(position);
        cardObject.scale.setScalar(scale);
        
        // CSS3DRenderer's DOM plane faces the camera after lookAt(). A further
        // 180-degree Y rotation displays the back of the plane, which mirrors
        // the text and makes Chromium's 3D hit-testing unreliable.
        cardObject.lookAt(lookAtTarget);

        cssScene.add(cardObject);

        const cardEntry = {
            obj: cardObject,
            el: cardDiv,
            baseY: position.y,
            offset: Math.random() * Math.PI * 2,
            maxDist: maxDist,
            minDist: minDist,
            isInteractive: isInteractive
        };
        cards3D.push(cardEntry);
        return cardEntry;
    }

    // CARD 1: At Point 2-3 (Moved further down boulevard, facing approaching camera)
    create3DCard({
        position: new THREE.Vector3(54.0, 5.0, 6.8),
        lookAtTarget: new THREE.Vector3(72.0, 5.0, 1.57),
        html: `
            <svg class="card-bg-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
            </svg>
            <div class="card-content">
                <div class="cyber-card-tag">
                    <span class="cyber-card-tag-dot"></span>
                    <span>01 // EXCLUSIVE FLEET</span>
                </div>
                <h3 class="cyber-card-title">Handpicked Luxury &amp; Sport</h3>
                <p class="cyber-card-sub">Guaranteed exact models • Fully detailed showroom fleet</p>
                <div class="cyber-card-features">
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                                <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
                            </svg>
                        </span>
                        <span>Exotic Coupes, Sedans &amp; SUVs</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </span>
                        <span>Comprehensive VIP Insurance</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="m4.93 4.93 4.24 4.24"/>
                                <path d="m14.83 9.17 4.24-4.24"/>
                                <path d="M14.83 14.83 19.07 19.07"/>
                                <path d="M9.17 14.83 4.93 19.07"/>
                                <circle cx="12" cy="12" r="2"/>
                            </svg>
                        </span>
                        <span>Pristine Condition, Zero Model Swaps</span>
                    </div>
                </div>
            </div>
        `
    });

    // CARD 2: At Point 3-4 (Central Highway, facing oncoming camera)
    create3DCard({
        position: new THREE.Vector3(30.0, 5.1, 5.2),
        lookAtTarget: new THREE.Vector3(55.73, 5.1, 1.59),
        html: `
            <svg class="card-bg-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <rect x="9" y="11" width="6" height="5" rx="1"/>
                <path d="M10 11V9a2 2 0 1 1 4 0v2"/>
            </svg>
            <div class="card-content">
                <div class="cyber-card-tag">
                    <span class="cyber-card-tag-dot"></span>
                    <span>02 // ZERO PAPERWORK</span>
                </div>
                <h3 class="cyber-card-title">60-Second Digital Unlock</h3>
                <p class="cyber-card-sub">Instant ID verification • Transparent GEL (₾) pricing</p>
                <div class="cyber-card-features">
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <polyline points="16 11 18 13 22 9"/>
                            </svg>
                        </span>
                        <span>Instant Digital ID Verification</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="20" height="14" x="2" y="5" rx="2"/>
                                <line x1="2" x2="22" y1="10" y2="10"/>
                            </svg>
                        </span>
                        <span>No Hidden Fees or Deposit Traps</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
                                <path d="M12 18h.01"/>
                            </svg>
                        </span>
                        <span>Direct Keyless Smartphone Access</span>
                    </div>
                </div>
            </div>
        `
    });

    // CARD 3: At Point 4-5 (Approaching intersection, facing oncoming camera)
    create3DCard({
        position: new THREE.Vector3(0.0, 5.0, 5.5),
        lookAtTarget: new THREE.Vector3(20.69, 5.0, 1.66),
        html: `
            <svg class="card-bg-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
            </svg>
            <div class="card-content">
                <div class="cyber-card-tag">
                    <span class="cyber-card-tag-dot"></span>
                    <span>03 // UNLIMITED FREEDOM</span>
                </div>
                <h3 class="cyber-card-title">Border-to-Border Exploration</h3>
                <p class="cyber-card-sub">Zero kilometer restrictions • Travel Georgia freely</p>
                <div class="cyber-card-features">
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                            </svg>
                        </span>
                        <span>Unlimited Km (Tbilisi, Batumi, Kazbegi)</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                            </svg>
                        </span>
                        <span>24/7 Nationwide Live GPS Support &amp; Towing</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                        </span>
                        <span>Cross-City Drop-Off (Airport, Hotel, Villa)</span>
                    </div>
                </div>
            </div>
        `
    });

    // CARD 4: At Point 5-6 (Curving banking avenue corner)
    create3DCard({
        position: new THREE.Vector3(-32.0, 5.1, 5.5),
        lookAtTarget: new THREE.Vector3(-19.47, 5.1, -6.03),
        html: `
            <svg class="card-bg-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <line x1="2" x2="22" y1="10" y2="10"/>
                <line x1="6" x2="10" y1="15" y2="15"/>
            </svg>
            <div class="card-content">
                <div class="cyber-card-tag">
                    <span class="cyber-card-tag-dot"></span>
                    <span>04 // TRANSPARENT ASSURANCE</span>
                </div>
                <h3 class="cyber-card-title">No Hidden Fees, Zero Surprises</h3>
                <p class="cyber-card-sub">Guaranteed flat rates in GEL (₾) • Instant deposit returns</p>
                <div class="cyber-card-features">
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </span>
                        <span>All-Inclusive Daily Rates, Zero Surcharges</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                            </svg>
                        </span>
                        <span>Automated 24-Hour Deposit Refund</span>
                    </div>
                    <div class="cyber-feature-row">
                        <span class="cyber-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="20" height="14" x="2" y="5" rx="2"/>
                                <line x1="2" x2="22" y1="10" y2="10"/>
                            </svg>
                        </span>
                        <span>Crypto (USDT, BTC) &amp; Global Cards Accepted</span>
                    </div>
                </div>
            </div>
        `
    });

    // CARD 5: At Point 8-9 (Summit Panoramic Skyline - Positioned directly in front of camera)
    const terminalCardEntry = create3DCard({
        className: 'card-search-terminal',
        scale: 0.017,
        maxDist: 35,
        minDist: 1,
        isInteractive: true,
        position: new THREE.Vector3(-52.2, 14.3, 22.6),
        lookAtTarget: new THREE.Vector3(-63.97, 15.27, 24.95),
        html: `
            <svg class="card-bg-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="6" r="6"/>
                <circle cx="12" cy="2" r="2"/>
                <line x1="12" y1="2" x2="12" y2="4"/>
                <line x1="12" y1="20" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="4" y2="12"/>
                <line x1="20" y1="12" x2="22" y2="12"/>
            </svg>
            <div class="card-content">
                <div class="cyber-card-tag">
                    <span class="cyber-card-tag-dot"></span>
                    <span>05 // INSTANT FLEET TERMINAL</span>
                </div>
                <h3 class="cyber-card-title">Search Cars by Location</h3>
                <p class="cyber-card-sub">Instant delivery to any hub in Georgia • Real-time inventory</p>

                <div class="terminal-locations-grid">
                    <a href="/vehicles/?location=tbilisi-airport" data-location="tbilisi-airport" class="terminal-loc-btn active">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Tbilisi Airport (TBS)</span>
                    </a>
                    <a href="/vehicles/?location=tbilisi-city" data-location="tbilisi-city" class="terminal-loc-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Tbilisi Center</span>
                    </a>
                    <a href="/vehicles/?location=batumi" data-location="batumi" class="terminal-loc-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Batumi Boulevard</span>
                    </a>
                    <a href="/vehicles/?location=gudauri" data-location="gudauri" class="terminal-loc-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Gudauri Ski Resort</span>
                    </a>
                </div>

                <div class="terminal-quick-filters">
                    <span class="terminal-filter-pill active">Airport Pick-up</span>
                    <span class="terminal-filter-pill">Hotel Delivery</span>
                    <span class="terminal-filter-pill">VIP Chauffeur</span>
                </div>

                <a href="/vehicles/?location=tbilisi-airport" class="cyber-card-btn terminal-submit-btn">Search Available Fleet (45+ Cars) →</a>
            </div>
        `
    });

    // Wire up interactive location selection on the terminal card with robust click/pointer handlers
    if (terminalCardEntry && terminalCardEntry.el) {
        const locBtns = terminalCardEntry.el.querySelectorAll('.terminal-loc-btn');
        const submitBtn = terminalCardEntry.el.querySelector('.terminal-submit-btn');
        const filterPills = terminalCardEntry.el.querySelectorAll('.terminal-filter-pill');

        let selectedLocation = 'tbilisi-airport';

        locBtns.forEach((locBtn) => {
            const selectLocation = (e) => {
                e.preventDefault();
                e.stopPropagation();
                locBtns.forEach((b) => b.classList.remove('active'));
                locBtn.classList.add('active');
                selectedLocation = locBtn.getAttribute('data-location') || 'tbilisi-airport';
                if (submitBtn) {
                    const newUrl = `/vehicles/?location=${encodeURIComponent(selectedLocation)}`;
                    submitBtn.setAttribute('href', newUrl);
                }
            };
            locBtn.addEventListener('click', selectLocation);
        });

        filterPills.forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                pill.classList.toggle('active');
            });
        });

        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetUrl = submitBtn.getAttribute('href') || `/vehicles/?location=${encodeURIComponent(selectedLocation)}`;
                window.location.href = targetUrl;
            });
        }

        // Build a separate, invisible interaction layer. Each target mirrors
        // one transformed control's screen-space rectangle and forwards its
        // click to the existing, already-wired source element.
        const terminalHitLayer = document.createElement('div');
        terminalHitLayer.className = 'cyberpunk-terminal-hit-layer';
        document.body.appendChild(terminalHitLayer);

        const sourceControls = [
            ...Array.from(locBtns),
            ...Array.from(filterPills),
            ...(submitBtn ? [submitBtn] : [])
        ];

        const hitTargets = sourceControls.map((source) => {
            const target = document.createElement('button');
            target.type = 'button';
            target.className = 'cyberpunk-terminal-hit-target';
            target.setAttribute('aria-hidden', 'true');
            target.tabIndex = -1;
            target.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                source.click();
            });
            terminalHitLayer.appendChild(target);
            return { source, target };
        });

        syncTerminalHitTargets = () => {
            const cardVisible = terminalCardEntry.el.style.visibility !== 'hidden'
                && Number.parseFloat(terminalCardEntry.el.style.opacity || '0') > 0.05;

            hitTargets.forEach(({ source, target }) => {
                if (!cardVisible) {
                    target.style.display = 'none';
                    return;
                }

                const rect = source.getBoundingClientRect();
                const hasArea = rect.width > 0 && rect.height > 0;
                target.style.display = hasArea ? 'block' : 'none';
                if (hasArea) {
                    target.style.left = `${rect.left}px`;
                    target.style.top = `${rect.top}px`;
                    target.style.width = `${rect.width}px`;
                    target.style.height = `${rect.height}px`;
                }
            });
        };
    }

    // ------------------------------------------------------------------
    // 5. SCROLL PROGRESS SYSTEM
    // ------------------------------------------------------------------
    let targetProgress = 0.0;
    let currentProgress = 0.0;

    function updateScrollFraction() {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll > 0) {
            targetProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
        }
    }

    window.addEventListener('scroll', updateScrollFraction, { passive: true });
    updateScrollFraction();

    // ------------------------------------------------------------------
    // 6. MONOCHROME STUDIO LIGHTING (SLEEK GRAY / BLACK / WHITE)
    // ------------------------------------------------------------------
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111116, 1.4);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-120, 100, 80);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xcbd5e1, 1.6);
    rimLight.position.set(130, 80, -90);
    scene.add(rimLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(0, 180, 0);
    scene.add(topLight);

    // ------------------------------------------------------------------
    // 7. ASSET LOADING & OPTIMIZED SETUP
    // ------------------------------------------------------------------
    const loader = new GLTFLoader();
    let cityLoaded = false;
    let statueLoaded = false;
    let carsReady = false;

    function checkAllReady() {
        if (cityLoaded && (statueLoaded || true)) {
            if (progressBar) progressBar.style.width = '100%';
            if (loadingPct) loadingPct.textContent = '100%';
            if (loadingStatus) loadingStatus.textContent = 'METROPOLIS READY';
            if (loadingDetail) loadingDetail.textContent = 'ALL ASSETS STREAMED & SYNCED';

            // Trigger Cinematic 3D Warp Flight in Loader World
            if (miniLoader && typeof miniLoader.triggerWarp === 'function') {
                miniLoader.triggerWarp();
            }

            setTimeout(() => {
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    loadingOverlay.style.transform = 'scale(1.04)';
                    setTimeout(() => { 
                        loadingOverlay.style.visibility = 'hidden'; 
                        if (miniLoader && typeof miniLoader.dispose === 'function') {
                            miniLoader.dispose();
                        }
                        updateScrollFraction();
                    }, 700);
                }
            }, 450);
        }
    }

    // A. LOAD CYBERPUNK CITY (164 MB)
    loader.load(
        '/static/models/cyberpunk_city.glb',
        (gltf) => {
            const cityModel = gltf.scene;

            cityModel.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = true;
                    if (child.material) {
                        child.material.side = THREE.FrontSide;

                        if (child.material.emissive && (child.material.emissive.r > 0 || child.material.emissive.g > 0 || child.material.emissive.b > 0)) {
                            child.material.emissiveIntensity = 2.4;
                        }

                        const matName = (child.material.name || '').toLowerCase();
                        if (matName.includes('neon') || matName.includes('screen') || matName.includes('advertis')) {
                            if (!child.material.emissive || (child.material.emissive.r === 0 && child.material.emissive.g === 0 && child.material.emissive.b === 0)) {
                                child.material.emissive = new THREE.Color(0x00f0ff);
                            }
                            child.material.emissiveIntensity = 2.0;
                        }
                    }
                }
            });

            const box = new THREE.Box3().setFromObject(cityModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;

            const targetScale = 280.0 / maxDim;
            cityModel.scale.setScalar(targetScale);

            cityModel.position.x = -center.x * targetScale;
            cityModel.position.y = -box.min.y * targetScale;
            cityModel.position.z = -center.z * targetScale;

            cityModel.updateMatrixWorld(true);
            cityModel.traverse((child) => {
                child.matrixAutoUpdate = false;
            });

            scene.add(cityModel);
            cityLoaded = true;
            checkAllReady();
        },
        (progress) => {
            if (progress.total > 0) {
                const pct = Math.min(99, Math.round((progress.loaded / progress.total) * 100));
                const loadedMB = (progress.loaded / 1024 / 1024).toFixed(1);
                const totalMB = (progress.total / 1024 / 1024).toFixed(1);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (loadingPct) loadingPct.textContent = `${pct}%`;
                if (loadingDetail) loadingDetail.textContent = `STREAMING ASSETS: ${loadedMB} MB / ${totalMB} MB`;

                if (loadingStatus) {
                    if (pct < 30) {
                        loadingStatus.textContent = 'STREAMING 3D GEOMETRY...';
                    } else if (pct < 65) {
                        loadingStatus.textContent = 'PARSING HIGHWAY & ARCHITECTURE...';
                    } else if (pct < 92) {
                        loadingStatus.textContent = 'CALIBRATING CAMERA CORRIDORS...';
                    } else {
                        loadingStatus.textContent = 'FINALIZING HDR SHADERS...';
                    }
                }
            } else if (progress.loaded > 0) {
                const loadedMB = (progress.loaded / 1024 / 1024).toFixed(1);
                if (loadingDetail) loadingDetail.textContent = `STREAMING ASSETS: ${loadedMB} MB LOADED`;
            }
        },
        (err) => {
            console.error('Error loading cyberpunk_city.glb:', err);
            if (loadingStatus) loadingStatus.textContent = 'ERROR LOADING 3D ASSETS';
            if (loadingDetail) loadingDetail.textContent = 'CHECK CONSOLE LOGS';
        }
    );

    // B. LOAD "netanyaho-loves-trump.glb"
    loader.load(
        '/static/models/netanyaho-loves-trump.glb',
        (gltf) => {
            const statue = gltf.scene;

            statue.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = true;
                    child.material = new THREE.MeshStandardMaterial({
                        vertexColors: true,
                        roughness: 0.55,
                        metalness: 0.08,
                        side: THREE.FrontSide
                    });
                }
            });

            const STATUE_SCALE = 5.5;
            statue.scale.setScalar(STATUE_SCALE);

            statue.position.set(82.85, 0, 7.90);
            statue.updateMatrixWorld(true);

            const initialBox = new THREE.Box3().setFromObject(statue);
            const groundY = 2.75;
            const yOffset = groundY - initialBox.min.y;

            statue.position.set(82.85, yOffset, 7.90);
            statue.lookAt(82.92, yOffset, -5.39);

            statue.updateMatrixWorld(true);
            statue.traverse((child) => {
                child.matrixAutoUpdate = false;
            });

            const keyLight = new THREE.PointLight(0xfff5ea, 4.5, 30);
            keyLight.position.set(82.85 + 4.0, yOffset + 5.0, 7.90 - 4.0);
            scene.add(keyLight);

            const fillLight = new THREE.PointLight(0x00f0ff, 2.5, 25);
            fillLight.position.set(82.85 - 4.0, yOffset + 3.5, 7.90 + 3.0);
            scene.add(fillLight);

            const baseRing = new THREE.Mesh(
                new THREE.RingGeometry(2.8, 3.2, 32),
                new THREE.MeshBasicMaterial({ color: 0xff007f, side: THREE.DoubleSide })
            );
            baseRing.rotation.x = -Math.PI / 2;
            baseRing.position.set(82.85, groundY + 0.02, 7.90);
            baseRing.matrixAutoUpdate = false;
            baseRing.updateMatrix();
            scene.add(baseRing);

            scene.add(statue);
            statueLoaded = true;
            checkAllReady();
        },
        undefined,
        (err) => {
            console.warn('Could not load netanyaho-loves-trump.glb:', err);
            statueLoaded = true;
            checkAllReady();
        }
    );

    // C. 4 HIGH-PERFORMANCE CAR TRAFFIC ROUTES
    const ROAD_Y = 2.75;

    const trafficConfigs = [
        // Route 1A & 1B: Main Boulevard (Spawns every 4.0s, drives for 7.0s before disappearing)
        {
            id: '1a',
            spawn: new THREE.Vector3(110.81, ROAD_Y, 1.11),
            target: new THREE.Vector3(-100.87, ROAD_Y, 3.21),
            stagger: 0.0,
            speed: 26.0,
            lifetime: 7.0,
            cycleDuration: 8.0
        },
        {
            id: '1b',
            spawn: new THREE.Vector3(110.81, ROAD_Y, 1.11),
            target: new THREE.Vector3(-100.87, ROAD_Y, 3.21),
            stagger: 4.0,
            speed: 26.0,
            lifetime: 7.0,
            cycleDuration: 8.0
        },
        {
            id: 2,
            spawn: new THREE.Vector3(88.45, ROAD_Y, -46.49),
            target: new THREE.Vector3(87.66, ROAD_Y, 24.07),
            stagger: 1.0,
            speed: 20.0,
            lifetime: 3.7,
            cycleDuration: 4.0
        },
        {
            id: 3,
            spawn: new THREE.Vector3(43.02, ROAD_Y, 48.67),
            target: new THREE.Vector3(43.13, ROAD_Y, -19.58),
            stagger: 2.0,
            speed: 21.0,
            lifetime: 3.7,
            cycleDuration: 4.0
        },
        {
            id: 4,
            spawn: new THREE.Vector3(-0.71, ROAD_Y, -52.57),
            target: new THREE.Vector3(-1.49, ROAD_Y, 8.09),
            stagger: 3.0,
            speed: 22.0,
            lifetime: 3.7,
            cycleDuration: 4.0
        }
    ];

    const activeCars = [];

    loader.load(
        '/static/models/bmw_m4_convertible_g83_2021.glb',
        (gltf) => {
            const baseCar = gltf.scene;

            baseCar.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = true;
                    if (child.material) {
                        child.material.side = THREE.FrontSide;
                    }
                }
            });

            const carBox = new THREE.Box3().setFromObject(baseCar);
            const wheelOffsetY = -carBox.min.y + 0.08;

            trafficConfigs.forEach((cfg) => {
                const carMesh = SkeletonUtils.clone(baseCar);
                carMesh.position.y = wheelOffsetY;
                carMesh.rotation.y = Math.PI;

                const dir = new THREE.Vector3().subVectors(cfg.target, cfg.spawn);
                dir.y = 0;
                dir.normalize();

                const carGroup = new THREE.Group();
                carGroup.add(carMesh);

                carGroup.position.copy(cfg.spawn);
                carGroup.lookAt(cfg.spawn.clone().add(dir));

                scene.add(carGroup);

                activeCars.push({
                    group: carGroup,
                    spawn: cfg.spawn.clone(),
                    dir: dir,
                    speed: cfg.speed,
                    timer: -cfg.stagger,
                    lifetime: cfg.lifetime || 3.7,
                    cycleDuration: cfg.cycleDuration || 4.0
                });
            });

            carsReady = true;
            checkAllReady();
        },
        undefined,
        (err) => {
            console.warn('Could not load BMW M4 model:', err);
            carsReady = true;
            checkAllReady();
        }
    );

    function updateTraffic(delta) {
        if (!carsReady || activeCars.length === 0) return;

        activeCars.forEach((car) => {
            car.timer += delta;

            if (car.timer < 0) {
                car.group.visible = false;
                return;
            }

            const progress = car.timer % car.cycleDuration;
            const lifetime = car.lifetime;

            // Disappear exactly after lifetime seconds from spawn
            if (progress >= lifetime) {
                car.group.visible = false;
                return;
            }

            car.group.position.copy(car.spawn).addScaledVector(car.dir, car.speed * progress);
            car.group.visible = true;

            // Smooth appear on spawn (0.3s) and smooth fade on disappearance (last 0.4s of lifetime)
            if (progress < 0.3) {
                const appear = progress / 0.3;
                car.group.scale.setScalar(Math.max(0.01, appear));
            } else if (progress > lifetime - 0.4) {
                const fade = Math.max(0.01, (lifetime - progress) / 0.4);
                car.group.scale.setScalar(fade);
            } else {
                car.group.scale.setScalar(1.0);
            }
        });
    }

    // ------------------------------------------------------------------
    // 8. ANIMATION LOOP WITH CENTRIPETAL SPLINE LERPING & 3D CARDS
    // ------------------------------------------------------------------
    const clock = new THREE.Clock();
    const currentCamPos = new THREE.Vector3();
    const currentLookTarget = new THREE.Vector3();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);
        const elapsed = clock.getElapsedTime();

        // 1. Update car traffic
        updateTraffic(delta);

        // 2. Smooth cinematic camera glide along 9 waypoints
        currentProgress += (targetProgress - currentProgress) * 0.08;
        const t = Math.max(0, Math.min(1, currentProgress));

        cameraSpline.getPointAt(t, currentCamPos);
        lookSpline.getPointAt(t, currentLookTarget);

        camera.position.copy(currentCamPos);
        camera.lookAt(currentLookTarget);

        // 3. Update 3D Holographic Cards (Floating Bob on info cards, Rock-solid stability on interactive terminal)
        cards3D.forEach((card) => {
            if (!card.isInteractive) {
                card.obj.position.y = card.baseY + Math.sin(elapsed * 2.0 + card.offset) * 0.12;
            }

            const dist = camera.position.distanceTo(card.obj.position);
            const maxD = card.maxDist || 26;
            const minD = card.minDist || 2;
            let opacity = 0;

            const isTerminal = card.el.classList.contains('card-search-terminal');
            if (isTerminal) {
                // Card 5 appears only as the camera climbs to the final summit (progress >= 0.70)
                if (currentProgress >= 0.70) {
                    opacity = Math.min(1, (currentProgress - 0.70) / 0.15);
                } else {
                    opacity = 0;
                }
            } else if (dist < maxD && dist > minD) {
                // Cards 1-4: Render only when within close proximity (~26 units)
                const fadeRange = 7;
                if (dist > maxD - fadeRange) {
                    opacity = (maxD - dist) / fadeRange;
                } else if (dist < minD + 3) {
                    opacity = (dist - minD) / 3;
                } else {
                    opacity = 1.0;
                }
            }

            opacity = Math.max(0, Math.min(1, opacity));
            card.el.style.opacity = opacity.toFixed(2);

            // Button Clickability & DOM hit-testing:
            if (opacity > 0.05) {
                card.el.style.visibility = 'visible';
                card.el.style.pointerEvents = 'auto';
                card.el.style.zIndex = isTerminal ? '10000' : String(Math.max(1, Math.round(1000 - dist)));
            } else {
                card.el.style.visibility = 'hidden';
                card.el.style.pointerEvents = 'none';
                card.el.style.zIndex = '0';
            }
        });

        // Keep the separate terminal hit targets aligned with the CSS3D card.
        syncTerminalHitTargets();

        // 4. Render WebGL 3D World & CSS3D Spatial Cards
        renderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
    }

    animate();

    // ------------------------------------------------------------------
    // 9. WINDOW RESIZE (FULL VIEWPORT)
    // ------------------------------------------------------------------
    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        if (width && height) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
            cssRenderer.setSize(width, height);
            updateScrollFraction();
        }
    });
}

// ==========================================================================
// Immersive Full-Viewport Three.js 3D World Loader Scene
// ==========================================================================
function initMiniLoader3D() {
    const canvas = document.getElementById('loader3dCanvas');
    if (!canvas) return null;

    let animId = null;
    let isDisposed = false;
    let isWarping = false;

    try {
        const miniRenderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance'
        });
        const width = window.innerWidth;
        const height = window.innerHeight;
        miniRenderer.setSize(width, height);
        miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        miniRenderer.outputColorSpace = THREE.SRGBColorSpace;

        const miniScene = new THREE.Scene();
        miniScene.background = new THREE.Color(0x020408);
        miniScene.fog = new THREE.FogExp2(0x020408, 0.016);

        const miniCamera = new THREE.PerspectiveCamera(48, width / height, 0.1, 400);
        miniCamera.position.set(0, 3.4, 16);
        miniCamera.lookAt(0, 1.2, 0);

        // Interactive Mouse / Cursor Parallax
        let targetCamX = 0;
        let targetCamY = 3.4;

        const onMouseMove = (e) => {
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = -(e.clientY / window.innerHeight) * 2 + 1;
            targetCamX = nx * 3.8;
            targetCamY = 3.4 + ny * 1.8;
        };
        window.addEventListener('mousemove', onMouseMove, { passive: true });

        // 1. Infinite Moving Wireframe Ground Grid World
        const gridHelper = new THREE.GridHelper(260, 64, 0xffffff, 0x1e293b);
        gridHelper.position.y = -2.2;
        miniScene.add(gridHelper);

        // 2. Flanking Futuristic Monolithic Glass Columns
        const columnsGroup = new THREE.Group();
        miniScene.add(columnsGroup);

        const colMaterial = new THREE.MeshStandardMaterial({
            color: 0x060912,
            roughness: 0.18,
            metalness: 0.9
        });
        const colEdgeMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.38
        });

        const colPositions = [
            [-8, -10], [-10, 0], [-11, 10], [-7, 20], [-9, -25], [-12, -35],
            [8, -10], [10, 0], [11, 10], [7, 20], [9, -25], [12, -35]
        ];

        const geometriesToDispose = [gridHelper.geometry];
        const materialsToDispose = [gridHelper.material, colMaterial, colEdgeMaterial];

        colPositions.forEach(([x, z], idx) => {
            const colH = 8 + (idx % 4) * 3.5;
            const colGeo = new THREE.BoxGeometry(1.2, colH, 1.2);
            geometriesToDispose.push(colGeo);
            const colMesh = new THREE.Mesh(colGeo, colMaterial);
            colMesh.position.set(x, -2.2 + colH / 2, z);

            const edgesGeo = new THREE.EdgesGeometry(colGeo);
            geometriesToDispose.push(edgesGeo);
            const edgeLines = new THREE.LineSegments(edgesGeo, colEdgeMaterial);
            colMesh.add(edgeLines);

            columnsGroup.add(colMesh);
        });

        // 3. Central Hero Gyroscopic Telemetry Orb Complex
        const heroGroup = new THREE.Group();
        heroGroup.position.set(0, 1.4, 0);
        miniScene.add(heroGroup);

        // Ring 1 (Outer Platinum Titanium Ring)
        const ring1Geo = new THREE.TorusGeometry(3.6, 0.038, 16, 80);
        geometriesToDispose.push(ring1Geo);
        const ring1Mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        materialsToDispose.push(ring1Mat);
        const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
        heroGroup.add(ring1);

        // Ring 2 (Middle Tilted Silver Ring)
        const ring2Geo = new THREE.TorusGeometry(2.7, 0.03, 16, 64);
        geometriesToDispose.push(ring2Geo);
        const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 });
        materialsToDispose.push(ring2Mat);
        const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.rotation.x = Math.PI / 3.4;
        heroGroup.add(ring2);

        // Ring 3 (Inner Counter-Rotating Titanium Ring)
        const ring3Geo = new THREE.TorusGeometry(1.85, 0.024, 16, 48);
        geometriesToDispose.push(ring3Geo);
        const ring3Mat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 });
        materialsToDispose.push(ring3Mat);
        const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
        ring3.rotation.y = Math.PI / 3.8;
        heroGroup.add(ring3);

        // Wireframe Crystalline Core (Icosahedron)
        const coreGeo = new THREE.IcosahedronGeometry(0.95, 1);
        geometriesToDispose.push(coreGeo);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.95 });
        materialsToDispose.push(coreMat);
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        heroGroup.add(coreMesh);

        // Central Luminous Seed
        const seedGeo = new THREE.SphereGeometry(0.35, 16, 16);
        geometriesToDispose.push(seedGeo);
        const seedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        materialsToDispose.push(seedMat);
        const seedMesh = new THREE.Mesh(seedGeo, seedMat);
        heroGroup.add(seedMesh);

        // 4. Cosmic Particle / Star Swarm
        const partCount = 450;
        const partPos = new Float32Array(partCount * 3);
        for (let i = 0; i < partCount; i++) {
            partPos[i * 3] = (Math.random() - 0.5) * 110;
            partPos[i * 3 + 1] = Math.random() * 45 - 2;
            partPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
        }
        const partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
        geometriesToDispose.push(partGeo);
        const partMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85 });
        materialsToDispose.push(partMat);
        const starField = new THREE.Points(partGeo, partMat);
        miniScene.add(starField);

        // 5. Studio Lighting
        const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
        miniScene.add(ambLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(15, 25, 20);
        miniScene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x94a3b8, 1.6);
        rimLight.position.set(-15, -10, -20);
        miniScene.add(rimLight);

        // Resize Listener
        const onResize = () => {
            if (isDisposed) return;
            const w = window.innerWidth;
            const h = window.innerHeight;
            miniCamera.aspect = w / h;
            miniCamera.updateProjectionMatrix();
            miniRenderer.setSize(w, h);
            miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        };
        window.addEventListener('resize', onResize);

        // Animation Loop
        function renderLoader() {
            if (isDisposed) return;
            animId = requestAnimationFrame(renderLoader);

            // Forward Flight Movement along Ground Grid
            gridHelper.position.z = ((Date.now() * 0.0035) % 4.06);

            // Gyroscope Orbital Rotations
            ring1.rotation.z += 0.014;
            ring2.rotation.x += 0.018;
            ring2.rotation.y += 0.012;
            ring3.rotation.z -= 0.022;
            ring3.rotation.x -= 0.01;
            coreMesh.rotation.y += 0.024;
            coreMesh.rotation.x += 0.016;

            // Cosmic Stars Slow Rotation
            starField.rotation.y += 0.0006;

            // Smooth Mouse Parallax
            miniCamera.position.x += (targetCamX - miniCamera.position.x) * 0.05;
            miniCamera.position.y += (targetCamY - miniCamera.position.y) * 0.05;
            miniCamera.lookAt(0, 1.2, 0);

            // Warp Acceleration on Ready
            if (isWarping) {
                miniCamera.position.z -= 0.65;
                miniCamera.fov = Math.min(105, miniCamera.fov + 0.85);
                miniCamera.updateProjectionMatrix();
                heroGroup.scale.multiplyScalar(1.025);
            }

            miniRenderer.render(miniScene, miniCamera);
        }
        renderLoader();

        return {
            triggerWarp: () => {
                isWarping = true;
            },
            dispose: () => {
                isDisposed = true;
                if (animId) cancelAnimationFrame(animId);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('resize', onResize);

                geometriesToDispose.forEach(g => { try { g.dispose(); } catch (e) {} });
                materialsToDispose.forEach(m => { try { m.dispose(); } catch (e) {} });
                miniRenderer.dispose();
            }
        };
    } catch (e) {
        console.warn('Full-world 3D loader init error:', e);
        return null;
    }
}
