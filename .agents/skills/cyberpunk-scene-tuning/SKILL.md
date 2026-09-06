---
name: cyberpunk-scene-tuning
description: >-
  Tune, extend, and debug the 3D Cyberpunk Metropolis home page scene.
  Use when modifying camera waypoints, spline trajectories, CSS3D spatial holographic
  cards, lighting, atmospheric fog, or scroll responsiveness in static/js/cyberpunk_city.js.
---

# Cyberpunk Metropolis 3D Scene Tuning Guide

This skill guides modifications to the full-viewport Cyberpunk Metropolis 3D experience located in `static/js/cyberpunk_city.js` and `templates/home.html`.

---

## 1. Scene Architecture

- **Engine File**: `static/js/cyberpunk_city.js`
- **Stylesheet**: `static/css/cyberpunk_city.css`
- **Template**: `templates/home.html` (mount element `#cyberpunkCanvasMount`)
- **Key Assets**:
  - `static/models/cyberpunk_city.glb` (City geometry, elevated highway tracks)
  - `static/models/netanyaho-loves-trump.glb` (Hero monument centerpiece)
  - `static/models/bmw_m4_convertible_g83_2021.glb` (Dynamic traffic loops)

---

## 2. Tuning Camera Trajectory & Waypoints

The camera position and look-at orientation are driven by 9-point centripetal Catmull-Rom curves:

```javascript
// Position curve through clear air corridors:
const cameraSpline = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x0, y0, z0),
    // ... waypoints 1 through 8
], false, 'centripetal');

// Look-target curve for cinematic focal framing:
const targetSpline = new THREE.CatmullRomCurve3([
    new THREE.Vector3(tx0, ty0, tz0),
    // ... target waypoints 1 through 8
], false, 'centripetal');
```

### Modifying Waypoints Safely
1. Increase or decrease waypoint altitude (`Y` coordinate) if the camera clips through high-rise skyscrapers or skybridges.
2. Centripetal splines prevent cusps and self-intersections; keep spline curve type as `'centripetal'`.
3. Use smooth interpolation (`THREE.MathUtils.lerp`) between current scroll progress and target progress for butter-smooth damping.

---

## 3. Spatial Holographic CSS3D Cards

The scene features interactive HTML/CSS cards rendered in true 3D spatial perspective:
- Card 1: **Exclusive Fleet Showcase**
- Card 2: **Instant Booking / Zero Paperwork**

### Positioning a CSS3D Object:
```javascript
const cssObj = new CSS3DObject(element);
cssObj.position.set(px, py, pz);
cssObj.rotation.set(rx, ry, rz);
cssObj.scale.set(0.05, 0.05, 0.05); // CSS pixels to Three.js world units
cssScene.add(cssObj);
```

### Fade & Proximity Rules:
- Calculate camera distance to card center: `camera.position.distanceTo(cardWorldPos)`.
- If distance > max range, set `cardElement.style.opacity = '0'` and `pointerEvents = 'none'`.
- If camera is within view range, apply smooth opacity falloff and subtle vertical floating bob.

---

## 4. Performance & Rendering Guardrails

To maintain a steady 60+ FPS in this high-complexity scene:
- **Matrix Freezing**: Keep `mesh.matrixAutoUpdate = false` and `mesh.updateMatrix()` on all static buildings.
- **Backface Culling**: Avoid `THREE.DoubleSide` on building meshes.
- **Shadow Passes**: Disabled (`shadowMap.enabled = false`). Rely on dark ambient lighting + vibrant neon directional emissive colors.
- **Fog Density**: Keep `THREE.FogExp2(0x05070f, 0.0032)` to cull geometry beyond the far viewing plane.
