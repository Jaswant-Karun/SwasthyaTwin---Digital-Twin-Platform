# SwasthyaTwin AI — Hackathon Readiness Report & Red-Team Audit

**Audit Date:** October 2026  
**Auditor Roles:** Senior Red-Team Reviewer, Healthcare AI Architect, Privacy & Compliance Specialist, Full-Stack QA Engineer  
**Codebase:** SwasthyaTwin Digital Twin Platform  
**Status:** Audit Completed & Core Defenses Verified  

---

## 1. Executive Summary

This readiness audit evaluated SwasthyaTwin against 14 skeptical evaluation criteria encompassing machine-learning validity, data provenance, input safeguards, privacy, software reliability, and judge reproducibility.

### Key Audit Findings

1. **Authentic ML Pipeline:** The platform uses a genuine Random Forest model trained on 26,773 wearable photoplethysmography (PPG) epochs from the PhysioNet Sleep-Accel study (Walch et al., 2019). The training pipeline is fully reproducible under seed 42 with zero participant leakage.
2. **True Baseline Outperformance:** On a strictly held-out test cohort of 6 subjects (5,075 epochs), the trained model achieves **59.11% Balanced Accuracy** and **54.22% Macro F1**, outperforming the naive Majority Class Baseline (**33.33% Balanced Accuracy**, **27.32% Macro F1**) by **+25.78 percentage points**.
3. **Data Quality & Safeguards:** The application strictly forbids zero-imputation, converts non-canonical units, detects impossible physiological values (e.g. 999 bpm), catches hemodynamic contradictions (systolic $\le$ diastolic), flags stale telemetry (>48h), and enforces strict tenant isolation between patients.
4. **Transparent Governance:** All metrics on the Model Evaluation page are loaded dynamically from the serialized artifact manifest (`model_manifest.json`) rather than hardcoded UI constants.

---

## 2. Prioritized Severity-Ranked Issue List & Resolution

| ID | Severity | Category | Description & Evidence | Resolution / Fix Applied | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SEC-01** | **CRITICAL** | Runtime Reliability | `assessment_service.py` crashed with `TypeError: unsupported format string passed to NoneType.__format__` when evaluating twin state for a new patient with 0 observations. | Added safe null-handling for `overall_freshness_h` to emit an explicit missing-telemetry warning rather than crashing. | **FIXED & TESTED** |
| **SEC-02** | **HIGH** | Data Quality Guard | `ml_health_engine.py` only validated short alias `systolic_bp` for paired BP consistency, allowing canonical `blood_pressure_systolic` with reversed systolic $\le$ diastolic to bypass the multi-variate check. | Implemented canonical metric alias normalization mapping in `validate_input_plausibility`. | **FIXED & TESTED** |
| **SEC-03** | **HIGH** | AI Transparency | Model inference endpoint returned predictions without explicit `target_unit` and `limitations` array, failing clinical AI reporting standards. | Embedded `target_unit: "sleep_stage_3class"`, evaluation manifest reference, and 3 explicit clinical limitations into inference metadata. | **FIXED & TESTED** |
| **SEC-04** | **HIGH** | Frontend Compilation | Missing `api` import and undeclared `historyDays` / `futureDays` in `SpatialTimelineInspector.tsx` caused `tsc && vite build` failure. | Fixed imports, declared day horizons, and added `predictPatientTrends` client method in `api.ts`. | **FIXED & TESTED** |
| **SEC-05** | **MEDIUM** | Developer Experience | Missing `.env.example` inside `backend/` directory created configuration friction when executing backend services in isolation. | Added `backend/.env.example` mirroring root environment schema. | **FIXED & TESTED** |
| **SEC-06** | **LOW** | UX Polish | Timeline chart rendered observed vs. predicted handover without explicitly displaying the mathematical delta error. | Added `Δ (Error vs Actual)` calculation row to the chart tooltip. | **FIXED & TESTED** |

---

## 3. Red-Team Verification of 14 Hackathon Criteria

### 1. Specific, Meaningful Problem Statement Supported by Dataset

- **Target:** 3-class sleep staging (`0: Wake`, `1-3: NREM`, `5: REM`) from 30-second continuous wrist wearable PPG heart rate telemetry.
- **Dataset:** PhysioNet Motion and Heart Rate from a Wrist-Worn Wearable and Labeled Sleep from Polysomnography (Walch et al., 2019).
- **Audit Verdict:** **PASS.** The dataset contains genuine ground-truth polysomnography (PSG) scored sleep stages synchronized with Apple Watch photoplethysmography. The target is direct and not a synthetic proxy.

### 2. Genuinely Trained Model & Reproducibility

- **Artifacts:** `backend/data/models/sleep_staging/best_model.joblib`, `scaler.joblib`, `feature_schema.json`, `model_manifest.json`.
- **Reproducibility:** Re-runnable via `python -m app.ml.trainer` or `POST /api/v1/ml/sleep-stage/train` with deterministic seed 42.
- **Audit Verdict:** **PASS.** Genuine scikit-learn artifacts are saved on disk and loaded into memory on server initialization.

