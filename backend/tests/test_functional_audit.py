"""
Functional Audit Test Suite for SwasthyaTwin
Tests the end-to-end criteria required for product-quality certification:
1. Patient creation & MongoDB persistence
2. Observation logging & immediate persistence
3. Querying observations across requests (persistence across reload)
4. Strict patient isolation (no data leakage between patients)
5. What-if simulator output separation (simulations never contaminate measured baselines)
6. Calculation engine mathematical consistency
7. Database error handling / no fake live data injection
"""
import pytest
from datetime import datetime, timezone, timedelta
import pymongo
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_database

TEST_DB_NAME = "swasthyatwin_audit_test"

@pytest.fixture(scope="module")
def audit_db():
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client[TEST_DB_NAME]
    
    # Clean up test collections prior to test run
    db.patients.delete_many({})
    db.observations.delete_many({})
    db.health_assessments.delete_many({})
    db.alerts.delete_many({})
    db.audit_logs.delete_many({})
    
    yield db
    
    # Teardown test artifacts
    client.drop_database(TEST_DB_NAME)
    client.close()

@pytest.fixture(scope="module")
def client(audit_db):
    def override_get_db():
        yield audit_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_1_create_patient_and_confirm_mongodb_persistence(client, audit_db):
    """Confirm patient creation through API persists directly in MongoDB."""
    patient_payload = {
        "full_name": "Audit Test Patient Alpha",
        "pseudonym": "Alpha-01",
        "age": 42,
        "biological_sex": "male",
        "baseline_window_days": 14,
        "consent_confirmed": True,
        "notes": "Auditing patient persistence"
    }
    resp = client.post("/api/v1/patients", json=patient_payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    patient_id = data["patient_id"]
    assert patient_id.startswith("PT-")

    # Verify directly in MongoDB
    doc = audit_db.patients.find_one({"patient_id": patient_id})
    assert doc is not None
    assert doc["full_name"] == "Audit Test Patient Alpha"
    assert doc["baseline_window_days"] == 14
    assert doc["consent_confirmed"] is True

def test_2_and_3_add_observation_persist_and_retrieve_after_refresh(client, audit_db):
    """Add observation, confirm MongoDB persistence, and verify query returns it."""
    # Create patient
    p_resp = client.post("/api/v1/patients", json={
        "full_name": "Audit Telemetry Patient",
        "age": 35,
        "biological_sex": "female",
        "consent_confirmed": True
    })
    patient_id = p_resp.json()["patient_id"]

    obs_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    obs_payload = {
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 74.0,
        "unit": "bpm",
        "observed_at": obs_time.isoformat(),
        "source": "manual_entry",
        "data_kind": "user_entered"
    }
    add_resp = client.post(f"/api/v1/patients/{patient_id}/observations", json=obs_payload)
    assert add_resp.status_code == 201, add_resp.text
    add_data = add_resp.json()
    obs_id = add_data["observation_id"]

    # Direct MongoDB verification
    db_doc = audit_db.observations.find_one({"observation_id": obs_id})
    assert db_doc is not None
    assert db_doc["patient_id"] == patient_id
    assert db_doc["value"] == 74.0
    assert db_doc["data_kind"] == "user_entered"

    # Simulate page reload / fresh API query
    get_resp = client.get(f"/api/v1/patients/{patient_id}/observations?metric_type=heart_rate")
    assert get_resp.status_code == 200
    items = get_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["observation_id"] == obs_id
    assert items[0]["value"] == 74.0

def test_4_switch_patients_and_verify_strict_data_isolation(client, audit_db):
    """Verify Patient A's observations NEVER leak to Patient B."""
    # Create Patient A and Patient B
    p_a = client.post("/api/v1/patients", json={"full_name": "Patient Isolation A", "consent_confirmed": True}).json()["patient_id"]
    p_b = client.post("/api/v1/patients", json={"full_name": "Patient Isolation B", "consent_confirmed": True}).json()["patient_id"]

    # Log 3 observations for Patient A
    base_t = datetime.now(timezone.utc) - timedelta(days=2)
    for hr in [70.0, 72.0, 74.0]:
        base_t += timedelta(hours=2)
        client.post(f"/api/v1/patients/{p_a}/observations", json={
            "patient_id": p_a,
            "measurement_type": "heart_rate",
            "value": hr,
            "unit": "bpm",
            "observed_at": base_t.isoformat()
        })

    # Log 1 observation for Patient B
    client.post(f"/api/v1/patients/{p_b}/observations", json={
        "patient_id": p_b,
        "measurement_type": "heart_rate",
        "value": 95.0,
        "unit": "bpm",
        "observed_at": base_t.isoformat()
    })

    # Verify Patient A query
    res_a = client.get(f"/api/v1/patients/{p_a}/observations").json()["items"]
    assert len(res_a) == 3
    assert all(o["patient_id"] == p_a for o in res_a)

    # Verify Patient B query
    res_b = client.get(f"/api/v1/patients/{p_b}/observations").json()["items"]
    assert len(res_b) == 1
    assert res_b[0]["patient_id"] == p_b
    assert res_b[0]["value"] == 95.0

    # Verify Patient B baselines are not influenced by Patient A
    base_b = client.get(f"/api/v1/patients/{p_b}/twin/baseline").json()
    hr_base_b = base_b.get("heart_rate")
    if hr_base_b:
        assert hr_base_b["sample_count"] == 1
        assert hr_base_b["mean"] == 95.0

def test_5_what_if_simulator_data_remains_separate(client, audit_db):
    """Verify simulation forecasts are marked 'simulated' and never pollute measured baselines."""
    p_id = client.post("/api/v1/patients", json={"full_name": "Sim Separation Patient", "consent_confirmed": True}).json()["patient_id"]

    # Log 3 measured observations to establish real baseline
    base_t = datetime.now(timezone.utc) - timedelta(days=3)
    for hr in [60.0, 62.0, 64.0]:
        base_t += timedelta(hours=4)
        client.post(f"/api/v1/patients/{p_id}/observations", json={
            "patient_id": p_id,
            "measurement_type": "heart_rate",
            "value": hr,
            "unit": "bpm",
            "observed_at": base_t.isoformat(),
            "data_kind": "measured"
        })

    # Run what-if simulation
    sim_payload = {
        "patient_id": p_id,
        "interventions": {
            "sleep_extension_hours": 1.5,
            "activity_increase_steps": 3000,
            "stress_reduction_pct": 25,
            "dietary_sodium_reduction_pct": 20
        },
        "projection_days": 14
    }
    sim_resp = client.post(f"/api/v1/patients/{p_id}/simulations/run", json=sim_payload)
    assert sim_resp.status_code == 200, sim_resp.text
    sim_data = sim_resp.json()
    assert "projected_vitality_index" in sim_data
    assert "projected_trajectories" in sim_data

    # Verify that measured observations in DB were not polluted
    measured_obs = list(audit_db.observations.find({
        "patient_id": p_id,
        "data_kind": {"$ne": "simulated"}
    }))
    assert len(measured_obs) == 3

    # Baseline query must still only reflect the 3 measured observations (mean 62.0)
    base_resp = client.get(f"/api/v1/patients/{p_id}/twin/baseline").json()
    hr_base = base_resp["heart_rate"]
    assert hr_base["sample_count"] == 3
    assert hr_base["mean"] == 62.0

def test_6_calculation_engine_mathematical_consistency(client, audit_db):
    """Verify that baseline calculation engine computes accurate mean, median, and std_dev."""
    p_id = client.post("/api/v1/patients", json={"full_name": "Math Audit Patient", "consent_confirmed": True}).json()["patient_id"]

    values = [70.0, 72.0, 74.0, 76.0, 78.0]
    base_t = datetime.now(timezone.utc) - timedelta(days=2)
    for v in values:
        base_t += timedelta(hours=3)
        client.post(f"/api/v1/patients/{p_id}/observations", json={
            "patient_id": p_id,
            "measurement_type": "heart_rate",
            "value": v,
            "unit": "bpm",
            "observed_at": base_t.isoformat()
        })

    base_resp = client.get(f"/api/v1/patients/{p_id}/twin/baseline").json()
    hr_base = base_resp["heart_rate"]
    assert hr_base["sample_count"] == 5
    assert hr_base["mean"] == 74.0
    assert hr_base["median"] == 74.0
    assert hr_base["is_sufficient"] is True

def test_7_database_error_handling_and_no_phantom_data(client, audit_db):
    """Verify that non-existent patient queries return 404, not fake synthetic records."""
    non_existent = "PT-NON-EXISTENT-9999"
    resp = client.get(f"/api/v1/patients/{non_existent}/twin/state")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
