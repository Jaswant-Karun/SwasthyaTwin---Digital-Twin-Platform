import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

logger = logging.getLogger(__name__)

def create_indexes(db: Database) -> None:
    """Ensure performant indexes are created for all core collections."""
    try:
        # Patients collection indexes
        db.patients.create_index([("patient_id", ASCENDING)], unique=True)
        db.patients.create_index([("created_at", DESCENDING)])

        # Observations collection indexes (crucial for fast time-series queries)
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("metric_type", ASCENDING),
            ("timestamp", DESCENDING)
        ])
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("timestamp", DESCENDING)
        ])

        # Health assessments indexes
        db.health_assessments.create_index([
            ("patient_id", ASCENDING),
            ("calculated_at", DESCENDING)
        ])

        # Simulations indexes
        db.simulations.create_index([
            ("patient_id", ASCENDING),
            ("created_at", DESCENDING)
        ])

        # Alerts indexes
        db.alerts.create_index([
            ("patient_id", ASCENDING),
            ("is_acknowledged", ASCENDING),
            ("timestamp", DESCENDING)
        ])

        logger.info("MongoDB indexes verified successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize indexes (likely in mock/fallback or constrained env): {e}")
