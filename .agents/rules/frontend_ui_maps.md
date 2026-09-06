# Frontend UI & Leaflet Map Architecture Rules

## 1. Split-View Catalog Layout
- The vehicle catalog (`templates/vehicles.html`) features a dynamic split-view design:
  - Left panel: Cards stream (`.vehicles-cards-stream`).
  - Right panel: Interactive map (`.vehicles-map-panel`).
- Split toggle states:
  - When `.split-view-active` is added to `#vehiclesMainContent`, the catalog shrinks and the map slides into view.
  - When map view is toggled, always call `mapInstance.invalidateSize()` after CSS transition delays (e.g. 60ms, 160ms, 300ms, 500ms) to ensure tiles render seamlessly.

## 2. Leaflet.js Mapping Standards
- Use Leaflet 1.9.4 with custom dark or neutral tiles suitable for the OLED dark design.
- Default geographic center: Tbilisi, Georgia (`[41.7151, 44.8271]` / Rustaveli coordinates).
- Markers must be synced with vehicle cards:
  - Hovering a card highlights the corresponding map pin.
  - Clicking a map pin scrolls to and highlights the corresponding vehicle card.
- Pin data must be injected via Django's `json_script` filter: `{{ vehicles_json|json_script:"vehiclesJsonData" }}`.

## 3. Dark / Light Theme System
- The app defaults to **pure OLED dark mode**:
  - Root element: `<html lang="en" data-theme="dark">`
  - Inline head script checks `localStorage.getItem('auto_theme') || 'dark'` to eliminate theme flash during page load.
  - Toggle button `#themeToggleBtn` flips between `dark` and `light` and stores preference in `localStorage`.
- All styling colors must use CSS variables:
  - Surface backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-card`
  - Text: `--text-primary`, `--text-secondary`, `--text-muted`
  - Borders: `--border-subtle`, `--border-hover`
  - Accents: `--accent-blue`, `--accent-glow`, `--accent-cyberpunk`

## 4. Responsive Design & Breakpoints
- **Desktop (>1200px)**: Full split-view layout with 3-column or 2-column card grid alongside the map.
- **Tablet (768px - 1199px)**: 2-column card grid; map can expand to full width or split view with collapsible filters.
- **Mobile (<768px)**: Single-column cards; filter pane collapses into a slide-out drawer; map opens in full-screen modal mode.
