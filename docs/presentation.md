# SwasthyaTwin AI — Final Hackathon Presentation Deck & Judge Walkthrough

**Event:** Happiest Health Digital Twin Challenge 2026  
**Team Name:** `24cb012`  
**Team Leader:** Gangeswara S  
**Team Members:** Bharanika D, Jaswant karun S A, Baviya Varshini V  
**Institution:** KPR Institute of Engineering and Technology, Coimbatore, Tamil Nadu  
**Department & Course:** B.Tech Computer Science and Business Systems  
**Format:** 6–8 Minute Presentation + 3-Minute Live Interactive Demonstration  
**Theme:** *Understand today. Prepare for tomorrow.*  
**Live URL:** `http://localhost:5173/` | **Interactive API:** `http://localhost:8000/docs`  
**Automated Verification:** 282 of 282 Tests Passing (227 Pytest + 55 Vitest) | Build: 2.08s  

---

## Slide 1: The Problem & Target Users

### The Problem
- **The Tyranny of Generic Population Averages:** Traditional health tracking platforms benchmark every human against broad, one-size-fits-all population ranges (e.g., standard 60–100 bpm resting heart rate).
  - An elite endurance athlete whose normal baseline is 46 bpm drifting upward to 64 bpm is experiencing significant autonomic exhaustion or systemic illness, yet legacy apps display a green "Normal" checkmark.
  - A senior with creeping 14-day blood pressure or glycemic elevation gets missed until an acute clinical emergency occurs.
- **The Black-Box Dilemma:** Proprietary "readiness" and "sleep scores" deliver opaque, unexplainable numbers that clinicians cannot audit, trust, or act upon.

### Target Users
1. **Proactive Health Consumers:** Individuals seeking early personal deviation detection rather than waiting for acute symptomatic crises.
2. **Preventive Care Clinicians:** Physicians who need transparent, auditable personal baseline corridors and verifiable mathematical explanations rather than proprietary scores.
3. **Clinical Researchers:** Investigators analyzing physiological sleep architecture and non-invasive autonomic telemetry without electrode arrays.

---

## Slide 2: Why a Digital Twin Approach is Useful

- **Continuous In-Silico Representation:** A digital twin creates an ongoing, computational model of an individual's unique biological homeostasis calibrated to longitudinal historical telemetry.
- **Self-Baseline Comparison Over Population Norms:** By calculating personal median and normalized median absolute deviation ($nMAD = 1.4826 \times MAD$), the digital twin detects subtle individual drift long before population thresholds are breached.
- **Counterfactual "What-If" Exploration:** Rather than guessing lifestyle changes, a digital twin enables *in silico* prospective simulation—modeling how +1.5 hours of sleep or +3,000 daily steps affects recovery kinetics before the patient commits to behavioral changes.

---

## Slide 3: What Makes SwasthyaTwin AI Distinctive

1. **Autonomous Spatial Holographic Interface:**
   - 6 grounded physiological subsystems (Cardiovascular, Sleep/Autonomic, Blood Pressure, Respiratory, Metabolic, Activity) with hotkey switching (`1`–`6`) and live telemetry beacon cards.
   - Non-diagnostic schematic vector locator—never confuses abstract vector topologies with diagnostic CT/MRI medical scans.
2. **Zero Black-Box Scoring ("How is this calculated?"):**
   - Universal transparency modal on every metric, indicator, and Vitality deduction, exposing the exact formula, personal parameters, and worked calculation.
3. **Strict 5-Tier Data Provenance:**
   - Explicit badges: `MEASURED` (sensors), `DERIVED` (mathematical corridors), `PREDICTED` (AI inference), `SIMULATED` (prospective What-If scenarios), `SYNTHETIC` (disclosed demo cohorts).
4. **Resilient Data Architecture:**
   - Real MongoDB 7.0 persistence with automatic in-memory `mongomock` fallback ensuring 100% crash-free hackathon evaluation if local database daemons are offline.

---

## Slide 4: System Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                       SwasthyaTwin Client Frontend                            |
|             (React 19 + TypeScript + Vite + Tailwind CSS + Recharts)          |
|  - Spatial Human Twin Silhouette (SVG Anatomy + Meridian Telemetry Lines)     |
|  - Multi-Signal Chronological Timeline with Provenance Badges                 |
|  - Personal Trend Forecasting (Holdout Evaluation)                           |
|  - What-If Scenario Simulator (Exponential Recovery Kinetics)                 |
|  - Mathematical Explainability Modals & Worked Numerical Audit Trails         |
+---------------------------------------+---------------------------------------+
                                        |
                                        | REST / JSON over HTTPS
                                        v
+-------------------------------------------------------------------------------+
|                        FastAPI Backend Engine & Gateway                       |
|  - Lifespan Startup & Database Index Initialization                           |
|  - Pydantic v2 Strict Schema & Unit Validation (Canonical bpm, mmHg, hrs)     |
|  - AI Plausibility Guard (Rejects typos, e.g. HR=700 bpm or SBP < DBP)        |
|  - Multi-Tenant Patient Isolation (Mandatory patient_id scoping on all ops)   |
|  - Sanitized Public Paths & Automatic Credential Scrubbing                     |
+-------------------+-----------------------------------+-----------------------+
                    |                                   |
                    v                                   v
