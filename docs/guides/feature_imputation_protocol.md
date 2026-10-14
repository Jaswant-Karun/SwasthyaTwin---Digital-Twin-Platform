# Feature Scaling & Missing Data Imputation

## Handling Sparse Telemetry
1. **Forward Fill with Decay**: Recent telemetry valid within decay half-life (e.g., Blood Pressure: 48h half-life).
2. **Cohort Median Imputation**: Missing baseline metrics imputed using age-and-gender stratified cohort medians.
3. **Confidence Degradation**: Uncertainty interval widens proportionally to data age.
