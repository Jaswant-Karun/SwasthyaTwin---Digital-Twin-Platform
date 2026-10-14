# Data Provenance & Model Explainability

## Audit Trail Requirements
Every prediction rendered by SwasthyaTwin must maintain traceable provenance:
1. **Source Citation**: Which telemetry packet or lab report informed the baseline.
2. **Feature Contributions**: Local explainability (SHAP / feature weight contribution) identifying the top 3 contributing risk factors.
3. **Model Version**: Precise commit hash and model artifact identifier.