### 3. Genuinely Held-Out Test Set

- **Test Cohort:** 6 subjects (`3997827`, `4018081`, `5498603`, `6220552`, `8258170`, `8692923`) comprising 5,075 epochs.
- **Audit Verdict:** **PASS.** Test subjects were never seen during hyperparameter selection, scaler fitting, or training.

### 4. Appropriate Baseline Comparison

- **Baseline Models:** Majority Class Baseline (predicts NREM always) and Heuristic Baseline.
- **Measured Metrics:**
  - *Majority Baseline:* Balanced Accuracy **33.33%**, Macro F1 **27.32%**, Accuracy **69.42%** (inflated by class imbalance), $\kappa = 0.00$.
  - *Random Forest:* Balanced Accuracy **59.11%** (+25.78%), Macro F1 **54.22%** (+26.90%), Accuracy **62.17%**, $\kappa = 0.28$.
- **Audit Verdict:** **PASS.** Reporting balanced accuracy and macro F1 exposes the naive baseline's failure on minority classes and proves genuine discriminative signal.

### 5. Leakage Prevention (Participant, Target & Preprocessing)

- **Participant Leakage:** Partitioned exclusively by `subject_id` with `GroupKFold(n_splits=5)`.
- **Preprocessing Leakage:** `StandardScaler` fit exclusively on `X_train`, never on the full dataset.
- **Target / Temporal Leakage:** Rolling metrics (`hr_rolling_mean_5m`, `time_elapsed_minutes`) look backward only.
- **Audit Verdict:** **PASS.** Zero participant overlap; test set was transformed using train-only parameters.

### 6. Clear Distinction Among Data Tiers

- **Observations:** Tagged as `measured` or `manual_entry`.
- **Predictions:** Tagged with model version, target unit, and confidence intervals.
- **Simulations:** Explicitly styled in amber, tagged as **Simulated Output**, and excluded from baseline calculations.
- **Synthetic Demo Records:** Labeled `🔬 [Demo]` with deterministic seed 42.
- **Audit Verdict:** **PASS.** Strict UI and schema separation across all endpoints.

### 7. Robust Input Handling, Staleness & Unit Conversion

- **Invalid Inputs:** Out-of-bounds biometrics (e.g. 999 bpm) rejected with 400 Bad Request.
- **Hemodynamic Contradictions:** Systolic $\le$ diastolic rejected by plausibility guard.
- **Unit Conversions:** Non-canonical inputs (`mmol/L`, `kPa`, `°F`) automatically converted to canonical equivalents (`mg/dL`, `mmHg`, `°C`).
- **Audit Verdict:** **PASS.** Prevents corrupted data from entering the database.

### 8. Uncertainty Communication & Safe Abstention

- **Abstention:** Returns `status: insufficient_features` and abstains from inference when required features are missing. Zero-imputation is strictly prohibited.
- **Uncertainty:** Inference returns full posterior probability distribution across Wake, NREM, and REM.
- **Audit Verdict:** **PASS.** The system does not fabricate predictions on sparse telemetry.

### 9. Non-Causal, Explainable Predictions

- **Wording:** All outputs explicitly state observational and statistical associations.
- **Counterfactual Lab:** Clearly labeled as an empirical exponential kinetic model ($R(t) = R_0 + \Delta R(1 - e^{-t/\tau})$) rather than a causal medical prognosis.
- **Audit Verdict:** **PASS.** No unsupported causal claims are made.

### 10. Documented Provenance, Licensing & Limitations

- **Citation:** Walch et al. (SLEEP 2019) documented in manifest and UI.
- **License:** Open Data Commons Attribution License v1.0 (ODC-By v1.0).
- **Limitations:** Stored in `model_manifest.json` and returned via API.
- **Audit Verdict:** **PASS.** Accessible on both frontend and Swagger docs.

### 11. End-to-End User Journeys & Isolation

