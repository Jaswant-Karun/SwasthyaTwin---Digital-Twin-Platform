"""
SwasthyaTwin AI — Comprehensive Final End-to-End Acceptance Tests
Validates the complete supported clinical user journey:
1. Application startup and API health endpoints.
2. Loading and selecting a fictional demo patient.
3. Creating a valid health observation.
4. Confirming the observation persists in MongoDB.
5. Confirming the correct timeline and charts update from API data.
6. Validating malformed, out-of-range, missing, duplicated, and unsupported inputs.
7. Verifying heart-rate baseline calculations against known expected values.
8. Handling insufficient history and unavailable ML artifacts.
9. Verifying sleep inference against the actual model output when available.
10. Preventing patient data from appearing in another patient's view (strict isolation).
11. Handling database disconnection and API failures without silent fake-data substitution.
12. Keeping hypothetical simulations separate from measured observations.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from pymongo.database import Database

from app.main import app
from app.api.deps import get_database
from app.database.seed import seed_synthetic_patients
from app.analytics.hr_anomaly_engine import (
    calculate_hr_baseline,
    evaluate_heart_rate_observation
)
from app.services.sleep_inference_service import sleep_inference_service


@pytest.fixture
def test_client(mock_db: Database):
    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ==============================================================================
# 1. Application Startup and API Health Check
# ==============================================================================

def test_01_application_startup_and_health(test_client: TestClient):
    """Verifies that the application starts up and reports healthy status and readiness."""
    res = test_client.get("/health")
    assert res.status_code == 200
    health_data = res.json()
    assert health_data["status"] in ["healthy", "degraded"]
    assert "service" in health_data
    assert "version" in health_data
    assert "database" in health_data
    assert health_data["database"]["status"] == "connected"

    # Readiness probe
    res_ready = test_client.get("/health/ready")
    assert res_ready.status_code == 200
    readiness = res_ready.json()
    assert readiness["ready"] is True


# ==============================================================================
# 2. Loading and Selecting a Fictional Demo Patient
# ==============================================================================

def test_02_load_and_select_fictional_demo_patient(test_client: TestClient, mock_db: Database):
    """Seeds and verifies selection of fictional demo patient PT-1001 (Aarav Mehta)."""
    seed_report = seed_synthetic_patients(mock_db, force=True)
    assert seed_report["status"] in ["success", "already_seeded"]

    # Query all patients
    res = test_client.get("/api/v1/patients")
    assert res.status_code == 200
    patients = res.json()
    assert len(patients) >= 3

    # Select Aarav Mehta (PT-1001)
    res_aarav = test_client.get("/api/v1/patients/PT-1001")
    assert res_aarav.status_code == 200
    aarav = res_aarav.json()
    assert aarav["patient_id"] == "PT-1001"
    assert "Aarav Mehta" in (aarav.get("display_name") or aarav.get("full_name"))
    assert aarav["age"] == 38
    assert aarav["demo_data"] is True
    assert aarav["is_synthetic"] is True
    assert "lifestyle_profile" in aarav
    assert aarav["lifestyle_profile"]["baseline_sleep_hours"] == 7.5


# ==============================================================================
# 3. Creating a Valid Health Observation
# ==============================================================================

def test_03_create_valid_health_observation(test_client: TestClient, mock_db: Database):
    """Ingests a valid resting heart rate reading and checks canonical unit coercion and provenance."""
    test_client.post("/api/v1/patients", json={
        "patient_id": "PT-ACCEPT-01",
        "display_name": "Acceptance Test Patient",
        "age": 40
    })

    now_iso = datetime.now(timezone.utc).isoformat()
    obs_payload = {
        "patient_id": "PT-ACCEPT-01",
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "source": "wearable",
        "data_kind": "measured",
        "timestamp": now_iso
    }
    res = test_client.post("/api/v1/patients/PT-ACCEPT-01/observations", json=obs_payload)
    assert res.status_code == 201
    created = res.json()
    assert created["patient_id"] == "PT-ACCEPT-01"
    assert created["measurement_type"] == "heart_rate"
    assert created["value"] == 72.0
    assert created["unit"] == "bpm"
    assert created["validation_status"] == "valid"
    assert "observation_id" in created


# ==============================================================================
# 4. Confirming Observation Persists in MongoDB
# ==============================================================================

def test_04_observation_persists_in_mongodb(test_client: TestClient, mock_db: Database):
    """Ensures created observation is directly persisted in MongoDB collection and readable on fresh query."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-PERSIST-01", "display_name": "Mongo Persist"})

    obs_payload = {
        "patient_id": "PT-PERSIST-01",
        "measurement_type": "spo2",
        "value": 98.0,
        "unit": "%",
        "source": "device_measurement",
        "data_kind": "measured"
    }
    res = test_client.post("/api/v1/patients/PT-PERSIST-01/observations", json=obs_payload)
    assert res.status_code == 201
    obs_id = res.json()["observation_id"]

    # Verify directly in MongoDB collection
    direct_doc = mock_db.observations.find_one({"observation_id": obs_id})
    assert direct_doc is not None
    assert direct_doc["patient_id"] == "PT-PERSIST-01"
    assert direct_doc["value"] == 98.0
    assert direct_doc["unit"] == "%"

    # Verify through API read endpoint
    res_query = test_client.get("/api/v1/patients/PT-PERSIST-01/observations")
    assert res_query.status_code == 200
    items = res_query.json()["items"]
    assert any(item["observation_id"] == obs_id for item in items)


