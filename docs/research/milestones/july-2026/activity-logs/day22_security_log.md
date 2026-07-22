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

### Access Logging
Every data read recorded in audit collection with timestamp.

### In-Transit Encryption
Strict TLS 1.3 with forward secrecy ciphers mandated.

### Rest Encryption
WiredTiger database engine encrypted with AES-256-CBC.

### Erasure Protocol
Deleting patient profile cascades to all linked observations.

### Isolation Fixture
Pytest fixture spins up twin patients to verify data boundaries.

### Inactivity Timeout
UI sessions automatically lock after 15 minutes of idle time.

