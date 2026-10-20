# SwasthyaTwin — Synthetic Demonstration Dataset Architecture & Verification Report

## Executive Summary

SwasthyaTwin features a production-grade, deterministic, and repeatable **Synthetic Demonstration Dataset** comprising **5 fictional patient profiles** and **2,833 longitudinal physiological observations** spanning a 90-day baseline window. Every record is strictly quarantined with `demo_data: True` and explicit synthetic tags, ensuring non-destructive operations that never alter or delete real patient data.

The system features an automated one-command seed and reset workflow, a dynamic **Demo Banner** with a real-time patient selector, and a **Live Demonstration Mode** capable of ingesting acute telemetry packets, instantly recomputing the Digital Twin's vitality index and alert states, and highlighting newly arrived observations with visual badges.

---

## 1. Synthetic Patient Cohort Specifications

All identities are entirely fictional, created with deterministic random seeds (`random.seed(42)`) to ensure identical repeatability across environments.

| Patient ID | Fictional Identity | Age / Sex | Physiological Archetype | 90-Day Telemetry Pattern | Documented Deviation / Incomplete Data |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`PT-1001`** | **Aarav Mehta** | 38 / M | **Circadian Strain & Sleep Drift** | Stable baseline days 0–75 (HR ~64 bpm, HRV ~56 ms, Sleep 7.5h). Days 75–90: sleep deficit drift (7.5h $\to$ 4.8h), HR climbs to 78 bpm, HRV drops to 34 ms, resp rate increases from 14 to 17.5 rpm. | **Acute Crisis (Day 85):** 3.8h sleep, HR 83.2 bpm, HRV 27.5 ms.<br>**Incomplete Data:** Wearable battery depleted on days 22 & 54; glucose measured bi-weekly. |
| **`PT-1002`** | **Priya Sharma** | 54 / F | **Cardiovascular Lifestyle Optimization** | Pre-intervention days 0–15: SBP ~142 mmHg, DBP ~92 mmHg, steps ~3800. Days 15–90: DASH diet + aerobic walking, steady normalization to SBP ~124 mmHg, DBP ~80 mmHg, steps ~8200. | **Dietary Indiscretion (Day 48):** Transient SBP spike to 138.5 mmHg, glucose 118 mg/dL.<br>**Incomplete Data:** Home BP cuff used 3 days/week; glucose logged weekly. |
| **`PT-1003`** | **Devan Nair** | 28 / M | **Athletic Conditioning & Autonomic Overreaching** | High fitness baseline days 0–70: resting HR ~48 bpm, HRV ~86 ms, steps ~14,000. Days 70–90: high-volume training overload with inadequate recovery; HR climbs to 63 bpm, HRV drops to 38 ms. | **Overreaching Spike (Day 83):** Acute parasympathetic suppression (HR 67.5 bpm, HRV 31.0 ms).<br>**Incomplete Data:** Missing telemetry during 2 backcountry weekend runs. |
| **`PT-1004`** | **Sunita Rao** | 67 / F | **Healthy Senior Baseline & High Stability** | Exemplifies healthy aging: resting HR ~70.5 bpm ($\pm 1.6$), SBP ~124/78 mmHg, steady sleep ~7.2h, steps ~5800. Tests robust stability without false positive alerts. | **Graceful Handling:** Removes smartwatch every 3rd weekend (~15 missing days over 90 days); BP measured bi-weekly at community clinic; glucose monthly. |
| **`PT-1005`** | **Kabir Sen** | 44 / M | **Sedentary Desk Ergonomics & Weekend Cyclist** | Bimodal distribution: Mon–Fri sedentary routine (steps ~4400, HR ~72 bpm, SBP ~124 mmHg). Sat–Sun gravel cycling spikes (steps ~15,500, post-exercise sympathetic lag on Mondays). | **Century Ride (Day 76):** 19,500 steps, HR 81.5 bpm, HRV 28.5 ms.<br>**Incomplete Data:** Fasting glucose completely untracked (validating missing input weight normalization). |

---

## 2. Telemetry Modalities & Standardized Units

All generated observations conform to Pydantic schema validation with timezone-aware UTC timestamps and standardized units:

- **Resting Heart Rate (`heart_rate`):** `bpm` (optical PPG wearable stream)
- **Blood Pressure Systolic / Diastolic (`blood_pressure_systolic`, `blood_pressure_diastolic`):** `mmHg` (manual home cuff + clinical lab)
- **Heart Rate Variability (`hrv_rmssd`):** `ms` (vagally-mediated autonomic recovery)
- **Sleep Duration (`sleep_duration_hours`):** `hours` (wearable somnography)
- **Daily Physical Activity (`daily_steps`):** `steps` (accelerometer continuous tracking)
- **Respiratory Rate (`respiratory_rate`):** `breaths/min` (resting respiratory frequency)
- **Blood Oxygen Saturation (`spo2`):** `%` (pulse oximetry)
- **Fasting Blood Glucose (`fasting_blood_glucose`):** `mg/dL` (capillary fingerstick & lab panel)

