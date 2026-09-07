---
name: django-workflows
description: >-
  Manage, run, test, and migrate the Django backend for Gruzin Auto.
  Use when running the development server, managing migrations, switching between
  PostgreSQL and SQLite, creating database models, or debugging Django errors.
---

# Django Development & Backend Workflows

This skill provides step-by-step procedures for managing the Gruzin Auto Django 5.1+ backend.

---

## 1. Environment & Python Setup

Always use the workspace virtual environment located at `.venv`.

### Health Check
```powershell
.\.venv\Scripts\python.exe manage.py check
```

### Running the Local Dev Server
```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

---

## 2. Database Switching (PostgreSQL vs SQLite)

The project supports dual databases through `rentalcars/settings.py`.

### A. Using Remote PostgreSQL (Default)
In `.env`:
```ini
DB_ENGINE=postgresql
DB_NAME=rentalcars
DB_USER=admin
DB_PASSWORD=ylexar
DB_HOST=5.83.153.60
DB_PORT=5020
```

### B. Using Local SQLite (Offline / Fast Development)
In `.env`:
```ini
DB_ENGINE=sqlite
```
Django will automatically use `BASE_DIR / 'db.sqlite3'`.

---

## 3. Database Migrations Workflow

Whenever modifying or adding Django ORM models:

1. **Create Migrations**:
   ```powershell
   .\.venv\Scripts\python.exe manage.py makemigrations
   ```
2. **Apply Migrations**:
   ```powershell
   .\.venv\Scripts\python.exe manage.py migrate
   ```
3. **Verify Migration Status**:
   ```powershell
   .\.venv\Scripts\python.exe manage.py showmigrations
   ```

---

## 4. Transitioning from Mock Vehicles to Django Models

Currently, `mock_vehicles` in `rentalcars/views.py` serves the catalog. To transition to a database-backed catalog:

1. Create a dedicated app:
   ```powershell
   .\.venv\Scripts\python.exe manage.py startapp vehicles
   ```
2. Register `'vehicles'` in `INSTALLED_APPS` in `rentalcars/settings.py`.
3. Define the `Vehicle` model in `vehicles/models.py`:
   ```python
   from django.db import models

   class Vehicle(models.Model):
       brand = models.CharField(max_length=64)
       model = models.CharField(max_length=64)
       trim = models.CharField(max_length=128, blank=True)
       price_per_hour = models.DecimalField(max_digits=8, decimal_places=2)
       rating = models.DecimalField(max_digits=3, decimal_places=1, default=5.0)
       review_count = models.PositiveIntegerField(default=0)
       model_3d = models.CharField(max_length=255, help_text="Path under static/models/")
       is_favourite = models.BooleanField(default=False)
       lat = models.FloatField()
       lng = models.FloatField()
       location_name = models.CharField(max_length=128)
       city = models.CharField(max_length=64, default="Tbilisi")
       year = models.PositiveIntegerField(default=2024)
       seats = models.PositiveIntegerField(default=4)
   ```
4. Run migrations and seed the initial records from the existing `mock_vehicles` list.

---

## 5. Testing & Verification

- Check for syntax/import errors:
  ```powershell
  .\.venv\Scripts\python.exe -c "import django; print('Django version:', django.__version__)"
  ```
- Run unit tests (if configured):
  ```powershell
  .\.venv\Scripts\python.exe manage.py test
  ```
