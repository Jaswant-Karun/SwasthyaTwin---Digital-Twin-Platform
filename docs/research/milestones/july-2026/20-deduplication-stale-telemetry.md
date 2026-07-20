# Observation Deduplication & Stale Telemetry Rules (July 20, 2026)
## Deduplication Rule
Composite key: `(patient_id, primary_metric, timestamp_to_second)`.
When matching an existing observation, duplicates are suppressed and the verified original is preserved.
Telemetry older than 48 hours without fresh readings triggers a stale data warning.
