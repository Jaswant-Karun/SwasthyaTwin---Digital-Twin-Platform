# SwasthyaTwin API Specification

Base URL: `http://localhost:8000/api`

Interactive Documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints Summary

### System & Health
- `GET /health`: Returns service status, database connectivity mode (`mongodb` or `in-memory fallback`), and uptime.

### Patients
- `GET /api/v1/patients`: List patient profiles with pagination, chronic condition filters, and name search.
- `POST /api/v1/patients`: Register new patient profile.
- `GET /api/v1/patients/{patient_id}`: Get full patient demographic, baseline window config, and lifestyle metrics.
- `PUT /api/v1/patients/{patient_id}`: Update baseline window or lifestyle parameters.

### Observations
- `GET /api/v1/patients/{patient_id}/observations`: Longitudinal query with filters:
  - `metric_type`: Optional metric string (e.g. `heart_rate`, `blood_pressure_systolic`, `sleep_duration_hours`, `daily_steps`, `spo2`, `hrv_rmssd`)
  - `start_date`: ISO date string
  - `end_date`: ISO date string
  - `limit`: Default 200, max 1000
- `POST /api/v1/patients/{patient_id}/observations`: Insert single observation with unit, source, and data tier.
- `POST /api/v1/patients/{patient_id}/observations/batch`: Batch ingest wearable timeseries.

### Digital Twin State & Analytics
- `GET /api/v1/patients/{patient_id}/twin/state`: Current biometric snapshot vs personalized baseline with computed Z-scores.
- `GET /api/v1/patients/{patient_id}/twin/baseline`: Full statistical baseline profile ($\mu, \sigma, Q_1, Q_2, Q_3, IQR$) across all measured metrics.
- `GET /api/v1/patients/{patient_id}/twin/assessment`: Vitality Index (0-100), stability classification, radar scores, and plain-English explainability drivers.

### What-If Simulations
- `POST /api/v1/patients/{patient_id}/simulations/run`: Execute a predictive intervention:
  - `scenario_name`: e.g. "Sleep Optimization & 8k Daily Steps"
  - `delta_sleep_hours`: e.g. `+1.5`
  - `delta_daily_steps`: e.g. `+3000`
  - `delta_stress_level`: e.g. `-20%`
  - `duration_days`: e.g. `30`
- `GET /api/v1/patients/{patient_id}/simulations`: List past simulations with trajectory forecasts and confidence bands.

### Alerts
- `GET /api/v1/patients/{patient_id}/alerts`: Retrieve active & historic deviation alerts with severity and root-cause evidence.
- `POST /api/v1/alerts/{alert_id}/acknowledge`: Mark alert as reviewed with optional physician/patient notes.

### Demo & Seed
- `POST /api/v1/seed`: Trigger deterministic synthetic data generation for 3 distinct longitudinal demo patients (90 days of synthetic data each).
