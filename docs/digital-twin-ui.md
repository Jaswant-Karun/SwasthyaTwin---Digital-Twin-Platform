# SwasthyaTwin AI — Interactive Spatial Human Digital Twin (Step 6)

## 1. Overview & Research-Grade Interface Architecture

Step 6 delivers an interactive, futuristic human digital twin grounded in real physiological telemetry, robust longitudinal baselines, and explainable ML models. Rather than relying on generic card-based dashboard widgets, the Digital Twin interface centers the user experience around an anatomical vector topology, providing an intuitive, spatial mental model for exploring multi-organ health dynamics.

### Design Aesthetics & Technology Stack
- **Environment**: Dark graphite/midnight navy spatial canvas (`#060a14` to `#090e1a`) with fine 32px coordinate grids and subtle cyan/teal horizon illumination.
- **Accents**: Restrained cyan (`#06b6d4`), clinical teal (`#14b8a6`), electric blue (`#3b82f6`), and violet (`#a855f7`).
- **Typography**: Google Fonts Inter for readability paired with JetBrains Mono for telemetry, statistical confidence intervals, and formulas.
- **Accessibility & Motion**: Full `@media (prefers-reduced-motion: reduce)` compliance, high-contrast `:focus-visible` rings, ARIA roles (`role="region"`, `role="tablist"`, `role="button"`, `aria-pressed`, `aria-label`), and hotkey support (`1-6`, Arrow navigation, Escape to close).

---

## 2. Central Holographic Human Silhouette (Visual Anchor)

The central canvas features an interactive SVG vector silhouette with wireframe ribcage contours, meridian guide axes, and vascular/neural flow trajectories.

```
       [ 2: Sleep & Autonomic Core ]  <-- Cranium / Circadian Center
                     |
       [ 4: Respiratory Dynamics ]   <-- Thorax / Pulmonary Modulation
                     |
  [ 3: Hemodynamic BP ] --- [ 1: Cardiovascular Dynamics ] <-- Cardiac Locus
                     |
       [ 5: Glycemic Regulation ]    <-- Epigastric / Pancreatic Area
                     |
       [ 6: Kinetic Ambulation ]     <-- Femoral / Lower Extremities
```

### Mandatory Non-Diagnostic Disclosures
The interface strictly enforces ethical clinical guardrails:
- **Schematic Locator Disclosure**: A persistent banner explicitly specifies:
  > *"Schematic Vector Topology: Visual index for telemetry mapping only. Not a clinical medical scan, CT/MRI image, or anatomical diagnostic model."*
- **Zero Fabricated Scores**: The system never invents fake organ health percentages (e.g. "Liver Health 88%"), hypothetical organ failure scores, or disease probabilities.
- **Zero Imputation**: Missing metrics are explicitly flagged as *"No Telemetry Ingested"* rather than silently zero-filled or hallucinated.

---

## 3. Six Grounded Physiological Subsystems

Every selectable locus on the silhouette is strictly bound to authentic physiological parameters, verified personal baselines, and statistical formulas:

