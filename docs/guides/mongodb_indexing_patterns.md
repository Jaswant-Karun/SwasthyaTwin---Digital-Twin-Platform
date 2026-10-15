# MongoDB Indexing Strategy & Patterns

## Index Declarations
1. `patients`: Unique index on `patient_id`.
2. `vitals`: Compound index on `[("patient_id", ASCENDING), ("timestamp", DESCENDING)]`.
3. `simulations`: Compound index on `[("patient_id", ASCENDING), ("created_at", DESCENDING)]`.
4. `twin_states`: Index on `patient_id` with background creation.
