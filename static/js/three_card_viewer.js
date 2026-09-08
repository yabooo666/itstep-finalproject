import * as THREE from 'three';

/**
 * Gruzin Auto - Interactive 3D Credit Card Showroom Viewer (Three.js PBR)
 * Features:
 * - Real 3D Beveled Rounded Card Geometry (ISO 7810 ID-1 standard)
 * - Dynamic Canvas-driven PBR Textures (Card number, Name, MM/YY, Gold Chip, Contactless, Hologram, CVV/PIN)
 * - Realistic Gyroscopic Mouse Tilt & Specular Light Follower
 * - Smooth 180° Auto-Flip on PIN/CVV focus & flip back
 * - Ultra-crisp 2K Canvas Textures with Metallic & Embossed Effects
 * - 60FPS optimized rendering with pause when modal is closed
 */

let scene, camera, renderer, cardMesh, pointLight;
let frontTexture, backTexture, frontCanvas, backCanvas, frontCtx, backCtx;
let isInitialized = false;
let isRunning = false;
let animFrameId = null;

let currentCardNum = '•••• •••• •••• ••••';
let currentHolderName = 'CARDHOLDER NAME';
let currentExpiry = 'MM/YY';
let currentPin = '•••';

let targetRotX = 0;
let targetRotY = 0;
let currentRotX = 0;
let currentRotY = 0;
let isFlipped = false;

export function initThreeCard() {
    const stage = document.getElementById('threeCardStage');
    const canvas = document.getElementById('threeCardCanvas');
    if (!stage || !canvas) return;

    if (isInitialized) {
        startRendering();
        return;
    }

    const width = stage.clientWidth || 480;
    const height = stage.clientHeight || 255;

    // 1. Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.65);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // 3. Lighting Setup (PBR Studio Showcase)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(0xffffff, 4.0, 12);
    pointLight.position.set(0, 0, 3.5);
    scene.add(pointLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-3, -2, -2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xeab308, 0.8);
    fillLight.position.set(0, -3, 2);
    scene.add(fillLight);

    // 4. Dynamic Textures Generation
    setupCardCanvases();
    updateCardTextures();

    // 5. Card 3D Geometry (Standard ISO/IEC 7810 ID-1 Card Aspect: 3.375 x 2.125)
    const cardWidth = 3.375;
    const cardHeight = 2.125;
    const radius = 0.16;
    const thickness = 0.045;

    const shape = new THREE.Shape();
    shape.moveTo(-cardWidth / 2 + radius, -cardHeight / 2);
    shape.lineTo(cardWidth / 2 - radius, -cardHeight / 2);
    shape.quadraticCurveTo(cardWidth / 2, -cardHeight / 2, cardWidth / 2, -cardHeight / 2 + radius);
    shape.lineTo(cardWidth / 2, cardHeight / 2 - radius);
    shape.quadraticCurveTo(cardWidth / 2, cardHeight / 2, cardWidth / 2 - radius, cardHeight / 2);
    shape.lineTo(-cardWidth / 2 + radius, cardHeight / 2);
    shape.quadraticCurveTo(-cardWidth / 2, cardHeight / 2, -cardWidth / 2, cardHeight / 2 - radius);
    shape.lineTo(-cardWidth / 2, -cardHeight / 2 + radius);
    shape.quadraticCurveTo(-cardWidth / 2, -cardHeight / 2, -cardWidth / 2 + radius, -cardHeight / 2);

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // Front & Back PBR Materials
    const frontMat = new THREE.MeshPhysicalMaterial({
        map: frontTexture,
        metalness: 0.45,
        roughness: 0.22,
        clearcoat: 0.95,
        clearcoatRoughness: 0.12,
        reflectivity: 0.95,
    });

    const backMat = new THREE.MeshPhysicalMaterial({
        map: backTexture,
        metalness: 0.35,
        roughness: 0.3,
        clearcoat: 0.75,
        clearcoatRoughness: 0.2,
    });

    const edgeMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.85,
        roughness: 0.25
    });

    // Multi-material card body
    cardMesh = new THREE.Mesh(geometry, edgeMat);

    // Front shape plate with mapped UVs
    const frontShapeGeo = new THREE.ShapeGeometry(shape);
    assignExactUVs(frontShapeGeo, cardWidth, cardHeight);
    const frontMesh = new THREE.Mesh(frontShapeGeo, frontMat);
    frontMesh.position.z = thickness / 2 + 0.016;
    cardMesh.add(frontMesh);

    // Back shape plate with mapped UVs (flipped)
    const backShapeGeo = new THREE.ShapeGeometry(shape);
    assignExactUVs(backShapeGeo, cardWidth, cardHeight);
    const backMesh = new THREE.Mesh(backShapeGeo, backMat);
    backMesh.position.z = -thickness / 2 - 0.016;
    backMesh.rotation.y = Math.PI;
    cardMesh.add(backMesh);

    scene.add(cardMesh);

    // 6. Interactive Mouse & Pointer Listeners
    stage.addEventListener('mousemove', onMouseMove);
    stage.addEventListener('mouseleave', () => {
        targetRotX = 0;
        targetRotY = isFlipped ? Math.PI : 0;
    });

    // Touch Support for mobile tilt
    stage.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            onMouseMove(e.touches[0]);
        }
    }, { passive: true });

    // Handle Window/Stage Resize
    const resizeObserver = new ResizeObserver(() => {
        if (!stage || !renderer || !camera) return;
        const newW = stage.clientWidth;
        const newH = stage.clientHeight;
        if (newW > 0 && newH > 0) {
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        }
    });
    resizeObserver.observe(stage);

    isInitialized = true;
    startRendering();
}

