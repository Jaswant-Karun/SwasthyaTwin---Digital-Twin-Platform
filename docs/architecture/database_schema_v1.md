# Database Schema v1 Specification

## Collections
- **patients**: Demographic baseline, medical history, phenotypic cohort assignments.
- **vitals**: High-frequency time-series observations indexed on `(patient_id, timestamp)`.
- **lab_results**: Laboratory panel measurements with standard LOINC codes.
- **twin_states**: Persisted snapshots of calibrated digital twins.
- **simulations**: History of counterfactual what-if scenarios and outcome comparisons.
