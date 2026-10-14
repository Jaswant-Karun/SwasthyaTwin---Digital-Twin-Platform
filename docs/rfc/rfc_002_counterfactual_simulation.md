# RFC 002: Counterfactual What-If Simulation Logic

## Status: Approved
## Objective
Enable clinicians and patients to simulate hypothetical therapeutic interventions (e.g., smoking cessation, 10% BMI reduction, medication adherence) and project quantitative trajectory improvements.

## Delta Propagation Formula
$$\Delta Y_{predicted} = f_{surrogate}(X_{baseline} + \Delta X_{intervention}) - f_{surrogate}(X_{baseline})$$
