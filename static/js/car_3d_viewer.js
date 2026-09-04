// Three.js High-Performance Interactive 3D Car Viewer for Vehicle Cards
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

document.addEventListener('DOMContentLoaded', () => {
    initAll3DCardViewports();
});

// ==========================================
// 1. PERFORMANCE INFRASTRUCTURE:
//    - Shared RoomEnvironment (compiles shaders once, not 6x)
//    - Model In-Memory Cache (downloads & parses 35MB BMW M4 only ONCE)
//    - Concurrency Queue (max 2 parallel loads to eliminate browser lag)
// ==========================================

let sharedEnvironmentTexture = null;
function getSharedEnvironment(renderer) {
    if (!sharedEnvironmentTexture) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        sharedEnvironmentTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture;
        pmremGenerator.dispose();
    }
    return sharedEnvironmentTexture;
}

// In-memory model cache to avoid re-downloading duplicate models
const modelCache = new Map();
const inFlightRequests = new Map();

class ConcurrencyQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(() => fn().then(resolve).catch(reject));
            this.next();
        });
    }

    next() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            this.running++;
            const task = this.queue.shift();
            task().finally(() => {
                this.running--;
                this.next();
            });
        }
    }
}

const loadQueue = new ConcurrencyQueue(2);

// Load model via concurrency queue (using browser HTTP caching instead of Object3D.clone to preserve SkinnedMesh skeletons)
function loadModelQueued(modelUrl, carId) {
    return loadQueue.add(() => {
        return new Promise((resolve, reject) => {
            const ext = modelUrl.split('?')[0].split('.').pop().toLowerCase();
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
                modelUrl,
                (result) => {
                    const carModel = result.scene || result;

                    // Remove non-car studio artifacts
                    const objectsToRemove = [];
                    carModel.traverse((child) => {
                        if (child.isLight || child.isCamera || child.name === 'Plane_023') {
                            objectsToRemove.push(child);
                        }
                    });
                    objectsToRemove.forEach(obj => obj.parent?.remove(obj));

                    // If GLTF/GLB: preserve authentic embedded PBR materials
                    if (ext === 'glb' || ext === 'gltf') {
                        carModel.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (child.material) {
                                    child.material.side = THREE.DoubleSide;
                                }
                            }
                        });
                    } else {
                        applyRealisticCarMaterials(carModel, carId);
                    }

                    resolve(carModel);
                },
                undefined,
                (err) => reject(err)
            );
        });
    });
}

// ==========================================
// 2. VIEWPORT INITIALIZATION
// ==========================================

function initAll3DCardViewports() {
    const viewports = document.querySelectorAll('.card-3d-viewport');
    viewports.forEach(viewport => {
        initSingle3DViewer(viewport);
    });
}

function initSingle3DViewer(container) {
    const modelUrl = container.dataset.modelUrl;
    const carId = container.dataset.carId || 'default';
    if (!modelUrl) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 220;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup (Showroom 3/4 angle)
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000);
    camera.position.set(3.0, 1.25, 3.2);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    renderer.domElement.className = 'canvas-3d-car';
    container.appendChild(renderer.domElement);

    // 4. Shared Studio Lighting (Environment texture shared across all cards)
    scene.environment = getSharedEnvironment(renderer);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(6, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb0d0ff, 1.6);
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 9, 0);
    scene.add(topLight);

    // 5. Contact Floor Shadow (Rotated 90° so length matches car body along Z axis)
    const shadowMesh = createContactShadow();
    scene.add(shadowMesh);

    // 6. Orbit Controls (Lower sensitivity for smooth, tactile dragging)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.35;
    controls.enableZoom = false; // Protect page scrolling
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minPolarAngle = Math.PI / 4.5;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.target.set(0, 0.55, 0);

    container.addEventListener('pointerdown', () => {
        controls.autoRotate = false;
    });

    // 7. Visibility & Render Throttling (Zero lag when loading or off-screen)
    let isModelLoaded = false;
    let isVisible = true;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isVisible = entry.isIntersecting;
            });
        }, { threshold: 0.05 });
        observer.observe(container);
    }

    // Auto-adapt canvas and camera on layout change (e.g. split-map toggle)
    if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width || container.clientWidth;
                const h = entry.contentRect.height || container.clientHeight;
                if (w > 0 && h > 0) {
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    renderer.setSize(w, h);
                }
            }
        });
        resizeObserver.observe(container);
    }

    // Animation Loop: only renders when model is ready and card is visible
    function animate() {
        requestAnimationFrame(animate);
        if (!isModelLoaded || !isVisible) return;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // 8. Load 3D Model with Queue
    const loadingIndicator = container.querySelector('.model-loading-indicator');

    loadModelQueued(modelUrl, carId)
        .then((carModel) => {
            // Auto-center & scale using a parent wrapper group
            const wrapper = new THREE.Group();
            wrapper.add(carModel);

            // Orient model forward so it shows 3/4 hero front view initially
            if (modelUrl.toLowerCase().includes('bmw')) {
                carModel.rotation.y = Math.PI;
            }

            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            carModel.position.x = -center.x;
            carModel.position.y = -box.min.y; // Sits directly on ground
            carModel.position.z = -center.z;

            // Target dimension: prominent size while keeping the whole car framed
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetDim = 4.05;
            const scaleFactor = targetDim / maxDim;
            wrapper.scale.setScalar(scaleFactor);

            scene.add(wrapper);

            const visualHeight = (size.y * scaleFactor) || 1.25;
            controls.target.set(0, visualHeight * 0.42, 0);
            camera.position.set(3.0, visualHeight * 0.88, 3.2);
            controls.update();

            // Mark ready and fade out loading indicator
            isModelLoaded = true;
            if (loadingIndicator) {
                loadingIndicator.style.opacity = '0';
                setTimeout(() => loadingIndicator.remove(), 250);
            }
        })
        .catch((error) => {
            console.error('Error loading 3D car model:', error);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = '<span style="font-size:10px; color:#ef4444;">3D Preview Unavailable</span>';
            }
        });

    // 9. Resize Handling
    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        if (newWidth && newHeight) {
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        }
    });
}

