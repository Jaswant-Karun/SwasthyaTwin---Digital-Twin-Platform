from fastapi import APIRouter, Response, status
from app.database.connection import db_manager
from app.core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    """System health check and database connection summary."""
    db_status = "connected" if db_manager.is_connected else "disconnected"
    storage_engine = "in_memory_mongomock" if db_manager.is_fallback else "mongodb_official_driver"

    return {
        "status": "healthy" if db_manager.is_connected else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "app_env": settings.APP_ENV,
        "environment": settings.ENVIRONMENT,
        "database": {
            "status": db_status,
            "engine": storage_engine,
            "database_name": settings.MONGODB_DATABASE,
            "fallback_active": db_manager.is_fallback,
            "connection_error": db_manager.connection_error
        },
        "disclaimer": "SwasthyaTwin is a prototype medical digital twin research engine. Not for emergency diagnostics."
    }

@router.get("/health/ready")
def readiness_check(response: Response):
    """
    Kubernetes / deployment readiness probe.
    Performs an active database ping to verify read/write readiness.
    """
    readiness = db_manager.check_readiness()
    if not readiness.get("ready"):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return readiness