function assignExactUVs(geometry, width, height) {
    const pos = geometry.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        uvs[i * 2] = (x + width / 2) / width;
        uvs[i * 2 + 1] = (y + height / 2) / height;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function setupCardCanvases() {
    // 2K Ultra-Crisp Canvas
    frontCanvas = document.createElement('canvas');
    frontCanvas.width = 1024;
    frontCanvas.height = 640;
    frontCtx = frontCanvas.getContext('2d');

    backCanvas = document.createElement('canvas');
    backCanvas.width = 1024;
    backCanvas.height = 640;
    backCtx = backCanvas.getContext('2d');

    frontTexture = new THREE.CanvasTexture(frontCanvas);
    frontTexture.colorSpace = THREE.SRGBColorSpace;
    frontTexture.anisotropy = 8;

    backTexture = new THREE.CanvasTexture(backCanvas);
    backTexture.colorSpace = THREE.SRGBColorSpace;
    backTexture.anisotropy = 8;
}

export function updateCardData(cardNum, name, expiry, pin) {
    if (cardNum !== undefined) currentCardNum = cardNum || '•••• •••• •••• ••••';
    if (name !== undefined) currentHolderName = (name || 'CARDHOLDER NAME').toUpperCase();
    if (expiry !== undefined) currentExpiry = expiry || 'MM/YY';
    if (pin !== undefined) currentPin = pin || '•••';

    updateCardTextures();
}

export function setCardFlipped(flipped) {
    isFlipped = Boolean(flipped);
    targetRotY = isFlipped ? Math.PI : 0;
}

function updateCardTextures() {
    if (!frontCtx || !backCtx) return;

    // =========================================================================
    // FRONT FACE DESIGN
    // =========================================================================
    // 1. Base Obsidian Titanium Carbon Gradient
    const frontGrad = frontCtx.createLinearGradient(0, 0, 1024, 640);
    frontGrad.addColorStop(0, '#1c1c24');
    frontGrad.addColorStop(0.25, '#0c0c10');
    frontGrad.addColorStop(0.7, '#14141d');
    frontGrad.addColorStop(1, '#050508');
    frontCtx.fillStyle = frontGrad;
    frontCtx.fillRect(0, 0, 1024, 640);

    // 2. Micro Carbon Grid Pattern
    frontCtx.save();
    frontCtx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    frontCtx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 16) {
        frontCtx.beginPath();
        frontCtx.moveTo(x, 0);
        frontCtx.lineTo(x, 640);
        frontCtx.stroke();
    }
    for (let y = 0; y < 640; y += 16) {
        frontCtx.beginPath();
        frontCtx.moveTo(0, y);
        frontCtx.lineTo(1024, y);
        frontCtx.stroke();
    }
    frontCtx.restore();

    // 3. Diagonal Futuristic Sheen Beam
    frontCtx.save();
    frontCtx.beginPath();
    frontCtx.moveTo(0, 180);
    frontCtx.lineTo(620, 0);
    frontCtx.lineTo(720, 0);
    frontCtx.lineTo(0, 320);
    frontCtx.closePath();
    frontCtx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    frontCtx.fill();
    frontCtx.restore();

    // 4. Subtle Outer Border Inset
    frontCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    frontCtx.lineWidth = 4;
    frontCtx.strokeRect(14, 14, 996, 612);

    // 5. Brand Logo & VIP Emblem
    frontCtx.fillStyle = '#ffffff';
    frontCtx.font = '900 38px "Inter", "Segoe UI", sans-serif';
    frontCtx.letterSpacing = '5px';
    frontCtx.fillText('GRUZIN AUTO', 75, 95);

    frontCtx.fillStyle = '#a1a1aa';
    frontCtx.font = '700 17px "Inter", "Segoe UI", sans-serif';
    frontCtx.letterSpacing = '2.5px';
    frontCtx.fillText('BLACK EDITION • PLATINUM VIP', 75, 126);

    // 6. Realistic Gold Microchip
    drawGoldChip(frontCtx, 75, 175, 130, 95);

    // 7. Contactless NFC Symbol
    drawContactlessIcon(frontCtx, 240, 222);

    // 8. Embossed 16-Digit Card Number (with 3D Raised Shadow)
    frontCtx.save();
    frontCtx.fillStyle = '#ffffff';
    frontCtx.font = 'bold 54px "Courier New", Courier, monospace';
    frontCtx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    frontCtx.shadowBlur = 10;
    frontCtx.shadowOffsetY = 4;
    frontCtx.shadowOffsetX = 2;
    frontCtx.letterSpacing = '7px';
    frontCtx.fillText(currentCardNum, 75, 395);
    frontCtx.restore();

    // 9. Cardholder Name Label & Value
    frontCtx.fillStyle = '#71717a';
    frontCtx.font = '800 17px "Inter", sans-serif';
    frontCtx.letterSpacing = '1.8px';
    frontCtx.fillText('CARDHOLDER NAME', 75, 485);

    frontCtx.fillStyle = '#ffffff';
    frontCtx.font = 'bold 30px "Inter", sans-serif';
    frontCtx.letterSpacing = '2px';
    frontCtx.fillText(currentHolderName.slice(0, 24), 75, 532);

    // 10. Expiration Date Label & Value
    frontCtx.fillStyle = '#71717a';
    frontCtx.font = '800 17px "Inter", sans-serif';
    frontCtx.letterSpacing = '1.8px';
    frontCtx.fillText('EXPIRES', 560, 485);

    frontCtx.fillStyle = '#ffffff';
    frontCtx.font = 'bold 30px "Courier New", monospace';
    frontCtx.letterSpacing = '2px';
    frontCtx.fillText(currentExpiry, 560, 532);

    // 11. Dual Mastercard Hologram Emblem
    drawMastercardLogo(frontCtx, 860, 510);

    // =========================================================================
    // BACK FACE DESIGN
    // =========================================================================
    // 1. Matte Obsidian Base
    backCtx.fillStyle = '#08080b';
    backCtx.fillRect(0, 0, 1024, 640);

    // 2. Solid Magnetic Stripe
    backCtx.fillStyle = '#000000';
    backCtx.fillRect(0, 65, 1024, 125);

    // 3. Signature Panel with Micro-Security Lines
    backCtx.fillStyle = '#f4f4f5';
    backCtx.fillRect(75, 240, 620, 85);

    backCtx.fillStyle = '#e4e4e7';
    for (let i = 0; i < 620; i += 28) {
        backCtx.fillRect(75 + i, 240, 14, 85);
    }

    // 4. CVV / PIN Security Box
    backCtx.fillStyle = '#ffffff';
    backCtx.fillRect(710, 240, 160, 85);
    backCtx.fillStyle = '#000000';
    backCtx.font = 'bold 38px "Courier New", monospace';
    backCtx.textAlign = 'center';
    backCtx.fillText(currentPin, 790, 298);
    backCtx.textAlign = 'left';

    // 5. CVV / PIN Label
    backCtx.fillStyle = '#a1a1aa';
    backCtx.font = '800 17px "Inter", sans-serif';
    backCtx.letterSpacing = '1.2px';
    backCtx.fillText('SECURITY CODE (CVV / PIN)', 75, 365);

    // 6. Fine-Print VIP Terms & Support
    backCtx.fillStyle = '#52525b';
    backCtx.font = '600 16px "Inter", sans-serif';
    backCtx.fillText('Authorized signature required. This card remains property of Gruzin Auto.', 75, 470);
    backCtx.fillText('24/7 VIP Concierge & Luxury Roadside: +995 (32) 200-8800', 75, 505);
    backCtx.fillText('Encrypted EMV • Instant Authorization Verified', 75, 540);

    // 7. Holographic Security Strip on Back
    drawHoloBadge(backCtx, 875, 480);

    // Notify WebGL textures to refresh
    frontTexture.needsUpdate = true;
    backTexture.needsUpdate = true;
}

