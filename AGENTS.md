# Auto Ultimate — Codebase Architecture & Agent Guide

Welcome to the **Auto Ultimate** codebase! This repository is a high-performance, immersive luxury & sports car rental web application built with **Django 5.1+**, **Three.js (r160)**, and **Leaflet.js**, featuring an OLED-dark cyberpunk aesthetic and interactive 3D showroom environments.

---

## 1. Technology Stack

| Layer | Technologies | Key Files / Paths |
| :--- | :--- | :--- |
| **Backend** | Python 3.14, Django 5.1+, `python-dotenv`, `psycopg3` | `rentalcars/settings.py`, `rentalcars/urls.py`, `rentalcars/views.py` |
| **Database** | Dual Database: Remote PostgreSQL (default) or Local SQLite | Configurable via `DB_ENGINE` in `.env` |
| **Frontend Templates** | Django Templates with modular component partials | `templates/base.html`, `templates/components/*.html` |
| **Styling** | Modular Vanilla CSS, CSS Variables, OLED Dark Theme (`data-theme="dark"`) | `static/css/*.css` (cache-busted with `?v=...`) |
| **3D Graphics** | Three.js (r160 via ES module importmap), OrbitControls, CSS3DRenderer | `static/js/cyberpunk_city.js`, `static/js/car_3d_viewer.js` |
| **3D Formats** | GLTF / GLB, FBX, Collada (.dae), OBJ | `static/models/`, `.carmodels/` |
| **Mapping** | Leaflet.js 1.9.4, OpenStreetMap tiles with custom Tbilisi coordinates | `static/js/vehicles_map.js`, `templates/vehicles.html` |

---

## 2. Workspace Directory Map

```text
FinalProject/
├── .agents/                      # Agent intelligence & workspace customization
│   ├── rules/                    # Architectural guidelines & domain constraints
│   │   ├── coding_standards.md   # Clean code, DRY, component partials rules
│   │   ├── django_backend.md     # Backend architecture, dual DB, ORM conventions
│   │   ├── threejs_graphics.md   # 3D memory management, rendering performance
│   │   └── frontend_ui_maps.md   # UI layouts, theme engine, Leaflet integration
│   └── skills/                   # Procedural runbooks for complex workflows
│       ├── django-workflows/     # Backend execution, DB switching, migrations
│       ├── vehicle-3d-pipeline/  # 3D model ingestion, scale normalization, viewer
│       ├── cyberpunk-scene-tuning/ # 9-waypoint camera path & CSS3D card tuning
│       └── threejs-*/            # 10 specialized Three.js reference skills
├── .carmodels/                   # Source 3D car assets (Audi, Mercedes, BMW)
├── .venv/                        # Dedicated Python 3.14 virtual environment
├── rentalcars/                   # Core Django project package
│   ├── settings.py               # Env configuration, installed apps, DB router
│   ├── urls.py                   # Master routing (home, vehicles, favourites, chat)
│   ├── views.py                  # Catalog controllers & mock vehicles data
│   ├── wsgi.py & asgi.py         # Deployment entry points
├── static/
│   ├── css/                      # Modular CSS per component
│   ├── js/                       # ES modules (car viewer, cyberpunk engine, map)
│   └── models/                   # Runtime 3D models (GLB, FBX, DAE)
├── templates/
│   ├── base.html                 # Master layout (sidebar, header, auth modal, theme)
│   ├── home.html                 # 3D Cyberpunk Metropolis experience page
│   ├── vehicles.html             # Split-view vehicle catalog + Leaflet map
│   └── components/               # Reusable partials (cards, filters, modals, nav)
├── db.sqlite3                    # Local SQLite fallback database
├── manage.py                     # Django CLI entrypoint
├── requirements.txt              # Production/development dependencies
└── .env / .env.example           # Environment variables (DB credentials, DEBUG)
```

---

## 3. Core Architectural Principles

### 3.1. Reusable Component-Based Templates
- **Zero monolith templates**: Repeating UI patterns (vehicle cards, sidebar, navbar, auth modal, filter pane) **must** reside in `templates/components/`.
- Included using: `{% include "components/<name>.html" %}`.
- All pages must extend `templates/base.html` and use blocks (`{% block content %}`, `{% block extra_css %}`, `{% block extra_js %}`).
- Home page explicitly removes the footer (`{% block footer %}{% endblock %}`) to provide an uninterrupted full-viewport 3D canvas.

### 3.2. Modular Styling & Cache-Busting
- Every component has its own dedicated `.css` stylesheet in `static/css/` (e.g. `rental_catalog.css`, `sidebar.css`, `cyberpunk_city.css`).
- Always use versioned query strings when linking CSS/JS in templates to bust browser cache:
  `{% static 'css/base.css' %}?v=soft1`
- Rely on theme CSS variables (e.g. `--bg-primary`, `--accent-blue`, `--border-subtle`) supporting `data-theme="dark"` (default) and `data-theme="light"`.

### 3.3. High-Performance Three.js 3D Engine
- **In-Memory Caching**: 3D models (e.g. 35MB BMW M4) are cached in `modelCache` Map in `car_3d_viewer.js` to download and parse only once.
- **Concurrency Control**: Asynchronous model loading uses a `ConcurrencyQueue` (max 2 parallel loads) to prevent browser stutter during grid scrolling.
- **Shared Lighting PMREM**: Pre-compiled `RoomEnvironment` PMREM texture is generated once and shared across all cards.
- **Disposal**: Dispose of geometries, materials, and textures when viewports or modal elements unmount to avoid WebGL memory leaks.
- **Device Pixel Ratio**: Always clamp pixel ratio: `Math.min(window.devicePixelRatio || 1, 1.25)`.

### 3.4. Dual Database Architecture
- `rentalcars/settings.py` checks `DB_ENGINE = os.getenv('DB_ENGINE', 'postgresql')`.
- If set to `postgresql`, connects to the remote Postgres instance.
- If set to `sqlite`, falls back automatically to local `BASE_DIR / 'db.sqlite3'`.
- Run migrations and database commands using the local virtual environment:
  `.\.venv\Scripts\python.exe manage.py <command>`

---

## 4. Key Workflows & CLI Commands (PowerShell)

### Running the Development Server
```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

### Checking System Health
```powershell
.\.venv\Scripts\python.exe manage.py check
```

### Database Migrations
```powershell
.\.venv\Scripts\python.exe manage.py makemigrations
.\.venv\Scripts\python.exe manage.py migrate
```

### Switching to Local SQLite (for offline testing)
Set in `.env`:
```ini
DB_ENGINE=sqlite
```

---

## 5. Agent Instructions & Rules Reference
For specialized domain guidelines, always consult the dedicated rules in `.agents/rules/`:
- `coding_standards.md` — Code cleanliness, conciseness, DRY, modular structure.
- `django_backend.md` — Backend patterns, settings, database, view logic.
- `threejs_graphics.md` — 3D asset handling, memory disposal, shader/lighting rules.
- `frontend_ui_maps.md` — Split-view catalog, Leaflet map sync, theme styling.
