# SwasthyaTwin Known Limitations & Technical Boundaries

**Document Version**: 1.0.0  
**Status**: Comprehensive Engineering & Clinical Disclosure  
**Audit Step**: Step 9 Systems Audit  
**Last Updated**: October 23, 2026  

---

## 1. Regulatory & Clinical Limitations

1. **Non-Diagnostic Device**:
   - SwasthyaTwin is a **research and technology demonstrator**. It is not a certified medical device (Software as a Medical Device / SaMD) under US FDA 21 CFR Part 820, EU MDR 2017/745, or CDSCO Medical Device Rules.
   - It cannot be used as a standalone diagnostic tool, triage filter for acute care, or automated drug dosage titration system.
2. **Absence of Disease Probability Modeling**:
   - The platform strictly avoids computing or displaying "probability of heart attack", "cancer risk score", or any unvalidated clinical risk metrics.
   - All biometric evaluations are presented as **statistical personal deviations ($Z$-scores)** relative to an individual's historical baseline, not population disease prevalence.

---

## 2. Machine Learning Model Limitations

### A. PhysioNet Sleep Staging Model (BiDSleep)
1. **Cohort Scale**:
   - The model is trained and evaluated on 31 participants from the open PhysioNet Bimodal Sleep dataset. While realistic and authentic, 31 healthy adults do not represent the full heterogeneity of clinical sleep apnea, narcolepsy, or pediatric cohorts.
2. **Physiological Input Reliance**:
   - The sleep stage classifier operates on optical photoplethysmography (PPG) derived heart-rate time series and actigraphy. While EEG/polysomnography (PSG) is the gold standard for clinical sleep staging (distinguishing Stage N1, N2, N3), heart-rate surrogates primarily distinguish broader **Wake**, **NREM**, and **REM** stages.
3. **Class Imbalance**:
   - Natural sleep architecture exhibits class imbalance: NREM sleep comprises ~75–80% of normal nocturnal sleep, REM ~15–20%, and Wake episodes ~5–10%. Model metrics report **Balanced Accuracy** and **Macro F1** alongside raw accuracy to prevent majority-class misinterpretation.

---

## 3. Time-Series Forecasting Boundaries

1. **Supported vs. Unsupported Metrics**:
   - **Supported Targets**: Daily physical activity (`daily_steps`), nocturnal sleep duration (`sleep_duration_hours`), and resting heart rate (`heart_rate`). These targets exhibit diurnal periodicity and behavioral autocorrelations suitable for statistical forecasting.
   - **Strictly Excluded Metrics**: Acute vitals such as blood pressure (systolic/diastolic) and blood glucose. Forecasting blood pressure or glucose dynamics without real-time continuous insulin, dietary, or pharmacotherapy logging is scientifically ungrounded and clinically hazardous.
2. **Horizon & History Constraints**:
   - Maximum forecasting horizon is **7 days**. Long-range projections beyond 7 days accumulate significant error due to unpredictable lifestyle shifts.
   - Minimum historical data required is **7 days** of consistent observations. If history is insufficient, the system gracefully falls back to persistence or displays an insufficient-data warning.

---

## 4. Counterfactual Simulation Boundaries

1. **Association vs. Causation**:
   - What-if simulations (e.g., assessing the impact of increasing sleep duration by 1.5 hours) use deterministic evidence-based heuristic models and linear regression coefficients derived from cohort literature.
   - The platform explicitly informs users that scenario outputs are **hypothetical counterfactual projections**, not guaranteed causal outcomes.
2. **Biological Contradiction Guards**:
   - Scenarios enforce biological boundaries: physical daily steps cannot be simulated above 50,000 steps; nocturnal sleep cannot be simulated above 14 hours.
3. **Immutability of True History**:
   - Simulations are stored strictly in the `simulations` collection. They never overwrite, delete, or merge with a patient's historical measured observations.

---

## 5. Telemetry, Sensor & Hardware Dependencies

1. **Wearable Sampling Rate Variability**:
   - Consumer wearable devices (Apple Watch, Fitbit, Garmin, Oura) utilize differing sampling frequencies (e.g. 1 Hz continuous vs. 5-minute intermittent PPG).
   - Ingestion pipelines normalize values into canonical units (bpm, %, hours, steps), but sensor artifact noise (e.g. motion artifacts during vigorous exercise) can skew individual readings.
2. **Timezone Transitions**:
   - Daylight saving time transitions and intercontinental travel can create apparent gaps or overlaps in chronological time-series timestamps. All timestamps are coerced to UTC internally.

---

## 6. Infrastructure & Deployment Constraints

1. **Database Fallback Mode**:
   - For hackathon demonstration convenience, `ALLOW_IN_MEMORY_FALLBACK=True` permits running in an isolated `mongomock` memory store if local MongoDB is unreachable.
   - In production environments, `ALLOW_IN_MEMORY_FALLBACK` must be set to `False` to guarantee data durability and ensure that database offline conditions produce explicit 503 service alerts.
2. **Single-Node Deployment**:
   - The current demonstration backend is configured for single-node FastAPI execution. High-availability production deployments require multi-region MongoDB Atlas replica sets, Redis-backed rate limiting, and Kubernetes horizontal pod autoscaling.
