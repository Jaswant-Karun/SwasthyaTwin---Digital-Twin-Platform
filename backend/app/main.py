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

            # Auto-seed if patient collection is empty and enabled
            if settings.ENABLE_SYNTHETIC_AUTOSEED:
                count = db.patients.count_documents({})
                if count == 0:
                    logger.info("Patient database is empty. Auto-seeding synthetic demonstration cohort...")
                    seed_synthetic_patients(db)
                    logger.info("Auto-seeding complete.")
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

# Mount Health check at root
app.include_router(health_router)

# Mount v1 API routers
app.include_router(patients_router, prefix=settings.API_V1_STR)
app.include_router(observations_router, prefix=settings.API_V1_STR)
app.include_router(twin_router, prefix=settings.API_V1_STR)
app.include_router(simulations_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(seed_router, prefix=settings.API_V1_STR)
