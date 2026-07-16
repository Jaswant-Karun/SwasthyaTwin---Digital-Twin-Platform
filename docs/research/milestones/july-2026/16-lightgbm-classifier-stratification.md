# LightGBM Classifier Architecture & Stratification (July 16, 2026)
## Model Hyperparameters
- Objective: `multiclass` (num_class=5)
- Learning rate: 0.05
- Num leaves: 31
- Regularization: L1=0.1, L2=0.2
- Participant-level grouped splitting to prevent cross-validation data leakage.
