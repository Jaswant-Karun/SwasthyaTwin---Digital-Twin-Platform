# SwasthyaTwin AI — Observation Identity Schema (July 2, 2026)
## Specifications
Every physiological reading adheres to a unified identity model:
- `patient_id`: Strict isolation identifier.
- `timestamp`: UTC canonical timestamp with optional local time zone preservation.
- `metric_type`: Standardized physiological metric identifier.
- `value` & `unit`: Quantitative measurement paired with canonical unit.
- `source` & `device_id`: Provenance equipment tracking.
