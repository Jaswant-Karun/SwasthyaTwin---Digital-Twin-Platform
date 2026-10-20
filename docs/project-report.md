# SwasthyaTwin — Comprehensive Technical Project Report

**Project Name:** SwasthyaTwin — Personalized Healthcare Digital Twin for Early Risk Detection and Preventive Intervention  
**Version:** 1.2.0-alpha  
**Date:** October 2026  
**Audience:** Hackathon Evaluation Panel, Senior Healthcare Software Architects, Application Security Reviewers  

---

## Executive Summary

**SwasthyaTwin** is an end-to-end, personalized healthcare digital twin platform engineered to dynamically reflect a patient's biological state using longitudinal wearable metrics, clinical lab records, and lifestyle telemetry. 

Modern commercial health apps frequently suffer from two fatal flaws:
1. **Generic Population Cutoffs:** Imposing one-size-fits-all clinical thresholds (e.g., standard 60–100 bpm resting heart rate) that trigger false alarms in well-conditioned individuals or miss dangerous progressive drift in chronic disease patients.
2. **Black-Box Opacity:** Presenting proprietary "health scores" without mathematical provenance, preventing clinical auditability and alienating healthcare providers.

SwasthyaTwin implements an **Anti-Population Norm Architecture**. Every patient is evaluated strictly against their own historical baseline corridor. Any deduction from the **Vitality Stability Index (0–100)** is 100% deterministic, explainable, and traceable to individual biometric $Z$-scores.

---

## 1. System Architecture & Components

SwasthyaTwin is structured as a decoupled, multi-tier reactive platform:

```mermaid
graph TD
    subgraph Client ["Frontend (React 18 + TypeScript + Vite)"]
        UI["Tailwind CSS + shadcn/ui Dashboard"]
        Context["TwinContext (Race Condition Guard & State)"]
        ClientAPI["Typed API Client (Fetch + Error Normalizer)"]
        UI --> Context
        Context --> ClientAPI
    end

    subgraph Server ["Backend API (FastAPI + Python 3.11+)"]
        Router["FastAPI REST Routers (/api/v1)"]
        AuthMiddleware["CORS & Header Sanitization"]
        Router --> AuthMiddleware
        
        subgraph Analytics ["Analytics Engine"]
            BaselineCalc["Baseline Calculator (Robust Statistics)"]
            AnomalyDet["Anomaly & Drift Detector (Z-Scores)"]
            TrendInd["Trend Indicator (Vitality Index)"]
            SimEngine["What-If Simulation Engine"]
        end

        subgraph ServiceLayer ["Service Layer"]
            PatService["Patient Service"]
            ObsService["Observation Service"]
            AssessService["Assessment Service"]
            SimService["Simulation Service"]
            AlertService["Alert Service"]
        end

        Router --> ServiceLayer
        ServiceLayer --> Analytics
    end

    subgraph DataStore ["Persistence Layer (MongoDB 7.0)"]
        MongoDb[("MongoDB Database: swasthyatwin")]
        ColPatients[("patients")]
        ColObs[("observations")]
        ColAssess[("health_assessments")]
        ColSims[("simulations")]
        ColAlerts[("alerts")]
        ColAudit[("audit_logs")]

        MongoDb --- ColPatients
        MongoDb --- ColObs
        MongoDb --- ColAssess
        MongoDb --- ColSims
        MongoDb --- ColAlerts
        MongoDb --- ColAudit
    end

    ClientAPI -->|HTTP/REST Proxy| Router
    ServiceLayer -->|PyMongo Driver| MongoDb
```

### 1.1 Technology Stack Selection
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **Backend:** Python 3.11+, FastAPI (ASGI), Pydantic v2 (strict runtime schema validation), NumPy, SciPy.
- **Database:** MongoDB 7.0 with compound indexing on `(patient_id, measurement_type, observed_at)` for high-throughput longitudinal timeseries retrieval.
- **Resilience:** Built-in in-memory fallback store (`mongomock`) activated automatically when a local MongoDB daemon is unreachable, guaranteeing zero-crash demonstrability.

---

## 2. Mathematical & Algorithmic Formulations

### 2.1 Robust Baseline Formulation
Rather than computing simple arithmetic means that are easily skewed by sensor noise or acute temporary spikes, SwasthyaTwin utilizes robust non-parametric metrics alongside Winsorized Gaussian statistics across a configurable rolling window $W$ (default: 30 days):

$$\text{Median}(X) = Q_2(X)$$
$$\text{IQR}(X) = Q_3(X) - Q_1(X)$$

To establish personal baseline tolerance bounds:
$$\text{Lower Bound} = \mu_{\text{self}} - 1.5\sigma_{\text{self}}$$
$$\text{Upper Bound} = \mu_{\text{self}} + 1.5\sigma_{\text{self}}$$

### 2.2 Standardized $Z$-Score Divergence
For any incoming verified measurement $x_t$ of metric type $m$:
$$Z_m(t) = \frac{x_t - \mu_{m,\text{self}}}{\sigma_{m,\text{self}}}$$

- $|Z| < 1.0$: **Optimal** (Within standard biological circadian variation)
- $1.0 \le |Z| < 1.8$: **Mild Deviation** (Incipient biological shift)
- $1.8 \le |Z| < 2.5$: **Moderate Drift** (Sub-clinical stress or cumulative fatigue)
- $|Z| \ge 2.5$: **Significant Deviation** (Actionable deviation triggering alert review)

### 2.3 Transparent Vitality Stability Index (0–100)
The overall Vitality Index is anchored to 100 points. Points are deducted through an explicit, auditable attribution formula:

$$V = \max\left(10, 100 - \sum_{m \in M} D_m\right)$$

