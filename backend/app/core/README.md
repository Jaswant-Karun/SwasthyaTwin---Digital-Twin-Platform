# Backend Core Module

Contains centralized configuration parameters, logging initialization, and environment variable loaders based on `pydantic-settings`.

## Core Settings
- `APP_NAME`: Application identifier.
- `MONGODB_URI`: Async database connection string.
- `DATABASE_NAME`: Target database instance.
- `JWT_SECRET_KEY`: Token signature secret.
- `CORS_ORIGINS`: Allowed client domain origins.
