import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict, Any
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError
from app.database.connection import get_db

logger = logging.getLogger(__name__)

class PatientRepository:
    def __init__(self, db: Optional[Database] = None):
        self._db = db

    @property
    def collection(self):
        db = self._db if self._db is not None else get_db()
        return db.patients

    def get_by_id(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve patient by unique patient_id, excluding raw internal _id."""
        try:
            return self.collection.find_one(
                {"patient_id": patient_id},
                {"_id": 0}
            )
        except PyMongoError as e:
            logger.error(f"Failed to query patient {patient_id}: {e}")
            raise

    def list_patients(self, skip: int = 0, limit: int = 50, search: Optional[str] = None) -> Tuple[List[Dict[str, Any]], int]:
        """List patients with pagination and optional search filter, sorted by updated_at desc."""
        try:
            query: Dict[str, Any] = {}
            if search:
                query["$or"] = [
                    {"patient_id": {"$regex": search, "$options": "i"}},
                    {"display_name": {"$regex": search, "$options": "i"}}
                ]

            total = self.collection.count_documents(query)
            cursor = self.collection.find(
                query,
                {"_id": 0}
            ).sort("updated_at", -1).skip(skip).limit(limit)

            return list(cursor), total
        except PyMongoError as e:
            logger.error(f"Failed to list patients: {e}")
            raise

    def create(self, patient_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a validated patient record with UTC timestamps."""
        try:
            pid = patient_dict.get("patient_id")
            if pid and self.collection.find_one({"patient_id": pid}):
                raise ValueError(f"Patient with ID '{pid}' already exists.")

            now = datetime.now(timezone.utc)
            if "created_at" not in patient_dict or not patient_dict["created_at"]:
                patient_dict["created_at"] = now
            if "updated_at" not in patient_dict or not patient_dict["updated_at"]:
                patient_dict["updated_at"] = now

            # Ensure internal _id is clean
            doc = dict(patient_dict)
            doc.pop("_id", None)

            self.collection.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except DuplicateKeyError:
            logger.warning(f"Patient with ID {patient_dict.get('patient_id')} already exists.")
            raise ValueError(f"Patient with ID '{patient_dict.get('patient_id')}' already exists.")
        except PyMongoError as e:
            logger.error(f"Failed to insert patient: {e}")
            raise


    def update(self, patient_id: str, update_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update patient fields and touch updated_at timestamp."""
        try:
            update_data = {k: v for k, v in update_dict.items() if v is not None}
            update_data["updated_at"] = datetime.now(timezone.utc)
            update_data.pop("_id", None)
            update_data.pop("patient_id", None)

            result = self.collection.find_one_and_update(
                {"patient_id": patient_id},
                {"$set": update_data},
                projection={"_id": 0},
                return_document=True
            )
            return result
        except PyMongoError as e:
            logger.error(f"Failed to update patient {patient_id}: {e}")
            raise

    def delete(self, patient_id: str) -> bool:
        """Delete patient by patient_id."""
        try:
            res = self.collection.delete_one({"patient_id": patient_id})
            return res.deleted_count > 0
        except PyMongoError as e:
            logger.error(f"Failed to delete patient {patient_id}: {e}")
            raise

    def count(self) -> int:
        """Total count of patients."""
        try:
            return self.collection.count_documents({})
        except PyMongoError as e:
            logger.error(f"Failed to count patients: {e}")
            raise
