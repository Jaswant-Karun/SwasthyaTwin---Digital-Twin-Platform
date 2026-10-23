# SwasthyaTwin AI: What-If Counterfactual Simulator Specification

## 1. Executive Summary & Core Design Architecture

The SwasthyaTwin **What-If Scenario Simulator** is an in-silico physiological experimentation environment. It allows clinicians, researchers, and patients to model hypothetical counterfactual adjustments to daily lifestyle inputs without compromising, modifying, or contaminating the patient's verified longitudinal observation history.

### Core Architectural Guarantees:
1. **Measured vs. Simulated Data Separation**:
   - Patient measured observations (`db.observations`) are **strictly immutable** during simulation runs.
   - Simulation outputs are flagged with `data_tier: "simulated"` and stored in a segregated collection (`db.simulations`).
   - Counterfactual curves are visually differentiated in the UI with distinct colors, amber provenance badges, and dashed trajectory styles.
2. **Deterministic Adaptation Kinetics & Empirical Machine Learning**:
   - Physiological adaptation curves are modeled using pharmacodynamic saturation kinetics backed by clinical recovery literature.
   - Autonomic risk migrations and 14-day vitality deltas are cross-validated by SwasthyaTwin's trained Gradient Boosting Regressor and Random Forest Classifier.
3. **No Fabricated Causal Inevitability**:
   - The simulator **strictly rejects** causal certainty. Adjusting a slider represents an *illustrative mathematical projection*, not guaranteed clinical disease prevention or medical advice.
4. **Contradiction & Biological Implausibility Guards**:
   - Contradictory inputs (e.g., severe sleep deprivation combined with high-volume endurance loading) are blocked at both the schema validator level and the frontend control layer.

---

## 2. Supported Scenarios & Parameters

### A. Supported Hypothetical Inputs
Each scenario supports four bounded lifestyle levers and an adjustable time horizon:

| Input Parameter | Units | Valid Range | Default | Physiological Meaning & Literature Grounding |
| :--- | :--- | :--- | :--- | :--- |
| **`delta_sleep_hours`** | hours/night | $[-4.0, +4.0]$ | $0.0$ | Nocturnal sleep duration extension or restriction. Models parasympathetic tone recovery ($\tau_{\text{sleep}} \approx 4.0\text{d}$). |
| **`delta_daily_steps`** | steps/day | $[-8000, +15000]$ | $0$ | Physical step volume shift. Models baroreflex sensitivity and active energy adaptation ($\tau_{\text{activity}} \approx 12.0\text{d}$). |
| **`delta_stress_level`** | % shift | $[-50.0, +50.0]$ | $0.0$ | Subjective autonomic stress/strain modulation. Alters sympathetic arousal ($k_{\text{hrv}} = 0.25\text{ ms/\%}$). |
| **`sodium_reduction_pct`** | % cut | $[0.0, 50.0]$ | $0.0$ | Dietary sodium moderation. Models reduction in peripheral vascular resistance ($\tau_{\text{sodium}} \approx 7.0\text{d}$). |
| **`duration_days`** | days | $[7, 90]$ | $30$ | Simulation trajectory evaluation window ($14, 30, 60, 90$ days). |

### B. Contradiction & Exclusion Rules
- **Contradiction Guard**: If $\Delta\text{sleep} \le -2.5\text{h}$ and $\Delta\text{steps} \ge +6000\text{ steps}$, the engine raises a `ValueError` (`"Contradictory scenario parameters: Severe sleep restriction combined with high-volume step increase exceeds biological adaptive capacity"`).
- **Outlier Enforcement**: Values outside $[-4.0, +4.0]\text{h}$ or $[-8000, +15000]\text{ steps}$ are rejected with Pydantic validation errors (`422 Unprocessable Entity`).

---

## 3. Supported vs. Unsupported Claims

| Claim Type | Status | Specification |
| :--- | :--- | :--- |
| **Autonomic Adaptation Trajectory** | **Supported** | Mathematical modeling of heart rate reduction and HRV increase under sustained sleep and exercise adherence. |
| **14-Day Vitality Index Shift** | **Supported** | Machine learning counterfactual estimate using Gradient Boosting Regressor trained on continuous biometric features. |
| **Autonomic Risk Tier Migration** | **Supported** | Classification of stress vs. resilience using the trained Random Forest Classifier. |
| **Clinical Cure or Disease Reversal** | **UNSUPPORTED** | **Strictly prohibited**. The simulator never claims that walking $+3000$ steps will "cure hypertension" or "prevent myocardial infarction". |
| **Pharmacological Equivalence** | **UNSUPPORTED** | **Strictly prohibited**. Dietary and sleep sliders must never be compared to prescription anti-hypertensive medication. |
| **Guaranteed Physiological Outcome** | **UNSUPPORTED** | **Strictly prohibited**. All trajectories include expanding 95% confidence intervals to convey mathematical uncertainty. |

