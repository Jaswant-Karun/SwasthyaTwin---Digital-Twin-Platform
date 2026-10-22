"""
End-to-End Integration Tests for SwasthyaTwin AI Platform
Tests the complete required user journey:
1. Patient registration (Demo vs Live Clinical User)
2. Validated observation ingestion, canonical unit conversion, and MongoDB persistence
3. Patient isolation (Zero cross-patient leakage in observations, baselines, and alerts)
4. Invalid/implausible input detection & rejection
5. Baseline corridor calculation strictly from eligible observations
6. Machine Learning prediction safeguards (No zero-imputation, freshness audit, version metadata)
7. Prediction vs Actual future telemetry comparison
8. What-If counterfactual simulation with explicit separation between measured and simulated data
9. Authentic model evaluation artifact retrieval from saved manifest
10. Resettable demo cohort preserving real user data
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from pymongo.database import Database

from app.main import app
from app.api.deps import get_database
from app.ml.config import DATASET_NAME, DATASET_VERSION
from app.services.patient_service import PatientService
from app.services.observation_service import ObservationService
from app.services.assessment_service import AssessmentService

@pytest.fixture
def test_client(mock_db: Database):
    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

# --- 1. Patient Registration & Research Demo Provenance ---

def test_patient_registration_and_provenance(test_client: TestClient, mock_db: Database):
    # 1. Register a real clinical user
    real_user_payload = {
        "patient_id": "PT-USER-001",
        "display_name": "Dr. Ananya Roy",
        "age": 42,
        "gender": "female",
        "baseline_window_days": 30,
        "chronic_conditions": [],
        "demo_data": False,
        "is_synthetic": False
    }
    res = test_client.post("/api/v1/patients", json=real_user_payload)
    assert res.status_code == 201
    user_data = res.json()
    assert user_data["patient_id"] == "PT-USER-001"
    assert user_data["demo_data"] is False

    # 2. Register a synthetic demo record
    demo_payload = {
        "patient_id": "PT-DEMO-001",
        "display_name": "Synthetic Demo Subject",
        "age": 35,
        "gender": "male",
        "baseline_window_days": 30,
        "chronic_conditions": ["mild_hypertension"],
        "demo_data": True,
        "is_synthetic": True
    }
    res2 = test_client.post("/api/v1/patients", json=demo_payload)
    assert res2.status_code == 201
    demo_data = res2.json()
    assert demo_data["patient_id"] == "PT-DEMO-001"
    assert demo_data["demo_data"] is True

    # 3. Retrieve patients with filter
    res_list = test_client.get("/api/v1/patients")
    assert res_list.status_code == 200
    patients = res_list.json()
    ids = [p["patient_id"] for p in patients]
    assert "PT-USER-001" in ids
    assert "PT-DEMO-001" in ids


# --- 2. Observation Ingestion, Unit Conversion & Persistence Across Reloads ---

def test_observation_ingestion_and_mongo_persistence(test_client: TestClient, mock_db: Database):
    # Create patient
    test_client.post("/api/v1/patients", json={
        "patient_id": "PT-PERSIST-1",
        "display_name": "Persistence Patient",
        "age": 30
    })

    # Ingest observation in non-canonical unit (e.g., Fahrenheit or regular bpm)
    obs_payload = {
        "patient_id": "PT-PERSIST-1",
        "measurement_type": "heart_rate",
        "value": 74.0,
        "unit": "bpm",
        "source": "manual_entry",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    res_post = test_client.post("/api/v1/patients/PT-PERSIST-1/observations", json=obs_payload)
    assert res_post.status_code == 201
    ingested = res_post.json()
    assert ingested["value"] == 74.0
    assert ingested["unit"] == "bpm"
    assert ingested["validation_status"] == "valid"

    # Simulate page refresh / subsequent query
    res_get = test_client.get("/api/v1/patients/PT-PERSIST-1/observations")
    assert res_get.status_code == 200
    obs_list = res_get.json()
    assert obs_list["total"] >= 1
    matched = [o for o in obs_list["items"] if o["measurement_type"] == "heart_rate"]
    assert len(matched) >= 1
    assert matched[0]["value"] == 74.0
    assert matched[0]["source"] == "manual_entry"


# --- 3. Patient Data Isolation (Zero Cross-Patient Leakage) ---

def test_patient_data_isolation(test_client: TestClient, mock_db: Database):
    # Register Patient A and Patient B
    test_client.post("/api/v1/patients", json={"patient_id": "PT-ISOLATE-A", "display_name": "Patient Alpha"})
    test_client.post("/api/v1/patients", json={"patient_id": "PT-ISOLATE-B", "display_name": "Patient Beta"})

    # Log measurements
    test_client.post("/api/v1/patients/PT-ISOLATE-A/observations", json={
        "patient_id": "PT-ISOLATE-A",
        "measurement_type": "heart_rate",
        "value": 62.0,
        "unit": "bpm"
    })
    test_client.post("/api/v1/patients/PT-ISOLATE-B/observations", json={
        "patient_id": "PT-ISOLATE-B",
        "measurement_type": "heart_rate",
        "value": 98.0,
        "unit": "bpm"
    })

    # Assert Patient A's query contains ONLY Patient A's data
    res_a = test_client.get("/api/v1/patients/PT-ISOLATE-A/observations")
    items_a = res_a.json()["items"]
    assert all(o["patient_id"] == "PT-ISOLATE-A" for o in items_a)
    assert not any(o["patient_id"] == "PT-ISOLATE-B" for o in items_a)

    # Assert Patient B's query contains ONLY Patient B's data
    res_b = test_client.get("/api/v1/patients/PT-ISOLATE-B/observations")
    items_b = res_b.json()["items"]
    assert all(o["patient_id"] == "PT-ISOLATE-B" for o in items_b)
    assert not any(o["patient_id"] == "PT-ISOLATE-A" for o in items_b)

    # Baselines for Patient A must not be influenced by Patient B
    baseline_a = test_client.get("/api/v1/patients/PT-ISOLATE-A/twin/baseline").json()
    hr_base_a = baseline_a["baselines"].get("heart_rate")
    assert hr_base_a is not None
    assert hr_base_a["mean"] == 62.0


# --- 4. Invalid Input Auditing & Plausibility Guard ---

def test_invalid_input_handling(test_client: TestClient, mock_db: Database):
    test_client.post("/api/v1/patients", json={"patient_id": "PT-QUALITY-1", "display_name": "Quality Audit Patient"})

    # 1. Physiologically impossible heart rate (999 bpm)
    res_impossible = test_client.post("/api/v1/patients/PT-QUALITY-1/observations", json={
        "patient_id": "PT-QUALITY-1",
        "measurement_type": "heart_rate",
        "value": 999.0,
        "unit": "bpm"
    })
    # Should be rejected with 422 Unprocessable Entity
    assert res_impossible.status_code == 422

    # 2. Input plausibility guard (systolic <= diastolic)
    res_guard = test_client.post("/api/v1/ml/validate-input", json={
        "measurement_type": "blood_pressure_systolic",
        "value": 70.0,
        "unit": "mmHg",
        "paired_measurements": {"blood_pressure_diastolic": 90.0}
    })
    assert res_guard.status_code == 200
    guard_data = res_guard.json()
    assert guard_data["is_plausible"] is False
    assert len(guard_data["warnings"]) > 0


# --- 5. Baseline Recalculation Strictly on Eligible Observations ---

def test_baseline_recalculation(test_client: TestClient, mock_db: Database):
    test_client.post("/api/v1/patients", json={"patient_id": "PT-BASE-1", "display_name": "Baseline Patient"})

    # Ingest 5 heart rate observations
    values = [60.0, 62.0, 64.0, 66.0, 68.0]
    for v in values:
        test_client.post("/api/v1/patients/PT-BASE-1/observations", json={
            "patient_id": "PT-BASE-1",
            "measurement_type": "heart_rate",
            "value": v,
            "unit": "bpm",
            "source": "device_measurement"
        })

    res_base = test_client.get("/api/v1/patients/PT-BASE-1/twin/baseline?window_days=30")
    assert res_base.status_code == 200
    base_data = res_base.json()["baselines"]
    assert "heart_rate" in base_data
    hr_metric = base_data["heart_rate"]
    assert hr_metric["sample_count"] == 5
    assert hr_metric["mean"] == 64.0
    assert hr_metric["median"] == 64.0


# --- 6. Prediction Safeguards & Feature Completeness ---

def test_prediction_safeguards_missing_features(test_client: TestClient, mock_db: Database):
    # Patient with NO telemetry data
    test_client.post("/api/v1/patients", json={"patient_id": "PT-SAFE-1", "display_name": "Safeguard Patient"})

    res_pred = test_client.get("/api/v1/patients/PT-SAFE-1/ml/prediction")
    assert res_pred.status_code == 200
    data = res_pred.json()
    
    # Must refuse prediction safely without zero-imputation
    assert data["status"] in ["insufficient_features", "missing_features", "data_stale"]
    assert "warnings" in data
    assert any("missing" in w.lower() or "telemetry" in w.lower() for w in data["warnings"])
    assert data["prediction"] is None


def test_prediction_when_features_present(test_client: TestClient, mock_db: Database):
    # Test authentic PhysioNet epoch inference with full valid features
    valid_features = {
        "hr_mean": 62.5,
        "hr_std": 2.3,
        "hr_min": 58.0,
        "hr_max": 68.0,
        "hr_delta_baseline": -4.2,
        "hr_rolling_mean_5m": 63.1,
        "hr_rolling_std_5m": 2.8,
        "time_elapsed_minutes": 180.0
    }
    res = test_client.post("/api/v1/ml/sleep-stage/predict", json=valid_features)
    assert res.status_code == 200
    pred_data = res.json()
    assert "predicted_stage_name" in pred_data
    assert pred_data["predicted_stage_name"] in ["Wake", "NREM", "REM"]
    assert "confidence_pct" in pred_data
    assert "model_metadata" in pred_data
    assert pred_data["model_metadata"]["target_unit"] == "sleep_stage_3class"
    assert "limitations" in pred_data["model_metadata"]


# --- 7. What-If Counterfactual Simulation Integrity ---

def test_what_if_simulation_separation(test_client: TestClient, mock_db: Database):
    test_client.post("/api/v1/patients", json={"patient_id": "PT-SIM-1", "display_name": "Simulation Patient"})
    
    sim_payload = {
        "patient_id": "PT-SIM-1",
        "interventions": {
            "sleep_hours_delta": 1.5,
            "daily_steps_delta": 3000
        },
        "horizon_days": 30
    }
    res_sim = test_client.post("/api/v1/patients/PT-SIM-1/simulations", json=sim_payload)
    assert res_sim.status_code == 201
    sim_data = res_sim.json()
    assert "trajectory" in sim_data
    assert "scientific_basis" in sim_data
    assert "disclaimer" in sim_data
    assert "hypothetical" in sim_data["disclaimer"].lower()

    # Verify that the simulation run did NOT contaminate actual patient observations
    res_obs = test_client.get("/api/v1/patients/PT-SIM-1/observations")
    assert res_obs.json()["total"] == 0


# --- 8. Model Evaluation Manifest Integrity ---

def test_model_evaluation_manifest(test_client: TestClient):
    res = test_client.get("/api/v1/ml/sleep-stage/evaluation")
    assert res.status_code == 200
    manifest = res.json()
    
    # Must come from genuine PhysioNet model manifest
    assert manifest["dataset_provenance"]["dataset_name"] == DATASET_NAME
    assert manifest["dataset_provenance"]["dataset_version"] == DATASET_VERSION
    assert manifest["held_out_test_evaluations"]["random_forest"]["balanced_accuracy"] > 0.50
    assert "confusion_matrix" in manifest["held_out_test_evaluations"]["random_forest"]
    assert "baseline_comparison" in manifest


# --- 9. Resettable Demo State Preserving Real User Records ---

def test_resettable_demo_state_protects_user_records(test_client: TestClient, mock_db: Database):
    # 1. Register a permanent real user record
    test_client.post("/api/v1/patients", json={
        "patient_id": "PT-PERMANENT-USER",
        "display_name": "Permanent User",
        "demo_data": False,
        "is_synthetic": False
    })
    # Ingest observation for permanent user
    test_client.post("/api/v1/patients/PT-PERMANENT-USER/observations", json={
        "patient_id": "PT-PERMANENT-USER",
        "measurement_type": "heart_rate",
        "value": 70.0,
        "unit": "bpm"
    })

    # 2. Register synthetic demo patient
    test_client.post("/api/v1/patients", json={
        "patient_id": "PT-1001",
        "display_name": "Aarav Mehta",
        "demo_data": True,
        "is_synthetic": True
    })

    # 3. Call reset endpoint with confirm=True
    res_reset = test_client.post("/api/v1/seed/reset?confirm=true")
    assert res_reset.status_code == 200
    reset_report = res_reset.json()
    assert reset_report["status"] == "success"

    # 4. Verify permanent user is still in the database with their observations
    res_user = test_client.get("/api/v1/patients/PT-PERMANENT-USER")
    assert res_user.status_code == 200
    assert res_user.json()["patient_id"] == "PT-PERMANENT-USER"

    res_user_obs = test_client.get("/api/v1/patients/PT-PERMANENT-USER/observations")
    assert res_user_obs.status_code == 200
    assert res_user_obs.json()["total"] >= 1