Where deduction $D_m$ for metric $m$ is determined by its standardized severity weight:
$$D_m = w_m \cdot f(|Z_m|)$$

Every deduction generates an `ExplainabilityFactor` containing:
- Metric Type (e.g., `heart_rate`)
- Exact point deduction (e.g., `-12 pts`)
- Plain-English clinical rationale (e.g., *"Resting HR (+18.4%) exceeds self-baseline (64.2 bpm) with sustained Z-Score of +3.81σ"*).

### 2.4 Counterfactual *In Silico* What-If Modeling
Interventions (e.g., sleep extension $\Delta S$, physical activity increase $\Delta A$, stress reduction $\Delta \Sigma$) model physiological adaptation curves using exponential saturation kinetics:

$$\Delta y(t) = \Delta y_{\max} \cdot \left(1 - e^{-t / \tau}\right)$$

Where $\tau$ is the characteristic biological time-constant (e.g., $\tau \approx 5$ days for autonomic sleep adaptation). Uncertainty bounds (90% Confidence Interval) expand over projection horizons:
$$\text{CI}_{90\%}(t) = \hat{y}(t) \pm 1.645 \cdot \sigma_{\text{residual}} \cdot \sqrt{1 + \alpha \frac{t}{T}}$$

---

## 3. 3-Tier Data Provenance & Safety Governance

SwasthyaTwin enforces strict data tiering across all storage and display components:

| Tier | Category | Sources | Allowed Uses |
|---|---|---|---|
| **Tier 1** | `measured` | Wearable sensors (PPG, accelerometer, ECG), clinical lab tests | Baseline calculations, deviation alerts, twin state |
| **Tier 2** | `user_entered` | Manual journal entries, subjective logs | Displayed on timeline, flagged as self-reported |
| **Tier 3** | `simulated` | Mathematical What-If counterfactual models | Visualized in What-If Simulator with explicit simulation banners |

> **Healthcare Safety Invariant:** Tier 3 (Simulated) data is **never** commingled with Tier 1/Tier 2 longitudinal observations and is strictly forbidden from triggering clinical surveillance alerts.

---

## 4. Application Security & Privacy Review

1. **Secret & Credential Sanitization:**
   - No credentials, tokens, or private keys are stored in the repository.
   - The logger in [`backend/app/core/config.py`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/core/config.py) automatically redacts passwords in database connection URIs (`mongodb+srv://admin:****@...`).
   - The [`AuditRepository`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/repositories/audit_repository.py) scrubs forbidden keys (`password`, `token`, `secret`, `credentials`, `apikey`) prior to writing audit logs.

2. **CORS & Network Boundaries:**
   - Controlled via `CORS_ORIGINS` environment variable, restricting cross-origin requests to configured frontend ports (e.g., `http://localhost:5173`, `http://127.0.0.1:5173`).

3. **Safe Demo Cohort Reset:**
   - Any synthetic demo reset invocation (`POST /api/v1/seed/reset` or CLI `--reset`) requires explicit `confirm=True`.
   - Filtered exclusively by `{"$or": [{"demo_data": True}, {"patient_id": {"$in": DEMO_PATIENT_IDS}}]}`. Real user accounts and telemetry are completely protected from deletion.

4. **Authentication Limitations Disclosure:**
   - SwasthyaTwin currently operates in **Hackathon Open Mode** without full HIPAA/GDPR authentication. In a clinical production deployment, OAuth2/OIDC, JWT role-based access control (RBAC), TLS in-transit encryption, and MongoDB field-level encryption (FLE) must be established before handling Protected Health Information (PHI).

---

## 5. Verification & Test Results

### 5.1 Automated Test Execution Summary
- **Backend Tests:** 33 / 33 passed (100%) via `pytest`
  - `test_analytics_engine.py`: 10 passed
  - `test_anomaly.py`: 2 passed
  - `test_api.py`: 2 passed
  - `test_baseline.py`: 3 passed
  - `test_mongo_data_layer.py`: 15 passed
  - `test_simulations.py`: 1 passed
- **Frontend Tests:** 5 / 5 passed (100%) via `vitest`
  - `MetricCard.test.tsx`: 2 passed
  - `StatusBadge.test.tsx`: 3 passed
- **Static Analysis & Type Checking:**
  - TypeScript build (`npm run build`): Clean compile, 0 errors.
  - Python compileall (`python -m compileall backend/app`): 100% syntax compliance.

### 5.2 Browser End-to-End Automation Verification
Full interactive user journeys were tested and recorded ([`integration_verification_1792520316108.webp`](file:///C:/Users/jaswant%20karun/.gemini/antigravity-ide/brain/bd0ec9ad-9320-49a5-b4be-3ec1cb086dd0/integration_verification_1792520316108.webp)):
1. TopNav displays real MongoDB connectivity and round-trip ping time (`0.8ms`).
2. Patient switching updates metric cards, vitality score, and longitudinal plots without race conditions.
3. Alert acknowledgement persistently updates MongoDB and changes status to `Reviewed`.
4. What-If simulator computes counterfactual curves and displays scientific model assumptions.
5. Ingesting an observation updates the digital twin state in place without requiring a full page reload.

---

## 6. Known Limitations & Future Roadmap

1. **Clinical Limitations:**
   - Current heuristic rules model linear/exponential approximations and do not encompass multi-organ pharmacology or genomic cross-interactions.
2. **Wearable Ingestion Pipelines:**
   - Ingestion is currently performed via REST APIs and synthetic batches. Future iterations will include real-time WebSocket streams for Apple HealthKit, Garmin, and Fitbit Web APIs.
3. **Enterprise Authentication:**
   - Transitioning from hackathon development mode to SMART-on-FHIR and OAuth2 authorization for direct electronic health record (EHR/EMR) interoperability.