function drawGoldChip(ctx, x, y, w, h) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.35, '#eab308');
    grad.addColorStop(0.7, '#ca8a04');
    grad.addColorStop(1, '#a16207');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y);
    ctx.lineTo(x + w * 0.35, y + h);
    ctx.moveTo(x + w * 0.65, y);
    ctx.lineTo(x + w * 0.65, y + h);
    ctx.moveTo(x, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.stroke();
    ctx.restore();
}

function drawContactlessIcon(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let r = 16; r <= 36; r += 10) {
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
    }
    ctx.restore();
}

function drawMastercardLogo(ctx, cx, cy) {
    ctx.save();
    ctx.fillStyle = '#eb001b';
    ctx.beginPath();
    ctx.arc(cx - 30, cy, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f79e1b';
    ctx.beginPath();
    ctx.arc(cx + 30, cy, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff5f00';
    ctx.beginPath();
    ctx.arc(cx + 30, cy, 48, 0, Math.PI * 2);
    ctx.clip();
    ctx.arc(cx - 30, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHoloBadge(ctx, cx, cy) {
    ctx.save();
    const holoGrad = ctx.createLinearGradient(cx - 40, cy - 30, cx + 40, cy + 30);
    holoGrad.addColorStop(0, '#38bdf8');
    holoGrad.addColorStop(0.33, '#ec4899');
    holoGrad.addColorStop(0.66, '#eab308');
    holoGrad.addColorStop(1, '#22c55e');
    ctx.fillStyle = holoGrad;
    ctx.beginPath();
    ctx.roundRect(cx - 45, cy - 35, 90, 70, 10);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = '900 14px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SECURE', cx, cy + 5);
    ctx.restore();
}

function onMouseMove(e) {
    const stage = document.getElementById('threeCardStage');
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    targetRotX = y * 0.55;
    targetRotY = (isFlipped ? Math.PI : 0) + x * 0.65;

    if (pointLight) {
        pointLight.position.x = x * 4;
        pointLight.position.y = -y * 3;
    }
}

function startRendering() {
    if (isRunning) return;
    isRunning = true;

    function renderLoop() {
        if (!isRunning) return;

        // Smooth spring dampening towards target rotation
        currentRotX += (targetRotX - currentRotX) * 0.08;
        currentRotY += (targetRotY - currentRotY) * 0.08;

        if (cardMesh) {
            cardMesh.rotation.x = currentRotX;
            cardMesh.rotation.y = currentRotY;
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }

        animFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop();
}

export function stopRendering() {
    isRunning = false;
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

// Global window bridge for non-module integration
if (typeof window !== 'undefined') {
    window.ThreeCardViewer = {
        initThreeCard,
        updateCardData,
        setCardFlipped,
        stopRendering
    };
}
