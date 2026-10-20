import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError
from app.database.connection import get_db

logger = logging.getLogger(__name__)

class SimulationRepository:
    def __init__(self, db: Optional[Database] = None):
        self._db = db

    @property
    def collection(self):
        db = self._db if self._db is not None else get_db()
        return db.simulations

    def save_simulation(self, sim_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Save a what-if simulation run."""
        try:
            doc = dict(sim_dict)
            doc.pop("_id", None)
            if "created_at" not in doc or not doc["created_at"]:
                doc["created_at"] = datetime.now(timezone.utc)
            self.collection.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except PyMongoError as e:
            logger.error(f"Failed to save simulation: {e}")
            raise

    def get_by_id(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve simulation run by simulation_id."""
        try:
            return self.collection.find_one(
                {"simulation_id": simulation_id},
                {"_id": 0}
            )
        except PyMongoError as e:
            logger.error(f"Failed to fetch simulation {simulation_id}: {e}")
            raise

    def list_for_patient(self, patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List past simulation runs for a patient sorted by creation time descending."""
        try:
            cursor = self.collection.find(
                {"patient_id": patient_id},
                {"_id": 0}
            ).sort("created_at", DESCENDING).limit(limit)
            return list(cursor)
        except PyMongoError as e:
            logger.error(f"Failed to list simulations for {patient_id}: {e}")
            raise
