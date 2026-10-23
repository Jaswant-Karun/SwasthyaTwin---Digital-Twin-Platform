# SwasthyaTwin Engineering & Quality Assurance Audit Report (Step 9)

**Date**: October 23, 2026  
**Auditor**: SwasthyaTwin Core Engineering & AI Systems Audit  
**Target Platform**: SwasthyaTwin Personalized Healthcare Digital Twin  
**Overall Status**: **PASSED (ALL AUTOMATED SUITES 100% GREEN, ZERO BLOCKERS)**

---

## 1. Executive Summary

This comprehensive audit evaluates SwasthyaTwin across five core dimensions:
1. **Build and Integration**: Dependency lockfile integrity, static typing, production builds, FastAPI lifespan lifecycle, and MongoDB connectivity.
2. **Data Integrity & Persistence**: CRUD semantics, duplicate rejection, timestamp/timezone normalization, patient data isolation, and non-destructive demonstration seeding.
3. **Calculation & ML Correctness**: Deterministic Z-score anomalies, PhysioNet sleep-staging model reproducibility (31 subjects, group-aware participant split, zero leakage), chronological holdout forecasting, and counterfactual simulation immutability.
4. **Security, Privacy & Compliance**: Secret management, authentication guards, patient-level authorization, NoSQL/regex injection defenses, and non-diagnostic regulatory boundaries.
5. **Frontend Quality & Accessibility**: State resilience (loading, empty, error, stale, insufficient history), responsive viewports, ARIA dialog/alert semantics, and keyboard navigation.

---

## 2. Test Execution Summary

| Test Domain | Runner / Engine | Scope | Tests Run | Passed | Failed | Duration | Outcome |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Backend Suite** | `pytest 9.1.1` (Python 3.13.5) | Full API, ML, Repositories, Analytics | **185** | **185** | **0** | 70.53s | **PASSED** |
| **Frontend Suite** | `vitest 5.0.5` (jsdom, React 19) | Pages, Components, Twin State, Accessibility | **50** | **50** | **0** | 14.22s | **PASSED** |
| **Frontend Types** | `tsc --noEmit` (TypeScript 5.8) | Full Static Type Checking | Full codebase | - | - | 4.80s | **0 Errors** |
| **Frontend Build** | `vite v8.3.4` (Production Rollup) | Minification, Asset Bundling | 2,537 modules | - | - | 2.75s | **PASSED** |

---

## 3. Section-by-Section Verification

### A. Build and Integration Audit

#### Exact Commands Run:
```powershell
# Frontend Type Check
cd frontend; npx tsc --noEmit

# Frontend Production Build
cd frontend; npm run build

# Frontend Test Suite
cd frontend; npx vitest run

# Backend Test Suite
cd backend; $env:PYTHONPATH="."; .\venv\Scripts\pytest tests
```

#### Results & Verifications:
- **Lockfile Consistency**: Frontend dependencies installed strictly via `package-lock.json`. Backend dependencies pinned in `requirements.txt`.
- **Production Asset Output**: Production bundle compiled in 2.75s producing `dist/assets/index-BONiE7ch.js` (1,176.74 kB │ gzip: 299.54 kB) and `dist/assets/index-D7sgacZb.css` (75.27 kB │ gzip: 13.17 kB).
- **Startup and Shutdown**: FastAPI `lifespan` handler tested via `TestClient(app)`. Startup pings MongoDB, validates or builds collection indexes, conditionally checks for synthetic seed data without mutating user records, and cleanly closes connections on shutdown.
- **Model Artifact Loading**: BiDSleep random forest and XGBoost models, scikit-learn standard scalers, and manifest files loaded deterministically from `backend/app/ml/artifacts/` during module initialization.

---

### B. Data Integrity & Persistence Audit

#### Verifications Performed:
1. **CRUD Lifecycle & Restart Persistence**:
   - Tested in `test_mongo_data_layer.py`: Patient creation, read, update, list pagination, and soft/hard cascade deletion.
   - Tested in `test_user_input_pipeline.py`: Observations persist to MongoDB collections (`observations`, `health_assessments`) and remain retrievable across process restarts.
2. **Units, Plausibility, and Timezone Normalization**:
   - `VALID_UNITS` strictly enforced. Invalid units (e.g. submitting heart rate with unit `'liters'`) raise an immediate `ValueError` (422 response).
   - Timezones coerced to UTC if naive; ISO-8601 strings normalized.
   - Physiological plausibility bounds enforced (e.g. `heart_rate` restricted to 25–260 bpm; `spo2` restricted to 50–100%).
3. **Duplicate Prevention**:
   - Unique indexes on `patient_id` and `observation_id` reject duplicates with `DuplicateKeyError` and return structured 409/400 errors.
4. **Patient Isolation**:
   - Every observation, assessment, simulation, and alert query strictly parameters `{"patient_id": patient_id}`.
   - Tested cross-patient leakage: Patient A's query never includes records from Patient B.
5. **MongoDB Failure & Synthetic Fallback Transparency**:
   - `ALLOW_IN_MEMORY_FALLBACK=True` enables isolated in-memory `mongomock` strictly for offline local hackathon demonstrations.
   - In production or when `ALLOW_IN_MEMORY_FALLBACK=False`, database disconnection raises a transparent `RuntimeError` and returns 503 Service Unavailable at `/health/ready`. Real patient observations are **never** silently fabricated.
6. **Demo Data Segregation**:
   - Demo patients and observations are permanently tagged with `demo_data=True` and `is_synthetic=True`.
   - Seeding routines (`seed_synthetic_patients`) check for existing data and never overwrite or delete authentic user patient records.

---

### C. Calculation and Machine Learning Correctness

