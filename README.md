# SwasthyaTwin 🧬
### Personalized Healthcare Digital Twin for Early Risk Detection and Preventive Intervention

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_TypeScript-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_7.0-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com)
[![Pytest](https://img.shields.io/badge/Testing-Pytest_%26_Vitest-0A9EDC.svg?style=flat)](https://pytest.org)

---

## ⚠️ Healthcare Safety & Research Prototype Notice
> **DISCLAIMER:** SwasthyaTwin is an experimental proof-of-concept research platform built for hackathon exploration of personalized biometric deviation tracking and *in silico* What-If lifestyle simulation.
> - **It does NOT provide medical diagnoses.**
> - **It does NOT promise prevention or predict clinical emergencies.**
> - **It does NOT replace licensed medical professionals.**
> - All demonstration records in this distribution are synthetic cohorts generated mathematically.
> - Any acute, worsening, or emergency symptoms require immediate professional clinical evaluation.

---

## 🌟 Key Features

1. **Self-Baseline Comparison (Anti-Population Norm Architecture)**
   - Benchmarks every patient against their **own longitudinal rolling window** (e.g. 30-day baseline), not against generic population distributions.
   - Standardized Z-Score deviation indicators ($\sigma$) identify subtle individual drift.

2. **Dynamic Digital Twin State & Transparent Vitality Index**
   - 0–100 Health Stability Index calculated via a **100% explainable deduction formula**.
   - No black-box machine-learning probabilities; every point deduction is mathematically linked to the offending metric's standardized deviation.

3. **In Silico What-If Intervention Simulator**
   - Interactive levers for sleep extension, physical activity increments, stress reduction, and dietary sodium moderation.
   - Plots forecasted multi-day cardiovascular adaptation curves with **90% confidence uncertainty envelopes**.

4. **Explainable Health Deviation Alert Center**
   - Rule-based alerts flagged by severity (`info`, `warning`, `critical`).
   - Complete root-cause decomposition: trigger value, baseline reference, Z-score, and conservative non-prescriptive lifestyle guidance.
   - Full acknowledgement workflow with clinician/patient notes.

5. **3-Tier Data Provenance Model**
   - Strict categorization of every measurement:
     - `Tier 1: Measured` (Wearable PPG/ECG, clinical laboratory assays)
     - `Tier 2: User Reported` (Subjective journals, manual cuff logs)
     - `Tier 3: Simulated` (What-If counterfactual model forecasts)

6. **Longitudinal Interactive Charts & Audit Timeline**
   - Multi-metric timeseries with **shaded $\mu \pm 1.5\sigma$ tolerance envelope**.
   - Interactive timeframe filters (7D, 14D, 30D, 90D).
   - Real-time measurement logger to test twin reactivity dynamically.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, PyMongo, Pandas, NumPy, SciPy |
| **Database** | MongoDB 7.0 (with automated in-memory mongomock fallback for instant offline execution) |
| **Testing** | Pytest (backend), Vitest & React Testing Library (frontend) |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quickstart Guide

### Option 1: Run Locally (Fastest)

#### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- (Optional) MongoDB running locally on port 27017. *If MongoDB is not running, SwasthyaTwin automatically initializes an in-memory database fallback so you can test all features immediately!*

#### 1. Start the Backend
```bash
# Clone and enter directory
cd SwasthyaTwin

# Create Python virtual environment
python -m venv backend/venv

# Activate virtual environment
# On Windows (PowerShell):
.\backend\venv\Scripts\Activate.ps1
# On macOS/Linux:
# source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run backend API server
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Backend API will be live at: **`http://localhost:8000`**
Interactive Swagger Docs: **`http://localhost:8000/docs`**

#### 2. Start the Frontend
In a new terminal window:
```bash
cd SwasthyaTwin/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend web application will be live at: **`http://localhost:5173`**

---

### Option 2: Run with Docker Compose

Ensure Docker Desktop is running, then execute:
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- MongoDB: `localhost:27017`

---

## 🧪 Running the Test Suites

### Backend Tests (`pytest`)
```bash
# From workspace root:
$env:PYTHONPATH="backend"; backend/venv/Scripts/pytest.exe backend/tests -v
```
Verifies:
- Outlier Winsorization and baseline window calculations
- Z-score thresholding and rule-based alert triggering
- What-If physiological decay & recovery kinetics
- Full API integration tests (health check, synthetic seeding, twin state evaluations)

### Frontend Tests (`vitest`)
```bash
cd frontend
npm run test
```

---

## 👥 Pre-Configured Synthetic Cohorts

SwasthyaTwin auto-seeds 3 distinct demonstration cohorts upon startup (90 days of daily continuous telemetry each):

1. **Aarav Mehta (`PT-1001`)** — 38M, Corporate Professional
   - *Clinical Scenario:* Acute work-crunch sleep deprivation. Sleep hours drop from 7.5h to 5.1h over the last 15 days, resulting in resting HR elevation and autonomic strain.
2. **Priya Sharma (`PT-1002`)** — 54F, Hypertensive Recovery
   - *Clinical Scenario:* Adopting DASH low-sodium diet and daily walking. Systolic BP steadily improves from 144 to 128 mmHg over 90 days.
3. **Devan Nair (`PT-1003`)** — 28M, Marathon Athlete
   - *Clinical Scenario:* High-performance runner experiencing autonomic fatigue/overtraining drift (normally resting HR 48 bpm; drifts to 62 bpm with depressed HRV).

*You can trigger a fresh re-seed anytime from the header button or via `POST /api/v1/seed`.*

---

## 📖 System Architecture & Endpoints

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for full algorithmic formulations.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server and database connection readiness check |
| `GET` | `/api/v1/patients` | List patients with pagination and search |
| `GET` | `/api/v1/patients/{id}` | Get patient demographic and baseline settings |
| `GET` | `/api/v1/patients/{id}/twin/state` | Dynamic digital twin state & Z-score deviations |
| `GET` | `/api/v1/patients/{id}/twin/baseline` | Calculated personalized baseline distributions |
| `GET` | `/api/v1/patients/{id}/twin/assessment` | Explainable Vitality Index and deduction factors |
| `POST` | `/api/v1/patients/{id}/simulations/run` | Execute counterfactual What-If projection |
| `GET` | `/api/v1/patients/{id}/alerts` | Active and historical deviation alerts |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Mark alert as acknowledged with clinician notes |
| `POST` | `/api/v1/seed` | Seed deterministic synthetic 90-day cohorts |
