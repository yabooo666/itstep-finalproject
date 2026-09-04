# Project Coding Guidelines & Architectural Rules

## 1. Code Cleanliness & Conciseness
- **No Spaghetti Code**: Keep functions and components focused on a single responsibility.
- **Concise & Direct**: If logic can be elegantly written in 50 lines, do not bloat it into 200–300 lines. Avoid unnecessary boilerplate.
- **DRY (Don't Repeat Yourself)**: Shared logic, styles, and markup must be extracted into reusable modules or components.

## 2. File Size & Modular Structure
- **No Monolithic Files**: Avoid giant files (no 5k+ line monstrosities).
- **Split by Responsibility**:
  - Keep models, views, forms, and services in dedicated modular files when features grow.
  - Keep CSS modular (e.g. `base.css`, `navbar.css`, feature-specific stylesheets).
  - Templates must follow component-based composition (like EJS partials).

## 3. Reusable Component-Based Templates
- All global or repeating UI elements (Header/Navbar, Footer, Car Card, Modal, Badges) must live in `templates/components/` as reusable partials.
- Use Django's `{% include "components/<name>.html" %}` (exact equivalent of EJS `<%- include(...) %>`).
- All pages must extend `templates/base.html`.

## 4. Frontend & CSS Standards
- Modern, clean, professional aesthetics (Google Fonts, crisp borders, subtle shadows, flexbox/grid).
- Avoid inline styles where reusable CSS classes can be used.
