---
name: vehicle-3d-pipeline
description: >-
  Ingest, calibrate, optimize, and test 3D car models for the Auto Ultimate showroom.
  Use when adding new 3D car models (.glb, .gltf, .fbx, .dae, .obj), fixing scaling
  or orientation issues, debugging car_3d_viewer.js, or optimizing card loading performance.
---

# 3D Vehicle Asset Pipeline & Showroom Calibration

This skill details how to integrate, normalize, and debug 3D car models for vehicle cards and interactive 3D inspection.

---

## 1. Supported Formats & Storage

| Format | Extension | Recommended Loader | Notes |
| :--- | :--- | :--- | :--- |
| **GLTF / GLB** | `.glb`, `.gltf` | `GLTFLoader` | **Preferred**. Best compression and PBR material accuracy. |
| **Collada** | `.dae` | `ColladaLoader` | Check Up-axis (Z-up vs Y-up). |
| **FBX** | `.fbx` | `FBXLoader` | Check unit scaling (cm vs m, often requires 0.01 scale). |
| **OBJ** | `.obj` | `OBJLoader` | Requires `.mtl` companion if materials are external. |

Assets must be placed in `static/models/<model_name>/` or directly in `static/models/`.

---

## 2. Model Ingestion & Normalization Procedure

Whenever adding a new vehicle:

1. **Place the 3D File**:
   Copy the asset into `static/models/` (e.g. `static/models/bmw_m4_convertible_g83_2021.glb`).
2. **Register in Vehicle Data**:
   In `rentalcars/views.py` (or the database model), add the relative path under `static/`:
   ```python
   'model_3d': 'models/bmw_m4_convertible_g83_2021.glb',
   ```
3. **Automatic Normalization in `car_3d_viewer.js`**:
   The viewer automatically runs bounding-box centering:
   ```javascript
   const box = new THREE.Box3().setFromObject(root);
   const size = box.getSize(new THREE.Vector3());
   const center = box.getCenter(new THREE.Vector3());

   // Center pivot to ground level
   root.position.x += (root.position.x - center.x);
   root.position.y += (root.position.y - box.min.y);
   root.position.z += (root.position.z - center.z);
   ```

---

## 3. Calibration & Inspection

If a vehicle appears too large, too small, inverted, or dark:

- **Dark Car Paints / Glass**:
  Ensure the shared `RoomEnvironment` PMREM generator is applied:
  ```javascript
  scene.environment = getSharedEnvironment(renderer);
  ```
- **Flipped Axes (Collada / FBX)**:
  Apply rotation if the model faces sideways or upside down:
  ```javascript
  root.rotation.set(0, -Math.PI / 2, 0);
  ```
- **Scale Factor**:
  If the model was exported in millimeters instead of meters:
  ```javascript
  root.scale.setScalar(0.001);
  ```

---

## 4. Performance & Memory Budget

- Keep runtime polygon counts per vehicle under 150,000 triangles for card preview.
- Ensure `modelCache` holds the parsed hierarchy so duplicate cards in the grid reuse the existing memory allocation.
- When an interactive modal closes or card detaches, call `dispose()` on all child mesh geometries and materials.
