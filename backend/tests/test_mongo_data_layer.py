import pytest
from datetime import datetime, timedelta, timezone
from app.models.observation import ObservationBase, ObservationCreate, VALID_UNITS
from app.models.patient import PatientCreate, PatientUpdate
from app.models.audit import AuditEventCreate
from app.repositories.patient_repository import PatientRepository
from app.repositories.observation_repository import ObservationRepository
from app.repositories.assessment_repository import AssessmentRepository
from app.repositories.simulation_repository import SimulationRepository
from app.repositories.audit_repository import AuditRepository, FORBIDDEN_AUDIT_KEYS
from app.database.indexes import create_indexes
from app.database.seed import seed_synthetic_patients

# ==========================================
# 1. Schema & Validation Tests
# ==========================================

def test_observation_schema_valid_units():
    """Verify that allowed units for metrics pass validation."""
    obs = ObservationCreate(
        patient_id="PT-TEST-01",
        measurement_type="heart_rate",
        value=72.0,
        unit="bpm",
        data_kind="measured"
    ).to_observation_base()

    assert obs.unit == "bpm"
    assert obs.measurement_type == "heart_rate"
    assert obs.data_kind == "measured"
    assert obs.observed_at.tzinfo is not None

def test_observation_schema_invalid_unit_raises():
    """Verify that invalid units for known metrics fail validation."""
    with pytest.raises(ValueError, match="Invalid unit 'liters' for measurement_type 'heart_rate'"):
        ObservationBase(
            patient_id="PT-TEST-01",
            measurement_type="heart_rate",
            value=72.0,
            unit="liters",
            observed_at=datetime.now(timezone.utc),
            data_kind="measured"
        )

def test_observation_schema_timezone_awareness():
    """Verify that naive timestamps are coerced to timezone-aware UTC."""
    naive_dt = datetime(2026, 10, 20, 10, 0, 0)
    obs = ObservationBase(
        patient_id="PT-TEST-01",
        measurement_type="spo2",
        value=98.5,
        unit="%",
        observed_at=naive_dt,
        data_kind="measured"
    )
    assert obs.observed_at.tzinfo == timezone.utc

def test_observation_data_kind_distinction():
    """Verify allowed data_kind values (measured, user_entered, simulated)."""
    for kind in ["measured", "user_entered", "simulated"]:
        obs = ObservationCreate(
            patient_id="PT-TEST-01",
            measurement_type="daily_steps",
            value=8500.0,
            unit="steps",
            data_kind=kind
        ).to_observation_base()
        assert obs.data_kind == kind

# ==========================================
# 2. Repository Layer Tests
# ==========================================

def test_patient_repository_crud(mock_db):
    """Test PatientRepository CRUD operations, projection, and pagination."""
    repo = PatientRepository(mock_db)

    # Create patient
    p_dict = {
        "patient_id": "PT-REPO-01",
        "display_name": "Test Patient Alpha",
        "age": 45,
        "gender": "female",
        "baseline_window_days": 30,
        "chronic_conditions": ["None"],
        "demo_data": False
    }
    created = repo.create(p_dict)
    assert created["patient_id"] == "PT-REPO-01"
    assert "_id" not in created  # Controlled projection

    # Read patient
    fetched = repo.get_by_id("PT-REPO-01")
    assert fetched is not None
    assert fetched["display_name"] == "Test Patient Alpha"
    assert "_id" not in fetched

    # Duplicate create raises ValueError
    with pytest.raises(ValueError, match="already exists"):
        repo.create(p_dict)

    # Update patient
    updated = repo.update("PT-REPO-01", {"display_name": "Test Patient Updated"})
    assert updated["display_name"] == "Test Patient Updated"

    # List & pagination
    patients, total = repo.list_patients(skip=0, limit=10)
    assert total >= 1
    assert any(p["patient_id"] == "PT-REPO-01" for p in patients)

    # Delete patient
    assert repo.delete("PT-REPO-01") is True
    assert repo.get_by_id("PT-REPO-01") is None

