# Database Evaluation & Storage Patterns

## Storage Performance Analysis
For time-series telemetry streams, MongoDB compound indexing on `{ patient_id: 1, timestamp: -1 }` delivers sub-5ms query response times across multi-million record test collections when combined with capped collections for rolling buffers.
