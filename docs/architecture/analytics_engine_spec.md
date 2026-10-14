# Analytics Engine Specification

## 1. Engine Structure
The analytics engine combines two complementary decision pathways:
1. **Clinical Decision Support (CDS) Rules**: Evidence-based guideline thresholds.
2. **Machine Learning Predictors**: Gradient boosting and regression models trained on longitudinal cohort data.

## 2. Organ Health Indices
- **Cardiovascular Health Index**: Evaluated from Blood Pressure, Resting Heart Rate, and Lipid Ratios.
- **Metabolic Health Index**: Evaluated from HbA1c, Fasting Blood Glucose, and BMI.
- **Renal Function Index**: Derived from Serum Creatinine and eGFR estimations.
- **Inflammatory Status**: Calibrated using hs-CRP and WBC counts.
