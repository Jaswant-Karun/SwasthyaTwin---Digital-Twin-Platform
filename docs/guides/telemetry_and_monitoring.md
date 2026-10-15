# Observability & Metrics Specification

## Standard Prometheus Metrics
- `swasthya_requests_total`: Counter by route and status code.
- `swasthya_inference_duration_seconds`: Histogram of ML inference latencies.
- `swasthya_active_twins_cached`: Gauge of currently in-memory twin models.
- `/health/ready` and `/health/live` endpoints for Kubernetes probes.
