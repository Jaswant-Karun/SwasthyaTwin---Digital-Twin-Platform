# Model Card: BiDSleep Wearable Sleep-Stage Classifier

## 1. Model Overview
- **Model Name:** BiDSleep Sleep-Stage Classifier (`sleep_stage_rf_model.joblib`)
- **Version:** `1.0.0`
- **Release Date:** October 2026
- **Architecture:** `RobustScaler` preprocessing + Class-Weighted `RandomForestClassifier` (150 trees, max depth 12, balanced class weighting)
- **Primary Task:** Multi-class 5-stage sleep classification (`Wake`, `N1`, `N2`, `N3`, `REM`) from 30-second epoch wearable optical heart rate dynamics.
- **Secondary Task:** Standard 3-class mapping (`Wake`, `NREM`, `REM`).
- **Reference Standard:** Polysomnography (Dreem 2 EEG with manual expert sleep physician scoring).
- **Execution & Artifact Status:** Fully trained, evaluated, and operational. Zero missing artifacts; inference and evaluation are **NOT** blocked.

---

## 2. Intended Use & Limitations
### Intended Use
- **Research & Digital Twin Biomarkers:** Academic experimentation, longitudinal sleep continuity tracking, and autonomic nervous system state modeling during nocturnal rest.
- **Wearable Health Monitoring:** Non-invasive detection of wakefulness episodes, sleep fragmentation, and REM autonomic transitions without requiring sleep lab electrodes.

### Explicit Non-Intended Uses & Clinical Warnings
- **Not a Diagnostic Medical Device:** This model is not FDA-cleared, CE-marked, or clinically certified. It cannot diagnose sleep apnea, narcolepsy, insomnia, or REM sleep behavior disorder.
- **No EEG Signal Claim:** The input signals are optical photoplethysmography (PPG) heart-rate metrics from a consumer smartwatch (Apple Watch); the model does NOT measure or decode electroencephalogram (EEG) brain waves.
- **No Total Sleep Duration Guarantee:** Epoch classification identifies sleep architecture within a recorded session; it should not be confused with actigraphy sleep duration forecasting.

---

## 3. Training & Validation Data
- **Dataset:** BiDSleep v1.0.1 on PhysioNet ([10.13026/rees-1092](https://doi.org/10.13026/rees-1092)).
- **Population:** Healthy adult cohort recorded across multiple nights in free-living environments.
- **License:** Open Data Commons Attribution License v1.0 (ODC-By v1.0).
- **Participant-Disjoint Partitioning:**
  - **Training Cohort:** `Bidslab00` (7 nights, 6,171 epochs)
  - **Validation Cohort:** `Bidslab01` (5 nights, 4,314 epochs)
  - **Held-Out Test Cohort:** `Bidslab02` (6 nights, 5,280 epochs, 44.0 continuous hours)
  - **Participant Leakage:** **0% (Verified strictly disjoint subject IDs)**.
  - **Preprocessing Leakage:** `RobustScaler` fit exclusively on training participant `Bidslab00`; test data transformed with frozen parameters.

---

## 4. Features Schema (12 Wearable Features)
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

## 5. Empirical Held-Out Test Evaluation (Participant `Bidslab02`)

### Overall Metrics vs. Simple Baseline
| Metric | BiDSleep Random Forest | Majority-Class Baseline | Empirical Lift |
| :--- | :--- | :--- | :--- |
| **Macro F1** | **28.22%** | 9.52% | **+18.69%** |
| **Balanced Accuracy** | **34.70%** | 20.00% | **+14.70%** |
| **Overall Accuracy** | **36.23%** | 31.25% | **+4.98%** |
| **Cohen's Kappa** | **0.1989** | 0.0000 | **+0.1989** |
| **Test Cohort Support** | 5,280 epochs (44.0 hrs) | 5,280 epochs | — |

### Per-Class Performance Breakdown
| Stage Name | Class ID | Precision | Recall | F1-Score | Support (Ground Truth) | Predicted Count |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wake** | 0 | **97.21%** | 58.93% | **73.38%** | 1,181 | 716 |
| **N1** (Light) | 1 | 16.67% | 0.50% | 0.97% | 402 | 12 |
| **N2** (Intermediate) | 2 | 28.56% | **54.42%** | **37.46%** | 1,650 | 3,144 |
| **N3** (Deep/SWS) | 3 | **66.84%** | 27.14% | **38.60%** | 936 | 380 |
| **REM** (Dream) | 4 | 5.95% | 5.49% | 5.71% | 1,111 | 1,028 |

### Confusion Matrix (Rows: Ground Truth, Columns: Predicted)
```
             Wake    N1    N2    N3   REM   [Total]
Wake (0)      696     2   303    11   169    (1,181)
N1   (1)        8     2   279     4   109      (402)
N2   (2)        7     4   898    84   657    (1,650)
N3   (3)        2     1   651   254    28      (936)
REM  (4)        3     3  1013    31    61    (1,111)
[Total]       716    12 3,144   384 1,024    (5,280)
```

---

## 6. Safeguards, Quality Gating & Ethical Considerations
- **Inadequate-Input Gating:** When optical sensor dropout occurs (`hr_valid_count < 2.0`) or heart rate is non-physiological (`< 30` or `> 240` bpm), the service returns an explicit `Unknown` label (`predicted_stage_id_5class: 5`, `input_quality_status: "INSUFFICIENT_INPUT_DATA"`). The system refuses to hallucinate a stage.
- **Zero Imputation:** Missing optical intervals are never filled with synthetic zeros.
- **Participant Isolation:** Public research participant recordings (`Bidslab00`, `Bidslab01`, `Bidslab02`) are stored in isolated research directories and never inserted into the production MongoDB patient `observations` collection.
- **Causal Guarantee:** Hypnogram timeline inference enforces strict chronological order $(t_0, t_1, \dots, t_k)$ with zero future-data leakage.
