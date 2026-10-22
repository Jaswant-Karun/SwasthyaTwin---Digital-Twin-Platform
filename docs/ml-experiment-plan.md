# SwasthyaTwin ML Experiment Plan & Research Protocol
**Document Version:** 1.0.0  
**Date:** October 2026  
**Role:** Senior Machine Learning Engineer & Healthcare Data Scientist  
**Repository Scope:** SwasthyaTwin — Digital Twin Platform  

---

## 1. Executive Summary & Task Selection

### Selected Primary ML Task
**Personalized Longitudinal Resting-Heart-Rate (RHR) Anomaly Detection against a Clinically Grounded Benchmark Window.**

### Selected Secondary ML Task (Auxiliary Sub-Epoch Module)
**Wearable Polysomnography-Aligned 3-Class Sleep Staging (Wake vs. NREM vs. REM) from 30-Second Photoplethysmography and Accelerometry.**

### Rejected Candidate Task
**Future Sleep-Duration Forecasting from Short-Term Sleep-Stage Datasets.**  
*Justification for Rejection:* In-laboratory polysomnography (PSG) datasets (such as Walch et al. or Sleep-EDF) measure single or dual isolated nights per participant to evaluate epoch-level sleep architecture. They contain zero multi-week longitudinal day-to-day history. Attempting to use a sleep-stage dataset to forecast total sleep duration over future days represents an invalid target-to-data mapping. Furthermore, consumer wearable sleep logs (e.g., public 30-user Fitbit Fitabase sets) suffer from massive missingness, proprietary sensor filtering without raw waveforms, and lack behavioral/circadian covariates (caffeine, bedtime intention, schedule consistency), leading to near-zero predictive signal ($R^2 \le 0.05$ over persistence).

---

## 2. Comparative Evaluation of Candidate Tasks

| Dimension | Candidate 1: Sleep-Stage Classification | Candidate 2: Future Sleep-Duration Prediction | Candidate 3: Personalized RHR Anomaly Detection (Selected Primary) |
| :--- | :--- | :--- | :--- |
| **Prediction Target** | Discrete sleep stage: Wake (0), NREM (1), REM (2) per 30-second epoch. | Continuous sleep duration (hours) for day $t+1$ or next 7 days. | Binary anomaly label $y_t \in \{0, 1\}$ (physiological strain/infection window) & continuous deviation score. |
| **Target Units / Classes** | 3 categorical classes: Wake, NREM, REM. | Continuous float: Hours/night. | Binary $\{0, 1\}$ alert & continuous standardized deviation ($Z$-score / anomaly index). |
| **Input Features** | 30s epoch mean HR, HR standard deviation, rolling activity count, circadian elapsed time. | Historical 14-day sleep duration, daily steps, day-of-week, resting HR. | Causal 28-day trailing RHR median, IQR, 7-day rolling mean, trailing step count, day-of-week. |
| **Sample Size / Scope** | ~33,000 30-second epochs (~280 recording hours). | ~30 participants over 31 days (Fitbit Fitabase) with heavy missingness. | 32 participants with continuous longitudinal tracking ($>60$ days/subject) and confirmed clinical onset dates. |
| **Participant Count** | 31 participants. | 30 participants. | 32 participants with documented viral infection/stress events. |
| **Leakage Risks** | **High intra-subject correlation:** Epochs from the same participant cannot be randomly split into train/test. | **Lookahead bias:** Future nights leaking into rolling window baselines. | **Temporal lookahead & non-causal centering:** Using future baseline data to normalize past anomalies. |
| **Split Strategy** | **Strict Participant-Level GroupKFold** (Leave-One-Subject-Out or 5-Fold GroupKFold). | Chronological rolling-origin train/test split. | **Strictly Causal Trailing-Window:** Training/baseline parameters computed strictly from $t < t_{\text{eval}}$, evaluated chronologically. |
| **Missing Data Pattern** | Minimal within-night PSG dropouts; sensor detachment epochs flagged. | Extremely high ($>35\%$ missing days across participants). | Periodic unmonitored days (smartwatch charging/removal) requiring causal forward imputation or skip logic. |
| **Dataset License** | PhysioNet Open Access (CC-BY 4.0). | CC0 Public Domain / Open Research (Kaggle/Zenodo). | Open Access Research License (PhysioNet / Zenodo / Stanford Data Repository). |
| **Codebase Alignment** | Requires adding sub-epoch raw observation storage or standalone offline benchmark pipeline. | Current schema supports `sleep_duration_hours`, but data target is unsupported. | **100% Drop-in Compatibility** with existing `heart_rate` schema, `BaselineCalculator`, and `AnomalyDetector`. |