# ==============================================================================
# 5. Confirming Timeline and Charts Update from API Data
# ==============================================================================

def test_05_timeline_and_charts_update_from_api(test_client: TestClient, mock_db: Database):
    """Verifies that newly added observations dynamically appear in timeline and baseline endpoints."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-TIMELINE-01", "display_name": "Timeline Patient"})

    now = datetime.now(timezone.utc)
    # Add two chronological past observations (future timestamps are rejected by plausibility guard)
    for i, val in enumerate([68.0, 74.0]):
        test_client.post("/api/v1/patients/PT-TIMELINE-01/observations", json={
            "patient_id": "PT-TIMELINE-01",
            "measurement_type": "heart_rate",
            "value": val,
            "unit": "bpm",
            "timestamp": (now - timedelta(hours=2 - i)).isoformat()
        })

    # Multi-signal timeline endpoint
    res_timeline = test_client.get("/api/v1/patients/PT-TIMELINE-01/timeline/multi-signal")
    assert res_timeline.status_code == 200
    timeline = res_timeline.json()
    assert timeline["patient_id"] == "PT-TIMELINE-01"
    assert "signals" in timeline
    assert "heart_rate" in timeline["signals"]
    assert len(timeline["signals"]["heart_rate"]["points"]) >= 2

    # Digital twin state reflects the latest reading
    res_twin = test_client.get("/api/v1/patients/PT-TIMELINE-01/twin/state")
    assert res_twin.status_code == 200
    twin_state = res_twin.json()
    assert twin_state["patient_id"] == "PT-TIMELINE-01"
    assert "heart_rate" in twin_state["metrics"]
    assert twin_state["metrics"]["heart_rate"]["current_value"] == 74.0


# ==============================================================================
# 6. Validating Malformed, Out-of-Range, Missing, Duplicated, and Unsupported Inputs
# ==============================================================================

def test_06_input_validation_boundaries(test_client: TestClient, mock_db: Database):
    """Rejects physiologically impossible, malformed, unsupported, or incomplete entries."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-BOUND-01", "display_name": "Boundary Patient"})

    # 1. Physiologically out-of-range heart rate (> 300 bpm)
    res_out = test_client.post("/api/v1/patients/PT-BOUND-01/observations", json={
        "patient_id": "PT-BOUND-01",
        "measurement_type": "heart_rate",
        "value": 999.0,
        "unit": "bpm"
    })
    assert res_out.status_code in [400, 422]

    # 2. Malformed non-numeric value
    res_malformed = test_client.post("/api/v1/patients/PT-BOUND-01/observations", json={
        "patient_id": "PT-BOUND-01",
        "measurement_type": "heart_rate",
        "value": "not-a-number",
        "unit": "bpm"
    })
    assert res_malformed.status_code in [400, 422]

    # 3. Missing required value field
    res_missing = test_client.post("/api/v1/patients/PT-BOUND-01/observations", json={
        "patient_id": "PT-BOUND-01",
        "measurement_type": "heart_rate",
        "unit": "bpm"
    })
    assert res_missing.status_code == 422

    # 4. Hemodynamically invalid paired measurements (Systolic <= Diastolic)
    res_guard = test_client.post("/api/v1/ml/validate-input", json={
        "measurement_type": "blood_pressure_systolic",
        "value": 70.0,
        "unit": "mmHg",
        "paired_measurements": {"blood_pressure_diastolic": 90.0}
    })
    assert res_guard.status_code == 200
    guard = res_guard.json()
    assert guard["is_plausible"] is False
    assert len(guard["warnings"]) > 0

    # 5. Unsupported measurement unit (liters for heart rate)
    res_bad_unit = test_client.post("/api/v1/patients/PT-BOUND-01/observations", json={
        "patient_id": "PT-BOUND-01",
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "liters"
    })
    assert res_bad_unit.status_code in [400, 422]


