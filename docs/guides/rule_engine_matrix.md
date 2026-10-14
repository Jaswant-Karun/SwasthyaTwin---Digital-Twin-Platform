# Clinical Rule Priority Matrix

Deterministic clinical rules evaluated prior to ML inference.

| Priority | Category | Rule Trigger | Clinical Action |
| :--- | :--- | :--- | :--- |
| P0 (Critical) | Hypertensive Crisis | SBP > 180 or DBP > 120 | Immediate urgent care alert |
| P1 (High) | Severe Hypoglycemia | Fasting Glucose < 54 mg/dL | Hypoglycemia intervention alert |
| P2 (Medium) | Uncontrolled HbA1c | HbA1c > 9.0% | Endocrine consult recommendation |
| P3 (Advisory) | Pre-Hypertension | SBP 120-129 & DBP < 80 | Lifestyle modification advisory |
