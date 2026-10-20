import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict, Any
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError
from app.database.connection import get_db

logger = logging.getLogger(__name__)

class ObservationRepository:
    def __init__(self, db: Optional[Database] = None):
        self._db = db

    @property
    def collection(self):
        db = self._db or get_db()
        return db.observations

    def create(self, obs_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a single validated observation."""
        try:
            doc = dict(obs_dict)
            doc.pop("_id", None)
            if "created_at" not in doc or not doc["created_at"]:
                doc["created_at"] = datetime.now(timezone.utc)
            self.collection.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except DuplicateKeyError:
            raise ValueError(f"Observation ID '{obs_dict.get('observation_id')}' already exists.")
        except PyMongoError as e:
            logger.error(f"Failed to insert observation: {e}")
            raise

    def create_batch(self, obs_list: List[Dict[str, Any]]) -> int:
        """Insert a batch of validated observations."""
        if not obs_list:
            return 0
        try:
            docs = []
            now = datetime.now(timezone.utc)
            for item in obs_list:
                doc = dict(item)
                doc.pop("_id", None)
                if "created_at" not in doc or not doc["created_at"]:
                    doc["created_at"] = now
                docs.append(doc)
            result = self.collection.insert_many(docs, ordered=False)
            return len(result.inserted_ids)
        except PyMongoError as e:
            logger.error(f"Failed to batch insert observations: {e}")
            raise

    def get_by_id(self, observation_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve observation by public observation_id."""
        try:
            return self.collection.find_one(
                {"observation_id": observation_id},
                {"_id": 0}
            )
        except PyMongoError as e:
            logger.error(f"Failed to get observation {observation_id}: {e}")
            raise

    def list_observations(
        self,
        patient_id: str,
        measurement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        data_kind: Optional[str] = None,
        limit: int = 200,
        skip: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Query observations for a patient with descending chronological order (observed_at desc) and pagination.
        Supports filtering by measurement_type (or metric_type for backward compat), date range, and data_kind.
        """
        try:
            query: Dict[str, Any] = {"patient_id": patient_id}

            if measurement_type:
                # Support both measurement_type and metric_type in query
                query["$or"] = [
                    {"measurement_type": measurement_type},
                    {"metric_type": measurement_type}
                ]

            if data_kind:
                query["$or"] = [
                    {"data_kind": data_kind},
                    {"data_tier": data_kind}
                ]

            time_query: Dict[str, Any] = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date

            if time_query:
                # Target observed_at or timestamp field
                query["observed_at"] = time_query

            total = self.collection.count_documents(query)
            cursor = self.collection.find(
                query,
                {"_id": 0}
            ).sort("observed_at", DESCENDING).skip(skip).limit(limit)

            results = list(cursor)
            # Ensure compatibility fields are filled in returned records if missing
            for r in results:
                if "metric_type" not in r and "measurement_type" in r:
                    r["metric_type"] = r["measurement_type"]
                if "timestamp" not in r and "observed_at" in r:
                    r["timestamp"] = r["observed_at"]
                if "data_tier" not in r and "data_kind" in r:
                    r["data_tier"] = "user_reported" if r["data_kind"] == "user_entered" else r["data_kind"]

            return results, total
        except PyMongoError as e:
            logger.error(f"Failed to list observations for patient {patient_id}: {e}")
            raise

    def count_for_patient(self, patient_id: str) -> int:
        """Count total observations for a patient."""
        try:
            return self.collection.count_documents({"patient_id": patient_id})
        except PyMongoError as e:
            logger.error(f"Failed to count observations for patient {patient_id}: {e}")
            raise

    def delete_for_patient(self, patient_id: str) -> int:
        """Delete all observations for a patient."""
        try:
            res = self.collection.delete_many({"patient_id": patient_id})
            return res.deleted_count
        except PyMongoError as e:
            logger.error(f"Failed to delete observations for patient {patient_id}: {e}")
            raise
