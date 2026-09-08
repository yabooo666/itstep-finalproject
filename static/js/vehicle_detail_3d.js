import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Gruzin Auto - Interactive 3D Vehicle Detail Showroom Viewer
 * Features: 360° Orbit, Zoom, Auto-rotation, Reset Camera, Ground Grid & Shadow, Lighting Controls
 */
document.addEventListener('DOMContentLoaded', () => {
    const stageContainer = document.getElementById('detail3dStage');
    if (!stageContainer) return;

    const canvasContainer = document.getElementById('detail3dCanvas');
    const modelUrl = stageContainer.getAttribute('data-model-url');
    const progressBar = document.getElementById('detail3dProgressBar');
    const progressWrap = document.getElementById('detail3dProgress');
    const autoRotateBtn = document.getElementById('btnAutoRotate');
    const resetViewBtn = document.getElementById('btnResetView');
    const lightToggleBtn = document.getElementById('btnToggleLighting');
    const switch3dBtn = document.getElementById('btnTab3D');
    const switchPhotoBtn = document.getElementById('btnTabPhotos');
    const galleryView = document.getElementById('detailPhotoGallery');

    if (!canvasContainer || !modelUrl) return;

    let scene, camera, renderer, controls, carModel;
    let isAutoRotating = true;
    let isNightMode = false;
    let hemiLight, dirLight;
    let initialCamPos = new THREE.Vector3();
    let initialTarget = new THREE.Vector3(0, 0, 0);

    // Tab switcher between 3D and 2D photos
    if (switch3dBtn && switchPhotoBtn && galleryView) {
        switch3dBtn.addEventListener('click', () => {
            switch3dBtn.classList.add('active');
            switchPhotoBtn.classList.remove('active');
            stageContainer.style.display = 'block';
            galleryView.style.display = 'none';
            onResize();
        });

        switchPhotoBtn.addEventListener('click', () => {
            switchPhotoBtn.classList.add('active');
            switch3dBtn.classList.remove('active');
            stageContainer.style.display = 'none';
            galleryView.style.display = 'block';
        });
    }

    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    // 2. Camera setup
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(4.5, 2.2, 5.5);

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    canvasContainer.appendChild(renderer.domElement);

    // 4. Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't allow camera to go below ground
    controls.minDistance = 2.0;
    controls.maxDistance = 14.0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // 5. Environment & Lights
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTexture = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.8);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(8, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Subtle blue neon under-glow
    const neonLight = new THREE.PointLight(0x38bdf8, 2, 8);
    neonLight.position.set(0, 0.3, 0);
    scene.add(neonLight);

    // 6. Ground Studio Floor (Grid + Soft Shadow Catcher)
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const shadowPlane = new THREE.Mesh(floorGeo, floorMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const gridHelper = new THREE.GridHelper(24, 24, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    // 7. Load GLB Model
    const loader = new GLTFLoader();
    loader.load(
        modelUrl,
        (gltf) => {
            carModel = gltf.scene || gltf;

            // Remove non-mesh artifacts
            const toRemove = [];
            carModel.traverse((child) => {
                if (child.isLight || child.isCamera) {
                    toRemove.push(child);
                }
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = Math.min(Math.max(child.material.roughness || 0.3, 0.1), 0.85);
                        child.material.metalness = Math.min(Math.max(child.material.metalness || 0.5, 0.1), 0.95);
                    }
                }
            });
            toRemove.forEach(obj => obj.parent?.remove(obj));

            // Compute Bounding Box and scale uniformly
            const box = new THREE.Box3().setFromObject(carModel);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);

            // Scale to standard car length ~ 4.2 units
            const targetSize = 4.2;
            const scale = targetSize / maxDim;
            carModel.scale.setScalar(scale);

            // Recalculate after scale to center at origin on the floor
            box.setFromObject(carModel);
            const center = new THREE.Vector3();
            box.getCenter(center);
            carModel.position.x = -center.x;
            carModel.position.z = -center.z;
            carModel.position.y = -box.min.y; // Sit flat on y=0 ground

            scene.add(carModel);

            // Position camera nicely at angle
            const fitDist = targetSize * 1.35;
            camera.position.set(fitDist * 0.9, fitDist * 0.45, fitDist * 0.85);
            controls.target.set(0, fitDist * 0.22, 0);
            controls.update();

            initialCamPos.copy(camera.position);
            initialTarget.copy(controls.target);

            if (progressWrap) {
                progressWrap.style.opacity = '0';
                setTimeout(() => { progressWrap.style.display = 'none'; }, 300);
            }
        },
        (xhr) => {
            if (xhr.lengthComputable && progressBar) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                progressBar.style.width = `${percent}%`;
            }
        },
        (error) => {
            console.error("Failed to load 3D GLB model:", error);
            if (progressWrap) {
                progressWrap.innerHTML = `
                    <div class="load-err-msg">
                        <span>Could not render 3D preview. Displaying 2D photos.</span>
                    </div>
                `;
            }
        }
    );

    // 8. Control Actions
    if (autoRotateBtn) {
        autoRotateBtn.addEventListener('click', () => {
            isAutoRotating = !isAutoRotating;
            controls.autoRotate = isAutoRotating;
            autoRotateBtn.classList.toggle('active', isAutoRotating);
        });
    }

    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            camera.position.copy(initialCamPos);
            controls.target.copy(initialTarget);
            controls.update();
        });
    }

    if (lightToggleBtn) {
        lightToggleBtn.addEventListener('click', () => {
            isNightMode = !isNightMode;
            if (isNightMode) {
                scene.background = new THREE.Color(0x020408);
                dirLight.intensity = 0.6;
                hemiLight.intensity = 0.3;
                renderer.toneMappingExposure = 0.85;
                neonLight.intensity = 5;
                lightToggleBtn.classList.add('active');
            } else {
                scene.background = new THREE.Color(0x06080e);
                dirLight.intensity = 1.8;
                hemiLight.intensity = 0.8;
                renderer.toneMappingExposure = 1.15;
                neonLight.intensity = 2;
                lightToggleBtn.classList.remove('active');
            }
        });
    }

    // 9. Resize Handling
    function onResize() {
        if (!canvasContainer || !renderer || !camera) return;
        const w = canvasContainer.clientWidth;
        const h = canvasContainer.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // 10. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
});
