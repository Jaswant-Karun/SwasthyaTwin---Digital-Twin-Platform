# eGFR CKD-EPI Formula Derivation

## Clinical & Mathematical Specification
Implementation of 2021 CKD-EPI creatinine equation without race coefficient.

### Key Equations & Thresholds
- Standardized baseline parameters validated against clinical cohort literature.
- Deterministic bounds checking ensuring non-negative and physically plausible values.
- Real-time surrogate approximation compatible with sub-50ms inference.
