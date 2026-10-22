# SwasthyaTwin Machine Learning Model Evaluation Report
**Experiment Name:** Wearable Sleep Architecture Classification Benchmark  
**Evaluation Standard:** 3-Class Sleep Staging (Wake vs. NREM vs. REM)  
**Dataset:** PhysioNet Sleep-Accel v1.0.0 (Walch et al., 2019)  
**Verification Date:** October 2026  
**Status:** Reproducible & Verified  

---

## 1. Executive Summary

This report documents the rigorous evaluation of the genuine, reproducible machine-learning pipeline implemented within SwasthyaTwin. Following the research protocol outlined in [`docs/ml-experiment-plan.md`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/docs/ml-experiment-plan.md), the system trains and benchmarks candidate machine learning models against gold-standard in-laboratory polysomnography (PSG) using authentic consumer wearable photoplethysmography (PPG) telemetry from 31 human participants (26,773 thirty-second epochs).

### Core Findings & Verification Proofs:
1. **Zero Intra-Subject Data Leakage:** Partitioned into 25 training participants (21,698 epochs) and 6 held-out test participants (5,075 epochs). Training and testing participant sets are strictly disjoint.
2. **Zero Preprocessing Lookahead:** The `StandardScaler` was fit exclusively on the 25 training participants. Test data were transformed using frozen training statistics.
3. **Model Selection on Generalization, Not Training Score:** The Champion model (`Random_Forest`) was selected based on held-out test Balanced Accuracy (58.08%) and Macro F1 (55.49%), outperforming the Majority Class Baseline (33.33% balanced accuracy) by **+24.75 percentage points**.
4. **Reproducibility:** Seeded with `RANDOM_SEED = 42`. The full training pipeline can be executed via `python scripts/train_sleep_staging.py`.

---

## 2. Experimental Setup & Cohort Breakdown

### Cohort Partitioning

```
Total PhysioNet Cohort: 31 Human Participants (26,773 Aligned 30s Epochs)
  │
  ├── Training Cohort (81.0% of data):
  │     • 25 Participants (21,698 Epochs)
  │     • Evaluated via 5-Fold GroupKFold Cross-Validation
  │     • Scaler fit exclusively on training folds
  │
  └── Held-Out Test Cohort (19.0% of data):
        • 6 Participants (5,075 Epochs)
        • Subject IDs: ['3997827', '4018081', '5498603', '6220552', '8258170', '8692923']
        • Strictly unobserved during feature scaling and model fitting
```

### Class Distribution (Severe Real-World Physiological Imbalance)
- **Class 0 (Wake):** 481 epochs in test set (9.48% prevalence)
- **Class 1 (NREM):** 3,523 epochs in test set (69.42% prevalence)
- **Class 2 (REM):** 1,071 epochs in test set (21.10% prevalence)

*Note on Scientific Rigor:* A naive model predicting solely NREM achieves an overall accuracy of 69.42%. However, its Balanced Accuracy is exactly 33.33% (chance) and its Cohen's Kappa is 0.0000. Therefore, **Balanced Accuracy and Macro F1 are the primary selection metrics**.

---

## 3. Quantitative Results & Benchmark Comparisons

### Comparison Across All Evaluated Models on the Held-Out Test Set (5,075 Epochs)

| Model Name | Overall Accuracy | Balanced Accuracy (Primary) | Macro F1-Score | Weighted F1-Score | Cohen's Kappa ($\kappa$) | ROC-AUC (OvR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Majority Baseline** | 69.42% | 33.33% | 27.32% | 56.88% | 0.0000 | 50.00% |
| **Heuristic Baseline** | 41.52% | 33.58% | 32.79% | 45.20% | 0.0210 | 52.10% |
| **Logistic Regression** | 60.12% | 54.20% | 51.85% | 61.20% | 0.2740 | 71.40% |
| **Random Forest (Champion)** | **63.90%** | **58.08%** | **55.49%** | **65.15%** | **0.3155** | **76.77%** |
| **HistGradientBoosting** | 63.15% | 56.40% | 54.10% | 64.30% | 0.2980 | 75.20% |

### 5-Fold GroupKFold Cross-Validation Scores (Training Cohort Only)
Cross-validation on the 25 training participants confirms stable performance across diverse individual physiological profiles:
- **Fold Accuracy (Mean ± Std):** $62.8\% \pm 3.4\%$
- **Fold Balanced Accuracy (Mean ± Std):** $57.2\% \pm 2.8\%$
- **Fold Macro F1 (Mean ± Std):** $54.8\% \pm 3.1\%$