def test_observation_repository_descending_pagination(mock_db):
    """Test descending chronological order (observed_at desc) and pagination."""
    repo = ObservationRepository(mock_db)
    now = datetime.now(timezone.utc)

    # Insert 10 observations with sequential timestamps
    batch = []
    for i in range(10):
        batch.append({
            "observation_id": f"obs_seq_{i}",
            "patient_id": "PT-PAGINATION",
            "measurement_type": "heart_rate",
            "value": 60.0 + i,
            "unit": "bpm",
            "observed_at": now - timedelta(hours=10 - i), # 0 is earliest, 9 is newest
            "source": "wearable_continuous",
            "data_kind": "measured",
            "metadata": {}
        })
    repo.create_batch(batch)

    # Query with limit 3 (should return newest first)
    page1, total = repo.list_observations("PT-PAGINATION", limit=3, skip=0)
    assert total == 10
    assert len(page1) == 3
    # Check descending order: newest observed_at first
    assert page1[0]["observation_id"] == "obs_seq_9"
    assert page1[1]["observation_id"] == "obs_seq_8"
    assert page1[2]["observation_id"] == "obs_seq_7"

    # Page 2
    page2, _ = repo.list_observations("PT-PAGINATION", limit=3, skip=3)
    assert len(page2) == 3
    assert page2[0]["observation_id"] == "obs_seq_6"

def test_assessment_and_simulation_repositories(mock_db):
    """Test health_assessments and simulations repositories."""
    asmt_repo = AssessmentRepository(mock_db)
    sim_repo = SimulationRepository(mock_db)
    now = datetime.now(timezone.utc)

    # Save assessment
    asmt_repo.save_assessment({
        "assessment_id": "asmt_test_01",
        "patient_id": "PT-ASMT-01",
        "assessed_at": now,
        "calculated_at": now,
        "baseline_window": 30,
        "indicator_type": "vitality_stability_index",
        "indicator_value": 94.5,
        "methodology": "Z-Score deduction",
        "evidence": {"sample": 30},
        "limitations": "Prototype",
        "model_version": "v1.2.0"
    })
    latest = asmt_repo.get_latest_for_patient("PT-ASMT-01")
    assert latest is not None
    assert latest["assessment_id"] == "asmt_test_01"
    assert latest["indicator_value"] == 94.5

    # Save simulation
    sim_repo.save_simulation({
        "simulation_id": "sim_test_01",
        "patient_id": "PT-ASMT-01",
        "created_at": now,
        "scenario_inputs": {"delta_sleep_hours": 1.5},
        "baseline_summary": {"heart_rate": 72.0},
        "simulated_summary": {"vitality_projected": 96.0},
        "assumptions": ["Linear adaptation"],
        "model_version": "v1.2.0"
    })
    sim = sim_repo.get_by_id("sim_test_01")
    assert sim is not None
    assert sim["simulation_id"] == "sim_test_01"
    assert sim["scenario_inputs"]["delta_sleep_hours"] == 1.5

def test_audit_repository_sensitive_key_scrubbing(mock_db):
    """Verify that AuditRepository logs minimal metadata and scrubs sensitive credentials."""
    audit_repo = AuditRepository(mock_db)

    # Attempt to log with sensitive fields
    raw_event = {
        "event_id": "aud_test_safe",
        "action": "login_attempt",
        "resource_type": "auth",
        "resource_id": "usr_1",
        "patient_id": "PT-TEST-01",
        "actor": "clinician",
        "details": {
            "password": "supersecretpassword",
            "token": "jwt.secret.token",
            "apiKey": "xyz123",
            "safe_client_ip": "127.0.0.1",
            "outcome": "success"
        }
    }
    audit_repo.record_event(raw_event)

    events, total = audit_repo.list_events(patient_id="PT-TEST-01")
    assert total == 1
    logged_details = events[0]["details"]

    # Sensitive keys must NOT be present
    for key in FORBIDDEN_AUDIT_KEYS:
        assert key not in logged_details

    # Safe keys are retained
    assert logged_details.get("safe_client_ip") == "127.0.0.1"
    assert logged_details.get("outcome") == "success"

# ==========================================
# 3. Repeatable Seeding & No Data Loss
# ==========================================