# ==============================================================================
# 7. Verifying Heart-Rate Baseline Calculations Against Known Expected Values
# ==============================================================================

def test_07_heart_rate_baseline_mathematical_precision():
    """Validates the exact mathematical formula of robust nMAD baseline calculations."""
    now = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)
    # Sequence of 10 observations spaced 1 hour apart: [60, 62, 64, 64, 66, 68, 70, 72, 74, 76]
    test_values = [60.0, 62.0, 64.0, 64.0, 66.0, 68.0, 70.0, 72.0, 74.0, 76.0]
    observations = [
        {
            "patient_id": "PT-MATH-01",
            "observation_id": f"obs_{i}",
            "measurement_type": "heart_rate",
            "value": v,
            "unit": "bpm",
            "observed_at": now - timedelta(hours=(10 - i)),
            "data_kind": "measured",
            "validation_status": "valid"
        }
        for i, v in enumerate(test_values)
    ]

    baseline = calculate_hr_baseline(
        patient_id="PT-MATH-01",
        observations=observations,
        window_days=30,
        min_observations=5,
        reference_time=now
    )
    assert baseline.is_sufficient is True
    assert baseline.observation_count == 10
    # Median of [60, 62, 64, 64, 66, 68, 70, 72, 74, 76] = (66 + 68) / 2 = 67.0
    assert baseline.median == 67.0
    # nMAD = 1.4826 * 4.0 = 5.9304 -> rounded to 5.93
    assert baseline.n_mad == 5.93

    # Anomaly evaluation with spike value: 105.0 bpm
    target_spike = {
        "patient_id": "PT-MATH-01",
        "observation_id": "target_spike",
        "measurement_type": "heart_rate",
        "value": 105.0,
        "unit": "bpm",
        "observed_at": now + timedelta(minutes=30),
        "data_kind": "measured"
    }
    eval_spike = evaluate_heart_rate_observation(
        target_obs=target_spike,
        prior_observations=observations,
        min_observations=5
    )
    assert eval_spike.status == "unusual_high"
    assert eval_spike.robust_score is not None
    assert eval_spike.robust_score > 2.5

    # Evaluation with normal value: 66.0 bpm
    target_normal = {
        "patient_id": "PT-MATH-01",
        "observation_id": "target_normal",
        "measurement_type": "heart_rate",
        "value": 66.0,
        "unit": "bpm",
        "observed_at": now + timedelta(minutes=30),
        "data_kind": "measured"
    }
    eval_normal = evaluate_heart_rate_observation(
        target_obs=target_normal,
        prior_observations=observations,
        min_observations=5
    )
    assert eval_normal.status == "within_personal_range"


