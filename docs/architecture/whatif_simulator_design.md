# What-If Simulator Architecture & State Flow

## Component State Flow
1. **Initial Baseline Load**: Fetches calibrated twin state from `/api/v1/twins/{patient_id}`.
2. **Interactive Perturbation**: User adjusts sliders (diet, exercise, medication, blood pressure).
3. **Optimistic Local Projection**: Client-side heuristic provides instantaneous 60fps chart feedback.
4. **Server Validation**: Debounced API request validates non-linear trajectory through backend models.
5. **Delta Differential Render**: Visual diff highlighting projected gains in biological age and risk reduction.
