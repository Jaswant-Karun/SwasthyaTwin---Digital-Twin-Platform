import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pymongo.database import Database
from app.models.simulation import SimulationRequest
from app.analytics.twin_simulation_engine import run_twin_simulation
from app.repositories.simulation_repository import SimulationRepository
from app.repositories.audit_repository import AuditRepository

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

        sim_id = f"sim_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        # Standardize required fields for simulations collection
        sim_doc["simulation_id"] = sim_id
        sim_doc["id"] = sim_id
        sim_doc["_id"] = sim_id
        sim_doc["created_at"] = now
        sim_doc["scenario_inputs"] = sim_request.parameters.model_dump()
        sim_doc["simulated_summary"] = sim_doc.get("projected_outcomes", {})
        sim_doc["assumptions"] = sim_doc.get("model_assumptions", [])
        sim_doc["model_version"] = "v1.2.0"

        repo = SimulationRepository(db)
        repo.save_simulation(sim_doc)

        # Record audit event
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "run_simulation",
            "resource_type": "simulation",
            "resource_id": sim_id,
            "patient_id": patient_id,
            "actor": "api_client",
            "details": {
                "scenario_name": sim_request.scenario_name,
                "duration_days": sim_request.parameters.duration_days
            }
        })

        return sim_doc

    @staticmethod
    def get_patient_simulations(
        db: Database,
        patient_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        repo = SimulationRepository(db)
        items = repo.list_for_patient(patient_id, limit=limit)
        for doc in items:
            s_id = doc.get("simulation_id") or doc.get("id") or f"sim_{str(doc.get('patient_id', ''))}"
            doc["simulation_id"] = s_id
            doc["id"] = s_id
            doc["_id"] = s_id
            if "projected_outcomes" not in doc and "simulated_summary" in doc:
                doc["projected_outcomes"] = doc["simulated_summary"]
            if "model_assumptions" not in doc and "assumptions" in doc:
                doc["model_assumptions"] = doc["assumptions"]
            if "disclaimer" not in doc:
                doc["disclaimer"] = "Simulation results are predictive projections based on physiological heuristics, not guarantees."
        return items