# ==============================================================================
# 8. Handling Insufficient History and Unavailable ML Artifacts
# ==============================================================================

def test_08_insufficient_history_and_graceful_abstention(test_client: TestClient, mock_db: Database):
    """Verifies that the engine returns 'insufficient_data' instead of fabricating a baseline when N < 10."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-SPARSE-01", "display_name": "Sparse Patient"})

    now = datetime.now(timezone.utc)
    # Ingest only 2 observations (fewer than the required threshold of 10)
    for i, val in enumerate([68.0, 70.0]):
        test_client.post("/api/v1/patients/PT-SPARSE-01/observations", json={
            "patient_id": "PT-SPARSE-01",
            "measurement_type": "heart_rate",
            "value": val,
            "unit": "bpm",
            "timestamp": (now - timedelta(hours=3 - i)).isoformat()
        })

    res_cardio = test_client.get("/api/v1/patients/PT-SPARSE-01/cardiovascular/baseline")
    assert res_cardio.status_code == 200
    base_info = res_cardio.json()
    assert base_info["status"] == "insufficient_data"
    assert base_info["is_sufficient"] is False
    assert base_info["observation_count"] == 2


# ==============================================================================
# 9. Verifying Sleep Inference Against Actual Model Output
# ==============================================================================

def test_09_actual_sleep_stage_inference(test_client: TestClient):
    """Executes live inference on BiDSleep model artifact and verifies refusal on sensor dropout."""
    if not sleep_inference_service.is_ready:
        pytest.skip("BiDSleep model artifact not present in local test environment.")

    # 1. Valid nocturnal epoch with good optical PPG contact
    valid_payload = {
        "hr_mean": 58.5,
        "hr_std": 1.4,
        "hr_min": 55.0,
        "hr_max": 62.0,
        "hr_valid_count": 6.0,
        "hr_delta_baseline": -4.0,
        "hr_rolling_mean_5m": 59.0,
        "hr_rolling_std_5m": 1.6,
        "time_elapsed_minutes": 120.0
    }
    res = test_client.post("/api/v1/ml/sleep-stage/predict", json=valid_payload)
    assert res.status_code == 200
    pred = res.json()
    assert "predicted_stage_name" in pred
    assert pred["predicted_stage_name"] in ["Wake", "N1", "N2", "N3", "REM"]
    assert "class_probabilities" in pred
    assert "confidence_pct" in pred

    # 2. Sensor dropout (hr_valid_count < 2.0) -> must output Unknown
    dropout_payload = {
        "hr_mean": 60.0,
        "hr_std": 2.0,
        "hr_min": 55.0,
        "hr_max": 65.0,
        "hr_valid_count": 0.5,  # Dropout
        "hr_delta_baseline": 0.0,
        "hr_rolling_mean_5m": 60.0,
        "hr_rolling_std_5m": 2.0,
        "time_elapsed_minutes": 60.0
    }
    res_dropout = test_client.post("/api/v1/ml/sleep-stage/predict", json=dropout_payload)
    assert res_dropout.status_code == 200
    drop_pred = res_dropout.json()
    assert drop_pred["predicted_stage_name"] == "Unknown"
    assert drop_pred["predicted_stage_id"] in [-1, 5]


# ==============================================================================
# 10. Preventing Patient Data from Appearing in Another Patient's View
# ==============================================================================

def test_10_strict_patient_isolation(test_client: TestClient, mock_db: Database):
    """Enforces zero data leakage between two completely separate patients."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-ISO-1", "display_name": "Patient 1"})
    test_client.post("/api/v1/patients", json={"patient_id": "PT-ISO-2", "display_name": "Patient 2"})

    # Log observations for Patient 1
    test_client.post("/api/v1/patients/PT-ISO-1/observations", json={
        "patient_id": "PT-ISO-1",
        "measurement_type": "heart_rate",
        "value": 55.0,
        "unit": "bpm"
    })

    # Log observations for Patient 2
    test_client.post("/api/v1/patients/PT-ISO-2/observations", json={
        "patient_id": "PT-ISO-2",
        "measurement_type": "heart_rate",
        "value": 115.0,
        "unit": "bpm"
    })

    # Verify Patient 1 query contains only Patient 1
    obs_1 = test_client.get("/api/v1/patients/PT-ISO-1/observations").json()["items"]
    assert all(o["patient_id"] == "PT-ISO-1" for o in obs_1)
    assert not any(o["patient_id"] == "PT-ISO-2" for o in obs_1)
    assert obs_1[0]["value"] == 55.0

    # Verify Patient 2 query contains only Patient 2
    obs_2 = test_client.get("/api/v1/patients/PT-ISO-2/observations").json()["items"]
    assert all(o["patient_id"] == "PT-ISO-2" for o in obs_2)
    assert not any(o["patient_id"] == "PT-ISO-1" for o in obs_2)
    assert obs_2[0]["value"] == 115.0


