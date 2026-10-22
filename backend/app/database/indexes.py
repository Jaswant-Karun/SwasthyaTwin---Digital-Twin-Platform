import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

logger = logging.getLogger(__name__)

def create_indexes(db: Database) -> None:
    """
    Ensure robust and performant indexes are created for all core SwasthyaTwin collections.
    Includes unique ID constraints and composite indexes for fast time-series queries.
    """
    try:
        # 1. Patients collection indexes
        db.patients.create_index([("patient_id", ASCENDING)], unique=True)
        db.patients.create_index([("updated_at", DESCENDING)])
        db.patients.create_index([("created_at", DESCENDING)])

        # 2. Observations collection indexes
        db.observations.create_index([("observation_id", ASCENDING)], unique=True, sparse=True)
        # Required compound index: patient_id + measurement_type + observed_at desc
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("measurement_type", ASCENDING),
            ("observed_at", DESCENDING)
        ])
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("observed_at", DESCENDING)
        ])
        # Also index metric_type / timestamp for backward-compatibility queries
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("metric_type", ASCENDING),
            ("timestamp", DESCENDING)
        ])
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("data_kind", ASCENDING)
        ])
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("source_type", ASCENDING)
        ])
        db.observations.create_index([
            ("patient_id", ASCENDING),
            ("updated_at", DESCENDING)
        ])

        # 3. Health Assessments collection indexes
        db.health_assessments.create_index([("assessment_id", ASCENDING)], unique=True, sparse=True)
        db.health_assessments.create_index([
            ("patient_id", ASCENDING),
            ("assessed_at", DESCENDING)
        ])
        db.health_assessments.create_index([
            ("patient_id", ASCENDING),
            ("calculated_at", DESCENDING)
        ])

        # 4. Simulations collection indexes
        db.simulations.create_index([("simulation_id", ASCENDING)], unique=True, sparse=True)
        db.simulations.create_index([
            ("patient_id", ASCENDING),
            ("created_at", DESCENDING)
        ])

        # 5. Audit Events collection indexes
        db.audit_events.create_index([("event_id", ASCENDING)], unique=True, sparse=True)
        db.audit_events.create_index([("timestamp", DESCENDING)])
        db.audit_events.create_index([
            ("patient_id", ASCENDING),
            ("timestamp", DESCENDING)
        ])
        db.audit_events.create_index([
            ("resource_type", ASCENDING),
            ("resource_id", ASCENDING)
        ])

        # 6. Alerts collection indexes
        db.alerts.create_index([("alert_id", ASCENDING)], unique=True, sparse=True)
        db.alerts.create_index([
            ("patient_id", ASCENDING),
            ("is_acknowledged", ASCENDING),
            ("timestamp", DESCENDING)
        ])

        logger.info("MongoDB indexes verified and ensured successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize indexes (mock/in-memory or permissions): {e}")
