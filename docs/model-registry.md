# SwasthyaTwin AI — Machine Learning Model Registry

This document defines the central, authoritative Model Registry for the SwasthyaTwin AI digital twin platform. It provides explicit task definitions, dataset provenance, feature schema versions, evaluation metrics, and clinical boundaries for all supported artificial intelligence tasks.

---

## 1. Registry Architecture & Guarantees

The SwasthyaTwin Model Registry is maintained in [backend/app/analytics/model_registry.py](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/analytics/model_registry.py) and exposed via versioned endpoints at `/api/v1/ml/registry`.

### Core Architectural Guarantees:
1. **One Entry per Supported Task:** Every task has a unique identifier, target definition, and separate feature schema.
2. **Strict Task Isolation:** The sleep-stage classification pipeline is **never** reused for another physiological task (e.g., blood pressure or total sleep duration).
3. **Artifact-Backed Metrics:** Evaluation metrics are read dynamically from saved evaluation reports on disk. The system **never** displays fabricated, estimated, or placeholder metrics.
4. **Insufficient Data Gating:** When a patient lacks sufficient historical observations (e.g., $< 14$ days for forecasting or anomaly baselines), the system returns a structured `"insufficient_data"` response with an explicit rationale, rather than fabricating a prediction.

---

## 2. Supported Task Registry

| Task Identifier | Category | Target Definition | Dataset Source | Model Architecture | Minimum Samples |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `sleep_stage_classification` | Sleep | 5-Stage AASM Sleep (Wake, N1, N2, N3, REM) | BiDSleep v1.0.1 (PhysioNet) | RobustScaler + Class-Weighted Random Forest | 1 Epoch |
| `cardiovascular_trend_forecasting` | Forecast | 7-day future resting HR trajectory (bpm) | Personal Telemetry Stream | Autoregressive Exponential Smoothing (95% CI) | 14 Days |
| `activity_kinetics_analyzer` | Activity | Daily step volume & non-wear missingness | Wrist Wearable Pedometer | Non-Parametric Tukey IQR Corridor | 7 Days |
| `blood_pressure_trend_tracker` | Blood Pressure | SBP/DBP, Pulse Pressure & MAP (mmHg) | Oscillometric Arm Cuff | AHA/ACC Pulse Pressure Consistency Model | 3 Pairs |
| `personalized_anomaly_detector` | Anomaly | Multi-tier statistical corridor shift | Personal 30-Day Baseline | Dual-Gate Tukey Fences (1.5x) + Z-Scores | 14 Obs |

---

## 3. Detailed Task Cards