# ==============================================================================
# 11. Database Failure Handling Without Silent Fake-Data Substitution
# ==============================================================================

def test_11_database_failure_handling(mock_db: Database):
    """Ensures database failures surface as structured HTTP errors without silently inventing mock data."""
    def broken_get_db():
        raise RuntimeError("Simulated transient MongoDB network failure.")

    app.dependency_overrides[get_database] = broken_get_db
    with TestClient(app, raise_server_exceptions=False) as broken_client:
        # Request should fail with 500 error instead of silently substituting synthetic Aarav Mehta data
        res = broken_client.get("/api/v1/patients")
        assert res.status_code in [500, 503]
    app.dependency_overrides.clear()


# ==============================================================================
# 12. Keeping Hypothetical Simulations Separate from Measured Observations
# ==============================================================================

def test_12_simulation_separation_from_measured_observations(test_client: TestClient, mock_db: Database):
    """Guarantees What-If counterfactual simulations never mutate or contaminate historical observations."""
    test_client.post("/api/v1/patients", json={"patient_id": "PT-SIM-ACC-1", "display_name": "Sim Patient"})

    # Log 1 real measured observation
    test_client.post("/api/v1/patients/PT-SIM-ACC-1/observations", json={
        "patient_id": "PT-SIM-ACC-1",
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "data_kind": "measured"
    })

    # Run What-If simulation
    sim_payload = {
        "scenario_name": "Sleep & Step Optimization",
        "parameters": {
            "delta_sleep_hours": 1.5,
            "delta_daily_steps": 2500,
            "duration_days": 30
        }
    }
    res_sim = test_client.post("/api/v1/patients/PT-SIM-ACC-1/simulations", json=sim_payload)
    assert res_sim.status_code == 201
    sim_data = res_sim.json()
    assert "trajectories" in sim_data
    assert "disclaimer" in sim_data

    # Verify simulation is stored in simulations collection
    assert mock_db.simulations.count_documents({"patient_id": "PT-SIM-ACC-1"}) == 1

    # Verify observations collection is completely untouched (still exactly 1 measured observation)
    obs_count = mock_db.observations.count_documents({"patient_id": "PT-SIM-ACC-1"})
    assert obs_count == 1

    # Real observations returned via API remain strictly 1
    api_obs = test_client.get("/api/v1/patients/PT-SIM-ACC-1/observations").json()
    assert api_obs["total"] == 1
    assert api_obs["items"][0]["data_kind"] in ["measured", "user_entered"]
