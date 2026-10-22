# Model Card: SwasthyaTwin Sleep-Stage Ensemble (v1.0.0)

**Document Version:** 1.0.0  
**Date:** October 2026  
**Authors:** SwasthyaTwin Machine Learning & Clinical Informatics Team  
**Model Type:** Supervised Random Forest Classifier with Class-Balanced Re-weighting  
**Primary Task:** 3-Class Wearable Sleep-Stage Classification (Wake vs. NREM vs. REM) from 30-Second Photoplethysmography (PPG) Telemetry  

---

## 1. Model Details

- **Model Name:** SwasthyaTwin Sleep-Stage Ensemble (`Random_Forest_Champion`)
- **Model Version:** 1.0.0
- **Model Architecture:** Balanced Random Forest Classifier (`n_estimators=100`, `max_depth=10`, `class_weight='balanced'`, `random_state=42`)
- **Software Dependencies:** Python 3.13, Scikit-Learn 1.4+, NumPy 1.26+, Pandas 2.2+, Joblib 1.3+
- **Input Modality:** 30-second localized photoplethysmography (PPG) heart-rate summary features and circadian time progression
- **Output:** Predicted discrete sleep stage class $\in \{0: \text{Wake}, 1: \text{NREM}, 2: \text{REM}\}$, confidence score ($0–100\%$), and per-class probability distribution
- **Model License:** Open Data Commons Attribution License v1.0 (ODC-By v1.0) / MIT Open Source
- **Model Artifacts Location:** `backend/data/models/sleep_staging/` (`best_model.joblib`, `scaler.joblib`, `feature_schema.json`, `model_manifest.json`)

---

## 2. Intended Use & Clinical Scope

### Intended Uses
- Non-invasive, continuous sleep architecture estimation from consumer wearable optical heart-rate monitors (e.g., Apple Watch, Fitbit, Garmin).
- Longitudinal sleep hygiene surveillance and circadian rhythm tracking for personalized digital twin modeling.
- Counterfactual "what-if" sleep intervention modeling within the SwasthyaTwin platform.

### Out-of-Scope & Prohibited Uses
- **NOT for clinical medical diagnosis:** Must never be used as a stand-alone diagnostic tool for sleep apnea, narcolepsy, insomnia, or REM sleep behavior disorder.
- **NOT an emergency triage system:** Cannot detect acute cardiovascular emergencies, nocturnal arrhythmias, or nocturnal hypoxia.
- **NOT approved by the US FDA, EMA, or CDSCO as a medical device.**

---

## 3. Training & Evaluation Data Provenance

### Dataset Overview
- **Dataset Title:** Motion and Heart Rate from a Wrist-Worn Wearable and Labeled Sleep from Polysomnography (PhysioNet Sleep-Accel)
- **Version:** 1.0.0 (Published Oct 8, 2019)
- **DOI:** `10.13026/hmhs-py35`
- **Citation:** Walch, O., Huang, Y., Forger, D., & Goldstein, C. (2019). Sleep stage prediction with raw acceleration and photoplethysmography heart rate data derived from a consumer wearable device. *SLEEP*, 42(12), zsz180.
- **Cohort Scope:** 31 adult participants recruited at the University of Michigan after Institutional Review Board (IRB) approval.
- **Ground Truth Reference:** In-laboratory overnight Polysomnography (PSG) scored in 30-second epochs by board-certified sleep technicians.
- **Total Validated Volume:** 26,773 thirty-second epochs (~223 hours of synchronized polysomnography and wearable PPG recordings).

### Feature Schema (Input Vector Dimension = 8)
1. `hr_mean`: Mean heart rate in the 30-second epoch (bpm)
2. `hr_std`: Standard deviation of heart rate in the 30-second epoch (bpm)
3. `hr_min`: Minimum heart rate recorded in the epoch (bpm)
4. `hr_max`: Maximum heart rate recorded in the epoch (bpm)
5. `hr_delta_baseline`: Difference between epoch mean HR and the participant's pre-sleep baseline HR (bpm)
6. `hr_rolling_mean_5m`: Trailing 5-minute rolling mean heart rate (bpm)
7. `hr_rolling_std_5m`: Trailing 5-minute rolling heart rate variability (bpm)
8. `time_elapsed_minutes`: Continuous circadian time elapsed since sleep opportunity onset (minutes)

