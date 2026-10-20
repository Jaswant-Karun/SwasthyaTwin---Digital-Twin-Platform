# SwasthyaTwin Calculation Engine Methodology

> **Important Disclosure**: SwasthyaTwin is a health digital twin research and demonstration platform. All thresholds, indicators, what-if simulations, and flags described below are mathematical heuristics for longitudinal self-baseline surveillance. They do **not** constitute medical advice, diagnostic standards, disease probability scores, or emergency triage predictions.

---

## 1. Architectural Philosophy: Anti-Population Norm Design

Traditional digital health solutions benchmark patient biometrics against broad cohort distributions (e.g. resting heart rate between 60 and 100 bpm). This misses subtle, clinically significant physiological drift for an individual whose personal baseline is 52 bpm, while falsely alarming an individual whose baseline is naturally 82 bpm.

**SwasthyaTwin benchmarks every patient against their own longitudinal historical window**, tracking relative shifts, personal distribution spreads, and individual adaptation kinetics.

---

## 2. Personal Baselines (Section A)

### Median Baseline Formulation
For each patient and measurement type, a baseline is established over a configurable historical window $W$ (default: $30\text{ days}$, configurable between 7 and 180 days).

Let valid historical readings over window $W$ be ordered:
$$X = [x_{(1)}, x_{(2)}, \dots, x_{(N)}]$$

The primary personal baseline is the **sample median**:
$$\text{Baseline}_{\text{personal}} = \operatorname{Median}(X) = \begin{cases} 
x_{\left(\frac{N+1}{2}\right)} & \text{if } N \text{ is odd} \\
\frac{1}{2}\left(x_{\left(\frac{N}{2}\right)} + x_{\left(\frac{N}{2}+1\right)}\right) & \text{if } N \text{ is even}
\end{cases}$$

### Outlier Resilience via Tukey's Fences
Hardware artifacts, telemetry dropouts, and sensor detachment glitches can corrupt biometric feeds. To prevent transient spikes from skewing baseline statistics, the engine calculates the Interquartile Range (IQR):
$$\text{IQR} = Q_3(X) - Q_1(X)$$
$$\text{Extreme Outlier Fences} = [Q_1 - 3.0 \times \text{IQR},\ Q_3 + 3.0 \times \text{IQR}]$$
Readings outside these fences are counted in `outlier_count` and excluded when calculating baseline mean $\mu$ and standard deviation $\sigma$.

### Handling Missing and Invalid Telemetry
- Missing values (`None`, `NaN`, corrupted strings) are **explicitly filtered out** and are **never treated as zero**. Coercing missing heart-rate or blood-pressure readings to zero would cause catastrophic baseline distortion.
- If total valid observations $N < \text{min\_observations}$ (configurable; default: 3), the baseline is marked with `is_sufficient = False` and any dependent trend indicators output `"insufficient_data"`.

### Strict Simulated Data Separation
Simulated data points generated during counterfactual or "what-if" simulations are **never mixed into measured personal baselines by default**.
- If a client explicitly passes `include_simulated=True`, the resulting baseline is explicitly labeled with:
  - `includes_simulated: true`
  - `data_tier: "mixed_simulated"`
- Measured baselines remain pure (`data_tier: "measured"`).

### Baseline Metadata Returned
Every baseline response includes:
- `metric_type` and `unit`
- `median` (primary personal baseline reference)
- `mean` and `std_dev` (distribution parameters)
- `iqr`, `q1`, `q3`
- `sample_count` ($N$)
- `window_days`, `window_start`, and `window_end`
- `outlier_count`
- `is_sufficient`
- `calculated_at` (UTC timestamp)
- `includes_simulated` and `data_tier`

---

## 3. Deviation Analysis (Section B)

For every incoming biometric observation $x_{\text{current}}$, the engine computes:

### Absolute Deviation
$$\Delta_{\text{absolute}} = x_{\text{current}} - \text{Baseline}_{\text{personal}}$$

### Relative Deviation Percentage
$$\Delta_{\text{relative}} = 100 \times \frac{x_{\text{current}} - \text{Baseline}_{\text{personal}}}{|\text{Baseline}_{\text{personal}}|}$$

