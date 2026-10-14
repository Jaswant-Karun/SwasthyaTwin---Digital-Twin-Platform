# Phenotypic Subtyping via K-Means & PCA

## Methodological Summary
To identify distinct sub-phenotypes across chronic cohorts:
1. Normalize biomarker vector via `RobustScaler`.
2. Reduce dimensionality with Principal Component Analysis (retaining > 90% explained variance).
3. Apply K-Means clustering ($k=4$) to partition patient states into clinically distinct clusters:
   - Low Risk / Metabolically Resilient
   - Moderate Cardio-Metabolic Strain
   - Advanced Glycemic Dysregulation
   - Multi-System High Risk
