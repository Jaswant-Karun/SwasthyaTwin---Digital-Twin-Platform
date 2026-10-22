# Model Card: BiDSleep Wearable Sleep-Stage Classifier

## Model Overview
- **Model Name:** BiDSleep Sleep-Stage Classifier (`sleep_stage_rf_model.joblib`)
- **Version:** `1.0.0`
- **Release Date:** October 2026
- **Architecture:** `RobustScaler` preprocessing + Class-Weighted `RandomForestClassifier` (150 trees, max depth 12, balanced class weighting)
- **Primary Task:** Multi-class 5-stage sleep classification (Wake, N1, N2, N3, REM) from 30-second epoch wearable optical heart rate dynamics.
- **Reference Standard:** Polysomnography (Dreem 2 EEG with manual expert sleep physician scoring).

---

## Intended Use & Limitations
### Intended Use
- **Research & Digital Twin Biomarkers:** Academic experimentation, longitudinal sleep continuity tracking, and autonomic nervous system state modeling during nocturnal rest.
- **Wearable Health Monitoring:** Non-invasive detection of wakefulness episodes, sleep fragmentation, and REM autonomic transitions without requiring sleep lab electrodes.

### Explicit Non-Intended Uses & Clinical Warnings
- **Not a Diagnostic Medical Device:** This model is not FDA-cleared, CE-marked, or clinically certified. It cannot diagnose sleep apnea, narcolepsy, insomnia, or REM sleep behavior disorder.
- **No EEG Signal Claim:** The input signals are optical photoplethysmography (PPG) heart-rate metrics from a consumer smartwatch (Apple Watch); the model does NOT measure or decode electroencephalogram (EEG) brain waves.
- **No Total Sleep Duration Guarantee:** Epoch classification identifies sleep architecture within a recorded session; it should not be confused with actigraphy sleep duration forecasting.

---

## Training & Validation Data
- **Dataset:** BiDSleep v1.0.1 on PhysioNet ([10.13026/rees-1092](https://doi.org/10.13026/rees-1092)).
- **Population:** Healthy adult cohort recorded across multiple nights in free-living environments.
- **Participant-Disjoint Splitting:**
  - **Training Cohort:** `Bidslab00` (7 nights, 6,171 epochs)
  - **Validation Cohort:** `Bidslab01` (5 nights, 4,314 epochs)
  - **Held-Out Test Cohort:** `Bidslab02` (6 nights, 5,280 epochs)
  - **Participant Leakage:** **0% (Verified strictly disjoint subject IDs)**.

---

## Features Schema (12 Wearable Features)
All features are causal and derived exclusively from the concurrent 30-second epoch or preceding 5-minute rolling window:
1. `hr_mean`: Arithmetic mean heart rate (bpm) in 30s epoch.
2. `hr_std`: Sample standard deviation of heart rate.
3. `hr_median`: 50th percentile heart rate.
4. `hr_min`: Minimum heart rate.
5. `hr_max`: Maximum heart rate.
6. `hr_q25`: 25th percentile heart rate.
7. `hr_q75`: 75th percentile heart rate.
8. `hr_valid_count`: Number of valid PPG samples in the epoch (~5–6 samples at 0.2Hz).
9. `hr_delta_baseline`: Difference between epoch mean HR and night session baseline HR.
10. `hr_rolling_mean_5m`: Causal backward 5-minute rolling mean (10 epochs).
11. `hr_rolling_std_5m`: Causal backward 5-minute rolling standard deviation.
12. `time_elapsed_minutes`: Circadian elapsed recording time $(k - 1) \times 0.5$ minutes.

---

## Ethical & Privacy Considerations
- Research data is stored in isolated directories outside the application web server and excluded from Git.
- Predictions for research participants are strictly segregated from real patient health records and MongoDB collections.
