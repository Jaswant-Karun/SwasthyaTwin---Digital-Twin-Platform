# SwasthyaTwin Methodology & Scientific Foundations

## 1. Baseline Computation Methodology

A personalized baseline is computed from the patient's historical observation window (default: past 30 days, configurable per patient).

### Mathematical Formulation

Given a series of daily or discrete measurements $X = \{x_1, x_2, \dots, x_N\}$ for metric $m$ over baseline window $W$:

1. **Robust Mean & Standard Deviation**:
   $$\mu_m = \frac{1}{N}\sum_{i=1}^N x_i$$
   $$\sigma_m = \sqrt{\frac{1}{N-1}\sum_{i=1}^N (x_i - \mu_m)^2}$$

2. **Non-Parametric Interquartile Dispersion**:
   $$IQR_m = Q_3(X) - Q_1(X)$$
   $$\text{Median}_m = Q_2(X)$$
   Used to cross-validate against outliers (such as transient exercise spikes).

---

## 2. Deviation & Drift Detection (Z-Score Standardizing)

When evaluating the current observation period (e.g., past 7-day rolling average $\bar{x}_{current}$):

$$Z_m = \frac{\bar{x}_{current} - \mu_m}{\sigma_m}$$

### Categorization Tiers:
- **Optimal / Stable**: $|Z_m| < 1.0$ (within typical daily biological variation)
- **Mild Deviation**: $1.0 \le |Z_m| < 2.0$ (subtle shift; worth monitoring)
- **Moderate Drift**: $2.0 \le |Z_m| < 3.0$ (multi-day divergence from baseline)
- **Significant Deviation**: $|Z_m| \ge 3.0$ (pronounced deviation requiring review)

---

## 3. Vitality & Health Stability Index (0 - 100)

The overall Health Stability Index $S$ provides an explainable aggregate indicator across critical vital categories (Cardiovascular, Autonomic/HRV, Sleep Architecture, Metabolic/Activity):

$$S = 100 - \sum_{k=1}^K w_k \cdot \min\left(25, \; \max(0, \; (|Z_k| - 1.0) \times 12)\right)$$

Where $w_k$ is the normalized clinical relevance weight of biometric $k$.
- Every point deduction is mathematically linked to the offending metric's Z-score deviation in the explainability payload.

---

## 4. What-If Simulation Engine Mechanics

The digital twin models physiological adaptation using validated empirical physiological decay & recovery kinetics:

1. **Sleep Extension Response**:
   Increasing sleep duration by $\Delta S$ hours attenuates sympathetic tone, progressively decreasing resting heart rate:
   $$\Delta \text{RHR}(t) = -\alpha_{hr} \cdot \Delta S \cdot \left(1 - e^{-t / \tau_{sleep}}\right)$$
   where $\tau_{sleep} \approx 4.5\text{ days}$, $\alpha_{hr} \approx 1.8\text{ bpm/hr}$.

2. **Daily Physical Activity Response**:
   Increasing daily steps by $\Delta A$ improves cardiorespiratory fitness and vascular compliance:
   $$\Delta \text{BP}_{sys}(t) = -\beta_{bp} \cdot \left(\frac{\Delta A}{2000}\right) \cdot \left(1 - e^{-t / \tau_{act}}\right)$$
   where $\tau_{act} \approx 14\text{ days}$, $\beta_{bp} \approx 2.4\text{ mmHg}$.

3. **Confidence Bounds**:
   Forecasts generate a 90% confidence ribbon derived from the individual's baseline variance $\sigma_m$:
   $$\text{Upper}(t) = \hat{y}(t) + 1.645 \cdot \sigma_m \cdot \sqrt{1 + \frac{t}{30}}$$
   $$\text{Lower}(t) = \hat{y}(t) - 1.645 \cdot \sigma_m \cdot \sqrt{1 + \frac{t}{30}}$$

---

## 5. Ethical & Safety Guardrails
- **Non-Diagnostic**: The system strictly maps statistical divergence and hypothetical trajectories.
- **Explainability**: No black-box outputs; every alert provides the trigger value, reference baseline, and percentage delta.
