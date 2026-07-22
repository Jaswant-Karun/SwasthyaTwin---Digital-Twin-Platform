### Query Encapsulation
All MongoDB calls must receive explicit patient_id parameters.

### Repository Isolation
Decorators enforce tenancy checking on database operations.

### Leakage Prevention
Tests verify patient A cannot inspect patient B telemetry.

### Hashing Standards
Sensitive identity fields hashed using modern salting protocols.

### Auth Claims
Bearer tokens carry subject tenant context validated by middleware.

### RBAC Matrix
Patient, Clinician, Researcher distinct capability definitions.

