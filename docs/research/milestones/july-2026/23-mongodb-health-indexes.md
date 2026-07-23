# MongoDB Health Observations Compound Index Strategy (July 23, 2026)
## Optimal Query Indexing
- Compound index: `{"patient_id": 1, "timestamp": -1}` for chronological timelines.
- Metric-specific index: `{"patient_id": 1, "metric_type": 1, "timestamp": -1}` for time-series extraction.
- Provenance index: `{"patient_id": 1, "data_tier": 1, "timestamp": -1}`.
