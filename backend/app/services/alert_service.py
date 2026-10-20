import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from bson import ObjectId
from pymongo.database import Database
from app.models.alert import AlertBase
from app.repositories.audit_repository import AuditRepository

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
            # Map id cleanly
            pub_id = doc.get("alert_id") or str(doc.get("_id"))
            doc["alert_id"] = pub_id
            doc["id"] = pub_id
            doc["_id"] = pub_id
            items.append(doc)
        return items


    @staticmethod
    def create_alert(db: Database, alert_in: AlertBase) -> Dict[str, Any]:
        doc = alert_in.model_dump()
        alert_id = doc.get("alert_id") or f"alt_{uuid.uuid4().hex[:12]}"
        doc["alert_id"] = alert_id
        result = db.alerts.insert_one(doc)
        doc["id"] = alert_id
        doc["_id"] = alert_id
        return doc

    @staticmethod
    def acknowledge_alert(
        db: Database,
        alert_id: str,
        acknowledged_by: str = "Patient",
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        # Match either alert_id or ObjectId
        query: Dict[str, Any] = {"$or": [{"alert_id": alert_id}]}
        try:
            query["$or"].append({"_id": ObjectId(alert_id)})
        except Exception:
            pass

        now = datetime.now(timezone.utc)
        result = db.alerts.find_one_and_update(
            query,
            {"$set": {
                "is_acknowledged": True,
                "acknowledged_at": now,
                "acknowledged_by": acknowledged_by,
                "acknowledgement_notes": notes
            }},
            return_document=True
        )
        if result:
            pub_id = result.get("alert_id") or str(result.get("_id"))
            result["id"] = pub_id
            result["_id"] = pub_id

            # Audit event for alert acknowledgement
            audit_repo = AuditRepository(db)
            audit_repo.record_event({
                "action": "acknowledge_alert",
                "resource_type": "alert",
                "resource_id": pub_id,
                "patient_id": result.get("patient_id"),
                "actor": acknowledged_by,
                "details": {
                    "severity": result.get("severity"),
                    "metric_type": result.get("metric_type")
                }
            })

        return result
