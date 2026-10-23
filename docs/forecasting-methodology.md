# SwasthyaTwin AI: Personal Trend Forecasting Methodology

## 1. Executive Summary & Clinical Grounding

The SwasthyaTwin Trend Forecasting Module delivers **personal longitudinal trend extrapolation** grounded strictly in verified physiological telemetry. The primary design principle is **clinical integrity and ethical restraint**:
- We predict **lifestyle and autonomic telemetry trajectories** (e.g., daily step counts, sleep duration, resting heart rate).
- We **strictly refuse** to forecast disease onset, acute clinical events (e.g., myocardial infarction, stroke), or episodic vitals that cannot be reliably extrapolated with simple models (e.g., blood pressure, fasting fingerstick glucose).
- We enforce that **correlations never imply causation**.

---

## 2. Supported vs. Excluded Prediction Targets

| Target Metric | Unit | Status | Scientific Justification |
| :--- | :--- | :--- | :--- |
| **`daily_steps`** | steps | **Supported** | Wearable 3-axis accelerometer observations collected continuously on a 24-hour diurnal cadence. Captures habitual baseline activity patterns. |
| **`sleep_duration_hours`** | hours | **Supported** | Verified nocturnal sleep duration derived from sleep tracking/polysomnography epochs. Bounded by 24h diurnal limits. |
| **`heart_rate`** | bpm | **Supported** | Resting heart rate baseline tracked during deep nocturnal rest or quiet wakefulness via continuous PPG. |
| **`hrv_rmssd`** | ms | **Supported** | Vagal tone and parasympathetic recovery derived from inter-beat intervals ($RR$). |
| **`blood_pressure_systolic`** | mmHg | **EXCLUDED** | **Not Supported**. Intermittent oscillometric cuff measurements vary with posture, acute stress, and cuff placement. Extrapolating forward without continuous arterial line waveforms generates clinically dangerous false projections. |
| **`blood_pressure_diastolic`** | mmHg | **EXCLUDED** | **Not Supported**. Excluded for identical hemodynamical reasons as systolic BP. |
| **`fasting_blood_glucose`** | mg/dL | **EXCLUDED** | **Not Supported**. Infrequent bi-weekly fingerstick samples lack the time-density required for continuous time-series forecasting. |
| **`disease_onset`** | N/A | **EXCLUDED** | **Not Supported**. Wearable trend heuristics are non-diagnostic and must never simulate acute pathological onset. |

---

## 3. Data Ingestion, Aggregation, and Exclusion Rules

Before any model training or baseline calculation takes place, observations must pass strict preprocessing filters:

1. **Physiological Plausibility Boundary Checks**:
   - Each observation value $x_t$ is validated against documented human survival limits ([plausibility_checker.py](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/app/analytics/plausibility_checker.py)).
   - `daily_steps`: $[0, 120\,000]$ steps.
   - `sleep_duration_hours`: $[0.0, 24.0]$ hours.
   - `heart_rate`: $[25.0, 260.0]$ bpm.
   - Any reading exceeding bounds triggers an `input_quality_rejection` response; corrupt observations are never silently imputed.

2. **Daily Aggregation & Missingness Handling**:
   - Time-stamped telemetry is bucketed by calendar date (`YYYY-MM-DD`). Multiple intra-day readings are collapsed into the daily summary metric.
   - **Missing Day Rule**: Missing days are **NOT** imputed with $0.0$ (e.g., an unrecorded day is not assumed to be zero steps). Gaps in telemetry are preserved in the chronology.
   - If historical observations span $> 90$ days without recent updates, forecasting is halted with a `stale_data` notification.

3. **Minimum History Gate**:
   - Requires at least **14 unique chronological observation days** ($\ge 14$ observations).
   - If $N < 14$, the module halts and returns `insufficient_features`, refusing to fabricate predictions.

---

## 4. Leakage-Free Chronological Holdout Splitting

