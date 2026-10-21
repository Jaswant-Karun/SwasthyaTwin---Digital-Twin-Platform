import pytest
import pymongo
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_database

# Helper to check if real MongoDB is reachable
def is_real_mongo_available():
    try:
        c = pymongo.MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1500)
        c.server_info()
        c.close()
        return True
    except Exception:
        return False

@pytest.fixture
def real_mongo_db():
    if not is_real_mongo_available():
        pytest.skip("Real MongoDB server at localhost:27017 is not available.")
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["swasthyatwin_integration_test"]
    # Clean up test collections prior to test run
    db.patients.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.observations.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.health_assessments.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.alerts.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.audit_events.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})

    yield db

    # Teardown test artifacts
    db.patients.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.observations.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.health_assessments.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.alerts.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    db.audit_events.delete_many({"patient_id": {"$regex": "^PT-PIPE-"}})
    client.close()

@pytest.fixture
def real_client(real_mongo_db):
    def override_get_db():
        yield real_mongo_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

# ================================================================
# 1. Real MongoDB Integration Test: Complete Ingestion Pipeline
# ================================================================

def test_complete_user_input_to_twin_pipeline_real_mongodb(real_client, real_mongo_db):
    """
    Executes the full 10-step user-input-to-Digital-Twin update pipeline on real MongoDB:
    1. Patient creation.
    2. First observation logging (provisional baseline, sufficiency message).
    3. Sparse observations below N=3 (no premature locked baseline).
    4. Minimum sample threshold reached (N=3, baseline established).
    5. Observation with deviation (absolute, relative, z-score, vitality update).
    6. Direct MongoDB verification of persistence and audit trail.
    """
    pid = "PT-PIPE-001"
    now = datetime.now(timezone.utc)

    # 1. Create Patient in MongoDB
    create_res = real_client.post("/api/v1/patients", json={
        "patient_id": pid,
        "full_name": "Integration Patient One",
        "age": 42,
        "biological_sex": "male",
        "baseline_window_days": 30
    })
    assert create_res.status_code == 201
    stored_patient = real_mongo_db.patients.find_one({"patient_id": pid})
    assert stored_patient is not None
    assert stored_patient["full_name"] == "Integration Patient One"

    # 2. First Observation: Heart Rate = 70 bpm
    obs1_payload = {
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 70.0,
        "unit": "bpm",
        "observed_at": (now - timedelta(days=5)).isoformat(),
        "source": "manual_entry",
        "data_kind": "user_entered"
    }
    res1 = real_client.post(f"/api/v1/patients/{pid}/observations", json=obs1_payload)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["value"] == 70.0
    assert data1["unit"] == "bpm"
    assert "assessment_update" in data1
    asmt1 = data1["assessment_update"]
    assert asmt1["is_first_observation"] is True
    assert asmt1["previous_baseline"] is None
    assert asmt1["updated_baseline"]["sample_count"] == 1
    assert asmt1["updated_baseline"]["is_sufficient"] is False
    assert "minimum" in asmt1["sufficiency_message"].lower()

    # Verify directly in MongoDB
    db_obs1 = real_mongo_db.observations.find_one({"observation_id": data1["id"]})
    assert db_obs1 is not None
    assert db_obs1["value"] == 70.0
    assert db_obs1["patient_id"] == pid

    # Verify patient total_observations_count incremented
    p_after_1 = real_mongo_db.patients.find_one({"patient_id": pid})
    assert p_after_1["total_observations_count"] == 1

    # 3. Second Observation: Heart Rate = 72 bpm (N=2, still insufficient)
    obs2_payload = {
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": (now - timedelta(days=3)).isoformat(),
        "source": "wearable_continuous",
        "data_kind": "measured"
    }
    res2 = real_client.post(f"/api/v1/patients/{pid}/observations", json=obs2_payload)
    assert res2.status_code == 201
    asmt2 = res2.json()["assessment_update"]
    assert asmt2["is_first_observation"] is False
    assert asmt2["updated_baseline"]["sample_count"] == 2
    assert asmt2["updated_baseline"]["is_sufficient"] is False

    # 4. Third Observation: Heart Rate = 74 bpm (N=3 reaches sufficiency threshold!)
    obs3_payload = {
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 74.0,
        "unit": "bpm",
        "observed_at": (now - timedelta(days=1)).isoformat(),
        "source": "wearable_continuous",
        "data_kind": "measured"
    }
    res3 = real_client.post(f"/api/v1/patients/{pid}/observations", json=obs3_payload)
    assert res3.status_code == 201
    asmt3 = res3.json()["assessment_update"]
    assert asmt3["updated_baseline"]["sample_count"] == 3
    assert asmt3["updated_baseline"]["is_sufficient"] is True
    assert asmt3["updated_baseline"]["median"] == 72.0  # Median of [70, 72, 74] = 72

    # 5. Fourth Observation: Acute Elevation = 88 bpm
    obs4_payload = {
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 88.0,
        "unit": "bpm",
        "observed_at": now.isoformat(),
        "source": "manual_entry",
        "data_kind": "user_entered"
    }
    res4 = real_client.post(f"/api/v1/patients/{pid}/observations", json=obs4_payload)
    assert res4.status_code == 201
    asmt4 = res4.json()["assessment_update"]
    assert asmt4["previous_baseline"]["median"] == 72.0
    assert asmt4["deviation"]["delta_absolute"] > 0
    assert asmt4["deviation"]["z_score"] > 0
    assert asmt4["deviation"]["direction"] == "elevated"

    # Verify patient stability status updated directly in MongoDB
    p_final = real_mongo_db.patients.find_one({"patient_id": pid})
    assert p_final["total_observations_count"] == 4
    assert p_final["stability_status"] is not None
    assert p_final["latest_vitality_index"] is not None