#### Where Relative Deviation is Excluded / Deemed Misleading
Relative percentage deviation is **only calculated when mathematically and clinically defensible**:
1. **Bounded Proportions (SpO2)**: Oxygen saturation is already an absolute bounded percentage (0–100%). A drop from 98% to 94% is clinically described as a **-4 percentage point drop**, *not* a -4.08% relative change. Using relative percent on percentages causes severe clinical misinterpretation. Therefore, for `spo2`, `relative_deviation_percent` is set to `null` with `relative_deviation_meaningful: false`.
2. **Interval Temperature Scales**: Celsius and Fahrenheit lack an absolute physical zero. A shift from $37^\circ\text{C}$ to $38^\circ\text{C}$ does not represent a $+2.7\%$ increase in physiological heat energy. Relative percentage is therefore disabled for temperature intervals.
3. **Zero / Near-Zero Baselines**: When $|\text{Baseline}| < 10^{-4}$, relative division is undefined (division by zero) and suppressed.

### Standardized Parametric Distance (Z-Score)
$$Z = \frac{x_{\text{current}} - \mu}{\sigma}$$
- **Optimal Baseline**: $|Z| < 1.0\sigma$
- **Mild Fluctuation**: $1.0\sigma \le |Z| < 2.0\sigma$
- **Moderate Drift**: $2.0\sigma \le |Z| < 3.0\sigma$
- **Significant Deviation**: $|Z| \ge 3.0\sigma$

### Rolling Trend & Volatility
When $\ge 2$ observations are present in recent telemetry:
- **Slope**: Linear regression slope over recent readings:
  $$\text{slope} = \frac{\sum (t_i - \bar{t})(x_i - \bar{x})}{\sum (t_i - \bar{t})^2}$$
- **Direction**:
  - For *higher-worse* metrics (heart rate, blood pressure, glucose, respiratory rate):
    - $\text{slope} > +0.05 \implies \text{"worsening"}$
    - $\text{slope} < -0.05 \implies \text{"improving"}$
    - $|\text{slope}| \le 0.05 \implies \text{"stable"}$
  - For *lower-worse* metrics (HRV RMSSD, sleep duration, daily steps, SpO2):
    - $\text{slope} > +0.05 \implies \text{"improving"}$
    - $\text{slope} < -0.05 \implies \text{"worsening"}$
    - $|\text{slope}| \le 0.05 \implies \text{"stable"}$
- If $< 2$ valid readings exist, direction is reported as `"insufficient_data"`.

### Data Freshness & Quality Tracking
- `freshness_hours`: Elapsed hours since `observed_at`.
- `is_stale`: Flagged `true` if `freshness_hours > 24.0` hours (configurable).
- Telemetry older than 72 hours generates data staleness warnings rather than active acute physiological alarms.

---

## 4. Synthetic Baseline Walkthrough Example

Suppose a patient's resting heart rate observations over five consecutive days are:
- **Day 1**: 70 bpm
- **Day 2**: 72 bpm
- **Day 3**: 71 bpm
- **Day 4**: 73 bpm
- **Day 5**: 74 bpm

Ordered observations:
$$[70, 71, \mathbf{72}, 73, 74]\ \text{bpm}$$

1. **Personal Baseline (Median)**:
   $$\operatorname{Median}(70, 71, 72, 73, 74) = 72.0\ \text{bpm}$$

2. **Incoming Reading**: $84.0\ \text{bpm}$

3. **Absolute Deviation**:
   $$\Delta_{\text{absolute}} = 84.0 - 72.0 = +12.0\ \text{bpm}$$

4. **Relative Percentage Deviation**:
   $$\Delta_{\text{relative}} = 100 \times \frac{84.0 - 72.0}{72.0} = \frac{1200}{72} = +16.7\%$$

*Clinical Context: The new reading is 16.7% above this patient's personal baseline. Under conventional population guidelines (60–100 bpm), 84 bpm is labeled normal. SwasthyaTwin identifies this as a measurable individual deviation warranting lifestyle review (hydration, sleep, stress), without claiming proof of a medical condition.*

---

## 5. Explainable Demonstration Rules (Section C)

The platform evaluates transparent, documented demonstration rules. Every triggered flag returns the exact triggering observation, threshold rule, and plain-language explanation.

