# SwasthyaTwin Architecture & Engineering Design

## System Architecture

```
                                  +---------------------------------------+
                                  |         SwasthyaTwin Web App          |
                                  |     (React + TypeScript + Vite)       |
                                  +-------------------+-------------------+
                                                      |
                                                      | REST / JSON
                                                      v
                                  +---------------------------------------+
                                  |         FastAPI Backend Engine        |
                                  |  - Route Handlers (app/api/v1/)       |
                                  |  - Pydantic v2 Contract Validation    |
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +--------------------+
                     v                                                               v
      +-----------------------------+                               +---------------------------------+
      |    Analytics Engine         |                               |   Data Access Services          |
      | - Baseline Calculator       |                               | - Patient Service               |
      | - Anomaly / Drift Detector  |                               | - Observation Service           |
      | - What-If Simulation Model  |                               | - Alert & Audit Service         |
      | - Explainable Indicators    |                               +----------------+----------------+
      +-----------------------------+                                                |
                                                                                     v
                                                                    +---------------------------------+
                                                                    |        MongoDB Database         |
                                                                    | Collections:                    |
                                                                    | - patients                      |
                                                                    | - observations                  |
                                                                    | - health_assessments            |
                                                                    | - simulations                   |
                                                                    | - alerts                        |
                                                                    +---------------------------------+
```

## Key Architectural Principles

1. **Self-Baseline Comparison First**:
   Traditional clinical dashboards flag abnormalities against generalized population references (e.g. 60-100 bpm). However, an endurance athlete might normally rest at 48 bpm, whereas a senior may normally rest at 78 bpm. SwasthyaTwin prioritizes the patient's **own longitudinal rolling window** (e.g., 30-day baseline) as the primary benchmark.

2. **Decoupled Analytics Layer**:
   All statistical aggregation, rolling Z-score math, and physiological simulation algorithms reside inside `backend/app/analytics/`, making them purely functional, fully testable, and independent of HTTP layers.

3. **Data Tier Transparency**:
   Every biometric data point is strictly tagged with its tier:
   - `measured`: Wearable continuous or clinical laboratory test
   - `user_reported`: Manually logged journal entry
   - `simulated`: Forecasted by the digital twin What-If model

4. **Resilient Data Access**:
   Uses standard PyMongo with connection health-checks. If MongoDB is initializing or unavailable in development/testing mode, a memory-backed fallback ensures uninterrupted demonstration capability without silent data corruption.