#### Verifications Performed:
1. **Baseline & Anomaly Reproducibility**:
   - Tested in `test_calculation_engine.py` and `test_anomaly.py`: Z-score deductions, running standard deviations, and vitality stability indices match known mathematical outputs within $10^{-6}$ tolerance.
   - Minimum baseline observation requirement (3 records) enforced; insufficient history is flagged explicitly without computing misleading deviations.
2. **PhysioNet Sleep Staging Model Pipeline**:
   - Tested in `test_authentic_ml_pipeline.py` (15/15 tests passing):
     - **31 Authentic Subjects**: Data parsed directly from PhysioNet Bimodal Sleep dataset (`1066528_heartrate.txt`, etc.).
     - **Participant-Level Split**: Verified zero participant overlap between training and testing sets (`assert train_subs.intersection(test_subs) == set()`).
     - **Zero Preprocessing Leakage**: Feature scalers fitted strictly on training participants, preventing future information leakage.
     - **Baselines**: Compared against Majority Class Baseline (predicting NREM) and Heuristic Rule Baseline.
3. **Trend Forecasting**:
   - Tested in `test_personal_trend_forecasting.py` (7/7 tests passing):
     - Chronological holdout evaluation (latest 7 days held out; no shuffling).
     - Compared against Persistence (last known value) and Rolling 7-day Historical Average baselines.
     - Unsupported acute metrics (blood pressure, fasting glucose) strictly rejected with transparent explanatory errors.
4. **What-If Simulation Separation**:
   - Tested in `test_what_if_simulator.py` (6/6 tests passing):
     - Counterfactual simulations write strictly to `db.simulations` and **never** mutate `db.observations`.
     - Output schema clearly marks results as `simulated`.
5. **Non-Diagnostic Policy**:
   - Removed all unsupported diagnostic claims, fabricated cancer risks, or ungrounded disease probabilities.

---

### D. Security and Privacy Audit

#### Verifications Performed:
1. **Credential & Secret Protection**:
   - Verified `.gitignore` blocks `.env`, `.env.local`, and sensitive credential files.
   - Git tracking audit (`git ls-files | Select-String -Pattern "\.env"`) confirmed only `.env.example` templates are tracked.
   - Sanitized database URI logger (`sanitized_mongo_uri`) masks passwords before writing to console logs.
2. **Authentication & Authorization**:
   - Created `backend/app/core/security.py` and test suite `test_security_and_auth.py` (7/7 tests passing).
   - In non-demo environments or when `API_SECRET_KEY` is set, requests without valid `X-API-Key` or `Authorization: Bearer <token>` fail with 401 Unauthorized using constant-time comparison (`hmac.compare_digest`).
   - Patient-level role authorization (`require_patient_access`) blocks patient actors from inspecting other patient records (403 Forbidden).
3. **Injection & Query Hardening**:
   - PyMongo queries use structured dictionary parameters.
   - Hardened `PatientRepository.list_patients` with `re.escape(search.strip())` to prevent NoSQL regex injection and ReDoS attacks.
4. **Audit Logging Hygiene**:
   - `AuditRepository` scrubs sensitive credentials (`password`, `token`, `secret`, `apikey`, `authorization`) before persisting events.
5. **CORS & Error Handling**:
   - Restricted origins configured via `CORS_ORIGINS`.
   - Internal stack traces stripped in production error responses.

---

### E. Frontend Quality & Accessibility Audit

#### Verifications Performed:
1. **State Resilience**:
   - Tested in `FrontendQualityAuditStep9.test.tsx`:
     - **Loading State**: Spinners and loading text (`Retrieving calculation metadata...`).
     - **Empty & Insufficient History State**: Explicit alert rendered explaining minimum observation threshold (< 3 records).
     - **Stale Data Warning**: Tagged with amber badge when $>48$ hours without updates.
2. **Accessibility & Controls**:
   - Verified dialogs include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
   - Close buttons include descriptive `aria-label` attributes (`aria-label="Close calculation explanation modal"`).
   - Keyboard navigation tested: Enter/Click triggers selection and opens telemetry deep dives.
3. **Numeric Faithfulness**:
   - Rendered values verified to match API response numbers exactly (e.g. `84.0 bpm`, `+23.5%`, `+4.00σ`).

---

## 4. Issues Identified & Resolved During Audit

| Issue Identified | Root Cause | Resolution Implemented | Verification |
| :--- | :--- | :--- | :--- |
| **Vitest Timeout on Windows CI** | Default 5000ms timeout exceeded when 12 test suites spawn in jsdom | Increased `testTimeout: 15000` in `frontend/vite.config.ts` | All 12 test suites passed in 14.22s |
| **NoSQL Regex Search Injection** | Unescaped search string passed directly to MongoDB `$regex` | Added `re.escape(search.strip())` in `PatientRepository` | Clean literal substring search enforced |
| **Unconfigured Non-Demo Auth** | Lack of centralized API key validation dependency | Created `backend/app/core/security.py` with HMAC validation | 7/7 tests passing in `test_security_and_auth.py` |
| **Pydantic Model Shadowing Warnings** | `PatientResponse` and `ObservationResponse` re-declared base properties | Verified serialization stability across endpoints | Retained for API compatibility; audited in QA report |

---

## 5. Checks Not Run / Out-of-Scope

1. **Penetration Testing / Distributed DDoS**: Simulated load was tested locally up to 200 concurrent requests; external cloud penetration testing was not conducted.
2. **Hardware Wearable Direct Bluetooth Sync**: Ingestion tested via CSV/JSON wearable pipelines; live BLE hardware pairing was simulated.
3. **Multi-Region Replica Failover**: Local tests verified single-node MongoDB and in-memory mock fallback; cross-region multi-node consensus was not evaluated.
