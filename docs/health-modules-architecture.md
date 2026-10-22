# SwasthyaTwin AI — Multisignal Health Intelligence Architecture

This document defines the modular architecture for the SwasthyaTwin AI personal health digital twin platform. It establishes the mathematical models, data schemas, clinical guardrails, patient isolation protocols, and model boundaries for all supported intelligence domains.

---

## 1. Modular Health Architecture Overview

SwasthyaTwin AI is architected into **six independent, decoupled intelligence modules**. Each module possesses dedicated data validation rules, baseline computation logic, clinical boundaries, and explicit limitations.

```
                              ┌────────────────────────────────────────┐
                              │       MongoDB Observation Store        │
                              │ (Persistent Source of Truth, Isolated) │
                              └───────────────────┬────────────────────┘
                                                  │
                        ┌─────────────────────────┴─────────────────────────┐
                        │                                                   │
             ┌──────────▼──────────┐                             ┌──────────▼──────────┐
             │ Patient Live Stream │                             │ Research / Demo Raw │
             │  (Personal Baseline)│                             │ (BiDSleep PhysioNet)│
             └──────────┬──────────┘                             └──────────┬──────────┘
                        │                                                   │
  ┌─────────────────────┼─────────────────────┬─────────────────────┐       │
  │                     │                     │                     │       │
┌─▼──────────────┐   ┌──▼──────────────┐   ┌──▼──────────────┐   ┌──▼───────▼──────┐
│   Module B:    │   │   Module C:     │   │   Module D:     │   │   Module A:     │
│ Cardiovascular │   │   Activity      │   │ Blood Pressure  │   │     Sleep       │
│     Trends     │   │  Intelligence   │   │ Tracking (Cuff) │   │  Intelligence   │
└─┬──────────────┘   └──┬──────────────┘   └──┬──────────────┘   └──┬──────────────┘
  │                     │                     │                     │
  └─────────────────────┼─────────────────────┴─────────────────────┘
                        │
             ┌──────────▼──────────┐
             │   Module E: Multi-  │
             │   Tier Anomalies    │
             │ (Statistical Only)  │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │   Module F: Trend   │
             │     Forecasting     │
             │ (Chronological Split)
             └─────────────────────┘
```

---

## 2. Module Specifications

### Module A — Sleep Intelligence
- **Primary Research Task:** 5-Stage AASM Sleep Classification (`Wake=0`, `N1=1`, `N2=2`, `N3=3`, `REM=4`) from 30-second epoch wearable optical heart rate (PPG) dynamics.
- **Reference Ground Truth:** Polysomnography / Dreem headband EEG expert annotations from the BiDSleep v1.0.1 dataset.
- **Wearable Sensor Signals:** Apple Watch Series 9 optical photoplethysmography heart rate and tri-axial wrist accelerometry.
- **Causal Epoch Feature Schema (`v1.0-12features`):**
  - Instantaneous HR: `hr_mean`, `hr_std`, `hr_median`, `hr_min`, `hr_max`, `hr_q25`, `hr_q75`, `hr_valid_count`.
  - Autonomic & Circadian: `hr_delta_baseline` (bpm shift from pre-sleep baseline), `hr_rolling_mean_5m`, `hr_rolling_std_5m`, `time_elapsed_minutes`.
- **Label Handling:** Unknown (`5`) epochs are strictly excluded from supervised training and evaluation. Never silently converted to Wake.
- **Clinical Boundary:** Investigational research classification only. Does **NOT** directly measure EEG brain waves and does **NOT** diagnose obstructive sleep apnea, central sleep apnea, insomnia, or clinical parasomnias.

---

### Module B — Cardiovascular Trend Analysis
- **Supported Metrics:** Resting Heart Rate (`bpm`), Heart Rate Variability RMSSD (`ms`).
- **Data Provenance:** Continuous optical PPG wearable or verified clinical spot check.
- **Personal Baseline Corridor:**
  - Robust non-parametric corridor: Median and Interquartile Range (IQR).
  - Parametric reference: Mean ($\mu$) and Standard Deviation ($\sigma$) computed over a configurable rolling lookback window (default: 30 days).
  - Tukey's fences outlier filtering ($[Q_1 - 3.0 \times \text{IQR}, Q_3 + 3.0 \times \text{IQR}]$) prevents transient exercise spikes or device noise from contaminating the personal baseline.
- **Shift & Deviation Metrics:**
  - Absolute Deviation: $\Delta = x_{\text{observed}} - \text{Baseline Median}$
  - Relative Deviation Percentage: $\Delta\% = \frac{x_{\text{observed}} - \text{Baseline Median}}{\text{Baseline Median}} \times 100\%$
  - Standardized Gaussian $Z$-Score: $z = \frac{x_{\text{observed}} - \mu}{\sigma}$
- **Explicit Pattern Detection Rules:**
  1. *Resting Tachycardia Flag:* Sustained resting $\text{HR} > 100$ bpm.
  2. *Resting Bradycardia Flag:* Resting $\text{HR} < 45$ bpm (context-aware of endurance athletes).
  3. *Statistical Corridor Shift:* $|z| \ge 2.0\sigma$ persistent shift.
- **Clinical Boundary:** Measures longitudinal trends and autonomic variability. Does **NOT** diagnose cardiac arrhythmias (e.g., atrial fibrillation), conduction blocks, myocardial ischemia, or acute cardiovascular emergencies.

---

### Module C — Activity Intelligence
- **Supported Metrics:** Daily Step Count (`steps`), tri-axial activity volume.
- **Provenance:** Wearable pedometer / accelerometer.
- **Pattern Analytics:**
  - 7-day rolling average kinetic load.
  - Day-of-week stratification (weekday mean vs weekend mean).
  - Telemetry missingness audit: Days with $< 500$ cumulative steps are flagged as potential non-wear periods and **never** silently imputed as zero.
  - Percentage delta against personal 30-day median step count.
