# SwasthyaTwin 🧬
### Personalized Healthcare Digital Twin for Early Risk Detection and Preventive Intervention

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_TypeScript-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_7.0-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com)
[![Pytest](https://img.shields.io/badge/Testing-185_Pytest_%26_50_Vitest-0A9EDC.svg?style=flat)](https://pytest.org)
[![PhysioNet](https://img.shields.io/badge/Research_Data-PhysioNet_BiDSleep_31_Subjects-8A2BE2.svg?style=flat)](https://physionet.org)

---

## ⚠️ Healthcare Safety & Research Prototype Notice
> [!WARNING]
> **CLINICAL & REGULATORY DISCLAIMER:** SwasthyaTwin is an experimental proof-of-concept research platform built for personal longitudinal biometric deviation tracking, physiological sleep-stage inference, and *in silico* counterfactual What-If lifestyle simulation.
> - **It is NOT an FDA, EMA, or CDSCO-cleared medical device.**
> - **It does NOT provide clinical diagnoses or prescriptive medical advice.**
> - **It does NOT predict medical emergencies or acute cardiac events.**
> - **It does NOT compute ungrounded disease probabilities or replace certified clinicians.**
> - All demonstration records in this repository are synthetic cohorts generated mathematically.
> - Any acute, worsening, or emergency symptoms require immediate professional clinical care.

---

## 🌟 What SwasthyaTwin Solves

1. **Self-Baseline Comparison Over Generic Population Norms**:
   Traditional dashboards flag abnormalities against generalized population ranges (e.g., 60–100 bpm). However, an endurance athlete normally rests at 46 bpm, while an elderly individual rests at 76 bpm. SwasthyaTwin prioritizes the patient's **own longitudinal rolling window** ($\mu \pm 1.8\sigma$ over 14–30 days) as the benchmark, detecting subtle individual drift long before population thresholds are breached.

2. **Interactive Spatial Human Digital Twin**:
   A futuristic dark-canvas holographic anatomical locator where each body subsystem (Cardiovascular, Autonomic, Metabolic, Respiratory, Musculoskeletal, Thermoregulatory) links exclusively to real, supported physiological telemetry.

3. **Authentic ML Sleep Staging (PhysioNet BiDSleep)**:
   A fully reproducible machine learning pipeline trained on 31 authentic human participants from PhysioNet, inferring 3-class sleep stages (`Wake`, `NREM`, `REM`) from consumer optical PPG dynamics with **zero participant leakage** and **zero future-data leakage**.

4. **Personal Trend Forecasting on Supported Targets**:
   Evaluated against chronological holdouts (latest 7 days, no temporal shuffling) and compared against Persistence and Rolling 7-day baselines. Strictly excludes acute vitals (blood pressure, blood glucose) to prevent ungrounded predictions.

5. **In Silico What-If Intervention Simulator**:
   Interactive scenario workspace allowing users to adjust lifestyle levers (sleep extension, daily activity targets) to model multi-day recovery curves. Counterfactual simulations write strictly to `db.simulations` and **never contaminate** historical observations.

6. **Mathematical Transparency ("How is this calculated?")**:
   Clicking any metric, alert, or indicator opens an accessible dialog displaying the exact mathematical formula, personal parameters, and worked calculation.

---

## 🏗️ Architecture

```
                                  +---------------------------------------+
                                  |         SwasthyaTwin Web App          |
                                  |     (React 19 + TypeScript + Vite)    |
                                  +-------------------+-------------------+
                                                      |
                                                      | REST / JSON
                                                      v
                                  +---------------------------------------+
                                  |         FastAPI Backend Engine        |
                                  |  - API Router (/api/v1/ and /api/)    |
                                  |  - HMAC Bearer / X-API-Key Security   |
                                  |  - Patient Isolation & Route Guards   |
                                  |  - Pydantic v2 Contract Validation    |
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +--------------------+
                     v                                                               v
      +-----------------------------+                               +---------------------------------+
      |    Analytics & ML Engines   |                               |   Data Access Services          |
      | - Personal Baseline Math    |                               | - Patient Service               |
      | - Z-Score Anomaly Engine    |                               | - Observation Service           |
      | - PhysioNet Sleep Staging   |                               | - Health Assessment Service     |
      | - Trend Holdout Forecaster  |                               | - What-If Simulation Service    |
      | - What-If Kinetics Model    |                               | - Scrubbed Audit Repository     |
      +-----------------------------+                               +----------------+----------------+
                                                                                     |
                                                                                     v
                                                                    +---------------------------------+
                                                                    |        MongoDB Database         |
                                                                    | Collections:                    |
                                                                    | - patients                      |
                                                                    | - observations                  |
                                                                    | - health_assessments            |
                                                                    | - simulations                   |
                                                                    | - alerts                        |
                                                                    | - audit_events                  |
                                                                    +---------------------------------+
```

---

## 📋 Prerequisites

- **Python**: Version `3.11` or `3.12+` (Tested on Python `3.13.5`)
- **Node.js**: Version `18.x` or `20.x+` (npm `9.x` or `10.x+`)
- **MongoDB**: Version `6.0+` or `7.0+` running on `mongodb://localhost:27017`
  *(Note: If local MongoDB is offline, an in-memory `mongomock` fallback allows offline hackathon demonstration without crashes)*

---

## 🚀 Quickstart & Clean Installation

### 1. Clone & Setup Environment Files
```bash
git clone https://github.com/Jaswant-Karun/SwasthyaTwin---Digital-Twin-Platform.git
cd SwasthyaTwin

# Copy environment configuration template
cp .env.example .env
cp backend/.env.example backend/.env
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies from pinned requirements
pip install -r requirements.txt

# Seed the 5 synthetic demonstration patients
python -m app.database.seed

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Backend API will be live at:
- **API Root**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend

# Install exact dependencies from lockfile
npm ci

# Start Vite client development server
npm run dev
```
Frontend Web Application will be live at:
- **Application URL**: `http://localhost:5173`

---

## 🐳 Docker Compose (Optional)

If Docker and Docker Compose are installed:
```bash
docker compose up --build
```
This spins up:
- MongoDB 7.0 on port `27017`
- FastAPI backend on port `8000`
- Nginx frontend on port `5173` (mapped from container port 80)

---

## ⚙️ Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Deployment tier: `development`, `staging`, `production` |
| `HOST` | `127.0.0.1` | Backend binding host |
| `PORT` | `8000` | Backend listening port |
| `DEMO_MODE` | `true` | Allows open demonstration access with synthetic cohorts |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string (passwords masked in logs) |
| `MONGODB_DATABASE` | `swasthyatwin` | Target database instance |
| `ALLOW_IN_MEMORY_FALLBACK` | `true` | Permits in-memory `mongomock` if MongoDB is unreachable |
| `API_SECRET_KEY` | *(empty)* | Optional secret key; when set, requires `X-API-Key` or Bearer header |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed web origins |
| `DEFAULT_BASELINE_DAYS` | `30` | Default longitudinal rolling corridor window |
| `MIN_OBSERVATIONS_FOR_BASELINE` | `3` | Minimum valid records required before computing $Z$-scores |
| `DEVIATION_SIGMA_THRESHOLD` | `1.8` | Standard deviation threshold triggering anomaly warnings |

---

## 🧪 Testing & Quality Assurance

### Backend & ML Pytest Suite (215 Tests)
```powershell
# From repository root:
$env:PYTHONPATH="backend;.backend"
backend\venv\Scripts\python.exe -m pytest -q

# Or from backend directory:
cd backend
$env:PYTHONPATH="."
.\venv\Scripts\pytest tests -q
```
- **Total Tests**: **215 passed** (185 backend unit/integration + 30 ML pipeline tests; 0 failures)
- **Coverage**: Database persistence, schema validation, personal baseline calculations, robust nMAD anomaly engine, BiDSleep ML pipeline, causal sequence inference, forecasting holdouts, What-If simulator, HMAC security, multi-signal timeline, and data quality guards.

### Frontend Vitest Suite (50 Tests)
```powershell
cd frontend
npx vitest run
```
- **Total Tests**: **50 passed** across 12 test suites in ~34s (0 failures)
- **Coverage**: Spatial Hologram Twin, timeline interactions, forecasting cards, simulation comparisons, accessibility semantics, and state error guards.

### Static Typing & Production Build
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
- **TypeScript**: 0 diagnostic errors
- **Production Bundle**: Built successfully (`dist/assets/index-BONiE7ch.js` 1,176 kB │ gzip 299 kB)

---

## 🔬 Machine Learning Pipeline & Dataset Setup

### Dataset Provenance
- **Dataset**: PhysioNet Bimodal Sleep Dataset (BiDSleep v1.0.1)
- **Subjects**: 31 authentic human participants
- **License**: Open Data Commons Attribution License v1.0 (ODC-By v1.0)
- **Signal**: Optical PPG pulse rate recordings aligned with polysomnography ground truth

### Model Training & Artifact Generation
To retrain the sleep-stage model from raw PhysioNet files:
```powershell
cd backend
python -m app.ml.trainer
```
Serialized production artifacts are generated in `backend/app/ml/artifacts/`:
1. `best_model.joblib`: Trained class-weighted Random Forest classifier
2. `scaler.joblib`: Preprocessing standard scaler fitted on training participants
3. `model_manifest.json`: Evaluated metrics, confusion matrix, and feature schema

> [!NOTE]
> If model artifacts are deleted or absent, the API returns an honest `503 Service Unavailable` status (`Sleep Stage ML model artifact is unavailable`) rather than fabricating fake predictions.

---

## 🎭 Demonstration Mode & Seed Management

SwasthyaTwin includes 5 deterministic synthetic archetypes (`PT-1001` through `PT-1005`):
- `PT-1001` Aarav Mehta: High-stress tech worker with resting heart rate drift
- `PT-1002` Priya Sharma: Metabolic profile with sedentary daily steps
- `PT-1003` Marcus Vance: Endurance athlete with resting bradycardia (48 bpm normal)
- `PT-1004` Elena Rostova: Senior with narrow blood pressure corridor
- `PT-1005` David Kim: Shift worker with circadian sleep disruption

### Demonstration CLI Commands
```powershell
# Seed demo patients into MongoDB (deterministic random seed 42)
python -c "from app.database.connection import get_db; from app.database.seed import seed_synthetic_patients; seed_synthetic_patients(get_db(), force=True)"

# Inject a live acute telemetry observation (recalculates baseline dynamically)
python -c "from app.database.connection import get_db; from app.database.seed import inject_live_observation; inject_live_observation(get_db(), 'PT-1001', 'heart_rate', 84.0)"
```

---

## 🛠️ Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"MongoDB connection failed"** | Local MongoDB daemon is not running on port 27017 | Start MongoDB (`net start MongoDB` on Windows, or `brew services start mongodb-community`), or keep `ALLOW_IN_MEMORY_FALLBACK=true` in `.env` for in-memory mock execution. |
| **"Sleep Stage ML model artifact is unavailable" (503)** | Model artifacts were deleted or not generated | Run `python -m app.ml.trainer` in `backend/` to regenerate artifacts, or verify `backend/app/ml/artifacts/` exists. |
| **"Invalid unit 'xyz' for measurement_type" (422)** | Client passed a non-canonical unit | Review `VALID_UNITS` in [observation.py](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/models/observation.py). Heart rate accepts `bpm`, sleep accepts `hours`, steps accepts `steps`. |
| **Vitest JSDOM ResizeObserver Warning** | Recharts responsive container rendered in JSDOM | Mock is configured in `frontend/src/tests/setup.ts`; warnings in stderr are expected in virtual headless DOMs and do not fail tests. |
| **401 Unauthorized in API calls** | `API_SECRET_KEY` was configured in `.env` | Include header `X-API-Key: <your-key>` or `Authorization: Bearer <your-key>` in HTTP requests. |

---

## 📑 Submission Documentation Directory

- **Technical Architecture**: [docs/architecture.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/architecture.md)
- **3-Minute Demo Walkthrough Script**: [docs/demo-script.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/demo-script.md)
- **PhysioNet BiDSleep Model Card**: [docs/model-card.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/model-card.md)
- **Data Provenance & Grounding Audit**: [docs/data-provenance.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/data-provenance.md)
- **Security & Privacy Architecture**: [docs/security-and-privacy.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/security-and-privacy.md)
- **Known Limitations & Clinical Boundaries**: [docs/known-limitations.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/known-limitations.md)
- **Final Release Verification Checklist**: [docs/release-checklist.md](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/release-checklist.md)

---

## 📄 License
This project is licensed under the MIT License for open-source research and hackathon evaluation.
