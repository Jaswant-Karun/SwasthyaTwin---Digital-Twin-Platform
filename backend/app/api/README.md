# API Endpoints Specification

FastAPI router module mapping REST endpoints.

## Key Routes
- `/api/v1/patients`: Patient CRUD, demographic profiles, cohort assignment.
- `/api/v1/twins/{patient_id}`: Calibrated digital twin state and composite health score.
- `/api/v1/simulations/what-if`: Interactive scenario simulation execution.
- `/api/v1/analytics/cohorts`: Cohort-wide risk distributions and cluster metrics.
