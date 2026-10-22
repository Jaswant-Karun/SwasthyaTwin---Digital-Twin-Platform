# SwasthyaTwin AI — 3-Minute Live Demonstration Script & Judge Walkthrough

**Target Duration:** 3 minutes (180 seconds)  
**Presenters:** Full-Stack & Clinical AI Systems Team  
**Live Frontend Canvas:** `http://localhost:5173/`  
**FastAPI Swagger Documentation:** `http://localhost:8000/docs`  
**Evaluation Artifact Manifest:** `backend/data/models/sleep_staging/model_manifest.json`  

---

## High-Level Architecture Overview

| Component | Technology | Real-world Purpose |
| :--- | :--- | :--- |
| **Spatial Digital Twin** | React 18, SVG Vector Canvas, Recharts | Dynamic multi-layer anatomical visualization of physiological signals |
| **Validated Ingestion** | FastAPI, Pydantic v2, Tukey Clamping | Canonical unit conversion, plausibility guards, and duplicate rejection |
| **Persistence Layer** | MongoDB 7.x (Replica/Standalone) | Timezone-aware audit logs, personal baselines, and telemetry records |
| **Authentic ML Pipeline** | Scikit-learn, PhysioNet Sleep-Accel | Group-aware 3-class sleep staging (Wake, NREM, REM) from wearable PPG |
| **Counterfactual Engine**| Exponential Saturation Kinetics | In-silico lifestyle perturbation simulations with strict data separation |

---

## 3-Minute Step-by-Step Judge Walkthrough

### Part 1: Patient Selection & Provenance Verification (0:00 – 0:30)
*Addresses User Journey Steps 1 & 2*

- **Action:** Open `http://localhost:5173/`. Point out the TopNav and Demo Banner.
- **On Screen:** 
  - Top banner displays `SYNTHETIC DEMO ENVIRONMENT` with active MongoDB connection ping (`MongoDB: Connected (0.8ms)`).
  - Patient switcher in TopNav shows clear provenance tags: `🔬 [Demo] Aarav Mehta (PT-1001)` vs `👤 [User] Live Clinical User`.
  - In Digital Twin Profile, the patient context strip displays: `PATIENT ID: PT-1001`, `BASELINE CORRIDOR: 30 Days Rolling`, `PROVENANCE INTEGRITY: Zero Zero-Imputation`, and `🔬 RESEARCH DEMO COHORT`.
- **Spoken Walkthrough:**
  > *"Welcome judges. This is **SwasthyaTwin AI**, a clinical digital twin platform for early biological drift detection and preventive intervention.
  >
  > Notice the top bar: our MongoDB connection indicator runs a live latency probe rather than displaying a static status. In the patient dropdown, we clearly separate synthetic demonstration cohorts from live user records.
  >
  > We are inspecting **Aarav Mehta (`PT-1001`)**. Every observation on screen displays its canonical unit, source provenance, validation status, and personal baseline envelope."*

---

### Part 2: Biometric Ingestion, Persistence & Baseline Recalculation (0:30 – 1:00)
*Addresses User Journey Steps 3, 4 & 5*

- **Action:** In the left sidebar, click **Add Observation** (`/add-observation`). 
  1. Select **Manual Entry**.
  2. Test Invalid Input: Enter `heart_rate = 999 bpm`. Notice the instant validation guard catches the impossible value: *"Value 999.0 bpm is physiologically impossible for heart rate (valid human limits: 30.0 - 240.0 bpm)"*.
  3. Enter valid observation: `heart_rate = 74 bpm`, unit `bpm`, source `Manual Ingestion`. Click **Commit Observation to Digital Twin**.
  4. Press **F5 (Browser Refresh)**.
- **On Screen:**
  - Success badge: *"Observation committed to MongoDB with status: VALID"*.
  - After page refresh, the observation persists at the top of the chronological timeline with full audit metadata.
  - In the **Digital Twin Profile**, Aarav's baseline envelope ($\mu \pm 1.5\sigma$) updates dynamically, calculated strictly on eligible non-simulated observations.
