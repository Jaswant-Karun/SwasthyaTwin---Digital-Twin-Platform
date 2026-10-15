# Security & Authentication Guidelines

## Role-Based Access Control (RBAC) Matrix
| Resource | Clinician | Researcher (De-identified) | Patient |
| :--- | :--- | :--- | :--- |
| Identified Patient Profile | Read / Write | Denied | Read Own |
| Aggregate Cohort Stats | Read | Read | Denied |
| Simulation Playground | Read / Execute | Read / Execute | Read / Execute |
| Model Retraining Trigger | Denied | Admin Only | Denied |
