from datetime import datetime, timezone

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SwasthyaTwin"
    assert "database" in data
    assert "disclaimer" in data

def test_seed_and_patient_crud(client):
    # Trigger seed
    seed_res = client.post("/api/v1/seed")
    assert seed_res.status_code == 200
    seed_data = seed_res.json()
    assert seed_data["status"] == "success"
    assert seed_data["patients_created"] >= 3

    # List patients
    list_res = client.get("/api/v1/patients")
    assert list_res.status_code == 200
    patients = list_res.json()
    assert len(patients) >= 3
    pid = patients[0]["patient_id"]

    # Get single patient
    single_res = client.get(f"/api/v1/patients/{pid}")
    assert single_res.status_code == 200
    assert single_res.json()["patient_id"] == pid

    # Digital twin state
    twin_res = client.get(f"/api/v1/patients/{pid}/twin/state")
    assert twin_res.status_code == 200
    twin_data = twin_res.json()
    assert "overall_vitality" in twin_data
    assert "metrics" in twin_data

    # Add observation
    new_obs = {
        "patient_id": pid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metric_type": "heart_rate",
        "value": 68.0,
        "unit": "bpm",
        "source": "wearable_continuous",
        "data_tier": "measured"
    }
    obs_res = client.post(f"/api/v1/patients/{pid}/observations", json=new_obs)
    assert obs_res.status_code == 201

    # What-if simulation
    sim_payload = {
        "scenario_name": "Test Sleep Extension",
        "parameters": {
            "delta_sleep_hours": 1.0,
            "delta_daily_steps": 2000,
            "delta_stress_level": -10.0,
            "sodium_reduction_pct": 10.0,
            "duration_days": 14
        }
    }
    sim_res = client.post(f"/api/v1/patients/{pid}/simulations/run", json=sim_payload)
    assert sim_res.status_code == 201
    sim_data = sim_res.json()
    assert len(sim_data["trajectories"]) == 14