| Subsystem | Hotkey | Anatomical Locus | Underlying Metric | Sensor / Provenance Source | Mathematical Formula / Method | Algorithm Version |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **Cardiovascular Dynamics** | `1` | Left Precordial Thorax | `heart_rate`, `resting_heart_rate`, `hrv_rmssd` | Apple Watch Series 9 (Optical PPG) / Polar H10 | $\text{Score} = \frac{x_i - \tilde{x}}{1.4826 \times \text{MAD}}$ & Tukey Fences $[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$ | `v1.2.0-robust-mad` |
| **Sleep & Autonomic Core** | `2` | Cranium / Autonomic Center | `sleep_duration_hours`, 5-stage hypnogram | BiDSleep Wearable PPG Epoch Pipeline | $P(y = c \mid \mathbf{x}) = \frac{\exp(z_c)}{\sum_{k=1}^5 \exp(z_k)}$ (Softmax) | `BiDSleep LightGBM 5-Stage AASM v1.0.0` |
| **Hemodynamic Arterial Pressure** | `3` | Right Brachial Artery | `blood_pressure_systolic`, `blood_pressure_diastolic` | Validated Upper-Arm Oscillometric Cuff (Omron 10) | $\text{MAP} = \text{DBP} + \frac{1}{3}(\text{SBP} - \text{DBP})$, $PP = SBP - DBP$ | `AHA/ACC 2017 Standardized Corridor` |
| **Respiratory Dynamics** | `4` | Thoracic Cavity / Lungs | `respiratory_rate` | Wearable Impedance Pneumography / Optical Modulation | Spectral peak respiration frequency with 6-60 bpm bounds | `Ventilatory Corridor v1.1` |
| **Glycemic Regulation** | `5` | Epigastric / Pancreatic Area | `fasting_blood_glucose` | Fasting Fingerstick Capillary Glucometer | 30-day baseline corridor with physiological inversion plausibility guards | `ADA 2024 Fasting Corridor` |
| **Kinetic Ambulation** | `6` | Lower Extremities / Locomotor | `daily_steps` | Tri-Axial Wearable Accelerometer / Pedometer | $\bar{x}_{7d} = \frac{1}{7}\sum_{i=1}^7 x_{t-i}$ with non-wear audit ($<500$ steps flagged) | `Actigraphy Cadence v2.0` |

---

## 4. Interactive Health Timeline & Signal Overlays

The interactive timeline (`SpatialTimelineInspector`) combines continuous time-series visualization with an event-driven audit stream:

### A. Continuous Longitudinal Trajectory
- **Observed Telemetry**: Solid colored curve showing verified historical measurements.
- **Personal Baseline Corridor**: Shaded band representing $\pm 1.5\sigma$ or the $[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$ Tukey corridor.
- **AI Projected Trajectory**: Dashed curve illustrating the 7-day predictive forecast generated by autoregressive exponential smoothing with strict chronological split.
- **Handover Marker**: Vertical dashed cyan line at "NOW", guaranteeing complete visual transparency between past reality and future projections.
- **Lookback Controls**: Rapid toggling across 14-day, 30-day, and 90-day historical evaluation windows.

### B. Signal Overlays
- Hovering over any event in the timeline feed immediately projects a highlight ring and beacon glow onto the corresponding anatomical node on the central silhouette.
- Dashed coordinate callout lines connect the active anatomical hotspot to the right telemetry inspection card.

---

## 5. Multi-Signal Event Stream & Mathematical Explanation Panel

Selecting any timeline event expands a granular, transparent explanation panel revealing the internal mathematical computation:

1. **Actual Values**: Observed reading, historical median, dispersion metric (IQR / nMAD), and absolute deviation.
2. **Standardized Scores**: Robust Z-scores ($\sigma$) and relative shift percentages.
3. **Exact Mathematical Formula**: LaTeX formula representation with code block formatting.
4. **Model Architecture**: Exact model names (e.g. `LightGBM 5-Stage AASM v1.0.0`), training features (e.g. 30s optical PPG features), and sample counts.
5. **Softmax Confidence Distribution**: For sleep predictions, an interactive bar graph shows probability allocations across all 5 AASM stages (`Wake`, `N1`, `N2`, `N3`, `REM`).
6. **Provenance Verification**: Validates sensor source, measurement method, timestamp, and time zone.
7. **Clinical Limitations**: Explicit statement detailing what the measurement can and cannot establish.

---

## 6. Provenance Classification Tiers

To ensure data integrity, every piece of telemetry in the interface carries a standardized provenance badge:

| Provenance Tier | Color Token | Badge Style | Clinical Meaning |
| :--- | :---: | :--- | :--- |
| **MEASURED** | Teal (`#14b8a6`) | Solid teal chip | Direct sensor readings from verified physical hardware (BLE optical PPG, oscillometric cuff, glucometer). |
| **DERIVED** | Cyan (`#06b6d4`) | Cyan border chip with $\Sigma$ | Mathematically transformed metrics (MAP, Pulse Pressure, 30-day rolling median, robust Z-scores). |
| **MODEL PREDICTED** | Purple (`#a855f7`) | Purple spark chip | Probabilistic AI inferences (BiDSleep 5-stage hypnogram, 7-day autoregressive trend forecasting). |
| **SIMULATED** | Amber (`#f59e0b`) | Dashed amber border | In-silico parameter adjustments generated in the What-If Scenario Lab. |
| **SYNTHETIC** | Fuchsia (`#d946ef`) | Fuchsia flask chip | Controlled research demonstration cohort profiles. |

---

## 7. State Handling & Data Integrity

The UI cleanly handles and communicates all data states:

- **Active / Optimal**: Fresh observations within normal corridors with live pulse animation.
- **Stale Telemetry Notice**: When the latest observation is older than 48 hours, an amber badge warning is displayed (`STALE TELEMETRY (>48h)`), indicating that baseline stability calculations are provisional.
- **Insufficient History Gate**: When fewer than 14 observations exist for a subsystem, the interface flags an `Insufficient History Gate`, informing the user that statistical fences require sufficient samples to prevent false alarms.
- **Missing Data State**: For unrecorded metrics, the UI displays `No Telemetry Ingested` and leaves the locus disabled, avoiding synthetic hallucinations.
- **Loading State**: Accessible spinner with animated status indicators.
- **API Error State**: Non-blocking alert strip with a `Retry Sync` action button that allows graceful degradation to verified client-side caches.

---

## 8. Patient Switching

A persistent patient switcher dropdown is integrated into the Digital Twin navigation bar:
- Instantly toggles between patient profiles (e.g. `PT-1001 Aarav Mehta`, `PT-1002 Priya Sharma`, `PT-1003 Devan Nair`, `PT-1004 Sunita Rao`).
- Dynamically updates patient metadata, conditions, lifestyle targets, active telemetry layers, body node values, baseline corridors, and timeline feeds without requiring a page reload.

---

## 9. Keyboard Accessibility & Reduced Motion

- **Hotkeys**: Pressing keys `1`, `2`, `3`, `4`, `5`, or `6` immediately selects the corresponding anatomical subsystem.
- **Arrow Keys**: Pressing `ArrowUp`, `ArrowDown`, `ArrowLeft`, or `ArrowRight` cycles through available nodes.
- **Escape Key**: Dismisses any open explanation modal or event detail drawer.
- **Reduced Motion**: Under `@media (prefers-reduced-motion: reduce)`, scanning laser animations, cardiac pulse effects, and continuous spinners are disabled.

---

## 10. Verification & Test Suite

The interface is validated by automated frontend test suites in `frontend/src/tests/DigitalTwinStep6.test.tsx` using Vitest and React Testing Library:

- **Patient Switching**: Verified dynamic updates when toggling between patient cohorts.
- **Subsystem Selection**: Verified all 6 anatomical nodes and deep-dive metadata rendering.
- **Hotkey Navigation**: Verified keys `1-6` activate appropriate nodes.
- **Event Explanation**: Verified timeline event click opens mathematical breakdown with model version and limitations.
- **Signal Overlays**: Verified hovering timeline events highlights target body node.
- **Absence of Fabricated Data**: Formally tested to ensure no fake organ health scores or disease probabilities exist in the DOM.

**Test Run Output**:
```
✓ src/tests/DigitalTwinStep6.test.tsx (11 tests) 5039ms
  ✓ Step 6: Interactive Spatial Human Digital Twin (11)
    ✓ 1. SpatialHumanTwin Central Visualization & Grounded Subsystems (5)
      ✓ renders the central holographic silhouette and non-diagnostic locator disclosure
      ✓ renders all 6 grounded anatomical subsystems linked only to supported data
      ✓ displays deep-dive telemetry with formula, algorithm version, and limitations when selected
      ✓ invokes onSelectNode when a subsystem node or button is clicked
      ✓ supports rapid hotkey navigation (keys 1-6)
    ✓ 2. Interactive Health Timeline & Multi-Signal Event Explanations (4)
      ✓ renders the longitudinal area chart with lookback windows and metric options
      ✓ renders multi-signal timeline events with provenance badges (MEASURED, MODEL PREDICTED, DERIVED)
      ✓ opens detailed mathematical explanation panel when a timeline event is clicked
      ✓ triggers body node highlighting when hovering over a timeline event
    ✓ 3. Patient Switching & Full Experience Coordination (2)
      ✓ renders patient switcher dropdown in DigitalTwinPage and displays cohort members
      ✓ verifies absence of invented organ scores or disease probabilities

Test Files  1 passed (1)
     Tests  11 passed (11)
```
