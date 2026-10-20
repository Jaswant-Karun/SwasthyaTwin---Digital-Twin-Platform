from app.analytics.twin_simulation_engine import run_twin_simulation
from app.models.simulation import InterventionParams

def test_twin_simulation_lifestyle_optimization():
    params = InterventionParams(
        delta_sleep_hours=1.5,
        delta_daily_steps=3000,
        delta_stress_level=-20.0,
        sodium_reduction_pct=15.0,
        duration_days=30
    )
    baseline_stats = {
        "heart_rate": 74.0,
        "blood_pressure_systolic": 130.0,
        "hrv_rmssd": 38.0
    }

    result = run_twin_simulation(
        patient_id="PT-TEST",
        scenario_name="Test Simulation",
        params=params,
        baseline_stats=baseline_stats
    )

    assert result["patient_id"] == "PT-TEST"
    assert len(result["trajectories"]) == 30

    outcomes = result["projected_outcomes"]
    # Improving sleep, steps, and reducing sodium should decrease resting HR and systolic BP
    assert outcomes["delta_resting_hr"] < 0
    assert outcomes["delta_systolic_bp"] < 0
    assert outcomes["delta_hrv_rmssd"] > 0
    assert "disclaimer" in result
