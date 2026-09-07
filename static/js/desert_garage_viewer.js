// ==========================================================================
// 3D Desert Garage Interactive Viewer
// Renders car_garage__desert_garage_environment.glb with the chosen vehicle inside.
// User can drag anywhere to rotate 360° around the car.
// ==========================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let modalEl = null;
let containerEl = null;
let loadingOverlayEl = null;
let currentSession = null;
let cachedGarageModel = null;
let isGarageLoading = false;
const garageWaiters = [];

// Initialize Click Listeners for Eye Buttons
document.addEventListener('DOMContentLoaded', () => {
    initGarageModalDom();
});

function initGarageModalDom() {
    modalEl = document.getElementById('desertGarageModal');
    containerEl = document.getElementById('desertGarageCanvasMount');
    loadingOverlayEl = document.getElementById('garageLoadingOverlay');

    const closeBtn = document.getElementById('garageCloseBtn');
    const backdrop = document.getElementById('garageBackdrop');

    if (closeBtn) closeBtn.addEventListener('click', closeDesertGarageModal);
    if (backdrop) backdrop.addEventListener('click', closeDesertGarageModal);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl && modalEl.classList.contains('open')) {
            closeDesertGarageModal();
        }
    });

    // Delegate click on all eye buttons across the page
    document.addEventListener('click', (e) => {
        const eyeBtn = e.target.closest('.card-garage-eye-btn');
        if (eyeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const modelUrl = eyeBtn.getAttribute('data-model-url');
            const carId = eyeBtn.getAttribute('data-car-id');
            openDesertGarageModal(modelUrl, carId);
        }
    });
}

// In-Memory Shared RoomEnvironment
let sharedEnvTexture = null;
function getSharedEnv(renderer) {
    if (!sharedEnvTexture) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        sharedEnvTexture = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
        pmrem.dispose();
    }
    return sharedEnvTexture;
}

// Load or retrieve cached garage model
function getGarageModel() {
    return new Promise((resolve, reject) => {
        if (cachedGarageModel) {
            resolve(SkeletonUtils.clone(cachedGarageModel));
            return;
        }

        if (isGarageLoading) {
            garageWaiters.push({ resolve, reject });
            return;
        }

        isGarageLoading = true;
        const loader = new GLTFLoader();
        loader.load(
            '/static/models/car_garage__desert_garage_environment.glb',
            (gltf) => {
                const model = gltf.scene;

                // Calibrate and clean materials
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                        }
                    }
                });

                // Compute bounding box to ground garage floor at y = 0
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());

                model.position.x = -center.x;
                model.position.y = -box.min.y;
                model.position.z = -center.z;

                cachedGarageModel = model;
                isGarageLoading = false;

                resolve(SkeletonUtils.clone(model));
                garageWaiters.forEach(w => w.resolve(SkeletonUtils.clone(model)));
                garageWaiters.length = 0;
            },
            undefined,
            (err) => {
                isGarageLoading = false;
                console.error('Failed to load desert garage environment:', err);
                reject(err);
                garageWaiters.forEach(w => w.reject(err));
                garageWaiters.length = 0;
            }
        );
    });
}

// Load car model supporting multiple formats
function loadVehicleModel(url) {
    return new Promise((resolve, reject) => {
        const ext = url.split('?')[0].split('.').pop().toLowerCase();
        let loader;
        if (ext === 'glb' || ext === 'gltf') {
            loader = new GLTFLoader();
        } else if (ext === 'fbx') {
            loader = new FBXLoader();
        } else if (ext === 'obj') {
            loader = new OBJLoader();
        } else {
            loader = new ColladaLoader();
        }

        loader.load(
            url,
            (res) => {
                const root = res.scene || res;

                // Remove unwanted studio cameras/lights
                const toRemove = [];
                root.traverse((c) => {
                    if (c.isCamera || c.isLight || c.name === 'Plane_023') toRemove.push(c);
                });
                toRemove.forEach(c => c.parent?.remove(c));

                root.traverse((c) => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                        if (c.material) {
                            c.material.side = THREE.DoubleSide;
                        }
                    }
                });

                resolve(root);
            },
            undefined,
            (err) => reject(err)
        );
    });
}

