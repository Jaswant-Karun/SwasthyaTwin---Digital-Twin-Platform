import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import db_manager
from app.database.seed import seed_synthetic_patients
from app.services.explanation_service import ExplanationService
from app.models.explanation import SimulationExplanationRequest

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def ensure_seed_data():
    db = db_manager.get_database()
    # Seed cohort deterministically
    seed_synthetic_patients(db, force=True)

def test_explanations_pt1001_circadian_drift():
    """
    Test PT-1001 (Aarav Mehta - Circadian strain & sleep disruption).
    Has elevated heart rate, acute sleep deprivation, and active alert.
    """
    res = client.get("/api/v1/patients/PT-1001/explanations")
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == "PT-1001"

    # 1. Health Metric: Heart Rate
    hr = data["metrics"].get("heart_rate")
    assert hr is not None
    assert hr["category"] == "metric"
    assert hr["unit"] == "bpm"
    assert hr["current_value"] is not None
    assert hr["baseline_value"] is not None
    assert hr["window_days"] == 30
    assert hr["observations_count"] > 0
    assert "Z = (Observed - Baseline_Mean)" in hr["formula_latex_or_text"]
    assert len(hr["worked_example_steps"]) >= 4
    assert hr["worked_example_summary"] != ""
    assert hr["data_source"] != ""
    assert hr["latest_timestamp_formatted"] != ""
    assert hr["result_type"] == "Statistical Estimate"
    assert "Non-diagnostic" in hr["limitations"]

    # 2. Baseline: Heart Rate
    base_hr = data["baselines"].get("heart_rate")
    assert base_hr is not None
    assert base_hr["category"] == "baseline"
    assert base_hr["is_sufficient"] is True
    assert base_hr["observations_count"] >= 14
    assert "Median" in base_hr["formula_name"]
    assert len(base_hr["worked_example_steps"]) >= 4

    # 3. Trend Indicator: Vitality Index
    vit = data["trends"].get("vitality_index")
    assert vit is not None
    assert vit["category"] == "trend"
    assert vit["current_value"] is not None
    assert vit["baseline_value"] == 100.0
    assert vit["result_type"] == "Rule-Based Indicator"
    assert "Vitality" in vit["formula_latex_or_text"]
    assert len(vit["worked_example_steps"]) >= 4

    # 4. Active Alert
    alerts = data["alerts"]
    assert len(alerts) > 0
    first_alert = list(alerts.values())[0]
    assert first_alert["category"] == "alert"
    assert first_alert["result_type"] == "Rule-Based Indicator"
    assert first_alert["reason_flag_or_alert"] is not None
    assert len(first_alert["worked_example_steps"]) >= 4

    # 5. Simulation Output
    sim = data["simulation"]
    assert sim is not None
    assert sim["category"] == "simulation"
    assert sim["result_type"] == "Model Prediction"
    assert "exp(" in sim["formula_latex_or_text"]
    assert len(sim["worked_example_steps"]) >= 4

def test_explanations_pt1002_lifestyle_improvement():
    """
    Test PT-1002 (Priya Sharma - Cardiometabolic lifestyle improvement).
    Shows blood pressure improvement and stable adaptations.
    """
    res = client.get("/api/v1/patients/PT-1002/explanations")
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == "PT-1002"

    sbp = data["metrics"].get("blood_pressure_systolic")
    assert sbp is not None
    assert sbp["unit"] == "mmHg"
    assert sbp["current_value"] is not None
    assert sbp["baseline_value"] is not None
    assert len(sbp["worked_example_steps"]) >= 4

    base_sbp = data["baselines"].get("blood_pressure_systolic")
    assert base_sbp is not None
    assert base_sbp["observations_count"] > 0

    vit = data["trends"].get("vitality_index")
    assert vit is not None
    assert vit["current_value"] > 0

def test_explanations_pt1005_missing_glucose_telemetry():
    """
    Test PT-1005 (Kabir Sen - Bimodal desk worker).
    Has UNTRACKED glucose telemetry to verify honest missing data handling.
    """
    res = client.get("/api/v1/patients/PT-1005/explanations")
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == "PT-1005"

    glucose = data["metrics"].get("fasting_blood_glucose")
    assert glucose is not None
    # Must handle missing data honestly
    assert glucose["is_missing_data"] is True
    assert glucose["is_sufficient"] is False
    assert glucose["current_value"] is None
    assert "Awaiting Telemetry" in glucose["current_value_formatted"]
    assert "Not Established" in glucose["baseline_formatted"]
    assert len(glucose["warnings"]) > 0
    assert any("Missing" in w for w in glucose["warnings"])
    assert "Anti-Population Norm" in glucose["worked_example_steps"][1]["title"]

    base_glucose = data["baselines"].get("fasting_blood_glucose")
    assert base_glucose is not None
    assert base_glucose["is_missing_data"] is True
    assert base_glucose["observations_count"] == 0

def test_custom_simulation_explanation():
    """
    Test dynamic simulation explanation endpoint with custom levers.
    """
    payload = {
        "patient_id": "PT-1001",
        "scenario_name": "Intensive Sleep & Activity Intervention",
        "parameters": {
            "delta_sleep_hours": 2.0,
            "delta_daily_steps": 5000,
            "delta_stress_level": -20.0,
            "sodium_reduction_pct": 25.0,
            "duration_days": 45
        },
        "baseline_summary": {
            "resting_hr": 68.0,
            "systolic_bp": 120.0,
            "hrv_rmssd": 50.0
        }
    }
    res = client.post("/api/v1/patients/PT-1001/explanations/simulation", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "simulation"
    assert data["result_type"] == "Model Prediction"
    assert data["window_days"] == 45
    assert len(data["worked_example_steps"]) >= 5
    assert "Intensive Sleep" in data["title"]
    assert "Pharmacokinetic" in data["formula_name"]
    # Check that worked example has step 4 with delta calculations
    step4 = data["worked_example_steps"][3]
    assert "Sleep Effect" in step4["calculation"]
    assert "Activity Effect" in step4["calculation"]

def test_specific_category_item_endpoints():
    """
    Test /patients/{id}/explanations/{category}/{item_id} endpoint.
    """
    res_metric = client.get("/api/v1/patients/PT-1001/explanations/metric/heart_rate")
    assert res_metric.status_code == 200
    assert res_metric.json()["metric_type"] == "heart_rate"

    res_baseline = client.get("/api/v1/patients/PT-1001/explanations/baseline/heart_rate")
    assert res_baseline.status_code == 200
    assert res_baseline.json()["category"] == "baseline"

    res_trend = client.get("/api/v1/patients/PT-1001/explanations/trend/vitality_index")
    assert res_trend.status_code == 200
    assert res_trend.json()["category"] == "trend"
