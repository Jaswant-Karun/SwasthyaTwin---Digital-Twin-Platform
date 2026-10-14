# Model Validation Protocol

## Validation Guidelines
- 5-Fold Stratified Cross-Validation on synthetic test cohorts.
- Minimum acceptable ROC-AUC for high-risk classifiers: 0.88.
- Minimum acceptable $R^2$ for trajectory regressors: 0.82.
- Calibration curve verification to ensure well-calibrated probabilistic estimates.
