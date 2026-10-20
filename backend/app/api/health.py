from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.api.deps import get_database
from app.database.connection import db_manager
from app.core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    """System health check and database readiness validation."""
    db_status = "connected" if db_manager.is_connected else "disconnected"
    storage_engine = "in_memory_mongomock" if db_manager.is_fallback else "mongodb_cluster"

    return {
        "status": "healthy" if db_manager.is_connected else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
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