+---------------------------------------+   +-----------------------------------+
|      Analytics & ML Intelligence      |   |        Data Access Layer          |
| - Robust nMAD Anomaly Detector        |   | - Patient Service                 |
| - BiDSleep 5-Stage AASM Sleep Model   |   | - Observation Service             |
| - Chronological 7-Day Holdout Model   |   | - Health Assessment Engine        |
| - What-If Saturation Kinetics Model   |   | - Isolated Simulation Service     |
+---------------------------------------+   +-----------------+-----------------+
                                                              |
                                                              v
                                            +-----------------------------------+
                                            |       MongoDB 7.0 Storage         |
                                            | - db.patients                     |
                                            | - db.observations                 |
                                            | - db.health_assessments           |
                                            | - db.simulations (Isolated)       |
                                            | - db.alerts                       |
                                            | - db.audit_events (Scrubbed)      |
                                            +-----------------------------------+
```

---

## Slide 5: The Actual ML Contribution & Verified Evaluation

### Real Dataset: PhysioNet BiDSleep v1.0.1
- **Dataset:** 31 authentic human participants with simultaneous consumer smartwatch optical PPG pulse recordings and polysomnography (Dreem 2 EEG with manual expert scoring).
- **Features (12 Causal Inputs):** `hr_mean`, `hr_std`, `hr_median`, `hr_min`, `hr_max`, `hr_q25`, `hr_q75`, `hr_valid_count`, `hr_delta_baseline`, `hr_rolling_mean_5m`, `hr_rolling_std_5m`, `time_elapsed_minutes`.
- **Group-Aware Partitioning (Zero Participant Leakage):**
  - Training: `Bidslab00` (7 nights, 6,171 epochs)
  - Validation: `Bidslab01` (5 nights, 4,314 epochs)
  - Test: `Bidslab02` (6 nights, 5,280 epochs, 44.0 continuous hours)

### Empirical Evaluation on Unseen Test Subject `Bidslab02`
| Evaluation Metric | BiDSleep Random Forest | Majority Baseline | Real Empirical Lift |
| :--- | :--- | :--- | :--- |
| **Macro F1** | **28.22%** | 9.52% | **+18.69%** |
| **Balanced Accuracy** | **34.70%** | 20.00% | **+14.70%** |
| **Overall Accuracy** | **36.23%** | 31.25% | **+4.98%** |
| **Cohen's Kappa** | **0.1989** | 0.0000 | **+0.1989** |
| **Test Set Support** | 5,280 epochs (44.0 hrs) | 5,280 epochs | Authentic Dreem 2 EEG |

- **Sensor Dropout Safeguard:** If PPG contact is lost (`valid_count < 2.0`), model outputs an explicit `Unknown` label and `INSUFFICIENT_INPUT_DATA` flag rather than hallucinating sleep stages.

---

## Slide 6: The Interactive Live Demo (3-Minute Tour)

*(Full narration in `docs/demo-script.md`)*

1. **Flagship Digital Twin Centerpiece (`/digital-twin`):**
   - Dark spatial canvas with holographic anatomical SVG locator.
   - Interactive body beacons; press keys `1`–`6` for instantaneous subsystem telemetry.
2. **Patient Cohort Selector:**
   - Switch between synthetic archetypes: `PT-1001` (Aarav Mehta, high stress), `PT-1002` (Priya Sharma, metabolic risk), `PT-1003` (Marcus Vance, 48 bpm athlete).
3. **Data Ingestion & Persistence (`/add-observation`):**
   - Type in an out-of-range value (e.g. `999 bpm`) → instant Pydantic rejection.
   - Type in valid reading (`74 bpm`) → persisted directly to MongoDB and updates timeline.
4. **Mathematical Explainability Modal:**
   - Click "How is this calculated?" on any card → displays exact formula, personal parameters, and step-by-step arithmetic.
5. **Sleep Research Workspace (`/sleep-research`):**
   - Dual-track hypnogram comparing Dreem 2 EEG ground truth vs Apple Watch model predictions across 120 continuous epochs.
   - Live single-epoch inference sandbox with real-time FastAPI classification.
6. **In-Silico What-If Simulator (`/simulator`):**
   - Adjust sleep extension (+1.5h) → renders exponential recovery trajectory.
   - Proves projection is saved strictly to `db.simulations` without contaminating patient history.

---

## Slide 7: Privacy, Safety & Data-Quality Measures

- **Zero Zero-Imputation:** Optical sensor dropouts are never filled with synthetic zeros or artificial constants.
- **Minimum History Gating:** Statistical corridors enforce $\ge 14\text{ observations}$ before declaring statistical flags.
- **Tenant Isolation:** Every query enforces `{"patient_id": patient_id}` scoping; route guards block cross-patient access with 403 Forbidden.
- **Audit Scrubbing:** Sensitive keys (`password`, `token`, `secret`, `api_key`, `authorization`) are stripped automatically prior to audit logging.
- **Explicit Synthetic Disclosure:** All demo cohorts carry `demo_data: true` and `is_synthetic: true`.

---

## Slide 8: Current Limitations & Next Steps

### Documented Technical Limitations
- **Non-Diagnostic:** Not an FDA/CDSCO cleared medical device. Does not diagnose arrhythmias, ischemia, or apnea.
- **No EEG Signal Claim:** Operates on consumer smartwatch optical PPG dynamics; does not measure micro-volt EEG brainwaves directly.
- **Chronological Scope:** Forecasting is strictly bounded to 7 days and only for periodic targets (steps, sleep, resting HR). Acute vitals (blood pressure, blood glucose) are barred from ungrounded forecasting.

### Immediate Post-Hackathon Roadmap
1. **Wearable BLE Streaming Bridge:** Direct Web Bluetooth / HealthKit continuous packet ingest.
2. **SMART-on-FHIR Integration:** Standardized bidirectional synchronization with hospital EHRs (Epic, Cerner).
3. **Multi-Night Hypnogram Stacking:** Multi-week circadian phase-shift comparisons across shift workers.