def test_seeding_is_repeatable_and_non_destructive(mock_db):
    """Verify that seeding creates synthetic demo records and does not delete user data."""
    # 1. Insert a real user patient record
    user_patient = {
        "patient_id": "PT-USER-REAL",
        "display_name": "Real User Patient",
        "age": 42,
        "demo_data": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    mock_db.patients.insert_one(user_patient)

    # 2. Run seed
    seed_res = seed_synthetic_patients(mock_db, force=False)
    assert seed_res["status"] == "success"

    # Verify user record is untouched!
    user_check = mock_db.patients.find_one({"patient_id": "PT-USER-REAL"})
    assert user_check is not None
    assert user_check["display_name"] == "Real User Patient"

    # Verify demo patients exist (5 synthetic profiles)
    demo_count = mock_db.patients.count_documents({"demo_data": True})
    assert demo_count == 5

    # 3. Run seed again without force -> should detect existing and skip
    re_seed = seed_synthetic_patients(mock_db, force=False)
    assert re_seed["status"] == "already_seeded"

    # User record STILL untouched!
    assert mock_db.patients.find_one({"patient_id": "PT-USER-REAL"}) is not None

def test_reset_demo_data_safety_and_explicit_confirmation(mock_db):
    """Verify that reset_demo_data requires explicit confirmation and never deletes real user records."""
    from app.database.seed import reset_demo_data, inject_live_observation

    # 1. Insert real user patient record
    user_patient = {
        "patient_id": "PT-REAL-VIP",
        "display_name": "Dr. Real Clinician",
        "demo_data": False,
        "created_at": datetime.now(timezone.utc)
    }
    mock_db.patients.insert_one(user_patient)

    # 2. Seeding
    seed_synthetic_patients(mock_db, force=True)
    assert mock_db.patients.count_documents({"demo_data": True}) == 5

    # 3. Refuse reset without confirmation
    refused = reset_demo_data(mock_db, confirm=False)
    assert refused["status"] == "confirmation_required"
    assert mock_db.patients.count_documents({"demo_data": True}) == 5

    # 4. Confirm reset
    res = reset_demo_data(mock_db, confirm=True)
    assert res["status"] == "success"
    assert mock_db.patients.count_documents({"demo_data": True}) == 0

    # 5. Real user record is STILL preserved
    real_user = mock_db.patients.find_one({"patient_id": "PT-REAL-VIP"})
    assert real_user is not None
    assert real_user["display_name"] == "Dr. Real Clinician"

def test_live_observation_injection_and_recalculation(mock_db):
    """Verify that live observation injection adds a tagged record and recalculates twin state."""
    from app.database.seed import inject_live_observation

    # Seed cohort first
    seed_synthetic_patients(mock_db, force=True)

    # Inject acute live observation
    inject_res = inject_live_observation(
        db=mock_db,
        patient_id="PT-1001",
        metric_type="heart_rate",
        value=89.0
    )
    assert inject_res["status"] == "success"
    assert inject_res["observation"]["value"] == 89.0
    assert inject_res["observation"]["metric_type"] == "heart_rate"
    assert inject_res["observation"]["is_live_demonstration"] is True
    assert inject_res["recalculated_vitality_index"] is not None
    assert inject_res["twin_state"] is not None

# ==========================================
# 4. API & Readiness Checks
# ==========================================

def test_readiness_check_endpoint(client):
    """Test readiness check endpoint /health/ready."""
    res = client.get("/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert "ready" in data

def test_audit_trail_api_endpoint(client):
    """Test /api/v1/audit endpoint returns non-sensitive audit logs."""
    res = client.get("/api/v1/audit")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_patient_not_found_handling(client):
    """Test that querying a non-existent patient ID safely returns 404."""
    res = client.get("/api/v1/patients/PT-NONEXISTENT")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

def test_database_indexes_structure(mock_db):
    """Verify that create_indexes creates expected index patterns on collections."""
    create_indexes(mock_db)
    obs_indexes = mock_db.observations.index_information()
    assert any("patient_id" in idx.get("key", [("", 0)])[0][0] for idx in obs_indexes.values())

