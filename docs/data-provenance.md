# SwasthyaTwin Data Provenance & Grounding Specification

**Version:** 1.0.0  
**Status:** Grounding Verification Standard  
**Last Updated:** October 23, 2026  

---

## 1. Summary of Data Sources

SwasthyaTwin strictly categorizes all platform data into verified operational tiers:

| Tier Identifier | Underlying Origin | Storage Location | Mutability & Grounding |
| :--- | :--- | :--- | :--- |
| `measured` | Authentic wearable optical PPG or clinical lab observation | MongoDB `observations` collection | Immutable historical ground truth; basis for personal baseline corridor. |
| `user_reported` | Manually entered journal observation | MongoDB `observations` collection | Authenticated user entry; subject to Tukey IQR plausibility checking. |
| `model_predicted` | ML classifier output (e.g. 30s epoch sleep stage) | Ephemeral inference / hypnogram timeline | Derived from causal feature windows; explicitly labeled with confidence. |
| `simulated` | What-If counterfactual scenario projection | MongoDB `simulations` collection | Isolated prospective projection; strictly prohibited from baseline recalculation. |
| `synthetic` | Fictional demonstration cohort member | MongoDB `patients` (flagged `demo_data=True`) | Deterministically generated demonstration data; never mixed silently with real users. |

---

## 2. Research Dataset Grounding: PhysioNet BiDSleep

- **Dataset Identifier**: BiDSleep v1.0.1 on PhysioNet ([doi:10.13026/rees-1092](https://doi.org/10.13026/rees-1092)).
- **Subjects**: 31 healthy adult human participants recorded in nocturnal free-living and laboratory sleep environments.
- **Reference Standard**: Polysomnography (Dreem 2 EEG headband) with manual expert sleep physician scoring.
- **Wearable Stream**: High-resolution optical photoplethysmography (PPG) pulse rate from consumer smartwatches.
- **Isolation Policy**: Raw research files (`data/bidsleep_raw/`) remain isolated and are never inserted into the production MongoDB patient `observations` collection.

---

## 3. Fictional Demonstration Cohort

The platform ships with 5 deterministically generated demonstration archetypes in `backend/app/database/seed.py`:

| Patient ID | Display Name | Age | Archetype Purpose | Demonstrable Physiological Feature |
| :--- | :--- | :---: | :--- | :--- |
| `PT-1001` | Aarav Mehta | 38 | High-Stress Tech Worker | Nocturnal tachycardia, elevated resting HR drift, sleep debt |
| `PT-1002` | Priya Sharma | 45 | Metabolic Risk Profile | Postprandial glucose excursions, sedentary activity baseline |
| `PT-1003` | Marcus Vance | 29 | Endurance Athlete | Resting bradycardia (48 bpm normal baseline), high HRV |
| `PT-1004` | Elena Rostova | 62 | Hypertensive Senior | Narrow blood pressure tolerance corridor, low sleep duration |
| `PT-1005` | David Kim | 51 | Shift Worker | Circadian disruption, irregular sleep-wake cycle transitions |

> [!NOTE]
> All demonstration profiles are explicitly marked with `demo_data: true` and `is_synthetic: true`. Seeding routines never delete or overwrite authentic patient records.

---

## 4. Zero-Imputation & Missing Data Policy

1. **No Phantom Value Generation**:
   - The platform never imputes missing wearable intervals with synthetic zeros or artificial constant values.
   - If an optical sensor disconnects or reports invalid telemetry, the reading is marked `rejected` or omitted from the baseline window.
2. **Explicit Insufficient History States**:
   - Computing a personal rolling baseline requires a minimum of **3 valid observations**.
   - If history is below 3 records, the system displays an explicit warning (`"Insufficient baseline observations"`) rather than fabricating population norms.
