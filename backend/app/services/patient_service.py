from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pymongo.database import Database
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse

class PatientService:
    @staticmethod
    def list_patients(
        db: Database,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if search:
            query["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"patient_id": {"$regex": search, "$options": "i"}},
                {"chronic_conditions": {"$regex": search, "$options": "i"}}
            ]
        
        cursor = db.patients.find(query).sort("created_at", -1).skip(skip).limit(limit)
        patients = []
        for doc in cursor:
            # Augment with active alert counts and total observations
            pid = doc["patient_id"]
            doc["active_alerts_count"] = db.alerts.count_documents({
                "patient_id": pid,
                "is_acknowledged": False
            })
            doc["total_observations_count"] = db.observations.count_documents({
                "patient_id": pid
            })
            # Fetch latest assessment vitality if present
            latest_assess = db.health_assessments.find_one(
                {"patient_id": pid},
                sort=[("calculated_at", -1)]
            )
            if latest_assess:
                doc["latest_vitality_index"] = latest_assess.get("vitality_index")
                doc["stability_status"] = latest_assess.get("stability_status")
            
            patients.append(doc)
        return patients

    @staticmethod
    def get_patient(db: Database, patient_id: str) -> Optional[Dict[str, Any]]:
        doc = db.patients.find_one({"patient_id": patient_id})
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
            sort=[("calculated_at", -1)]
        )
        if latest_assess:
            doc["latest_vitality_index"] = latest_assess.get("vitality_index")
            doc["stability_status"] = latest_assess.get("stability_status")
        return doc

    @staticmethod
    def create_patient(db: Database, patient_in: PatientCreate) -> Dict[str, Any]:
        existing = db.patients.find_one({"patient_id": patient_in.patient_id})
        if existing:
            raise ValueError(f"Patient with ID '{patient_in.patient_id}' already exists.")

        now = datetime.now(timezone.utc)
        doc = patient_in.model_dump()
        doc["created_at"] = now
        doc["updated_at"] = now

        db.patients.insert_one(doc)
        return PatientService.get_patient(db, patient_in.patient_id)

    @staticmethod
    def update_patient(
        db: Database,
        patient_id: str,
        update_in: PatientUpdate
    ) -> Optional[Dict[str, Any]]:
        existing = db.patients.find_one({"patient_id": patient_id})
        if not existing:
            return None

        update_dict = {k: v for k, v in update_in.model_dump(exclude_unset=True).items()}
        if "lifestyle_profile" in update_dict and update_dict["lifestyle_profile"]:
            update_dict["lifestyle_profile"] = update_dict["lifestyle_profile"].model_dump() if hasattr(update_dict["lifestyle_profile"], "model_dump") else update_dict["lifestyle_profile"]

        update_dict["updated_at"] = datetime.now(timezone.utc)

        db.patients.update_one({"patient_id": patient_id}, {"$set": update_dict})
        return PatientService.get_patient(db, patient_id)