---

## 4. Split Strategy & Leakage Guardrails

### Group-Aware Participant Partitioning
To prevent **intra-subject autocorrelation leakage** (where epochs from the same participant appear in both train and test partitions), the dataset is split strictly by participant identifier:
- **Training Cohort:** 25 participants (21,698 epochs, 81.0% of data)
- **Held-Out Test Cohort:** 6 participants (5,075 epochs, 19.0% of data)
  - Held-out subjects: `['3997827', '4018081', '5498603', '6220552', '8258170', '8692923']`

### Zero-Leakage Preprocessing Policy
- The `StandardScaler` is fit **exclusively** on the training split (`X_train`).
- Zero validation or test samples inform feature centering or scaling parameters.
- Cross-validation uses `GroupKFold(n_splits=5)` on the training cohort, re-fitting scalers inside each fold.

---

## 5. Quantitative Performance & Benchmark Comparison

### Held-Out Test Evaluation (Evaluated on 5,075 Unseen Epochs)

| Model / Benchmark | Overall Accuracy | Balanced Accuracy | Macro F1-Score | Cohen's Kappa ($\kappa$) | Model Selection Rationale |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Majority Baseline** | 69.42% | 33.33% | 27.32% | 0.0000 | Always predicts dominant class (NREM). High trivial accuracy, zero discriminatory power. |
| **Heuristic Baseline** | 41.52% | 33.58% | 32.79% | 0.0210 | Rule-based HR thresholding. Poor generalization across diverse resting rates. |
| **Logistic Regression** | 60.12% | 54.20% | 51.85% | 0.2740 | Linear benchmark with balanced class weighting. |
| **Random Forest (Champion)** | **63.90%** | **58.08%** | **55.49%** | **0.3155** | **Selected Champion:** Best held-out balanced accuracy and macro F1. Multi-class ROC-AUC: **76.77%**. |
| **HistGradientBoosting** | 63.15% | 56.40% | 54.10% | 0.2980 | Competitive ensemble performance, slightly lower REM sensitivity than Random Forest. |

### Per-Class Diagnostic Metrics (Random Forest on Held-Out Test Set)

| Sleep Stage Class | Precision | Recall (Sensitivity) | F1-Score | Test Support (Epochs) | Prevalence in Test Set |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Wake (Class 0)** | 44.9% | 46.6% | 45.7% | 481 | 9.48% |
| **NREM (Class 1)** | 82.7% | 67.4% | 74.3% | 3,523 | 69.42% |
| **REM (Class 2)** | 37.8% | 60.3% | 46.5% | 1,071 | 21.10% |

### Normalized Confusion Matrix (Test Set Generalization)

$$\begin{pmatrix}
\text{PSG \ Pred} & \text{Wake} & \text{NREM} & \text{REM} \\
\text{Wake} & 46.6\% & 24.1\% & 29.3\% \\
\text{NREM} & 6.5\% & 67.4\% & 26.1\% \\
\text{REM} & 4.3\% & 35.4\% & 60.3\%
\end{pmatrix}$$

---

## 6. Scientific Limitations & Ethical Disclosures

1. **Upper-Bound Benchmark Effect:** Research participants wore Apple Watches in a controlled sleep laboratory with optimal sensor tightness. Consumer daily wear involves motion artifacts, sweat, and loose fit, which will reduce real-world performance.
2. **Sub-Epoch Architecture:** Classification operates at 30-second epoch resolution. While capable of producing hypnograms, isolated epochs cannot substitute for whole-night clinical sleep architecture reviews.
3. **Class Imbalance:** NREM sleep accounts for ~70% of nocturnal recordings. While balanced weighting and balanced accuracy prevent majority collapse, wake detection remains challenging during quiet, motionless recumbency.
4. **Demographic Bias:** The University of Michigan cohort was recruited from a single geographic region with healthy volunteers; generalization to patients with severe cardiovascular pathology, arrhythmia, or beta-blocker therapy is unvalidated.
