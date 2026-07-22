# Multi-Tenant Patient Data Isolation (July 22, 2026)
## Isolation Guarantees
Every database query in FastAPI services applies mandatory `{"patient_id": patient_id}` constraints.
Cross-patient leakage is strictly prevented at the query, service, and routing layers.
