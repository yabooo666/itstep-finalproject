# Project Coding Guidelines & Architectural Rules

## 1. Code Cleanliness & Conciseness
- **Single Responsibility**: Keep functions, views, and frontend components focused on a single responsibility.
- **Concise & Direct**: If logic can be elegantly written in 50 lines, do not bloat it into 200–300 lines. Avoid unnecessary boilerplate or nested callbacks.
- **DRY (Don't Repeat Yourself)**: Shared logic, calculations, styles, and markup must be extracted into reusable modules or partials.
- **Documentation Integrity**: Preserve all existing comments and docstrings that are unrelated to your code changes.

## 2. File Size & Modular Structure
- **No Monolithic Files**: Avoid giant files (no 5k+ line monstrosities). Break files up when domain boundaries emerge.
- **Backend Separation**:
  - Keep `urls.py`, `views.py`, and future `models.py` / `forms.py` cleanly separated.
  - Extract complex vehicle query filters or mock data into dedicated modules or services.
- **Modular Stylesheets**:
  - Keep CSS modular (e.g. `base.css`, `sidebar.css`, `header.css`, `rental_catalog.css`, `vehicle_filters.css`).
  - Do NOT write mega CSS bundles; link component stylesheets only where needed.
- **Modular Frontend Scripts**:
  - Keep JavaScript logic separated by feature: `auth_modal.js`, `car_3d_viewer.js`, `vehicles_map.js`, `cyberpunk_city.js`.
  - Use modern ES module imports (`import * as THREE from 'three';`).

## 3. Reusable Component-Based Templates
- All global or repeating UI elements (Header, Sidebar, Footer, Rental Card, Auth Modal, Filter Pane, Trust Badges) must live in `templates/components/` as reusable partials.
- Use Django's `{% include "components/<name>.html" %}` with explicit context pass-through (e.g. `{% include "components/rental_card.html" with car=car %}`).
- All pages must extend `templates/base.html` and override designated blocks (`title`, `extra_css`, `content`, `footer`, `extra_js`).

## 4. Frontend & Styling Standards
- **Aesthetic Excellence**: Premium OLED-dark cyberpunk / automotive luxury aesthetic with crisp borders, subtle glassmorphism, glowing accents, and fluid transitions.
- **Theme Variables**: Use CSS custom properties defined on `[data-theme="dark"]` and `[data-theme="light"]`. Never hardcode raw hex colors in component CSS when a theme token exists.
- **Cache-Busting Requirement**: Always append version query strings (`?v=soft1`, `?v=v2`) to CSS and JS imports in HTML templates to prevent stale browser caching.