- **Spoken Walkthrough:**
  > *"Data integrity is non-negotiable. If a user enters an impossible typo like 999 bpm or systolic less than diastolic, our multi-variate plausibility guard rejects it immediately.
  >
  > When we log a valid measurement of 74 bpm, it is converted to canonical units and written to MongoDB. Refreshing the browser proves zero data loss. His personal baseline corridor is updated strictly from eligible measured observations—never from simulated data."*

---

### Part 3: Prediction Safeguards & Handover Comparison (1:00 – 1:40)
*Addresses User Journey Steps 6, 7 & 8*

- **Action:** Click **Digital Twin** in the sidebar, switch to the **Telemetry Timeline** tab.
- **On Screen:**
  - The chart displays Aarav's longitudinal resting heart rate with the shaded $\mu \pm 1.5\sigma$ personal corridor.
  - A vertical cyan dashed marker denotes **NOW (Handover)** between observed telemetry and future predictions.
  - Hover over the handover date: The custom tooltip renders both **Observed** and **Predicted** values, displaying:
    - `Observed: 74.0 bpm`
    - `Predicted: 74.0 bpm`
    - `Δ (Error vs Actual): 0.0 bpm`
  - In the Prediction Safeguards panel, click **Run Model Prediction**:
    - Returns model version `v1.0.0`, algorithm `Random_Forest`, target unit `sleep_stage_3class`, uncertainty confidence `84.2%`, and scientific limitations (*"Trained on 30s wearable PPG epochs; not a diagnostic substitute for EEG polysomnography"*).
    - If required telemetry is missing or stale, the system halts with `status: insufficient_features` rather than silently zero-imputing.
- **Spoken Walkthrough:**
  > *"When requesting machine learning predictions, SwasthyaTwin enforces strict safeguards: zero-imputation is banned, and stale telemetry is flagged. 
  >
  > Here on the timeline, notice the handover line. When actual future observations arrive, the digital twin places them directly against the model's projected trajectory and computes the empirical prediction error in real time."*

---

### Part 4: Counterfactual What-If Intervention Simulation (1:40 – 2:15)
*Addresses User Journey Step 9*

- **Action:** In the Digital Twin view, click the **What-If Lab** tab (or navigate to **What-if Simulator** in sidebar).
  1. Move the **Sleep Extension** slider to `+1.5 hrs/night`.
  2. Move the **Daily Steps** slider to `+3,000 steps/day`.
  3. Click **Run Scenario Simulation**.
- **On Screen:**
  - Projected 30-day biological adaptation trajectory appears.
  - Projected resting heart rate drops asymptotically by `-3.2 bpm` and Vitality improves by `+7.4 pts`.
  - Amber badges explicitly mark all curves as **Simulated Output**.
  - A prominent scientific disclosure card explains: *"Illustrative scenario calculation based on exponential saturation kinetics ($R(t) = R_0 + \Delta R (1 - e^{-t/\tau})$). Changing lifestyle habits does not guarantee a clinical outcome without medical supervision."*
  - Verification: Querying the database proves that zero simulated records contaminated Aarav's real observation history.
- **Spoken Walkthrough:**
  > *"In our What-If Lab, patients can explore counterfactual lifestyle modifications. What if Aarav increases nightly sleep by 1.5 hours and walks 3,000 more steps?
  >
  > Within milliseconds, our backend simulation engine models his autonomic adaptation using verified exponential kinetics. Notice our clinical safety standard: simulated data is colored amber, tagged with model assumptions, and completely isolated from measured observations."*

---

### Part 5: Model Evaluation & Authentic Research Metrics (2:15 – 2:45)
*Addresses User Journey Step 10*

