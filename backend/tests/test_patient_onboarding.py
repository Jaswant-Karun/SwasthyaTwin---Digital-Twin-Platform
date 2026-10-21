def test_create_patient_auto_generates_id(client, mock_db):
    payload = {
        "display_name": "Priya Sharma",
        "age": 34,
        "gender": "female",
        "baseline_window_days": 30,
        "chronic_conditions": ["Mild Asthma"],
        "notes": "Prefers morning telemetry logging",
        "consent_confirmed": True
    }
    response = client.post("/api/v1/patients", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "Priya Sharma"
    assert data["patient_id"].startswith("PT-")
    assert data["notes"] == "Prefers morning telemetry logging"
    assert data["is_synthetic"] is False

    # Verify directly in MongoDB
    doc = mock_db.patients.find_one({"patient_id": data["patient_id"]})
    assert doc is not None
    assert doc["display_name"] == "Priya Sharma"

def test_create_patient_custom_id_and_duplicate_rejection(client, mock_db):
    payload = {
        "patient_id": "PT-CUSTOM-99",
        "display_name": "Dev Vikram",
        "age": 42,
        "gender": "male"
    }
    res1 = client.post("/api/v1/patients", json=payload)
    assert res1.status_code == 201
    assert res1.json()["patient_id"] == "PT-CUSTOM-99"

    # Duplicate creation must fail with 400
    res2 = client.post("/api/v1/patients", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()

def test_reject_invalid_patient_age(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/v1/patients", json={"display_name": "Invalid Age", "age": 150})
    assert res.status_code == 422

def test_add_health_observation_valid_and_persisted(client_with_db):
    client, db = client_with_db
    # Create patient first
    p_res = client.post("/api/v1/patients", json={"display_name": "Rohan Sen", "age": 28})
    patient_id = p_res.json()["patient_id"]

    obs_payload = {
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 74.0,
        "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "source": "manual_entry",
        "data_kind": "user_entered",
        "notes": "Post-rest measurement"
    }
    response = client.post(f"/api/v1/patients/{patient_id}/observations", json=obs_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["value"] == 74.0
    assert data["unit"] == "bpm"
    assert data["data_tier"] == "user_reported"
    assert data["notes"] == "Post-rest measurement"
    obs_id = data["id"]
    assert obs_id.startswith("obs_")

    # Verify directly in MongoDB
    stored = db.observations.find_one({"observation_id": obs_id})
    assert stored is not None
    assert stored["value"] == 74.0
    assert stored["patient_id"] == patient_id

def test_reject_nonexistent_patient_id(client_with_db):
    client, _ = client_with_db
    obs_payload = {
        "patient_id": "PT-NONEXISTENT-9999",
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm"
    }
    res = client.post("/api/v1/patients/PT-NONEXISTENT-9999/observations", json=obs_payload)
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"].lower()

def test_reject_out_of_bounds_physiological_values(client_with_db):
    client, _ = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "Test Range"})
    patient_id = p_res.json()["patient_id"]

    # Implausible Resting Heart Rate (350 bpm)
    res_hr = client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 350.0,
        "unit": "bpm"
    })
    assert res_hr.status_code == 400
    assert "physiologically plausible" in res_hr.json()["detail"].lower()

    # Implausible Sleep Duration (35 hours)
    res_sleep = client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "sleep_duration_hours",
        "value": 35.0,
        "unit": "hours"
    })
    assert res_sleep.status_code == 400

def test_reject_unit_mismatch(client_with_db):
    client, _ = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "Test Unit"})
    patient_id = p_res.json()["patient_id"]

    res = client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "blood_pressure_systolic",
        "value": 120.0,
        "unit": "bpm" # Should be mmHg
    })
    assert res.status_code == 400
    assert "invalid unit" in res.json()["detail"].lower()

def test_observation_unit_auto_conversion(client_with_db):
    client, _ = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "Unit Conversion"})
    patient_id = p_res.json()["patient_id"]

    # mmol/L glucose conversion to mg/dL (5.5 mmol/L -> ~99.1 mg/dL)
    res = client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "fasting_blood_glucose",
        "value": 5.5,
        "unit": "mmol/L"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["unit"] == "mg/dL"
    assert 98.0 <= data["value"] <= 100.0

def test_correct_and_delete_observation_with_audit_trail(client_with_db):
    client, db = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "Audit Test"})
    patient_id = p_res.json()["patient_id"]

    obs_res = client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "daily_steps",
        "value": 8500,
        "unit": "steps"
    })
    obs_id = obs_res.json()["id"]

    # Correct observation
    put_res = client.put(f"/api/v1/patients/{patient_id}/observations/{obs_id}", json={
        "value": 9200,
        "notes": "Added evening walk steps",
        "correction_reason": "Evening sync adjustment"
    })
    assert put_res.status_code == 200
    assert put_res.json()["value"] == 9200
    assert put_res.json()["notes"] == "Added evening walk steps"

    # Verify audit event in MongoDB
    audit = db.audit_events.find_one({"action": "correct_observation", "resource_id": obs_id})
    assert audit is not None
    assert audit["details"]["previous_value"] == 8500
    assert audit["details"]["new_value"] == 9200

    # Delete observation
    del_res = client.delete(f"/api/v1/patients/{patient_id}/observations/{obs_id}")
    assert del_res.status_code == 200
    assert db.observations.find_one({"observation_id": obs_id}) is None

def test_csv_validation_and_import(client_with_db):
    client, db = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "CSV Patient"})
    patient_id = p_res.json()["patient_id"]

    sample_rows = [
        {
            "measurement_type": "heart_rate",
            "value": "72",
            "unit": "bpm",
            "observed_at": "2026-10-21T06:00:00Z",
            "source": "fitbit_import",
            "data_kind": "wearable_imported",
            "notes": "Morning reading"
        },
        {
            "measurement_type": "sleep_duration_hours",
            "value": "7.8",
            "unit": "hours",
            "observed_at": "2026-10-21T07:00:00Z",
            "source": "fitbit_import",
            "data_kind": "wearable_imported"
        },
        {
            "measurement_type": "heart_rate",
            "value": "350", # Out of range error!
            "unit": "bpm",
            "observed_at": "2026-10-21T08:00:00Z"
        }
    ]

    # Validate
    val_res = client.post(f"/api/v1/patients/{patient_id}/observations/csv/validate", json={"rows": sample_rows})
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["total_rows"] == 3
    assert val_data["valid_rows_count"] == 2
    assert val_data["invalid_rows_count"] == 1
    assert val_data["rows"][2]["is_valid"] is False

    # Import valid rows
    valid_rows = [r for r in sample_rows[:2]]
    import_res = client.post(f"/api/v1/patients/{patient_id}/observations/csv/import", json={"rows": valid_rows})
    assert import_res.status_code == 201
    assert import_res.json()["imported_count"] == 2

    # Verify MongoDB
    count = db.observations.count_documents({"patient_id": patient_id})
    assert count == 2

def test_delete_patient_and_cascade(client_with_db):
    client, db = client_with_db
    p_res = client.post("/api/v1/patients", json={"display_name": "To Delete"})
    patient_id = p_res.json()["patient_id"]

    # Add observation
    client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 70,
        "unit": "bpm"
    })
    assert db.observations.count_documents({"patient_id": patient_id}) == 1

    # Delete patient with cascade
    del_res = client.delete(f"/api/v1/patients/{patient_id}?delete_associated_data=true")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Patient and observations must be deleted from MongoDB
    assert db.patients.find_one({"patient_id": patient_id}) is None
    assert db.observations.count_documents({"patient_id": patient_id}) == 0