| Rule ID | Metric | Threshold | Minimum Persistence | Category | Plain-Language Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DEMO-HR-ELEV-01` | Heart Rate | $Z \ge 1.8$ | 2 readings | Informational Trend ($Z<3.0$) / Professional Review ($Z \ge 3.0$) | Resting HR exceeds personal median. Review sleep, hydration, and caffeine. |
| `DEMO-BP-SYS-ELEV-01` | Systolic BP | $Z \ge 1.8$ | 2 readings | Informational Trend ($Z<2.8$) / Professional Review ($Z \ge 2.8$) | Systolic BP exceeds personal bounds. Retest after seated rest. |
| `DEMO-BP-DIA-ELEV-01` | Diastolic BP | $Z \ge 1.8$ | 2 readings | Informational Trend ($Z<2.8$) / Professional Review ($Z \ge 2.8$) | Diastolic BP elevated compared to historical distribution. |
| `DEMO-HRV-SUPP-01` | HRV RMSSD | $Z \le -1.8$ | 1 reading | Informational Trend | Suppressed vagal HRV indicates autonomic stress or training fatigue. |
| `DEMO-SPO2-DROP-01` | SpO2 | $Z \le -2.0$ or $<94\%$ | 1 reading | Professional Review | Blood oxygen desaturation below personal baseline. Check probe; consult doctor if persistent. |
| `DEMO-SLEEP-DEF-01` | Sleep Duration | $Z \le -1.5$ | 2 nights | Informational Trend | Sleep duration consistently below personal baseline window. |
| `DEMO-STEPS-DECL-01` | Daily Steps | $Z \le -1.8$ | 3 days | Informational Trend | Step count significantly below regular ambulation routines. |
| `DEMO-GLUCOSE-ELEV-01`| Fasting Glucose | $Z \ge 1.8$ | 2 readings | Informational Trend / Professional Review ($Z \ge 3.0$) | Fasting blood sugar elevated compared to personal distribution. |
| `DEMO-RESP-ELEV-01` | Respiratory Rate| $Z \ge 1.8$ | 2 readings | Informational Trend / Professional Review ($Z \ge 2.8$) | Resting breathing rate exceeds personal baseline variation. |

### Ethical Boundaries of Rules
- **No Emergency Prediction**: Demonstration rules never claim to predict myocardial infarction, stroke, sepsis, or acute emergencies.
- **No Black-Box Probabilities**: No arbitrary percentage disease probabilities are output.
- **Categorization**: Distinguishes **Informational Lifestyle Trends** (lifestyle and recovery guidance) from **Findings Warranting Professional Review** (advising consultation with a physician).

---

## 6. Composite Health Stability Trend Indicator (Section D)

SwasthyaTwin prioritizes **individual, measurement-specific indicators**. To provide users with a single high-level orientation summary, an explainable **Experimental Health Stability Trend Indicator (0–100)** is computed.

### Mathematical Formulation
$$\text{Index} = \max\left(20.0, \min\left(100.0, 100.0 - \frac{\sum_{i \in \text{active}} w_i \times \min(30.0, E_i \times 12.0)}{\sum_{i \in \text{active}} w_i}\right)\right)$$

Where:
- $E_i = \max(0, |Z_i| - 1.0)$ is the excess standardized deviation beyond $1.0\sigma$.
- $w_i$ is the canonical metric weight:
  - Resting Heart Rate: $0.22$
  - Systolic Blood Pressure: $0.20$
  - Diastolic Blood Pressure: $0.15$
  - HRV RMSSD: $0.15$
  - Sleep Duration: $0.15$
  - Daily Physical Activity: $0.08$
  - Blood Oxygen Saturation: $0.05$

### Missing-Input Policy
If any canonical metric is not tracked for a patient, its weight is **removed from the active denominator**:
$$W_{\text{active}} = \sum_{i \in \text{active}} w_i$$
Missing metrics are recorded in `missing_inputs` and **never induce an artificial penalty or zero imputation**.

---

## 7. What-If Physiological Scenario Simulation Engine (Section E)

The counterfactual What-If engine is a **deterministic in silico simulation model** designed for lifestyle exploration.

### Core Mathematical Dynamics
Cardiovascular and autonomic adaptation follow exponential response curves with empirical physiological saturation:
$$\Delta y(t) = \Delta y_{\text{target}} \times \left(1 - e^{-t / \tau}\right)$$

### Literature-Grounded Time Constants
- **Sleep Adaptation ($\tau_{\text{sleep}} = 4.0\text{ days}$)**: Nocturnal sleep debt restoration modulates autonomic tone within 3–5 days.
- **Sodium / Fluid Balance ($\tau_{\text{sodium}} = 7.0\text{ days}$)**: Renal handling and vascular compliance adjust over approximately 1 week.
- **Aerobic Conditioning ($\tau_{\text{activity}} = 12.0\text{ days}$)**: Cardiorespiratory conditioning and endothelial nitric oxide expression adapt over 10–14 days.

### Predictive Confidence Envelope
Predictive variance widens over the forecast horizon to transparently represent biological uncertainty:
$$\text{CI}_{90\%}(t) = y(t) \pm 1.645 \times \sigma_{\text{metric}} \times \sqrt{1 + \frac{t}{T_{\text{horizon}}}}$$

### Simulation Guardrails & Non-Causal Disclaimers
1. **Historical Telemetry Immutability**: Observed historical records are never altered by running a simulation.
2. **Explicit Dual Scenarios**: Both the **Status Quo Baseline Scenario** and the **Counterfactual Hypothetical Scenario** are returned side-by-side.
3. **Non-Causal Disclosure**: Simulated outcomes do *not* claim that changing sleep or activity is guaranteed to produce a specific clinical blood pressure or heart rate reduction in an individual patient. Individual physiological responses vary according to genetics, age, medications, and comorbidities.

---

## 8. API Assessment Response Schema (Section F)

Every measurement assessment endpoint (`GET /api/v1/patients/{id}/twin/assessments/measurements`) returns:

```json
{
  "patient_id": "patient_001",
  "measurement_type": "heart_rate",
  "observed_value": 84.0,
  "personal_baseline": 72.0,
  "unit": "bpm",
  "absolute_deviation": 12.0,
  "relative_deviation_percent": 16.7,
  "trend_direction": "worsening",
  "data_quality": {
    "sample_count": 30,
    "is_sufficient": true,
    "window_days": 30,
    "outlier_count": 0,
    "volatility": 2.4,
    "data_tier": "measured"
  },
  "data_freshness": {
    "freshness_hours": 3.2,
    "is_stale": false,
    "last_observed_at": "2026-10-20T21:00:00Z",
    "staleness_threshold_hours": 24.0
  },
  "rule_id": "DEMO-HR-ELEV-01",
  "rule_version": "v1.4.0-demo",
  "explanation": "Observed 84.0 bpm deviates by +12.0 bpm (+16.7%) from personal baseline (|Z|=2.15). Resting heart rate has drifted significantly above personal median. Review sleep, hydration, and exertion.",
  "data_source": "wearable_continuous",
  "assessed_at": "2026-10-21T00:30:00Z",
  "limitations": "Heuristic demonstration comparison against personal median; not a diagnostic clinical standard."
}
```

---

## 9. Verification & Test Evidence (Section G)

The calculation engine is accompanied by a dedicated test suite in [test_calculation_engine.py](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/tests/test_calculation_engine.py) confirming:
1. **Known Numerical Baseline Example**: Validates median of $[70, 72, 71, 73, 74] = 72$ bpm, new reading $84$ bpm $\implies +12.0$ bpm absolute deviation, $+16.7\%$ relative deviation.
2. **Insufficient Observations Handling**: Validates `is_sufficient=False` and `trend_direction="insufficient_data"` when sample count is below threshold.
3. **Zero-Baseline Protection**: Prevents division by zero; sets `relative_deviation_percent=null`.
4. **Missing/Invalid Values Isolation**: Ensures `None`, `NaN`, and corrupted types are never converted to zero.
5. **Data Freshness / Staleness Detection**: Accurately computes elapsed hours and flags stale telemetry.
6. **Tukey Outlier Clamping**: Verifies that 240 bpm sensor glitches are excluded from baseline mean and median.
7. **Simulated Data Separation**: Guarantees that synthetic records are excluded from measured baselines unless explicitly requested.
8. **Misleading Relative Deviation Prevention**: Confirms relative percentage is disabled for SpO2 and temperature.
9. **Scenario Engine Determinism**: Verifies reproducible counterfactual outputs with explicit assumptions and non-causal disclaimers.