---

## 3. Workflows & Live Demonstration Mode

### A. One-Command CLI Management
The dedicated CLI utility [`backend/scripts/seed_demo.py`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/backend/scripts/seed_demo.py) allows one-command management:

```bash
# Seed synthetic cohort (idempotent, skips if already present)
python backend/scripts/seed_demo.py

# Force re-seed all 5 synthetic profiles with fresh 90-day baselines
python backend/scripts/seed_demo.py --force

# Safely delete ONLY demo records (preserves all real user accounts)
python backend/scripts/seed_demo.py --reset

# Simulate live telemetry packet injection and recompute twin state
python backend/scripts/seed_demo.py --live-inject --patient PT-1001 --metric heart_rate --value 88.5
```

### B. REST API Endpoints
- **`POST /api/v1/seed?force=true`**: Triggers idempotent or forced generation of the 5 synthetic patient profiles and 2,833 observations.
- **`POST /api/v1/seed/reset?confirm=true`**: Requires explicit confirmation (`confirm=true`). Non-destructively removes only records with `demo_data: true` or demo IDs.
- **`POST /api/v1/seed/live-observation`**: Accepts payload `{"patient_id": "PT-1001", "metric_type": "heart_rate", "value": 92.5}`. Ingests the packet, dynamically re-evaluates statistical baselines, updates active alerts, recalculates the Health Stability Index, and returns the updated Digital Twin state.

### C. Frontend Demo Experience
1. **Demo Banner ([`DemoBanner.tsx`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/frontend/src/components/common/DemoBanner.tsx)):**
   - Visible across all application pages.
   - Displays clear synthetic disclaimers and deterministic seed metadata (`seed=42`).
   - Integrated **Patient Selector** dropdown for instant switching across `PT-1001` through `PT-1005`.
   - **"Live Ingest Demo"** button: Simulates real-time telemetry streaming, triggers background twin recalculation, and updates status badges.
   - **"Reset Cohort"** button: Features an inline confirmation prompt (`Reset demo data? [Yes, Reset] [Cancel]`) to prevent accidental invocation.
2. **Observation Timeline ([`PatientTimeline.tsx`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/frontend/src/components/timeline/PatientTimeline.tsx)):**
   - Automatically detects live observations via `newlyAddedObservationId` and `source="wearable_continuous_live"`.
   - Renders a prominent pulsing badge: **`JUST INGESTED`** with a highlighted emerald/teal border.
   - Displays observation timestamp, provenance source, and data tier (`measured` vs `user_reported`).
3. **Digital Twin Page ([`DigitalTwinPage.tsx`](file:///c:/Users/jaswant%20karun/SwasthyaTwin/frontend/src/components/pages/DigitalTwinPage.tsx)):**
   - Telemetry Freshness & Provenance card displays the exact arrival time and sensor stream of the latest packet.

---

## 4. Verification & Test Proofs

### Automated Backend Tests
All **33 pytest unit and integration tests** pass with 100% success rate:
- `test_seeding_is_repeatable_and_non_destructive`: Verified 5 synthetic profiles generated; user records strictly preserved.
- `test_reset_demo_data_safety_and_explicit_confirmation`: Verified `confirm=False` is rejected; `confirm=True` cleans only demo data; real user patients remain intact.
- `test_live_observation_injection_and_recalculation`: Verified live observation creation, automatic twin state recalculation, and indicator update.
- `test_baseline_handles_missing_values_without_treating_as_zero`: Verified missing observations are never substituted with zeroes.

### Automated Frontend Verification
- Frontend production bundle built cleanly with zero TypeScript errors via `npm run build`.
- Vitest unit test suite passes: `StatusBadge.test.tsx` (3 tests) and `MetricCard.test.tsx` (2 tests).
- Browser subagent verified live page rendering, responsive patient switching across all profiles, and timeline observation highlighting.

---

## 5. Transparent Documentation of Limitations

To uphold the highest standards of scientific and engineering rigor, the following design boundaries are documented:

1. **Stochastic Telemetry Generation:** Observations are generated using tuned Gaussian distributions around longitudinal drift curves. While realistic, they do not simulate cellular biochemical cascades or coupled non-linear differential equations (e.g., Guyton cardiovascular dynamics).
2. **Missing Data Granularity:** Intermittent missing observations are injected at the daily resolution (e.g., wearable charging days, bi-weekly clinical assays). Sub-hourly sensor dropouts (e.g., optical PPG motion artifact gaps) are aggregated into daily summaries.
3. **Non-Diagnostic Research Boundary:** The Health Stability Index and deviation z-scores are statistical representations of personal variance from baseline. They do not constitute diagnostic medical advice, clinical risk stratifications, or automated treatment decisions.
