# API Endpoints Specification

FastAPI router module mapping REST endpoints.

## Security Policies
- Rate limiting: 100 requests per minute per IP for public endpoints.
- Strict CORS whitelist restricting origins to authorized frontend domains.
- Secure HTTP headers configured via middleware (HSTS, X-Content-Type-Options, CSP).
