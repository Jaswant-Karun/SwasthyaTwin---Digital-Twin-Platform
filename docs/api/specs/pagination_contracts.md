# Cursor-Based Pagination for Telemetry Streams

## Overview
Replacing skip/limit with stable cursor pagination based on `(timestamp, _id)`.

### Compliance & Performance
- Complies with RESTful best practices and RFC-7807 problem details standards.
- Fully validated against internal integration test suites.
