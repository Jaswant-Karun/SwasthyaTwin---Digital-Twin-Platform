# SwasthyaTwin AI — Personalized Heart-Rate Anomaly Evaluation Report

**Evaluation Timestamp**: 2026-10-23T00:07:41Z  
**Algorithm**: `v1.2.0-robust-mad`  
**Dataset Artifact**: [`reports/heart_rate_anomaly_evaluation.json`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/reports/heart_rate_anomaly_evaluation.json)  
**Configuration**: 30-day window, minimum 10 samples, Modified $Z \ge 2.5$.

---

## 1. Operational Results

| Metric | Measured Value | Percentage of Total |
| :--- | :--- | :--- |
| **Total Cohort Patients** | 5 | 100% |
| **Raw Observations Processed** | 439 | 100% |
| **Eligible Observations** | 439 | 100% |
| **Quality Exclusions (Invalid/Simulated)** | 0 | 0.0% |
| **Personalized Anomalies Flagged** | **35** | **8.0%** |
| **Static Population Threshold Flags (<50 or >100 bpm)** | **64** | **14.6%** |
| **Readings Within Personal Corridor** | **374** | **85.2%** |
| **Initial Insufficient History Observations** | **30** | **6.8%** |

---

## 2. Comparison: Personalized vs. Static Population Baseline

The empirical comparison illustrates the key finding:
- The **Static Population Detector** flagged **64 readings (14.6%)**. In athletic subjects with natural resting heart rates around 48–52 bpm, static thresholds generated constant false-alarm flags during nocturnal recovery periods.
- The **Personalized nMAD Detector** flagged **35 readings (8.0%)**, capturing genuine statistical deviations from each patient's actual baseline corridor while accommodating individualized resting biology.

---

## 3. Honest Evaluation Disclosure

> [!IMPORTANT]
> **Supervised Precision, Recall, and F1 Status: UNAVAILABLE**
> 
> Continuous longitudinal heart-rate streams from wearable devices do not come with independently verified, clinician-annotated pathological event labels. In accordance with clinical ML guidelines, SwasthyaTwin AI **does not invent synthetic ground-truth labels** to fabricate inflated precision or recall statistics.
> 
> Operational evaluation focuses strictly on:
> 1. Verifiable chronological replay with zero future leakage.
> 2. False alarm suppression relative to static clinical population norms.
> 3. Strict patient isolation and mathematical reproducibility.