### Task 1: `sleep_stage_classification`
- **Task ID:** `sleep_stage_classification`
- **Target:** 5-Class AASM Sleep Stage (`0=Wake`, `1=N1`, `2=N2`, `3=N3`, `4=REM`) per 30-second epoch.
- **Dataset Source:** BiDSleep v1.0.1 (PhysioNet, [doi:10.13026/rees-1092](https://doi.org/10.13026/rees-1092)).
- **Feature Schema Version:** `v1.0-12features` (`hr_mean`, `hr_std`, `hr_median`, `hr_min`, `hr_max`, `hr_q25`, `hr_q75`, `hr_valid_count`, `hr_delta_baseline`, `hr_rolling_mean_5m`, `hr_rolling_std_5m`, `time_elapsed_minutes`).
- **Model Artifact Location:** `models/sleep_stage_rf_model.joblib`.
- **Split Strategy:** Participant-Level Group Split (Train: `Bidslab00`, Val: `Bidslab01`, Held-Out Test: `Bidslab02`). Zero participant leakage.
- **Held-Out Evaluation (`Bidslab02`, 5,280 epochs):**
  - Macro F1: **0.2822** (Baseline: 0.0952, **+0.187 lift**)
  - Balanced Accuracy: **0.3470** (Baseline: 0.2000, **+0.147 lift**)
  - Cohen's Kappa: **0.1989**
  - Wake F1: 0.734 | REM F1: 0.408 | N3 F1: 0.171 | N2 F1: 0.088 | N1 F1: 0.010.
- **Limitations:** Optical PPG sensor signals; non-diagnostic; does not measure EEG.

---

### Task 2: `cardiovascular_trend_forecasting`
- **Task ID:** `cardiovascular_trend_forecasting`
- **Target:** 7-Day Resting Heart Rate Forecast with 95% Confidence Bounds.
- **Feature Schema Version:** `v2.0-time_series_chronological` (`value`, `observed_at`, `rolling_7d_mean`, `rolling_7d_std`).
- **Model Architecture:** Autoregressive Exponential Smoothing with Local Linear Trend.
- **Split Strategy:** Strict Chronological Held-Out Split (Last 7 days held out for backtesting).
- **Baseline Comparison:** Naive Persistence Baseline ($y_{t+h} = y_t$).
- **Minimum Requirements:** $\ge 14$ contiguous daily resting heart rate observations. Returns `"insufficient_data"` if $< 14$.
- **Limitations:** Captures longitudinal baseline drift; does not anticipate unmodeled acute exercise, illness, or medication shifts.

---

### Task 3: `activity_kinetics_analyzer`
- **Task ID:** `activity_kinetics_analyzer`
- **Target:** Daily step count pattern, weekday vs weekend volume, and telemetry missingness.
- **Feature Schema Version:** `v1.0-activity_daily` (`daily_steps`, `day_of_week`, `observed_at`).
- **Model Architecture:** Parametric and Non-Parametric Activity Corridor Analysis.
- **Missingness Audit:** Days with $< 500$ steps logged as non-wear instead of true zero.
- **Minimum Requirements:** $\ge 7$ days for habit pattern estimation.
- **Limitations:** Descriptive analysis only; does not forecast future step counts without an explicit habit model.

---

### Task 4: `blood_pressure_trend_tracker`
- **Task ID:** `blood_pressure_trend_tracker`
- **Target:** Verified Systolic and Diastolic Blood Pressure, Pulse Pressure, and Mean Arterial Pressure.
- **Feature Schema Version:** `v1.0-hemodynamic_pairs` (`systolic`, `diastolic`, `pulse_pressure`, `mean_arterial_pressure`, `observed_at`).
- **Model Architecture:** AHA/ACC Classification with Strict Plausibility ($\text{SBP} \ge \text{DBP} + 15$ mmHg).
- **Minimum Requirements:** $\ge 3$ verified measurement pairs.
- **Strict Guardrail:** Zero synthetic generation. Never infers blood pressure from heart rate or sleep stages.

---

### Task 5: `personalized_anomaly_detector`
- **Task ID:** `personalized_anomaly_detector`
- **Target:** Multi-tier statistical outlier classification (Optimal, Mild Deviation, Moderate Drift, Significant Deviation).
- **Feature Schema Version:** `v2.1-z_score_and_iqr` (`value`, `baseline_median`, `baseline_iqr`, `baseline_mean`, `baseline_std`).
- **Model Architecture:** Dual-Gate Tukey IQR Fences ($1.5 \times \text{IQR}$) and Standardized Gaussian Z-Score.
- **Minimum Requirements:** $\ge 14$ observations required before calculating baseline distributions to prevent small-sample false alarms.
- **Core Distinction:** Separates statistical anomalies from clinical abnormalities.

---

## 4. API Endpoints

- `GET /api/v1/ml/registry`: Returns complete model registry manifest.
- `GET /api/v1/ml/registry/{task_id}`: Returns task card for a specific task.
- `GET /api/v1/patients/{patient_id}/twin/modules`: Evaluates all 6 health modules for a patient.
- `GET /api/v1/patients/{patient_id}/twin/layers`: Returns active layer availability flags based on verified measurements.
- `GET /api/v1/patients/{patient_id}/predict`: Computes chronological trend forecasting with simple baseline comparison.
