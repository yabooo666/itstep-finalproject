# Django Backend & Database Architecture Rules

## 1. Environment & Dual-Database Management
- **Environment Isolation**: Always load configuration via `python-dotenv` from `.env`. Never commit secrets, passwords, or production keys.
- **Dual-Database Switching**:
  - `DB_ENGINE = os.getenv('DB_ENGINE', 'postgresql')` controls database selection.
  - When `DB_ENGINE` is `postgresql`, the application connects to the remote Postgres database (`psycopg3`).
  - When `DB_ENGINE` is `sqlite`, it automatically falls back to `BASE_DIR / 'db.sqlite3'`.
  - Never break SQLite fallback compatibility when writing schema migrations or queries.

## 2. Virtual Environment & Python Execution
- Always use the dedicated workspace virtual environment for executing Python or Django CLI commands:
  ```powershell
  .\.venv\Scripts\python.exe manage.py <command>
  ```
- Before creating new dependencies, ensure they are compatible with Python 3.14 and document them in `requirements.txt`.

## 3. Views & Controller Patterns
- Keep views lean. Views should parse HTTP request parameters, call data access or business logic functions, and return clean template contexts.
- Filtering & Search Parameters:
  - Query parameters (`q`, `city`, `capacity`, `year_min`, `year_max`, `brand`, etc.) in `rentalcars/views.py` must validate inputs defensively with try/except on type conversions.
  - Return JSON-serializable structures for map synchronization (e.g. `{{ vehicles_json|json_script:"vehiclesJsonData" }}`).

## 4. Transitioning to Django ORM Models
- When replacing `mock_vehicles` with database models:
  - Create a dedicated Django app (e.g. `vehicles` or `catalog`) using `manage.py startapp <name>`.
  - Register the new app in `INSTALLED_APPS` in `rentalcars/settings.py`.
  - Model fields should store vehicle specifications (`brand`, `model`, `trim`, `price_per_hour`, `rating`, `seats`, `year`, `city`, `lat`, `lng`, `model_3d`).
  - Always run `makemigrations` and `migrate` and verify migrations run on both SQLite and PostgreSQL.

## 5. Static & Media Asset Routing
- Development asset routing is configured via `urlpatterns += static(settings.MEDIA_URL, ...)` and `static(settings.STATIC_URL, ...)`.
- 3D models and textures must be served with correct MIME types:
  - `.glb` / `.gltf` -> `model/gltf-binary` or `model/gltf+json`
  - `.fbx` / `.dae` / `.obj` -> binary / text assets
- Large model files live in `static/models/`. Keep paths consistent with the `model_3d` field in vehicle data.