Random $K$-fold cross-validation or random data shuffling in time-series forecasting is **strictly prohibited**, as it leaks future temporal patterns into past training windows.

### Splitting Architecture:
```
Longitudinal Observations:  [ t_0, t_1, t_2, ..., t_{N-8} ] | [ t_{N-7}, ..., t_N ]
                              \_________________________/     \__________________/
                                     TRAINING SET               HELD-OUT TEST SET
                                 (Fit Model & Baselines)        (7-Day Evaluation)
```

1. **Chronological Sorting**: Input observations are ordered strictly by `observed_at`.
2. **Held-Out Evaluation Window**:
   - The final $H = 7$ days (or $\min(7, \lfloor N / 3 \rfloor)$) are isolated as the held-out test set $y_{\text{test}}$.
   - All model fitting, slope calculations, and baseline values are derived **strictly from $y_{\text{train}}$**.
   - Zero future data leaks into preprocessing, normalization, or slope estimation.

---

## 5. Baseline Comparison Architecture

Every trend forecast is quantitatively compared against two benchmark baselines computed on the held-out window:

1. **Baseline 1: Naive Persistence ($y_{t+h} = y_t$)**:
   $$\hat{y}_{\text{persist}}(t+h) = y_{\text{train}}[-1]$$
   - Projects the most recent training observation forward as a flat horizon.
2. **Baseline 2: Rolling 7-Day Historical Mean**:
   $$\hat{y}_{\text{rolling\_7d}}(t+h) = \frac{1}{7}\sum_{k=0}^{6} y_{\text{train}}[-1 - k]$$
   - Projects the mean of the last 7 training days.

### Forecasting Model: Autoregressive Local Trend with Exponential Dampening (v2.1)
- Fits a local slope $\beta$ over the recent 14 days of training data:
  $$\hat{y}(t+h) = y_{\text{train}}[-1] + \beta \cdot h \cdot e^{-h / \tau}$$
  where $\tau = 5.0$ for evaluation and $\tau = 8.0$ for future horizon damping.

---

## 6. Evaluation Metrics & Acceptance Criteria

We measure performance on the held-out evaluation window using:
- **Mean Absolute Error (MAE)**:
  $$\text{MAE} = \frac{1}{H} \sum_{h=1}^{H} |y_{\text{test}}[h] - \hat{y}[h]|$$
- **Root Mean Squared Error (RMSE)**:
  $$\text{RMSE} = \sqrt{\frac{1}{H} \sum_{h=1}^{H} (y_{\text{test}}[h] - \hat{y}[h])^2}$$
- **Gain vs. Persistence Baseline (%)**:
  $$\text{Gain} = \frac{\text{MAE}_{\text{persist}} - \text{MAE}_{\text{model}}}{\text{MAE}_{\text{persist}}} \times 100\%$$

### Acceptance Criterion & "Experimental" State:
- **Validated / Passed**: The model exhibits lower or comparable error to the persistence baseline ($\text{MAE}_{\text{model}} \le 1.20 \times \text{MAE}_{\text{persist}}$).
- **Experimental Flag**: If the model error exceeds the persistence baseline by $> 20\%$, the UI flags the forecast as **EXPERIMENTAL** rather than presenting inaccurate projections as authoritative.

---

## 7. Uncertainty Quantification & UI Demarcation

- **Prediction Interval**: Computed from the standard deviation of residuals $\sigma_{\epsilon}$ on the training series, expanding over the forecast horizon $h \in [1, H]$:
  $$\text{CI}_{95\%}(h) = \hat{y}(t+h) \pm 1.96 \cdot \sigma_{\epsilon} \cdot \left(1.0 + \frac{h}{H} \cdot 0.75\right)$$
- **UI Demarcation**:
  - The chart visibly separates observed history from future predictions with a vertical dashed marker labeled **"NOW (Handover)"**.
  - Historical data is rendered as a solid area curve; future predictions are rendered as dashed trajectory lines bounded by a translucent 95% confidence corridor.