- **Forecasting Safeguard:** Activity forecasting is strictly withheld unless $\ge 14$ contiguous days of valid, non-sparse step records exist.
- **Clinical Boundary:** Physical activity tracking for wellness and mobility self-awareness. Does **NOT** measure maximal oxygen uptake ($\text{VO}_2\text{max}$), cardiovascular fitness, or diagnose functional locomotor disabilities.

---

### Module D — Blood Pressure Trend Tracking
- **Supported Metrics:** Systolic Blood Pressure (`mmHg`), Diastolic Blood Pressure (`mmHg`).
- **Provenance:** Validated upper-arm oscillometric blood pressure monitor (e.g. Omron 10 Series) or calibrated auscultatory sphygmomanometer.
- **Hemodynamic Pair Processing:**
  - Pulse Pressure: $\text{PP} = \text{SBP} - \text{DBP}$ (canonical unit: mmHg).
  - Mean Arterial Pressure: $\text{MAP} = \text{DBP} + \frac{1}{3}\text{PP}$ (canonical unit: mmHg).
- **Strict Plausibility & Consistency Guards:**
  - Physiological bounds: $45 \le \text{SBP} \le 300$ mmHg, $25 \le \text{DBP} \le 180$ mmHg.
  - Hemodynamic consistency: $\text{SBP} \ge \text{DBP} + 15$ mmHg. Records with $\text{PP} < 15$ mmHg or inverted values are flagged for user confirmation.
- **AHA/ACC Reference Categorization:**
  - Normal: $\text{SBP} < 120$ and $\text{DBP} < 80$ mmHg.
  - Elevated: $120 \le \text{SBP} \le 129$ and $\text{DBP} < 80$ mmHg.
  - Stage 1: $130 \le \text{SBP} \le 139$ or $80 \le \text{DBP} \le 89$ mmHg.
  - Stage 2: $\text{SBP} \ge 140$ or $\text{DBP} \ge 90$ mmHg.
  - Hypertensive Crisis: $\text{SBP} > 180$ or $\text{DBP} > 120$ mmHg (requires immediate physician referral).
- **Clinical Boundary:** **Zero synthetic generation.** The platform **NEVER** estimates, infers, or predicts blood pressure from wearable photoplethysmography, heart rate, or sleep stages.

---

### Module E — Personalized Anomaly Detection
- **Methodology:** Multi-tier statistical corridor filtering combining non-parametric Tukey's fences and parametric Gaussian z-scores.
- **Minimum Historical Data Gate:** Requires at least **14 verified observations** before computing personal baseline distributions. Prevents erratic outlier alarms during initial user onboarding.
- **Core Distinction:**
  - *Statistical Anomaly:* Measurement falls outside the individual's typical mathematical distribution ($|z| \ge 2.0$ or $> 1.5 \times \text{IQR}$).
  - *Clinical Abnormality:* Measurement crosses universally validated clinical danger thresholds (e.g., $\text{SBP} \ge 140$ mmHg, $\text{HR} \ge 120$ bpm, $\text{SpO}_2 < 90\%$).
- **Alert Suppression & Confirmation:** Single transient outliers do not trigger immediate persistent alerts unless confirmed across consecutive epochs or acknowledged by the user.

---

### Module F — Future Trend Forecasting
- **Scope:** Autoregressive time-series trajectory projection with 95% confidence bounds.
- **Eligible Metrics:** Resting Heart Rate, HRV (RMSSD), Daily Steps.
- **Strict Data Gating:** Requires a minimum of **14 contiguous historical days**. Returns structured status `"insufficient_data"` if history is inadequate; never fabricates fictitious forecasts.
- **Chronological Split & Backtesting:**
  - Models are fit strictly on chronological history $[t_0, t_{\text{eval}}]$.
  - The held-out evaluation window $[t_{\text{eval}}, t_{\text{now}}]$ (last 7 days) tests model MAE/RMSE against a Naive Persistence Baseline ($y_{t+h} = y_t$).
- **Clinical Boundary:** Trend projection for personal recovery and lifestyle self-awareness. Does **NOT** predict disease onset, total sleep duration, or acute medical events.

---

## 3. Data Provenance & Schema Integrity

Every observation stored in MongoDB strictly adheres to the following unified schema:

```json
{
  "observation_id": "obs_a1b2c3d4e5f6",
  "patient_id": "PT-USER-1001",
  "measurement_type": "heart_rate",
  "value": 68.0,
  "unit": "bpm",
  "observed_at": "2026-10-22T22:30:00Z",
  "source": "wearable_continuous",
  "source_type": "device_measurement",
  "device_id": "apple_watch_series_9",
  "data_kind": "measured",
  "validation_status": "valid",
  "validation_warnings": [],
  "requires_confirmation": false,
  "confirmed_by_user": false,
  "edit_history": [],
  "demo_data": false,
  "is_synthetic": false,
  "created_at": "2026-10-22T22:30:15Z"
}
```

### Data Isolation Rules
1. **Zero Cross-Patient Contamination:** Every MongoDB aggregation, query, baseline recalculation, and prediction pipeline strictly filters by `patient_id`.
2. **Research Dataset Separation:** Public PhysioNet research participants (`Bidslab00`, `Bidslab01`, `Bidslab02`) are stored in raw/processed feature tables and are **never** injected into personal user patient records.
3. **Synthetic Demo Separation:** Demo records have `demo_data: true` and `is_synthetic: true` explicitly tagged, allowing one-click resets without affecting live user health timelines.
