# Cardiovascular Risk Mathematical Formulation

## Survival Analysis & Hazard Rates
We formulate baseline cardiovascular risk using Cox Proportional Hazards:

$$h(t, X) = h_0(t) \exp\left( \sum_{i=1}^p \beta_i X_i \right)$$

Where covariates $X$ include age, systolic blood pressure, total-to-HDL cholesterol ratio, smoking status, and diabetes diagnosis flag.
