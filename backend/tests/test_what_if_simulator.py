import pytest
from datetime import datetime, timezone
from pymongo.database import Database
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.models.simulation import InterventionParams, SimulationRequest
from app.analytics.twin_simulation_engine import run_twin_simulation
from app.services.simulation_service import SimulationService

# ==============================================================================
# 1. Calculation Reproducibility & Deterministic Kinetics
# ==============================================================================

def test_simulation_calculation_reproducibility():
    """Verify that identical simulation inputs produce bit-for-bit identical trajectories."""
    params = InterventionParams(
        delta_sleep_hours=1.0,
        delta_daily_steps=2500,
        delta_stress_level=-15.0,
        sodium_reduction_pct=20.0,
        duration_days=30
    )
    baseline_stats = {
        "heart_rate": 72.0,
        "blood_pressure_systolic": 126.0,
        "hrv_rmssd": 44.0
    }

    res1 = run_twin_simulation("PT-REPRO-1", "Reproducibility Test", params, baseline_stats)
    res2 = run_twin_simulation("PT-REPRO-1", "Reproducibility Test", params, baseline_stats)

    assert res1["projected_outcomes"]["final_resting_hr"] == res2["projected_outcomes"]["final_resting_hr"]
    assert res1["projected_outcomes"]["delta_resting_hr"] == res2["projected_outcomes"]["delta_resting_hr"]
    assert res1["projected_outcomes"]["final_systolic_bp"] == res2["projected_outcomes"]["final_systolic_bp"]
    assert res1["projected_outcomes"]["delta_systolic_bp"] == res2["projected_outcomes"]["delta_systolic_bp"]
    assert len(res1["trajectories"]) == len(res2["trajectories"]) == 30
    assert res1["trajectories"][-1]["resting_hr"] == res2["trajectories"][-1]["resting_hr"]


# ==============================================================================
# 2. Input Validation, Range Enforcement & Contradiction Detection
# ==============================================================================

def test_simulation_input_range_enforcement():
    """Verify that parameters out of bounds raise validation errors."""
    # delta_sleep_hours exceeding ge=-4.0, le=4.0
    with pytest.raises(ValidationError):
        InterventionParams(delta_sleep_hours=10.0)

    with pytest.raises(ValidationError):
        InterventionParams(delta_daily_steps=50000)

    with pytest.raises(ValidationError):
        InterventionParams(sodium_reduction_pct=80.0)

    with pytest.raises(ValidationError):
        InterventionParams(duration_days=180)


def test_simulation_contradictory_inputs_rejected():
    """Verify that biologically contradictory combinations are rejected."""
    # Severe sleep deprivation (-3.5h) with extreme high-volume step increase (+12,000 steps)
    with pytest.raises(ValidationError) as exc_info:
        InterventionParams(
            delta_sleep_hours=-3.5,
            delta_daily_steps=12000
        )
    assert "Contradictory scenario parameters" in str(exc_info.value)


# ==============================================================================
# 3. Patient Isolation & Separation from Measured Records
# ==============================================================================

def test_simulation_does_not_mutate_patient_measured_observations(mock_db: Database):
    """Verify running a simulation writes ONLY to simulations and NEVER to observations."""
    patient_id = "PT-SIM-ISOLATION"
    mock_db.patients.insert_one({"patient_id": patient_id, "full_name": "Isolation Patient"})

    # Ingest 2 verified measured observations
    obs1 = {
        "observation_id": "obs_iso_1",
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "data_tier": "measured"
    }
    mock_db.observations.insert_one(obs1)

    initial_obs_count = mock_db.observations.count_documents({"patient_id": patient_id})
    assert initial_obs_count == 1

    # Execute simulation
    sim_request = SimulationRequest(
        scenario_name="Aggressive Lifestyle Shift",
        parameters=InterventionParams(delta_sleep_hours=2.0, delta_daily_steps=4000)
    )
    sim_res = SimulationService.execute_simulation(mock_db, patient_id, sim_request)

    # 1. Observations count MUST NOT CHANGE
    post_obs_count = mock_db.observations.count_documents({"patient_id": patient_id})
    assert post_obs_count == initial_obs_count

    # 2. Simulation record must have data_tier: 'simulated'
    saved_sim = mock_db.simulations.find_one({"simulation_id": sim_res["simulation_id"]})
    assert saved_sim is not None
    assert saved_sim["data_tier"] == "simulated"
    assert saved_sim["patient_id"] == patient_id
    assert "model_version" in saved_sim


def test_simulation_patient_isolation(mock_db: Database):
    """Verify that simulations stored for Patient A are never leaked to Patient B."""
    p_a = "PT-ALPHA"
    p_b = "PT-BETA"
    mock_db.patients.insert_one({"patient_id": p_a, "full_name": "Alpha"})
    mock_db.patients.insert_one({"patient_id": p_b, "full_name": "Beta"})

    sim_req = SimulationRequest(
        scenario_name="Alpha Scenario",
        parameters=InterventionParams(delta_sleep_hours=1.0)
    )
    SimulationService.execute_simulation(mock_db, p_a, sim_req)

    # List simulations for Beta must be 0
    beta_sims = SimulationService.get_patient_simulations(mock_db, p_b)
    assert len(beta_sims) == 0

    # List simulations for Alpha must be 1
    alpha_sims = SimulationService.get_patient_simulations(mock_db, p_a)
    assert len(alpha_sims) == 1
    assert alpha_sims[0]["patient_id"] == p_a


# ==============================================================================
# 4. Output Semantic Classification & Provenance Tagging
# ==============================================================================

def test_simulation_output_classifications_and_provenance():
    """Verify every output is classified as deterministic calculation, prediction, or assumption."""
    params = InterventionParams(delta_sleep_hours=1.0, delta_daily_steps=2000)
    baseline_stats = {"heart_rate": 70.0, "systolic_bp": 120.0, "hrv_rmssd": 50.0}

    result = run_twin_simulation("PT-TEST", "Output Classification Test", params, baseline_stats)

    assert result["data_tier"] == "simulated"
    assert "output_classifications" in result
    classifications = result["output_classifications"]
    assert classifications["resting_hr"] == "deterministic_calculation"
    assert classifications["ml_risk_tier"] == "model_prediction"
    assert classifications["lifestyle_adherence"] == "illustrative_assumption"
    assert "disclaimer" in result
    assert "not constitute medical advice" in result["disclaimer"].lower()
