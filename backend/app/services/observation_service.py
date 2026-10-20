import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pymongo.database import Database
from app.models.observation import ObservationCreate, ObservationBase
from app.repositories.observation_repository import ObservationRepository
from app.repositories.audit_repository import AuditRepository

logger = logging.getLogger(__name__)

class ObservationService:
    @staticmethod
    def query_observations(
        db: Database,
        patient_id: str,
        metric_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        data_tier: Optional[str] = None,
        skip: int = 0,
        limit: int = 200
    ) -> Dict[str, Any]:
        repo = ObservationRepository(db)
        items, total = repo.list_observations(
            patient_id=patient_id,
            measurement_type=metric_type,
            start_date=start_date,
            end_date=end_date,
            data_kind=data_tier,
            skip=skip,
            limit=limit
        )

        # Ensure id and compatibility fields are present for UI and tests
        for item in items:
            item["id"] = item.get("observation_id", f"obs_{str(item.get('patient_id', ''))}")
            item["_id"] = item["id"]

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "items": items
        }

    @staticmethod
    def add_observation(db: Database, obs_in: ObservationCreate) -> Dict[str, Any]:
        repo = ObservationRepository(db)
        base_obs = obs_in.to_observation_base()
        doc = base_obs.model_dump()

        # Add compatibility fields
        doc["metric_type"] = base_obs.measurement_type
        doc["timestamp"] = base_obs.observed_at
        doc["data_tier"] = "user_reported" if base_obs.data_kind == "user_entered" else base_obs.data_kind

        created = repo.create(doc)
        created["id"] = created.get("observation_id")
        created["_id"] = created["id"]

        # Audit logging (non-sensitive)
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "create_observation",
            "resource_type": "observation",
            "resource_id": created["id"],
            "patient_id": base_obs.patient_id,
            "actor": "api_client",
            "details": {
                "measurement_type": base_obs.measurement_type,
                "unit": base_obs.unit,
                "data_kind": base_obs.data_kind
            }
        })

        return created

    @staticmethod
    def batch_add_observations(db: Database, observations: List[ObservationCreate]) -> int:
        if not observations:
            return 0
        repo = ObservationRepository(db)
        docs = []
        for obs in observations:
            base_obs = obs.to_observation_base()
            d = base_obs.model_dump()
            d["metric_type"] = base_obs.measurement_type
            d["timestamp"] = base_obs.observed_at
            d["data_tier"] = "user_reported" if base_obs.data_kind == "user_entered" else base_obs.data_kind
            docs.append(d)

        count = repo.create_batch(docs)
        return count