// ==========================================
// 3. CONTACT FLOOR SHADOW
//    - Rotated so the length (Z axis) matches the car length
//    - Soft ambient occlusion oval gradient
// ==========================================
function createContactShadow() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const ctx = shadowCanvas.getContext('2d');

    // Create realistic car floor ambient occlusion (narrower along X, longer along Z)
    ctx.save();
    ctx.translate(256, 256);
    ctx.scale(0.50, 1.0); // 0.50 width ratio to match car aspect ratio

    const gradient = ctx.createRadialGradient(0, 0, 30, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
    gradient.addColorStop(0.70, 'rgba(0, 0, 0, 0.20)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    // X = 2.3 (width across car), Z = 4.6 (length front-to-back under car)
    // Rotated 90° so it aligns along the car's body
    const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 4.6),
        new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
        })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    return shadowPlane;
}

// ==========================================
// 4. PBR MATERIAL UPGRADES FOR PROCEDURAL MODELS
// ==========================================
function upgradeSingleMaterial(mat, nodeName, carId, materialIndex) {
    if (!mat) return mat;

    const matName = (mat.name || '').toLowerCase();
    const meshName = (nodeName || '').toLowerCase();
    const combined = `${matName} ${meshName}`;

    // 1. Smoked Glass / Windows / Windshield
    if (combined.includes('glass') || combined.includes('cam') || combined.includes('window') || combined.includes('windshield') || (mat.opacity < 0.95 && mat.transparent)) {
        return new THREE.MeshPhysicalMaterial({
            name: mat.name,
            color: 0x0a1018,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.88,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
        });
    }

    // 2. Tires / Rubber Trim
    if (combined.includes('rubber') || combined.includes('tire') || combined.includes('tyre') || combined.includes('kau') || combined.includes('teker')) {
        return new THREE.MeshStandardMaterial({
            name: mat.name,
            color: 0x18181b,
            roughness: 0.85,
            metalness: 0.08,
            side: THREE.DoubleSide,
        });
    }

    // 3. Chrome / Alloy Wheels / Exhaust / Grille / Badges
    if (combined.includes('chrome') || combined.includes('steel') || combined.includes('alloy') || combined.includes('silver') || combined.includes('aliminyum') || combined.includes('metal') || combined.includes('rim') || combined.includes('grill') || combined.includes('badge') || combined.includes('audi') || combined.includes('egzos')) {
        return new THREE.MeshStandardMaterial({
            name: mat.name,
            color: 0xe2e8f0,
            metalness: 0.92,
            roughness: 0.18,
            side: THREE.DoubleSide,
        });
    }

    // 4. Taillights
    if (combined.includes('tail') || combined.includes('back_light') || combined.includes('ark_') || combined.includes('red')) {
        return new THREE.MeshStandardMaterial({
            name: mat.name,
            color: 0xef4444,
            emissive: 0xaa1111,
            roughness: 0.2,
            metalness: 0.4,
            side: THREE.DoubleSide,
        });
    }

    // 5. Headlights
    if (combined.includes('headlight') || combined.includes('light') || combined.includes('led')) {
        return new THREE.MeshStandardMaterial({
            name: mat.name,
            color: 0xffffff,
            emissive: 0x444444,
            roughness: 0.15,
            metalness: 0.5,
            side: THREE.DoubleSide,
        });
    }

    // 6. Carbon Fiber / Dark Aerodynamic Trim
    if (combined.includes('carbon') || combined.includes('karbon') || combined.includes('blade')) {
        return new THREE.MeshStandardMaterial({
            name: mat.name,
            color: 0x222226,
            roughness: 0.35,
            metalness: 0.3,
            side: THREE.DoubleSide,
        });
    }

    // 7. Car Body Paint: Sleek Obsidian Carbon Metallic
    return new THREE.MeshStandardMaterial({
        name: mat.name,
        color: 0x23262b,
        roughness: 0.28,
        metalness: 0.75,
        side: THREE.DoubleSide,
    });
}

function applyRealisticCarMaterials(object, carId) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (Array.isArray(child.material)) {
                child.material = child.material.map((m, idx) => upgradeSingleMaterial(m, child.name, carId, idx));
            } else if (child.material) {
                child.material = upgradeSingleMaterial(child.material, child.name, carId, 0);
            }
        }
    });
}
