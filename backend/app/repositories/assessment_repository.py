import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError
from app.database.connection import get_db

logger = logging.getLogger(__name__)

class AssessmentRepository:
    def __init__(self, db: Optional[Database] = None):
        self._db = db

    @property
    def collection(self):
        db = self._db or get_db()
        return db.health_assessments

    def save_assessment(self, assessment_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Save a computed health assessment record."""
        try:
            doc = dict(assessment_dict)
            doc.pop("_id", None)
            if "assessed_at" not in doc or not doc["assessed_at"]:
                doc["assessed_at"] = datetime.now(timezone.utc)
            if "calculated_at" not in doc:
                doc["calculated_at"] = doc["assessed_at"]

            self.collection.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except PyMongoError as e:
            logger.error(f"Failed to save health assessment: {e}")
            raise

    def get_latest_for_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the latest health assessment for a patient."""
        try:
            # Query by assessed_at or calculated_at descending
            doc = self.collection.find_one(
                {"patient_id": patient_id},
                {"_id": 0},
                sort=[("assessed_at", DESCENDING)]
            )
            return doc
        except PyMongoError as e:
            logger.error(f"Failed to fetch latest health assessment for {patient_id}: {e}")
            raise

    def list_history(self, patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List historical assessments for a patient in descending order."""
        try:
            cursor = self.collection.find(
                {"patient_id": patient_id},
                {"_id": 0}
            ).sort("assessed_at", DESCENDING).limit(limit)
            return list(cursor)
        except PyMongoError as e:
            logger.error(f"Failed to list assessment history for {patient_id}: {e}")
            raise
