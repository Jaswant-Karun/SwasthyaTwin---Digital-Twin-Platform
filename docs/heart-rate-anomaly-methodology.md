# SwasthyaTwin AI — Personalized Heart-Rate Anomaly Intelligence Methodology

**Algorithm Version**: `v1.2.0-robust-mad`  
**Standard**: Non-Parametric Normalized Median Absolute Deviation (nMAD)  
**Safety Notice**: This module performs personal statistical self-tracking. It is **not** a clinical diagnostic tool and does **not** detect, diagnose, or treat cardiac arrhythmias, myocardial ischemia, or heart disease.

---

## 1. Motivation: Why Population Thresholds Fail

Standard clinical reference charts typically define normal resting heart rate as **60–100 bpm**. When applied to continuous wearable streams, these static thresholds introduce substantial error:
- **Athletes & High-Fitness Individuals**: Frequently exhibit normal sinus bradycardia (42–52 bpm). A static cutoff flags them as pathological false positives.
- **Naturally Elevated Resting Corridors**: Individuals whose normal baseline is 78–82 bpm may experience a sharp autonomic strain surge to 98 bpm (a +18 bpm shift), yet static thresholds fail to flag it because it remains below 100 bpm.

**SwasthyaTwin Solution**: Anomaly detection benchmarked strictly against the individual's own recent historical baseline, using robust non-parametric statistics.

---

## 2. Mathematical Foundation

### A. Non-Parametric Median Baseline
Given a chronological series of validated observations $X = \{x_1, x_2, \dots, x_N\}$ within a historical window $W$ (default: 30 days):
$$\text{Baseline Median } \tilde{x} = \text{median}(X)$$

The median is chosen over the arithmetic mean because it has a breakdown point of 50%, preventing anomalous workout surges, transient stress events, or motion artifacts from corrupting the baseline.

### B. Normalized Median Absolute Deviation (nMAD)
Variability is estimated using the Median Absolute Deviation (MAD):
$$\text{raw\_MAD} = \text{median}(|x_i - \tilde{x}|)$$
To achieve asymptotic consistency with the standard deviation of a normal distribution, raw MAD is multiplied by $1.4826$:
$$\text{nMAD} = 1.4826 \times \text{raw\_MAD}$$

### C. Safe Variability Floor ($\epsilon$)
If an individual logs identical or near-identical resting measurements (e.g., during immobilized bedrest), $\text{raw\_MAD} \to 0$. To prevent division-by-zero or infinite scores:
$$\sigma_{\text{robust}} = \max(\text{nMAD}, \epsilon_{\text{floor}})$$
Where default $\epsilon_{\text{floor}} = 1.0\text{ bpm}$.

### D. Modified $Z$-Score
For any observation $x_{\text{eval}}$ at timestamp $t_{\text{eval}}$:
$$\text{Modified } Z = \frac{x_{\text{eval}} - \tilde{x}_{t < t_{\text{eval}}}}{\sigma_{\text{robust}}}$$
$$\Delta_{\text{abs}} = x_{\text{eval}} - \tilde{x} \quad (\text{bpm})$$
$$\Delta_{\%} = \left(\frac{x_{\text{eval}} - \tilde{x}}{\tilde{x}}\right) \times 100\%$$

---

## 3. Strict Chronological Gating & Non-Contamination

To prevent evaluation bias and data leakage:
1. **Self-Exclusion**: The evaluated reading $x_{\text{eval}}$ is **never** included in its own baseline:
   $$X_{\text{base}} = \{x \in X \mid t_x < t_{\text{eval}}\}$$
2. **Zero Future Leakage**: No observation recorded at $t \ge t_{\text{eval}}$ can influence $\tilde{x}$ or nMAD.
3. **Data-Quality Pre-Filtering**: Observations flagged as `rejected`, `invalid`, or `simulated` are excluded from $X_{\text{base}}$.
4. **Honest Abstention**: If $|X_{\text{base}}| < N_{\min}$ (default $N_{\min} = 10$), the algorithm abstains and returns `status: "insufficient_data"` rather than fabricating a provisional baseline.

---

## 4. Anomaly Classification Rules

| Status | Mathematical Rule | Clinical Context |
| :--- | :--- | :--- |
| `insufficient_data` | Prior eligible observations $N < 10$ | Not enough history to establish an individual baseline corridor. |
| `within_personal_range` | $|\text{Modified } Z| < 2.5$ | Typical biological fluctuations within individual tolerance. |
| `unusual_high` | $\text{Modified } Z \ge +2.5$ | Elevated above personal distribution (potential stress, illness, poor recovery). |
| `unusual_low` | $\text{Modified } Z \le -2.5$ | Depressed below personal distribution. |
| `review_data_quality` | $|\text{Modified } Z| \ge 2.5$ AND validation warnings present | Statistical divergence accompanied by sensor noise or motion artifact warnings. |

---

## 5. Non-Diagnostic Clinical Boundaries

1. **Not an Arrhythmia Detector**: Wearable photoplethysmography (PPG) calculates aggregate pulse rate, not cardiac electrical conduction.
2. **Not an Emergency Alerter**: A reading marked `unusual_high` reflects personal statistical divergence, not clinical diagnosis of tachycardia or ischemia.
3. **Motion Artifact Disclaimer**: Consumer wearables frequently report spurious deviations during high-motion activity or loose sensor contact.