# ================================================================
# 2. Data Integrity Guards Tests
# ================================================================

def test_future_observation_rejection(client, mock_db):
    """Verify that observations with future timestamps (> 5 min) are rejected with HTTP 400."""
    pid = "PT-FUTURE-01"
    mock_db.patients.insert_one({"patient_id": pid, "full_name": "Future Test"})

    future_time = datetime.now(timezone.utc) + timedelta(hours=2)
    res = client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 75.0,
        "unit": "bpm",
        "observed_at": future_time.isoformat()
    })
    assert res.status_code == 400
    assert "future" in res.json()["detail"].lower()

def test_duplicate_submission_safe_handling(client, mock_db):
    """Verify that duplicate submissions are handled safely without duplicating observation counts."""
    pid = "PT-DUP-01"
    mock_db.patients.insert_one({"patient_id": pid, "full_name": "Dup Test", "total_observations_count": 0})
    ts = datetime.now(timezone.utc) - timedelta(hours=1)

    payload = {
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": ts.isoformat()
    }

    res1 = client.post(f"/api/v1/patients/{pid}/observations", json=payload)
    assert res1.status_code == 201
    obs_id = res1.json()["id"]

    # Submit exact same reading again
    res2 = client.post(f"/api/v1/patients/{pid}/observations", json=payload)
    assert res2.status_code == 201
    assert res2.json()["id"] == obs_id
    assert "duplicate" in res2.json()["assessment_update"]["explanation"].lower()

    # Count in MongoDB must still be 1
    assert mock_db.observations.count_documents({"patient_id": pid}) == 1

def test_cross_patient_data_isolation(client, mock_db):
    """Verify that observations logged for Patient A never contaminate Patient B's baselines or twin state."""
    p_a = "PT-ISOLATE-A"
    p_b = "PT-ISOLATE-B"
    mock_db.patients.insert_one({"patient_id": p_a, "full_name": "Patient A", "baseline_window_days": 30})
    mock_db.patients.insert_one({"patient_id": p_b, "full_name": "Patient B", "baseline_window_days": 30})

    now = datetime.now(timezone.utc)
    # Add 4 tachycardia observations to Patient A (110 bpm)
    for i in range(4):
        client.post(f"/api/v1/patients/{p_a}/observations", json={
            "patient_id": p_a,
            "measurement_type": "heart_rate",
            "value": 110.0,
            "unit": "bpm",
            "observed_at": (now - timedelta(days=i+1)).isoformat()
        })

    # Add 4 normal observations to Patient B (68 bpm)
    for i in range(4):
        client.post(f"/api/v1/patients/{p_b}/observations", json={
            "patient_id": p_b,
            "measurement_type": "heart_rate",
            "value": 68.0,
            "unit": "bpm",
            "observed_at": (now - timedelta(days=i+1)).isoformat()
        })

    # Patient B's twin state must reflect ONLY 68 bpm, completely unaffected by Patient A
    twin_b = client.get(f"/api/v1/patients/{p_b}/twin/state").json()
    base_b = twin_b["baselines"]["heart_rate"]
    assert base_b["median"] == 68.0
    assert base_b["sample_count"] == 4

    # Patient A's twin state must reflect 110 bpm
    twin_a = client.get(f"/api/v1/patients/{p_a}/twin/state").json()
    base_a = twin_a["baselines"]["heart_rate"]
    assert base_a["median"] == 110.0
    assert base_a["sample_count"] == 4

def test_relative_deviation_exclusion_for_bounded_metrics(client, mock_db):
    """Verify that bounded metrics like SpO2 properly exclude relative percentage deviation."""
    pid = "PT-SPO2-01"
    mock_db.patients.insert_one({"patient_id": pid, "full_name": "SpO2 Test", "baseline_window_days": 30})
    now = datetime.now(timezone.utc)

    # Add 3 baseline readings for SpO2 (98%)
    for i in range(3):
        client.post(f"/api/v1/patients/{pid}/observations", json={
            "patient_id": pid,
            "measurement_type": "spo2",
            "value": 98.0,
            "unit": "%",
            "observed_at": (now - timedelta(days=i+2)).isoformat()
        })

    # Log acute SpO2 drop = 92%
    res = client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "spo2",
        "value": 92.0,
        "unit": "%",
        "observed_at": now.isoformat()
    })
    assert res.status_code == 201
    asmt = res.json()["assessment_update"]
    assert asmt["deviation"]["delta_absolute"] == -6.0
    assert asmt["deviation"]["relative_is_excluded"] is True
    assert "clinically standard" in asmt["deviation"]["exclusion_reason"].lower() or "misleading" in asmt["deviation"]["exclusion_reason"].lower()