---

## 3. Primary ML Task Specification: Personalized RHR Anomaly Detection

### 3.1 Motivation & Architectural Fit
SwasthyaTwin is architected around an "anti-population-norm" philosophy: patients are monitored against their own historical baseline rather than fixed clinical thresholds (e.g., 60–100 bpm). The current codebase implements heuristic $Z$-score anomaly tracking (`anomaly_detector.py`) and a synthetic Random Forest model (`ml_trainer.py`). The objective of this experiment is to establish a rigorous, reproducible machine learning benchmark evaluated on real-world longitudinal wearable telemetry with clinically verified reference events.

### 3.2 Dataset Source, Citation, Access & License
- **Dataset Name:** Pre-symptomatic detection of COVID-19 and viral respiratory infections from smartwatch data.
- **Citation:** Mishra, T., Wang, M., Metwally, A. A., et al. (2020). Pre-symptomatic detection of COVID-19 from smartwatch data. *Nature Biomedical Engineering*, 4(12), 1208–1220. DOI: `10.1038/s41551-020-00640-6`.
- **Repository / Access:** Stanford Healthcare Innovation Lab / Zenodo Open Data Repository (`https://doi.org/10.5281/zenodo.4143664`) and PhysioNet.
- **Access Requirements:** Open access research dataset. No credentialed physical exam or institutional DUA required.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Cohort Summary:** 32 individuals tracked longitudinally via consumer smartwatches (Fitbit / Apple Watch) who contracted confirmed viral respiratory illnesses with documented clinical symptom onset dates ($t_{\text{onset}}$) and laboratory diagnostic confirmation (RT-PCR).

### 3.3 Target Definition & Evaluation Reference
- **Evaluation Reference:** A binary ground-truth label $y_t \in \{0, 1\}$ defined around each clinical event:
  - $y_t = 1$ during the pre-symptomatic and acute early symptomatic window: $[t_{\text{onset}} - 3\text{ days}, t_{\text{onset}} + 2\text{ days}]$.
  - $y_t = 0$ during documented healthy baseline periods ($>14$ days prior to infection and $>21$ days post-recovery).
- **Evaluation Criteria:**
  - True Positive (TP): The algorithm triggers $\ge 1$ sustained anomaly alert within $[t_{\text{onset}} - 4\text{ days}, t_{\text{onset}} + 1\text{ day}]$.
  - False Positive (FP): An alert triggered during the healthy baseline period.
  - Early Detection Lead Time: Hours/days prior to $t_{\text{onset}}$ where the first sustained alert was triggered.

### 3.4 Input Features & Causal Construction
To strictly eliminate temporal leakage, all features at day $t$ are derived exclusively from historical data strictly prior to $t$:

```
Available at day t:
X_t = [
  RHR_current,                  # Daily resting heart rate (bpm)
  Baseline_Median_28d,          # Rolling 28-day trailing median RHR
  Baseline_IQR_28d,             # Rolling 28-day trailing IQR
  Z_Score_Trailing,             # (RHR_current - Trailing_Mean_28d) / Trailing_Std_28d
  Delta_7d_Mean,                # RHR_current - Mean(RHR_{t-7:t-1})
  Steps_Current,                # Daily physical activity volume
  Steps_Trailing_Ratio,         # Steps_current / Median(Steps_{t-28:t-1})
  DayOfWeek_Sin, DayOfWeek_Cos  # Cyclical weekly circadian rhythm encoding
]
```

