# Security & Authentication Guidelines

## Key Rotation Procedure
- Support for dual-active JWT keys to enable zero-downtime key rotation.
- Key identifiers (`kid`) embedded in token headers.
- Automated secret rotation scheduled every 90 days.
