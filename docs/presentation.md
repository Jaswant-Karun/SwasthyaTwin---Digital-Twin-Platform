# SwasthyaTwin — Hackathon Presentation Deck Outline

**Title:** SwasthyaTwin — A Personalized Healthcare Digital Twin for Early Risk Detection and Preventive Intervention  
**Format:** 5–7 Minute Presentation + 3-Minute Live Interactive Demonstration  
**Theme:** Understand today. Prepare for tomorrow.  

---

## Slide 1: Title & Hook
- **Visual:** Midnight navy canvas, glowing digital twin human silhouette, pulse line.
- **Hook:** *"What if your wearable didn't compare your heart rate to an arbitrary statistical average of 100,000 strangers, but compared you to yourself?"*
- **Introduction:**
  - Product Name: **SwasthyaTwin**
  - Team / Project Lead: Senior Full-Stack & Healthcare AI Engineers
  - Tagline: *Understand today. Prepare for tomorrow.*

---

## Slide 2: The Critical Healthcare Flaw (The Problem)
- **The Status Quo:**
  - Modern fitness trackers and health apps rely on **generic population averages** (e.g., standard 60–100 bpm resting heart rate).
  - An elite endurance runner with a resting HR of 44 bpm drifting to 62 bpm is in acute overtraining or autonomic exhaustion, yet generic apps label it "Normal".
  - A sedentary hypertensive patient experiencing creeping 2-week blood pressure elevation gets ignored until an acute crisis occurs.
- **The Black-Box Dilemma:**
  - Proprietary "Sleep Scores" and "Readiness Scores" give opaque numbers without explainability. Clinicians cannot audit or trust them.

---

## Slide 3: The SwasthyaTwin Paradigm Shift (The Solution)
- **Core Innovation 1: Anti-Population Norm Architecture**
  - Calculates patient-specific rolling baselines ($\mu_{\text{self}}, \sigma_{\text{self}}, \text{Median}, \text{IQR}$).
  - Identifies drift based on individual $Z$-scores, respecting personal physiology.
- **Core Innovation 2: 100% Explainable Vitality Index (0–100)**
  - Zero black-box probabilities. Every point deducted from 100 is attributed to a specific metric's statistical divergence and explained in plain language.
- **Core Innovation 3: Counterfactual *In Silico* What-If Simulator**
  - Allows patients and clinicians to simulate hypothetical lifestyle adjustments (sleep, steps, stress, sodium) before executing them in real life.

---

## Slide 4: System Architecture & Technical Rigor
- **Modern Full-Stack Engineering:**
  - **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts (Responsive, WCAG-compliant).
  - **Backend:** Python 3.11+, FastAPI, Pydantic v2 (Strict clinical unit & schema validation).
  - **Database:** MongoDB 7.0 (Compound indexes on `patient_id` and timestamps for longitudinal queries).
  - **Resilience:** Automatic in-memory `mongomock` fallback ensuring 100% zero-crash availability.
- **Strict 3-Tier Data Provenance:**
  - `Tier 1: Measured` (Wearables, Labs)
  - `Tier 2: User Reported` (Manual entries)
  - `Tier 3: Simulated` (What-If forecasts — never commingled with real telemetry)

---

## Slide 5: Live Demonstration (3-Minute Tour)
*(See `docs/demo-script.md` for exact narration)*
1. **The Overview Dashboard:**
   - Real-time MongoDB readiness probe (`MongoDB (0.8ms)`).
   - Baseline Corridor: Shaded $\mu \pm 1.5\sigma$ envelope.
2. **Patient Switching (Aarav Mehta → Priya Sharma):**
   - Instant re-rendering with race condition protection.
3. **Surveillance Alert Center:**
   - Reviewing an elevated resting HR alert and acknowledging it persistently with notes.
4. **Counterfactual What-If Simulator:**
   - Dragging sleep from 5.5h to 7.5h and adding 3,000 steps.
   - Running simulation: viewing exponential saturation recovery curve and explicit model assumptions.
5. **Real-time Live Telemetry Ingest:**
   - Ingesting a new observation from the timeline: immediate twin update without page reload!

---

## Slide 6: Safety, Security & Clinical Governance
- **Healthcare Safety Disclaimers:**
  - Clearly designated as a prototype research platform.
  - Transparent guardrails prevent simulated data from masquerading as actual measurements.
- **Privacy & Security:**
  - Zero hardcoded secrets; automated password masking in database URIs.
  - Audit logging automatically scrubs sensitive credentials and authorization tokens.
  - Safe demo reset cannot wipe real patient records.

---

## Slide 7: Future Vision & Commercial Roadmap
- **Near-Term (3–6 Months):**
  - Apple HealthKit & Garmin Health real-time WebSocket connectors.
  - SMART-on-FHIR integration for Epic and Cerner EHR connectivity.
- **Long-Term:**
  - Multi-organ pharmacodynamic digital twins for chronic disease intervention (Diabetes, Hypertension, Heart Failure).
- **Closing:**
  - *"SwasthyaTwin moves digital healthcare from reactive crisis management to proactive, personalized biological foresight."*
  - **Q&A / Interactive Panel Demonstration**
