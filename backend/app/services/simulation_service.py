from typing import List, Dict, Any, Optional
from bson import ObjectId
from pymongo.database import Database
from app.models.simulation import SimulationRequest
from app.analytics.twin_simulation_engine import run_twin_simulation

class SimulationService:
    @staticmethod
    def execute_simulation(
        db: Database,
        patient_id: str,
        sim_request: SimulationRequest
    ) -> Dict[str, Any]:
        # Compute current baseline values to anchor simulation
        from app.services.assessment_service import AssessmentService
        baselines = AssessmentService.get_patient_baselines(db, patient_id)

        baseline_stats = {}
        for k, v in baselines.items():
            baseline_stats[k] = v.get("mean", 70.0)

        sim_doc = run_twin_simulation(
            patient_id=patient_id,
            scenario_name=sim_request.scenario_name,
            params=sim_request.parameters,
            baseline_stats=baseline_stats
        )

        result = db.simulations.insert_one(sim_doc)
        sim_doc["_id"] = str(result.inserted_id)
        return sim_doc

    @staticmethod
    def get_patient_simulations(
        db: Database,
        patient_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        cursor = db.simulations.find({"patient_id": patient_id}).sort("created_at", -1).limit(limit)
        items = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items
