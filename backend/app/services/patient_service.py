import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pymongo.database import Database
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse
from app.repositories.patient_repository import PatientRepository
from app.repositories.audit_repository import AuditRepository

logger = logging.getLogger(__name__)

class PatientService:
    @staticmethod
    def list_patients(
        db: Database,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        repo = PatientRepository(db)
        docs, _ = repo.list_patients(skip=skip, limit=limit, search=search)

        patients = []
        for doc in docs:
            pid = doc["patient_id"]
            doc["active_alerts_count"] = db.alerts.count_documents({
                "patient_id": pid,
                "is_acknowledged": False
            })
            doc["total_observations_count"] = db.observations.count_documents({
                "patient_id": pid
            })
            latest_assess = db.health_assessments.find_one(
                {"patient_id": pid},
                {"_id": 0},
                sort=[("assessed_at", -1), ("calculated_at", -1)]
            )
            if latest_assess:
                doc["latest_vitality_index"] = latest_assess.get("vitality_index")
                doc["stability_status"] = latest_assess.get("stability_status")

            # Guarantee compatibility fields for frontend
            if "full_name" not in doc and "display_name" in doc:
                doc["full_name"] = doc["display_name"]
            if "biological_sex" not in doc and "gender" in doc:
                doc["biological_sex"] = doc["gender"]

            patients.append(doc)
        return patients

    @staticmethod
    def get_patient(db: Database, patient_id: str) -> Optional[Dict[str, Any]]:
        repo = PatientRepository(db)
        doc = repo.get_by_id(patient_id)
        if not doc:
            return None

        doc["active_alerts_count"] = db.alerts.count_documents({
            "patient_id": patient_id,
            "is_acknowledged": False
        })
        doc["total_observations_count"] = db.observations.count_documents({
            "patient_id": patient_id
        })
        latest_assess = db.health_assessments.find_one(
            {"patient_id": patient_id},
            {"_id": 0},
            sort=[("assessed_at", -1), ("calculated_at", -1)]
        )
        if latest_assess:
            doc["latest_vitality_index"] = latest_assess.get("vitality_index")
            doc["stability_status"] = latest_assess.get("stability_status")

        if "full_name" not in doc and "display_name" in doc:
            doc["full_name"] = doc["display_name"]
        if "biological_sex" not in doc and "gender" in doc:
            doc["biological_sex"] = doc["gender"]

        return doc

    @staticmethod
    def create_patient(db: Database, patient_in: PatientCreate) -> Dict[str, Any]:
        repo = PatientRepository(db)
        existing = repo.get_by_id(patient_in.patient_id)
        if existing:
            raise ValueError(f"Patient with ID '{patient_in.patient_id}' already exists.")

        base = patient_in.to_patient_base()
        doc = base.model_dump()
        doc["full_name"] = base.display_name
        doc["biological_sex"] = base.gender or "other"

        created = repo.create(doc)

        # Non-sensitive audit logging
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "create",
            "resource_type": "patient",
            "resource_id": patient_in.patient_id,
            "patient_id": patient_in.patient_id,
            "actor": "api_client",
            "details": {
                "display_name": base.display_name,
                "baseline_window_days": base.baseline_window_days,
                "demo_data": base.demo_data
            }
        })

        return PatientService.get_patient(db, patient_in.patient_id)

    @staticmethod
    def update_patient(
        db: Database,
        patient_id: str,
        update_in: PatientUpdate
    ) -> Optional[Dict[str, Any]]:
        repo = PatientRepository(db)
        existing = repo.get_by_id(patient_id)
        if not existing:
            return None

        update_dict = {k: v for k, v in update_in.model_dump(exclude_unset=True).items()}
        if "lifestyle_profile" in update_dict and update_dict["lifestyle_profile"]:
            update_dict["lifestyle_profile"] = update_dict["lifestyle_profile"].model_dump() if hasattr(update_dict["lifestyle_profile"], "model_dump") else update_dict["lifestyle_profile"]

        # Keep full_name and display_name synced
        if "display_name" in update_dict:
            update_dict["full_name"] = update_dict["display_name"]
        elif "full_name" in update_dict:
            update_dict["display_name"] = update_dict["full_name"]

        if "gender" in update_dict:
            update_dict["biological_sex"] = update_dict["gender"]
        elif "biological_sex" in update_dict:
            update_dict["gender"] = update_dict["biological_sex"]

        updated = repo.update(patient_id, update_dict)

        # Non-sensitive audit logging
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "update",
            "resource_type": "patient",
            "resource_id": patient_id,
            "patient_id": patient_id,
            "actor": "api_client",
            "details": {
                "updated_fields": list(update_dict.keys())
            }
        })

        return PatientService.get_patient(db, patient_id)
