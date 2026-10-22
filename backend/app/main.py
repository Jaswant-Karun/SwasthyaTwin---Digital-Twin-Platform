import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.connection import db_manager, get_db
from app.database.indexes import create_indexes
from app.database.seed import seed_synthetic_patients

# Routers
from app.api.health import router as health_router
from app.api.v1.patients import router as patients_router
from app.api.v1.observations import router as observations_router
from app.api.v1.twin import router as twin_router
from app.api.v1.simulations import router as simulations_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.seed import router as seed_router
from app.api.v1.audit import router as audit_router
from app.api.v1.explanations import router as explanations_router
from app.api.v1.ml import router as ml_router
from app.api.v1.cardiovascular import router as cardiovascular_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Starting SwasthyaTwin Digital Twin Platform...")
    db_manager.connect()
    if db_manager.is_connected:
        try:
            db = db_manager.get_database()
            create_indexes(db)

            # Auto-seed demo cohort only if no demo patients exist and enabled
            if settings.ENABLE_SYNTHETIC_AUTOSEED:
                demo_count = db.patients.count_documents({"demo_data": True})
                if demo_count == 0:
                    logger.info("No demo records found. Seeding synthetic demonstration cohort...")
                    seed_synthetic_patients(db, force=False)
                    logger.info("Synthetic demo seeding complete.")
        except Exception as e:
            logger.warning(f"Startup initialization warning: {e}")

    yield

    # Shutdown sequence
    logger.info("Shutting down SwasthyaTwin...")
    db_manager.close()

app = FastAPI(
    title="SwasthyaTwin API",
    description=(
        "Personalized Healthcare Digital Twin for Early Risk Detection and Preventive Intervention.\n\n"
        "**Safety Notice**: This API is part of a hackathon research prototype. "
        "It provides biometric deviation tracking and lifestyle simulation for wellness and research; "
        "it is not a certified medical diagnostic device."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Health check at root and /api
app.include_router(health_router)
app.include_router(health_router, prefix="/api")

# Mount API routers on /api/v1 and /api
for prefix in [settings.API_V1_STR, "/api"]:
    app.include_router(patients_router, prefix=prefix)
    app.include_router(observations_router, prefix=prefix)
    app.include_router(twin_router, prefix=prefix)
    app.include_router(simulations_router, prefix=prefix)
    app.include_router(alerts_router, prefix=prefix)
    app.include_router(seed_router, prefix=prefix)
    app.include_router(audit_router, prefix=prefix)
    app.include_router(explanations_router, prefix=prefix)
    app.include_router(ml_router, prefix=prefix)
    app.include_router(cardiovascular_router, prefix=prefix)