---

## 4. Output Semantic Classification

Every metric presented in the simulator workspace is categorized by its scientific derivation:

```
+-----------------------------------------------------------------------------------------+
| Output Metric        | Semantic Tier              | Mathematical Derivation             |
+-----------------------------------------------------------------------------------------+
| Resting Heart Rate   | Deterministic Calculation  | Exponential saturation kinetics     |
| Systolic BP          | Deterministic Calculation  | Baroreflex & vascular resistance    |
| HRV (RMSSD)          | Deterministic Calculation  | Autonomic parasympathetic recovery  |
| Vitality Index       | Hybrid Calculation         | 50% Kinetic + 50% Gradient Boosting |
| Autonomic Risk Tier  | Model Prediction           | Random Forest Classifier            |
| Lifestyle Adherence  | Illustrative Assumption    | Sustained 100% adherence (assumed)  |
+-----------------------------------------------------------------------------------------+
```

---

## 5. Mathematical Modeling & Uncertainty Quantification

### 1. Physiological Saturation Kinetics:
The daily physiological response $R(t)$ for each intervention lever follows exponential recovery kinetics:
$$R_{\text{sleep}}(t) = 1 - e^{-t / \tau_{\text{sleep}}}, \quad R_{\text{act}}(t) = 1 - e^{-t / \tau_{\text{activity}}}, \quad R_{\text{sod}}(t) = 1 - e^{-t / \tau_{\text{sodium}}}$$
where $\tau_{\text{sleep}} = 4.0\text{d}$, $\tau_{\text{activity}} = 12.0\text{d}$, $\tau_{\text{sodium}} = 7.0\text{d}$.

### 2. Metric Perturbation Equations:
$$\Delta\text{RHR}(t) = -k_{\text{hr\_sleep}} \cdot \Delta\text{sleep} \cdot R_{\text{sleep}}(t) - \frac{\Delta\text{steps}}{4000} \cdot 1.2 \cdot R_{\text{act}}(t) + \frac{\Delta\text{stress}}{20} \cdot 1.5 \cdot R_{\text{sleep}}(t)$$
$$\Delta\text{SBP}(t) = -\Delta\text{steps} \cdot k_{\text{bp\_act}} \cdot R_{\text{act}}(t) - \text{sod}_{\%} \cdot k_{\text{bp\_sod}} \cdot R_{\text{sod}}(t) - \Delta\text{sleep} \cdot 1.1 \cdot R_{\text{sleep}}(t)$$
$$\Delta\text{HRV}(t) = \Delta\text{sleep} \cdot k_{\text{hrv\_sleep}} \cdot R_{\text{sleep}}(t) - \Delta\text{stress} \cdot k_{\text{hrv\_stress}} \cdot R_{\text{sleep}}(t) + \frac{\Delta\text{steps}}{5000} \cdot 2.5 \cdot R_{\text{act}}(t)$$

### 3. Expanding Uncertainty Corridor (95% CI):
$$\text{CI}_{95\%}(t) = \pm \sigma_{\text{residual}} \cdot \left(1.0 + \frac{t}{T} \cdot 0.8\right)$$
- Resting Heart Rate: $\pm 2.5\text{ bpm}$ (Day 1) expanding to $\pm 4.5\text{ bpm}$ (Day 30).
- Systolic Blood Pressure: $\pm 3.8\text{ mmHg}$ expanding to $\pm 6.8\text{ mmHg}$.

---

## 6. Verification and Regression Testing Matrix

| Test Suite | File | Tests | Status | Focus Areas |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | `backend/tests/test_what_if_simulator.py` | 6 | **PASSED** | Deterministic reproducibility, input validation ranges, contradiction detection, patient isolation, non-mutation of real observations, output classification. |
| **Frontend Component Tests** | `frontend/src/tests/WhatIfSimulatorStep8.test.tsx` | 4 | **PASSED** | Locked measured baseline anchors, contradiction warning trigger, side-by-side comparison cards, reset action. |
| **Regression Suite (Step 6)** | `frontend/src/tests/DigitalTwinStep6.test.tsx` | 11 | **PASSED** | Anatomical silhouette, timeline event inspection, provenance badges. |
| **Regression Suite (Step 7)** | `frontend/src/tests/TrendForecastingStep7.test.tsx` | 3 | **PASSED** | Personal trend forecasting, held-out evaluation, persistence baselines. |
| **Production Build** | `npm run build` | Bundle | **PASSED** | Clean Vite build in 3.17s. |
