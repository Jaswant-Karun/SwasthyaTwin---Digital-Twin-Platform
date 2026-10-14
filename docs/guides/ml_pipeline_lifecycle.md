# ML Model Pipeline & Versioning Lifecycle

## Serialization Standards
- Models are persisted in `.joblib` format with zlib compression.
- Every release bundle must include a `training_manifest.json` detailing:
  - Training dataset hash and date.
  - Model hyperparameter configurations.
  - Evaluation metrics ($R^2$, RMSE, ROC-AUC).
  - Feature names and expected input dimensions.