- **Action:** Click **Model Evaluation** in the sidebar (`/model-evaluation`).
- **On Screen:**
  - Live data loaded directly from `backend/data/models/sleep_staging/model_manifest.json` via `GET /api/v1/ml/sleep-stage/evaluation`:
    - **Dataset Provenance:** PhysioNet Sleep-Accel (31 participants, 26,773 30-second epochs).
    - **Leakage Guard:** Group-aware participant partitioning (25 train subjects, 6 held-out test subjects: `3997827`, `4018081`, `5498603`, `6220552`, `8258170`, `8692923`).
    - **Scaler Integrity:** StandardScaler fit exclusively on the training split.
    - **Measured Test Metrics (Held-Out Test Cohort):**
      - **Random Forest Balanced Accuracy:** `59.11%` (vs. Majority Baseline `33.33%`, a **+25.78 percentage point** genuine gain).
      - **Random Forest Macro F1:** `54.22%` (vs. Majority Baseline `27.32%`, a **+26.90 percentage point** gain).
      - **Random Forest Overall Accuracy:** `62.17%` (Cohen's $\kappa = 0.28$).
    - **5-Fold GroupKFold Cross-Validation:** Balanced Accuracy `59.11% ± 4.97%`.
    - **Interactive Epoch Inference:** Click the **Wake**, **NREM**, or **REM** presets to test real-time inference with full class probabilities.
- **Spoken Walkthrough:**
  > *"Judges, look at the Model Evaluation page. Not a single number here is hardcoded. Everything is queried live from our saved training manifest.
  >
  > We trained on 26,773 authentic epochs from the PhysioNet Sleep-Accel study. To prevent data leakage, 6 subjects were held out completely. 
  >
  > While a naive majority baseline achieves 69.4% accuracy simply by guessing NREM, its balanced accuracy is only 33.3%—pure chance. Our Random Forest model achieves **59.11% Balanced Accuracy** and **54.22% Macro F1**, demonstrating genuine learned physiological signal from wearable photoplethysmography."*

---

### Part 6: Resettable Demo State & Test Suite Evidence (2:45 – 3:00)
*Addresses Demo Experience & Test Requirements*

- **Action:** 
  1. Click **Reset Cohort** in the Demo Banner.
  2. Confirm the safety dialog: *"Yes, Reset"*.
- **On Screen:**
  - Demo patients (`PT-1001` through `PT-1005`) are reset to their pristine deterministic baseline state.
  - Real user records (like `PT-USER-001` created in Part 1) remain untouched in the database.
- **Spoken Conclusion:**
  > *"Finally, judges can test the demo safely using 'Reset Cohort'. Our backend reset endpoint requires explicit confirmation and strictly filters on `demo_data: true`, guaranteeing that real patient records are never deleted.
  >
  > Backed by **122 backend tests**, **22 frontend tests**, zero-imputation bans, and strict patient isolation, SwasthyaTwin delivers a trustworthy digital twin experience for preventive healthcare. Thank you!"*

---

## Verifiable Test Evidence Summary

| Test Suite | File Location | Tests Passed | Key Capabilities Verified |
| :--- | :--- | :--- | :--- |
| **End-to-End Integration** | `backend/tests/test_e2e_integration.py` | **10 / 10** | Complete 10-step user journey, persistence, safeguards, demo reset |
| **Data Quality & Ingestion**| `backend/tests/test_data_quality_and_ingestion.py` | **21 / 21** | Unit conversion (mmol/L, kPa), plausibility checks, conflict prompts |
| **Authentic ML Pipeline** | `backend/tests/test_authentic_ml_pipeline.py` | **16 / 16** | PhysioNet dataset schema, group-aware split, scaler fitting, GroupKFold CV |
| **Full Backend Suite** | `backend/tests/` | **122 / 122** | MongoDB CRUD, calculations, alerts, simulations, audit history |
| **Frontend Component Suite** | `frontend/src/tests/` | **22 / 22** | Spatial UI, navigation, observation forms, CSV preview, safeguards |

### Commands to Reproduce Locally

```bash
# 1. Run all End-to-End Integration Tests
cd backend
$env:PYTHONPATH="."
.\venv\Scripts\pytest.exe tests/test_e2e_integration.py -v

# 2. Run the Full Backend Test Suite
.\venv\Scripts\pytest.exe -v

# 3. Run Frontend Tests
cd ../frontend
npm test -- --run

# 4. Verify Production Frontend Build
npm run build
```
