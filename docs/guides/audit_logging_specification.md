# Audit Logging Specification

Structured JSON logs for audit compliance:

```json
{
  "event_type": "TWIN_STATE_RECONCILE",
  "patient_id": "PT-90214",
  "user_id": "clinician_dr_sharma",
  "timestamp": "2026-10-15T21:40:00Z",
  "delta_keys": ["vitals.heart_rate", "scores.cardiovascular"]
}
```
