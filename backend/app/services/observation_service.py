from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from bson import ObjectId
from pymongo.database import Database
from app.models.observation import ObservationCreate

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
        query: Dict[str, Any] = {"patient_id": patient_id}
        if metric_type:
            query["metric_type"] = metric_type
        if data_tier:
            query["data_tier"] = data_tier

        time_filter: Dict[str, Any] = {}
        if start_date:
            time_filter["$gte"] = start_date
        if end_date:
            time_filter["$lte"] = end_date
        if time_filter:
            query["timestamp"] = time_filter

        total = db.observations.count_documents(query)
        cursor = db.observations.find(query).sort("timestamp", -1).skip(skip).limit(limit)

        items = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "items": items
        }

    @staticmethod
    def add_observation(db: Database, obs_in: ObservationCreate) -> Dict[str, Any]:
        doc = obs_in.model_dump()
        result = db.observations.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    @staticmethod
    def batch_add_observations(db: Database, observations: List[ObservationCreate]) -> int:
        if not observations:
            return 0
        docs = [obs.model_dump() for obs in observations]
        result = db.observations.insert_many(docs)
        return len(result.inserted_ids)