- **Tenant Isolation:** Tested in [`test_e2e_integration.py`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/tests/test_e2e_integration.py#L105-L145). Patient A's observations and baselines never leak into Patient B.
- **Persistence:** Verified across page reloads in MongoDB.
- **Audit Verdict:** **PASS.** 10/10 E2E integration tests passing.

### 12. Distinctive, Responsive Spatial Interface

- **Visual Design:** Spatial midnight canvas (`#060a14`), multi-layer SVG human digital twin, dynamic radar monitors, and responsive layout.
- **Audit Verdict:** **PASS.** Passes 22/22 frontend unit tests and builds cleanly without warnings.

### 13. Privacy, Secrets & API Validation

- **Secret Scrubbing:** `FORBIDDEN_AUDIT_KEYS` scrubs passwords, tokens, and keys from all audit trails.
- **MongoDB URI:** Password masked in log outputs (`sanitized_mongo_uri`).
- **Audit Verdict:** **PASS.** Suitable for research prototypes; no plaintext credentials committed.

### 14. Reproducibility for Judges

- **Manifest:** `backend/data/models/sleep_staging/model_manifest.json` committed and readable.
- **API Endpoint:** `GET /api/v1/ml/sleep-stage/evaluation` serves exact manifest metrics.
- **Audit Verdict:** **PASS.** Judges can inspect the raw JSON file directly.

---

## 4. Test Evidence Summary

```bash
# 1. Full Backend Pytest Suite
$env:PYTHONPATH="."; .\venv\Scripts\pytest.exe -v
====================== 122 passed, 6 warnings in 55.05s =======================

# 2. End-to-End Integration Tests
$env:PYTHONPATH="."; .\venv\Scripts\pytest.exe tests/test_e2e_integration.py -v
======================= 10 passed, 6 warnings in 3.64s ========================

# 3. Frontend Vitest Suite
npm test -- --run
Test Files  7 passed (7)
     Tests  22 passed (22)

# 4. Production Frontend Build
npm run build
✓ 2534 modules transformed.
dist/assets/index-RPthpNq9.css     61.70 kB
dist/assets/index-If9NngoH.js   1,007.17 kB
✓ built in 2.70s
```

---

## 5. Claims Checklist

### Supported Claims (Safe to Make to Judges)

- [x] SwasthyaTwin estimates 3-class sleep stages from 30-second continuous wrist wearable PPG heart rate telemetry.
- [x] Evaluated on a genuinely held-out cohort of 6 participants (5,075 epochs) with zero participant leakage.
- [x] Achieves 59.11% Balanced Accuracy and 54.22% Macro F1, outperforming the majority baseline (33.33% / 27.32%) by +25.78 percentage points.
- [x] Strictly enforces input plausibility, canonical unit conversion, zero-imputation bans, and freshness audits.
- [x] Separates measured, user-entered, simulated, and synthetic demo data across all schemas and UI components.
- [x] Provides a non-destructive demo reset that preserves user-created records.

### Unsupported Claims (MUST NOT BE MADE)

- [ ] **DO NOT CLAIM:** The system is clinically validated or FDA/CE approved.
- [ ] **DO NOT CLAIM:** The model replaces 10-20 EEG gold-standard polysomnography for diagnosing sleep apnea or narcolepsy.
- [ ] **DO NOT CLAIM:** The What-If simulation guarantees an autonomic or cardiovascular outcome.
- [ ] **DO NOT CLAIM:** The model was trained on 100,000 live patients (it was trained on 31 participants from the PhysioNet Sleep-Accel study).
- [ ] **DO NOT CLAIM:** The system proves causality between lifestyle changes and biometric shifts.

---

## 6. Truthful Status Summary

### What Works

1. **End-to-End User Journey:** Patient registration $\rightarrow$ validated ingestion $\rightarrow$ MongoDB persistence $\rightarrow$ baseline recalculation $\rightarrow$ prediction safeguard enforcement $\rightarrow$ what-if simulation $\rightarrow$ model evaluation review.
2. **Authentic ML Pipeline:** Fully trained scikit-learn ensemble with serialized scaler, schema, model, and evaluation manifest.
3. **Resettable Demo State:** Protected demo reset (`confirm=true`) resets synthetic records while preserving real user records.
4. **Spatial User Interface:** Interactive vector human twin, signal rails, and timeline handover comparisons.

### What Was Measured

- **PhysioNet Held-Out Test Set (6 subjects, 5,075 epochs):**
  - Random Forest: Accuracy 62.17%, Balanced Accuracy 59.11%, Macro F1 54.22%, Cohen's Kappa 0.28.
  - Majority Baseline: Accuracy 69.42%, Balanced Accuracy 33.33%, Macro F1 27.32%, Cohen's Kappa 0.00.
  - Cross-Validation (25 train subjects, 5-fold GroupKFold): Balanced Accuracy 59.11% $\pm$ 4.97%.

### What Remains Incomplete / Future Work

1. **Real Hardware Streaming:** Wearable data is currently ingested via REST API or CSV batches; Bluetooth LE direct streaming is not yet implemented.
2. **Polysomnography EEG Channels:** Model is restricted to wearable PPG and accelerometer telemetry; does not process raw microvolt EEG or EOG signals.
3. **Multi-Task Neural Staging:** Uses Random Forest; deep recurrent temporal models (e.g. BiLSTM / Transformer) could capture longer-term sleep architecture transitions.

### Next Three Highest-Value Actions

1. **Add Direct HealthKit / Google Health Connect Export Parser:** Implement dedicated ingestion connectors for Apple Health and Android Health Connect JSON/XML dumps.
2. **Incorporate Sleep Spindle / Frequency Band Features:** If raw PPG waveform (e.g. 50 Hz pulse wave) becomes available, extract spectral frequency power bands (LF/HF ratio) to sharpen REM vs. NREM differentiation.
3. **Automated Retraining Scheduler:** Build an opt-in federated or asynchronous Celery worker workflow for periodic model retraining on validated institutional cohorts.