### 3.5 Data Split Strategy (Preventing Leakage)
1. **Participant-Level Stratification:** The 32 participants are partitioned into 5 non-overlapping folds using `GroupKFold(n_splits=5)`. Telemetry from the same participant never appears simultaneously in train and validation/test folds.
2. **Chronological Rolling Baseline Window:** Within each participant, the baseline estimator uses strictly causal trailing windows ($W = 28\text{ days}$). No future observations, centered moving averages, or global dataset standardizations are permitted. Scalers (`StandardScaler`, `RobustScaler`) are fit exclusively on the training folds.

### 3.6 Baseline Models and Candidate ML Models

#### Baseline Models (Deterministic Benchmarks)
1. **Static Population Threshold:** Fixed alert if $\text{RHR} > 85\text{ bpm}$ (standard conventional telehealth alert).
2. **Univariate Static Self-Baseline ($Z$-Score):** Alert triggered if $Z_t > 2.0$, where $Z_t = \frac{\text{RHR}_t - \mu_{28d}}{\sigma_{28d}}$ (SwasthyaTwin's current mathematical implementation).
3. **Exponentially Weighted Moving Average (EWMA / CuSum):** Control-chart benchmark tracking cumulative deviations beyond personal noise floor.

#### Candidate Machine Learning Models
1. **Isolation Forest (Unsupervised Tree Anomaly Detection):**
   - Trained on each participant's healthy historical phase ($y_t = 0$).
   - Detects multi-variate drift across joint (RHR, Steps, $\Delta$7d) space without assuming Gaussian distribution.
2. **One-Class Support Vector Machine (OC-SVM) with RBF Kernel:**
   - Fits a tight non-linear boundary around the patient's individual resting baseline.
3. **LightGBM / Balanced Random Forest (Weakly Supervised Anomaly Classifier):**
   - Cross-validated across participants using GroupKFold.
   - Evaluates whether learned feature representations across other patients transfer to detect pre-symptomatic strain in unseen subjects.

### 3.7 Evaluation Metrics & Success Criteria

| Metric | Target Success Threshold | Clinical / Operational Rationale |
| :--- | :--- | :--- |
| **Sensitivity (Detection Rate)** | $\ge 75\%$ of infection events detected | Detects true physiological strain events prior to or at symptom onset. |
| **False Positive Rate (FPR)** | $\le 1\text{ alert per 30 healthy days}$ ($< 3.3\%$) | Prevents alert fatigue; excessive false alarms cause users to disable notifications. |
| **Pre-symptomatic Lead Time** | Median $\ge 24\text{ hours}$ before $t_{\text{onset}}$ | Validates digital twin utility: alerting the user before conscious symptom awareness. |
| **Area Under the Precision-Recall Curve (PR-AUC)** | $\ge 0.40$ (vs. random prevalence benchmark of $\approx 0.08$) | Appropriate metric for severe class imbalance ($<10\%$ positive days). |

---

## 4. Secondary ML Task Specification: Polysomnography-Aligned Sleep Staging

### 4.1 Motivation & Context
SwasthyaTwin currently records total sleep duration (`sleep_duration_hours`). In actual clinical practice, sleep duration is derived from micro-architecture (epochs of Wake, Light, Deep, and REM sleep). This auxiliary experiment builds an offline, reproducible epoch classifier.

### 4.2 Dataset Source, Citation & License
- **Dataset Name:** Motion and heart rate from a wrist-worn wearable and labeled sleep from polysomnography.
- **Citation:** Walch, O., Huang, Y., Forger, D., & Goldstein, C. (2019). Sleep stage prediction with raw acceleration and photoplethysmography heart rate data. *Physiological Measurement*, 40(12), 125006. DOI: `10.13026/kmwq-bh44`.
- **Repository:** PhysioNet (`physionet.org/content/sleep-accel/1.0.0/`).
- **Access:** Public Open Access (PhysioNet Credentialing not required for this dataset).
- **License:** Open PhysioNet / Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Cohort:** 31 healthy adults evaluated simultaneously with laboratory Polysomnography (PSG) and an Apple Watch. ~33,000 thirty-second epochs.

### 4.3 Target & Features
- **Target:** 3-class sleep stage per 30s epoch: `0: Wake`, `1: NREM`, `2: REM`.
- **Input Features (per 30s epoch):**
  - Instantaneous Heart Rate (PPG) and standard deviation of HR over 2-minute rolling window.
  - Accelerometer Euclidean Norm Minus One (ENMO) activity counts.
  - Circadian feature: Time elapsed since bedtime (minutes).

### 4.4 Split Strategy & Models
- **Split Strategy:** Strict **Leave-One-Subject-Out (LOSO) Cross-Validation** or **5-Fold GroupKFold** partitioned across the 31 participants. Zero epochs of the test participant ever appear in training.
- **Baseline Model:** Majority Class Classifier (predicts NREM) and Simple Activity Threshold (Steps/Motion $> 0 \implies \text{Wake}$).
- **Candidate Models:** Random Forest Classifier (100 estimators, max depth 12) and LightGBM Classifier with class weighting.
- **Metrics:** Cohen's Kappa ($\kappa$), Macro F1-Score, and Per-Class Sensitivity. Target: Cohen's $\kappa \ge 0.55$, Macro $\text{F1} \ge 0.65$.

---

## 5. Distinction: Research Dataset vs. Actual End-Users

An essential requirement of ethical healthcare machine learning is maintaining complete honesty regarding the gap between benchmark research datasets and live end-user environments:

```
+------------------------------------+------------------------------------+
| Benchmark Research Environment     | Live SwasthyaTwin End-User App     |
+------------------------------------+------------------------------------+
| Grounded in gold-standard clinical | Biometrics logged via manual input |
| labels (PSG hypnograms, RT-PCR lab | or consumer wearables with varying |
| confirmations, in-clinic protocol).| sensor contact & battery cycles.   |
+------------------------------------+------------------------------------+
| Controlled participant compliance  | Sparse, irregular sampling with    |
| (sensor worn continuously during   | multi-day gaps and unnotified      |
| study observation windows).        | removals during charging.          |
+------------------------------------+------------------------------------+
| Homogeneous sensor hardware and    | Heterogeneous hardware (Apple,     |
| synchronized clock timestamps.     | Garmin, Fitbit, Google Fit, cuffs) |
|                                    | with manufacturer filtering.       |
+------------------------------------+------------------------------------+
| Research metrics represent an      | Production system must treat ML    |
| UPPER BOUND on achievable real-    | outputs as exploratory trend hints,|
| world performance.                 | NOT clinical diagnostic findings.  |
+------------------------------------+------------------------------------+
```

### Operational Guardrails for Production:
1. **Never claim clinical diagnostic accuracy** for models evaluated solely on public academic cohorts.
2. **Explicit Data Kind Flagging:** Every observation ingested must be strictly tagged with `data_kind: "measured"` or `data_kind: "synthetic_demo"`.
3. **Graceful Missing Data Handling:** If fewer than 7 consecutive baseline days exist, ML inference must report `status: "insufficient_baseline"` rather than imputing artificial averages or zeros.
4. **Physiological Plausibility Guard:** All live inputs must continue passing the multivariate bounds defined in [`backend/app/models/observation.py`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/models/observation.py).

---

## 6. Implementation Scaffolding Roadmap

The verified ML experiment plan requires the following minimal scaffolding without altering the existing React + FastAPI + MongoDB architecture:

1. **Protocol Documentation:** Verified in `docs/ml-experiment-plan.md` (this deliverable).
2. **Offline Data Fetch & Verification Utility:** `backend/scripts/verify_ml_dataset.py` to inspect target distributions and verify participant counts prior to any model training.
3. **Causal Benchmark Harness:** A decoupled offline evaluation script comparing SwasthyaTwin's baseline $Z$-score against the causal EWMA and Isolation Forest models on the benchmark cohort.
4. **Safety & Zero-Regression Check:** Ensure all 76 existing pytest unit and integration tests continue passing with 100% success rate.
