# SwasthyaTwin MongoDB Data Layer Configuration Guide

This document describes how to configure, connect, index, and verify MongoDB as the primary application database for **SwasthyaTwin — Personalized Healthcare Digital Twin**.

---

## 1. Architecture Overview

SwasthyaTwin uses MongoDB as its primary application database via the official `pymongo` driver and a clean Repository pattern:

| Collection | Model / Entity | Primary Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `patients` | `PatientBase` / `PatientResponse` | `patient_id` (unique), `updated_at` (desc) | Patient profiles, baseline windows, chronic conditions, and lifestyle parameters |
| `observations` | `ObservationBase` / `ObservationResponse` | `[patient_id, measurement_type, observed_at (-1)]`, `[patient_id, observed_at (-1)]` | Time-series biometric telemetry (heart rate, BP, HRV, steps, sleep, SpO2, glucose) |
| `health_assessments` | `HealthAssessmentRecord` / `HealthAssessmentResponse` | `assessment_id` (unique), `[patient_id, assessed_at (-1)]` | Personalized Z-score health stability index, explainability rules, safety disclaimers |
| `simulations` | `SimulationRecord` / `SimulationResponse` | `simulation_id` (unique), `[patient_id, created_at (-1)]` | Hypothetical What-If interventions (sleep, steps, sodium, stress) and trajectory forecasts |
| `audit_events` | `AuditEventBase` / `AuditEventResponse` | `event_id` (unique), `timestamp` (-1), `[patient_id, timestamp (-1)]` | Non-sensitive audit trail for data mutations (credential-scrubbed) |
| `alerts` | `AlertBase` / `AlertResponse` | `alert_id` (unique), `[patient_id, is_acknowledged, timestamp (-1)]` | Biometric drift and critical anomaly notifications |

---

## 2. Environment Variables

Configure your database connection via `.env` in the project root:

```bash
# -----------------------------------------------------------------------------
# APPLICATION ENVIRONMENT
# -----------------------------------------------------------------------------
APP_ENV=development
PORT=8000
HOST=127.0.0.1
DEMO_MODE=true

# -----------------------------------------------------------------------------
# MONGODB CONFIGURATION
# -----------------------------------------------------------------------------
# Primary Database Connection URI
MONGODB_URI=mongodb://localhost:27017

# Target Database Name
MONGODB_DATABASE=swasthyatwin

# Fallback in-memory isolated engine if local MongoDB is unreachable
ALLOW_IN_MEMORY_FALLBACK=true

# -----------------------------------------------------------------------------
# CORS CONFIGURATION
# -----------------------------------------------------------------------------
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000

# -----------------------------------------------------------------------------
# OPTIONAL AUTHENTICATION
# -----------------------------------------------------------------------------
API_SECRET_KEY=optional_secret_token_for_restricted_deployments
```

---

## 3. Option A: Local MongoDB Setup

### Method 1: Docker (Recommended for quick local testing)

Start a standalone local MongoDB instance using Docker:

```bash
docker run -d --name swasthyatwin-mongo \
  -p 27017:27017 \
  -v swasthyatwin_data:/data/db \
  mongo:7.0
```

Configure `.env`:
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=swasthyatwin
```

### Method 2: Native Windows / macOS / Linux Service

1. Download and install MongoDB Community Server from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).
2. Ensure MongoDB service is running:
   - **Windows:** Check Services (`services.msc`) -> `MongoDB Server` running on port `27017`.
   - **macOS / Linux:** `brew services start mongodb-community@7.0` or `sudo systemctl status mongod`.
3. Set `MONGODB_URI=mongodb://localhost:27017`.

---

## 4. Option B: MongoDB Atlas Setup (Cloud Production)

### Step 1: Create a Cluster on MongoDB Atlas

1. Log in to [MongoDB Cloud](https://cloud.mongodb.com/).
2. Create a new project named `SwasthyaTwin`.
3. Deploy a cluster (M0 Free Tier or dedicated M10+).

### Step 2: Configure Network Access & IP Allowlist

1. Navigate to **Security** -> **Network Access**.
2. Click **Add IP Address**:
   - For local development: Click **Add Current IP Address** or add `0.0.0.0/0` (with strong passwords).
   - For cloud deployment: Add the static IP or VPC CIDR block of your application host.

### Step 3: Create Database User

1. Navigate to **Security** -> **Database Access**.
2. Click **Add New Database User**:
   - Authentication Method: **Password**.
   - Username: `swasthya_admin`
   - Password: `<Generate Strong Password>`
   - Database User Privileges: `readWriteAnyDatabase` or scoped to `swasthyatwin`.

### Step 4: Obtain Connection String

1. Under **Deployment** -> **Database**, click **Connect**.
2. Choose **Drivers** -> Python (driver version 3.12+ or 4+).
3. Copy the SRV URI:
   ```
   mongodb+srv://swasthya_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=SwasthyaTwin
   ```

### Step 5: Update `.env`

```env
MONGODB_URI=mongodb+srv://swasthya_admin:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=SwasthyaTwin
MONGODB_DATABASE=swasthyatwin
ALLOW_IN_MEMORY_FALLBACK=false
```

> **Security Note:** Never commit `.env` or plain-text passwords into version control. The SwasthyaTwin logger automatically sanitizes and masks URIs (`mongodb+srv://swasthya_admin:****@...`) in all console and file logs.

---

## 5. Verification & Health Checks

### Live Readiness Ping

Verify database connectivity and active ping response:

```bash
curl http://127.0.0.1:8000/health/ready
```

**Expected 200 OK Response:**
```json
{
  "ready": true,
  "engine": "mongodb_official_driver",
  "database": "swasthyatwin",
  "fallback_active": false
}
```

### Full Health Diagnostics

```bash
curl http://127.0.0.1:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "SwasthyaTwin",
  "version": "1.0.0",
  "app_env": "development",
  "database": {
    "status": "connected",
    "engine": "mongodb_official_driver",
    "database_name": "swasthyatwin",
    "fallback_active": false,
    "connection_error": null
  }
}
```

---

## 6. Seed Script Execution

The seed script deterministically populates 90-day continuous physiological telemetry for 3 demonstration patient archetypes:

```bash
# Via API Endpoint (Non-destructive: skips if demo patients exist)
curl -X POST http://127.0.0.1:8000/api/v1/seed

# To force-reseed demo data only (never touches user-entered records):
curl -X POST "http://127.0.0.1:8000/api/v1/seed?force=true"
```

---

## 7. Running Pytest Database Tests

Execute the automated test suite covering schemas, repositories, indexes, pagination, and audit logs:

```powershell
$env:PYTHONPATH="backend"
.\backend\venv\Scripts\pytest backend\tests -v
```