export function openDesertGarageModal(carModelUrl, carId) {
    if (!modalEl || !containerEl) initGarageModalDom();
    if (!modalEl || !containerEl) return;

    // Terminate existing session if open
    closeDesertGarageModal();

    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    if (loadingOverlayEl) loadingOverlayEl.classList.remove('hidden');

    const width = containerEl.clientWidth || (window.innerWidth * 0.95);
    const height = containerEl.clientHeight || (window.innerHeight * 0.92);

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c12);
    scene.fog = new THREE.FogExp2(0x0a0c12, 0.008);

    // 3. Stationary Camera & Lighting Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.2, 500);
    // Initial camera position will be calibrated once turntable coordinates are known
    camera.position.set(3.6, 1.8, 5.2);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'highp'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cursor = 'grab';

    containerEl.innerHTML = '';
    containerEl.appendChild(renderer.domElement);

    // Environment map for reflections
    scene.environment = getSharedEnv(renderer);

    // Realistic Studio & Desert Sun Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x1e293b, 1.4);
    scene.add(hemiLight);

    // Main Desert Sunlight entering the garage
    const sunLight = new THREE.DirectionalLight(0xfff6e5, 3.4);
    sunLight.position.set(18, 32, 22);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    scene.add(sunLight);

    // Overhead showroom warm light
    const garageOverhead = new THREE.PointLight(0xffeed6, 2.8, 35, 1.2);
    garageOverhead.position.set(0, 6.5, 0);
    scene.add(garageOverhead);

    const rimLight = new THREE.DirectionalLight(0x94a3b8, 1.4);
    rimLight.position.set(-16, 14, -18);
    scene.add(rimLight);

    // 4. Car Pivot & Direct Drag-to-Rotate Interaction
    const carPivot = new THREE.Group();
    scene.add(carPivot);

    let isDragging = false;
    let prevPointerX = 0;
    let carAngularVelocity = 0;
    const DRAG_SPEED = 0.0075;
    const FRICTION = 0.92;

    const onPointerDown = (e) => {
        isDragging = true;
        prevPointerX = e.clientX;
        carAngularVelocity = 0;
        renderer.domElement.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - prevPointerX;
        prevPointerX = e.clientX;
        carPivot.rotation.y += deltaX * DRAG_SPEED;
        carAngularVelocity = deltaX * DRAG_SPEED;
    };

    const onPointerUp = () => {
        if (isDragging) {
            isDragging = false;
            renderer.domElement.style.cursor = 'grab';
        }
    };

    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            prevPointerX = e.touches[0].clientX;
            carAngularVelocity = 0;
        }
    };

    const onTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const deltaX = e.touches[0].clientX - prevPointerX;
        prevPointerX = e.touches[0].clientX;
        carPivot.rotation.y += deltaX * DRAG_SPEED;
        carAngularVelocity = deltaX * DRAG_SPEED;
    };

    const onTouchEnd = () => {
        isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    let animId = null;
    let isDisposed = false;

    function renderLoop() {
        if (isDisposed) return;
        animId = requestAnimationFrame(renderLoop);

        // Smooth inertial spin deceleration
        if (!isDragging && Math.abs(carAngularVelocity) > 0.00008) {
            carPivot.rotation.y += carAngularVelocity;
            carAngularVelocity *= FRICTION;
        }

        renderer.render(scene, camera);
    }
    renderLoop();

    // Resize Handler
    const onResize = () => {
        if (isDisposed || !containerEl) return;
        const w = containerEl.clientWidth || window.innerWidth;
        const h = containerEl.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    };
    window.addEventListener('resize', onResize);

    currentSession = {
        dispose: () => {
            isDisposed = true;
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);

            dom.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            dom.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);

            scene.traverse((obj) => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                }
            });

            renderer.dispose();
            if (containerEl && renderer.domElement.parentNode === containerEl) {
                containerEl.removeChild(renderer.domElement);
            }
        }
    };

    // 5. Load Desert Garage & Car Models in Parallel
    const defaultFallbackCar = '/static/models/bmw_m4_convertible_g83_2021.glb';
    const targetCarUrl = carModelUrl || defaultFallbackCar;

    Promise.all([
        getGarageModel(),
        loadVehicleModel(targetCarUrl).catch((err) => {
            console.warn('Selected vehicle failed to load, falling back to BMW M4:', err);
            return loadVehicleModel(defaultFallbackCar);
        })
    ]).then(([garageScene, carScene]) => {
        if (isDisposed) return;

        // A. Add Garage Environment
        scene.add(garageScene);
        garageScene.updateMatrixWorld(true);

        // B. Detect Turntable Platform & Position Car squarely on it
        let turntableX = 0;
        let turntableY = 0.04;
        let turntableZ = 0;

        const turntableMesh = garageScene.getObjectByName('Circle_ImageTexture_0') ||
                              garageScene.getObjectByName('Circle_YellowMetal_0') ||
                              garageScene.getObjectByName('Circle');

        if (turntableMesh) {
            turntableMesh.updateWorldMatrix(true, true);
            const tbBox = new THREE.Box3().setFromObject(turntableMesh);
            const tbCenter = tbBox.getCenter(new THREE.Vector3());
            turntableX = tbCenter.x;
            turntableY = tbBox.max.y;
            turntableZ = tbCenter.z;
        }

        // Place carPivot at the turntable center (and nudge slightly forward for perfect placement)
        carPivot.position.set(turntableX, turntableY + 0.02, turntableZ);

        // Normalize & scale vehicle to realistic length (~4.8m)
        const carBox = new THREE.Box3().setFromObject(carScene);
        const carSize = carBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(carSize.x, carSize.y, carSize.z) || 1;
        const targetLength = 4.8;
        const scaleFactor = targetLength / maxDim;
        carScene.scale.setScalar(scaleFactor);

        // Center car geometry relative to its pivot
        const scaledBox = new THREE.Box3().setFromObject(carScene);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        carScene.position.x = -scaledCenter.x;
        carScene.position.y = -scaledBox.min.y;
        carScene.position.z = -scaledCenter.z;

        // Angle car toward the cinematic camera viewpoint
        carPivot.rotation.y = Math.PI / 4;

        carPivot.add(carScene);

        // C. Position stationary camera for cinematic view of car on turntable
        camera.position.set(turntableX + 3.4, turntableY + 1.6, turntableZ + 4.6);
        camera.lookAt(turntableX, turntableY + 0.75, turntableZ);

        // Overhead garage fill centered above car
        garageOverhead.position.set(turntableX, turntableY + 5.5, turntableZ);

        // Reveal view
        if (loadingOverlayEl) {
            loadingOverlayEl.classList.add('hidden');
        }
    }).catch((err) => {
        console.error('Error setting up desert garage scene:', err);
        if (loadingOverlayEl) loadingOverlayEl.classList.add('hidden');
    });
}

export function closeDesertGarageModal() {
    if (modalEl) {
        modalEl.classList.remove('open');
        modalEl.setAttribute('aria-hidden', 'true');
    }
    if (currentSession) {
        currentSession.dispose();
        currentSession = null;
    }
}
