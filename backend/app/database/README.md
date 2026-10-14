# Database Management Module

Asynchronous MongoDB connection layer utilizing Motor.

## Best Practices
- Use connection pooling with maximum pool size of 20 connections per worker.
- Always execute time-series biomarker queries with compound index prefix `patient_id`.
- Sanitize all query inputs to prevent injection attacks.
