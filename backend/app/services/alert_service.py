from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from bson import ObjectId
from pymongo.database import Database
from app.models.alert import AlertBase

class AlertService:
    @staticmethod
    def get_patient_alerts(
        db: Database,
        patient_id: str,
        acknowledged: Optional[bool] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"patient_id": patient_id}
        if acknowledged is not None:
            query["is_acknowledged"] = acknowledged

        cursor = db.alerts.find(query).sort("timestamp", -1).limit(limit)
        items = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items

    @staticmethod
    def create_alert(db: Database, alert_in: AlertBase) -> Dict[str, Any]:
        doc = alert_in.model_dump()
        result = db.alerts.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    @staticmethod
    def acknowledge_alert(
        db: Database,
        alert_id: str,
        acknowledged_by: str = "Patient",
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(alert_id)
        except Exception:
            oid = alert_id

        now = datetime.now(timezone.utc)
        result = db.alerts.find_one_and_update(
            {"_id": oid},
            {"$set": {
                "is_acknowledged": True,
                "acknowledged_at": now,
                "acknowledged_by": acknowledged_by,
                "acknowledgement_notes": notes
            }},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result