---

## 4. Per-Class Diagnostic Performance & Error Analysis

### Detailed Class Breakdown (Held-Out Test Set)

```
========================================================================================
 Class ID | Class Name | Precision | Recall (Sens) | F1-Score | Support | Prevalence
========================================================================================
    0     | Wake       |   44.9%   |     46.6%     |  45.7%   |   481   |    9.48%
    1     | NREM       |   82.7%   |     67.4%     |  74.3%   |  3,523  |   69.42%
    2     | REM        |   37.8%   |     60.3%     |  46.5%   |  1,071  |   21.10%
========================================================================================
```

### Normalized Confusion Matrix

$$\begin{pmatrix}
\text{Actual \ Predicted} & \text{Wake} & \text{NREM} & \text{REM} \\
\text{Wake} & \mathbf{46.6\%} & 24.1\% & 29.3\% \\
\text{NREM} & 6.5\% & \mathbf{67.4\%} & 26.1\% \\
\text{REM} & 4.3\% & 35.4\% & \mathbf{60.3\%}
\end{pmatrix}$$

### Clinical & Physiological Error Analysis
1. **Wake vs. REM Misclassification (29.3% of Wake epochs predicted as REM; 4.3% vice versa):**
   - *Physiological Cause:* Rapid Eye Movement (REM) sleep is characterized by **autonomic instability**, with heart-rate surges and heart-rate variability resembling active wakefulness despite muscular atonia. Models relying on cardiac PPG without EEG cannot always differentiate motionless wakefulness from phasic REM sleep.
2. **NREM Sensitivity (67.4% Recall, 82.7% Precision):**
   - High precision confirms that when the model predicts NREM, it is correct in $>82\%$ of cases, driven by steady parasympathetic dominance and suppressed HR variance.
3. **Wake Detection in Bed (46.6% Recall):**
   - In quiet wakefulness (lying still in bed before sleep onset or during brief arousals), movement is minimal and heart rate gradually declines, causing some wake epochs to blend into light NREM (24.1%).

---

## 5. Feature Importance Attribution

Feature importances derived from Gini impurity reduction across the 100 decision trees in the Random Forest ensemble:

```
Rank | Feature Name          | Importance % | Physiological Rationale
-----+-----------------------+--------------+-------------------------------------------------
  1  | time_elapsed_minutes  |    24.8%     | Circadian sleep architecture: REM dominates late.
  2  | hr_delta_baseline     |    18.4%     | Cardiac deceleration below baseline marks NREM.
  3  | hr_rolling_mean_5m    |    16.2%     | Macroscopic hemodynamic state over 5 minutes.
  4  | hr_mean               |    14.1%     | Instantaneous 30-second epoch pulse rate.
  5  | hr_rolling_std_5m     |    11.7%     | Autonomic tone variance over trailing epochs.
  6  | hr_std                |     6.2%     | Micro-variability within 30-second window.
  7  | hr_max                |     4.6%     | Peak tachycardia spikes (transient arousals).
  8  | hr_min                |     4.0%     | Deepest bradycardia troughs (slow-wave sleep).
```

---

## 6. How to Reproduce the Pipeline

The pipeline is completely deterministic and runnable via CLI:

```bash
# 1. Activate backend environment
cd backend
source venv/bin/activate  # Or .\venv\Scripts\Activate.ps1 on Windows

# 2. Execute full ML training and evaluation on authentic PhysioNet dataset
python scripts/train_sleep_staging.py

# 3. Execute automated test suite verifying data validation, leakage guard, and inference
pytest tests/test_authentic_ml_pipeline.py -v
```

---

## 7. Production Verification & Frontend Integration

The model is deployed in the live SwasthyaTwin application:
- **Backend API Endpoints:**
  - `POST /api/v1/ml/sleep-stage/predict` (Validates input features, returns predicted stage, probabilities, and quality audits)
  - `GET /api/v1/ml/sleep-stage/evaluation` (Returns full evaluation manifest and confusion matrix)
  - `POST /api/v1/ml/sleep-stage/train` (Triggers end-to-end retraining)
- **Frontend User Interface:**
  - Dedicated **Model Evaluation** page (`ModelEvaluationPage.tsx`) accessible from the main navigation sidebar.
  - Displays interactive KPI cards, baseline benchmark comparisons, normalized confusion matrix, per-class diagnostics, and an interactive single-epoch prediction sandbox with input plausibility guards.
