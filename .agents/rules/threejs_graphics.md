# Three.js 3D Graphics & Engine Guidelines

## 1. Scene & Renderer Initialization Standards
- **Import Maps**: Import Three.js and addons using the browser importmap defined in templates (`three` and `three/addons/`).
- **Device Pixel Ratio**: Always clamp pixel ratio to avoid mobile/high-DPI GPU overheating:
  ```javascript
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  ```
- **Color Space & Tone Mapping**:
  - `renderer.outputColorSpace = THREE.SRGBColorSpace;`
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping;`
  - `renderer.toneMappingExposure = 1.2 - 1.4;`
- **Shadow Maps**: Keep `renderer.shadowMap.enabled = false` unless strictly required for high-end hero showcases. Use baked contact shadows or simple ground plane meshes for card previews.

## 2. Memory Management & Lifecycle Cleanup
- **Garbage Collection in WebGL**: WebGL resources are not automatically garbage-collected by JavaScript. You MUST manually dispose:
  - `geometry.dispose()`
  - `material.dispose()` (and associated `material.map?.dispose()`, `normalMap?.dispose()`, etc.)
  - `renderer.dispose()`
  - `pmremGenerator.dispose()`
- **Cancel Animation Frames**: Always keep references to `requestAnimationFrame` handles (`cancelAnimationFrame(animId)`) when components detach or cards leave viewport.

## 3. Performance & Concurrency in Card Grid
- **Model In-Memory Cache**: Vehicle cards frequently share models (e.g. BMW M4 or E34). Cache parsed model scenes or clone with `SkeletonUtils.clone` to prevent repeated multi-megabyte network downloads.
- **Concurrency Queue**: Use a queue (maximum 2 simultaneous downloads/parses) to keep the browser main thread smooth and responsive while scrolling.
- **Shared RoomEnvironment**: Pre-generate a single PMREM environment map and share it across all card instances rather than compiling shaders for each card.

## 4. Multi-Format 3D Model Loading
- Support GLTF/GLB, FBX, Collada (.dae), and OBJ:
  - GLTF: Preferred standard format for performance and compression.
  - FBX: Check scale factors and bone animations; apply correct scaling (`model.scale.set(...)`).
  - Collada (.dae): Normalize rotation axes (Z-up vs Y-up conversion).
- Bounding Box Normalization:
  - Automatically calculate `THREE.Box3().setFromObject(model)` to center the pivot (`box.getCenter(...)`) and frame the camera to fit any vehicle model dimensions accurately.

## 5. Cyberpunk Metropolis Scene (`cyberpunk_city.js`)
- **Spline Trajectory**: Camera follows a 9-waypoint Catmull-Rom centripetal spline (`THREE.CatmullRomCurve3`). Avoid modifying control points without verifying building clearance.
- **CSS3D Perspective Cards**: Synchronize `CSS3DRenderer` with `WebGLRenderer` using identical camera projection matrices.
- **Matrix Auto-Update**: Freeze matrix updates on static buildings (`mesh.matrixAutoUpdate = false; mesh.updateMatrix();`) to achieve steady 60+ FPS.
