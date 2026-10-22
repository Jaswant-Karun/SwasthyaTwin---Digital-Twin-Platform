import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict, Any
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError
from app.database.connection import get_db

logger = logging.getLogger(__name__)

# Sensitive keys that should never be recorded into audit metadata
FORBIDDEN_AUDIT_KEYS = {"password", "secret", "uri", "token", "authorization", "auth", "credentials", "apikey"}

class AuditRepository:
    def __init__(self, db: Optional[Database] = None):
        self._db = db

    @property
    def collection(self):
        db = self._db if self._db is not None else get_db()
        return db.audit_events

    def record_event(self, event_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Record a non-sensitive audit event."""
        try:
            doc = dict(event_dict)
            doc.pop("_id", None)
            if "timestamp" not in doc or not doc["timestamp"]:
                doc["timestamp"] = datetime.now(timezone.utc)

            # Sanitize details to guarantee no sensitive keys are ever logged
            raw_details = doc.get("details") or {}
            sanitized_details = {
                k: str(v) if not isinstance(v, (int, float, bool, str)) else v
                for k, v in raw_details.items()
                if k.lower() not in FORBIDDEN_AUDIT_KEYS
            }
            doc["details"] = sanitized_details

            self.collection.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except PyMongoError as e:
            logger.error(f"Failed to record audit event: {e}")
            # Audit recording should be resilient and not crash core operations
            return event_dict

    def list_events(
        self,
        patient_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List audit events with controlled projection and descending timestamp order."""
        try:
            query: Dict[str, Any] = {}
            if patient_id:
                query["patient_id"] = patient_id
            if resource_type:
                query["resource_type"] = resource_type

            total = self.collection.count_documents(query)
            cursor = self.collection.find(
                query,
                {"_id": 0}
            ).sort("timestamp", DESCENDING).skip(skip).limit(limit)

            return list(cursor), total
        except PyMongoError as e:
            logger.error(f"Failed to query audit events: {e}")
            raise

    @staticmethod
    def log_action(
        db: Optional[Database],
        action: str,
        entity_type: str,
        entity_id: str,
        patient_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        user_id: str = "patient"
    ) -> Dict[str, Any]:
        """Convenience method to record an action directly using a Database reference."""
        repo = AuditRepository(db)
        return repo.record_event({
            "action": action,
            "resource_type": entity_type,
            "resource_id": entity_id,
            "patient_id": patient_id,
            "actor": user_id,
            "details": details or {}
        })

