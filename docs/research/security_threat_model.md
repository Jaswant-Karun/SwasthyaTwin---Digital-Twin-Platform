# Security Threat Model & Attack Surface Analysis

## Threat Vectors (STRIDE Methodology)
- **Spoofing**: Mitigated via cryptographically signed JWT tokens and TLS client certificates.
- **Tampering**: Telemetry hashes stored alongside raw measurements to guarantee integrity.
- **Information Disclosure**: Zero plain-text storage of PHI; column-level encryption for sensitive medical identifiers.
