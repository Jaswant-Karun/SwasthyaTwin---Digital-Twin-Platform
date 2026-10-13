# Security & Authentication Guidelines

## Authentication Architecture
- **Stateless Bearer Tokens**: JSON Web Tokens (JWT) signed via HMAC-SHA256.
- **Short Expiry Windows**: Access tokens valid for 60 minutes.
- **Role-Based Access Control (RBAC)**: Distinct permissions for `clinician`, `researcher`, and `admin` roles.
- **Data Minimization**: API responses sanitize unnecessary identifiable attributes.
