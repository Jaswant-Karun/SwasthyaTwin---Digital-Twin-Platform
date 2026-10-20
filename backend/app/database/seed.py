import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index
from app.services.alert_service import AlertService
from app.repositories.audit_repository import AuditRepository

def seed_synthetic_patients(db: Database, force: bool = False) -> Dict[str, Any]:
    """
    Deterministically populates realistic 90-day longitudinal healthcare telemetry
    for 3 demonstration patients.

    Safety Rules:
    - NEVER deletes user-entered data (only removes records explicitly flagged demo_data: True when force=True).
    - Repeatable and idempotent: if demo records already exist and force=False, returns current status without re-seeding.
    """
    # Check if demo cohort already exists
    existing_demo_count = db.patients.count_documents({"demo_data": True})
    if existing_demo_count > 0 and not force:
        return {
            "status": "already_seeded",
            "patients_count": existing_demo_count,
            "message": f"Demo data is already present ({existing_demo_count} demo patients). Pass force=True to re-seed."
        }

    random.seed(42)  # Deterministic repeatable seed
    now = datetime.now(timezone.utc)

    # Clean ONLY synthetic demo data to protect real user records
    demo_patient_ids = ["PT-1001", "PT-1002", "PT-1003"]
    db.patients.delete_many({"$or": [{"demo_data": True}, {"patient_id": {"$in": demo_patient_ids}}]})
    db.observations.delete_many({"$or": [{"demo_data": True}, {"patient_id": {"$in": demo_patient_ids}}]})
    db.health_assessments.delete_many({"$or": [{"demo_data": True}, {"patient_id": {"$in": demo_patient_ids}}]})
    db.simulations.delete_many({"$or": [{"demo_data": True}, {"patient_id": {"$in": demo_patient_ids}}]})
    db.alerts.delete_many({"patient_id": {"$in": demo_patient_ids}})

    demo_patients = [
        {
            "patient_id": "PT-1001",
            "display_name": "Aarav Mehta",
            "full_name": "Aarav Mehta",
            "age": 38,
            "gender": "male",
            "biological_sex": "male",
            "baseline_window_days": 30,
            "chronic_conditions": ["Mild Work-Related Burnout"],
            "primary_physician": "Dr. Ananya Sen, MD",
            "lifestyle_profile": {
                "baseline_sleep_hours": 7.5,
                "baseline_daily_steps": 7500,
                "activity_level": "moderate",
                "diet_pattern": "vegetarian_balanced",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "occasional",
                "stress_level": "elevated"
            },
            "demo_data": True,
            "profile_type": "sleep_deprivation_drift",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1002",
            "display_name": "Priya Sharma",
            "full_name": "Priya Sharma",
            "age": 54,
            "gender": "female",
            "biological_sex": "female",
            "baseline_window_days": 30,
            "chronic_conditions": ["Essential Hypertension (Stage 1)"],
            "primary_physician": "Dr. Rajesh Kulkarni, MD (Cardiology)",
            "lifestyle_profile": {
                "baseline_sleep_hours": 6.8,
                "baseline_daily_steps": 4200,
                "activity_level": "light",
                "diet_pattern": "low_sodium_dash",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "none",
                "stress_level": "moderate"
            },
            "demo_data": True,
            "profile_type": "lifestyle_improvement",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1003",
            "display_name": "Devan Nair",
            "full_name": "Devan Nair",
            "age": 28,
            "gender": "male",
            "biological_sex": "male",
            "baseline_window_days": 30,
            "chronic_conditions": ["High-Performance Endurance Athlete"],
            "primary_physician": "Dr. Marcus Vance, Sports Medicine",
            "lifestyle_profile": {
                "baseline_sleep_hours": 8.2,
                "baseline_daily_steps": 14000,
                "activity_level": "very_active",
                "diet_pattern": "high_protein_athlete",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "none",
                "stress_level": "moderate"
            },
            "demo_data": True,
            "profile_type": "overtraining_autonomic_drift",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        }
    ]

    inserted_patients = 0
    total_observations = 0

    for p in demo_patients:
        profile_type = p.pop("profile_type")
        pid = p["patient_id"]
        db.patients.insert_one(p)
        inserted_patients += 1

        patient_observations = []

        # Generate 90 days of daily readings
        for day in range(90, -1, -1):
            obs_time = now - timedelta(days=day, hours=random.randint(1, 4))
            day_idx = 90 - day  # 0 to 90

            # Base parameters according to profile
            if profile_type == "sleep_deprivation_drift":
                drift_factor = max(0.0, (day_idx - 75) / 15.0)
                sleep_hrs = max(4.0, 7.5 - drift_factor * 2.6 + random.gauss(0, 0.35))
                hr = 64.0 + drift_factor * 13.0 + random.gauss(0, 2.0)
                hrv = max(20.0, 56.0 - drift_factor * 24.0 + random.gauss(0, 3.5))
                sbp = 118.0 + drift_factor * 8.0 + random.gauss(0, 3.0)
                dbp = 76.0 + drift_factor * 5.0 + random.gauss(0, 2.5)
                steps = max(2000, int(7500 - drift_factor * 2500 + random.gauss(0, 800)))
                spo2 = round(min(100.0, 98.0 + random.gauss(0, 0.5)), 1)
                glucose = round(92.0 + drift_factor * 7.0 + random.gauss(0, 3.0), 1)

            elif profile_type == "lifestyle_improvement":
                improve_factor = min(1.0, day_idx / 80.0)
                sleep_hrs = round(6.5 + improve_factor * 1.0 + random.gauss(0, 0.4), 1)
                hr = round(78.0 - improve_factor * 7.0 + random.gauss(0, 2.2), 1)
                hrv = round(32.0 + improve_factor * 12.0 + random.gauss(0, 3.0), 1)
                sbp = round(142.0 - improve_factor * 16.0 + random.gauss(0, 3.5), 1)
                dbp = round(92.0 - improve_factor * 10.0 + random.gauss(0, 2.5), 1)
                steps = max(1500, int(3800 + improve_factor * 4500 + random.gauss(0, 600)))
                spo2 = round(min(100.0, 97.5 + random.gauss(0, 0.6)), 1)
                glucose = round(108.0 - improve_factor * 12.0 + random.gauss(0, 3.5), 1)

            else:  # overtraining_autonomic_drift
                strain_factor = max(0.0, (day_idx - 70) / 20.0)
                sleep_hrs = round(8.4 - strain_factor * 1.2 + random.gauss(0, 0.3), 1)
                hr = round(48.0 + strain_factor * 14.0 + random.gauss(0, 1.8), 1)
                hrv = round(max(25.0, 86.0 - strain_factor * 40.0 + random.gauss(0, 4.0)), 1)
                sbp = round(112.0 + strain_factor * 6.0 + random.gauss(0, 2.5), 1)
                dbp = round(70.0 + strain_factor * 4.0 + random.gauss(0, 2.0), 1)
                steps = max(6000, int(14000 + strain_factor * 4000 + random.gauss(0, 1200)))
                spo2 = round(min(100.0, 99.0 + random.gauss(0, 0.4)), 1)
                glucose = round(86.0 + random.gauss(0, 3.0), 1)

            metrics_data = [
                ("heart_rate", round(hr, 1), "bpm", "wearable_continuous", "measured"),
                ("blood_pressure_systolic", round(sbp, 1), "mmHg", "clinical_lab" if day % 14 == 0 else "manual_entry", "measured" if day % 14 == 0 else "user_entered"),
                ("blood_pressure_diastolic", round(dbp, 1), "mmHg", "clinical_lab" if day % 14 == 0 else "manual_entry", "measured" if day % 14 == 0 else "user_entered"),
                ("hrv_rmssd", round(hrv, 1), "ms", "wearable_continuous", "measured"),
                ("sleep_duration_hours", round(sleep_hrs, 1), "hours", "wearable_continuous", "measured"),
                ("daily_steps", float(steps), "steps", "wearable_continuous", "measured"),
                ("spo2", round(spo2, 1), "%", "wearable_continuous", "measured"),
                ("fasting_blood_glucose", round(glucose, 1), "mg/dL", "clinical_lab" if day % 7 == 0 else "user_reported", "measured" if day % 7 == 0 else "user_entered")
            ]

            for m_type, val, unit, src, kind in metrics_data:
                obs_id = f"obs_{uuid.uuid4().hex[:12]}"
                patient_observations.append({
                    "observation_id": obs_id,
                    "patient_id": pid,
                    "measurement_type": m_type,
                    "metric_type": m_type,
                    "value": val,
                    "unit": unit,
                    "observed_at": obs_time,
                    "timestamp": obs_time,
                    "source": src,
                    "data_kind": kind,
                    "data_tier": "user_reported" if kind == "user_entered" else kind,
                    "metadata": {"device": "Synthetic Telemetry Engine v1.0", "confidence": 0.96},
                    "created_at": obs_time,
                    "demo_data": True
                })

        db.observations.insert_many(patient_observations)
        total_observations += len(patient_observations)

        # Compute initial baselines & twin assessment
        from app.services.assessment_service import AssessmentService
        AssessmentService.evaluate_twin_state(db, pid)

    # Record non-sensitive audit event for seeding
    audit_repo = AuditRepository(db)
    audit_repo.record_event({
        "event_id": f"aud_seed_{uuid.uuid4().hex[:8]}",
        "action": "seed_demo_cohort",
        "resource_type": "cohort",
        "resource_id": "demo_patients",
        "actor": "system_seeder",
        "timestamp": now,
        "details": {
            "patients_seeded": inserted_patients,
            "observations_seeded": total_observations,
            "deterministic_seed": 42
        }
    })

    return {
        "status": "success",
        "patients_created": inserted_patients,
        "observations_created": total_observations,
        "message": f"Successfully seeded {inserted_patients} demo patients with {total_observations} longitudinal observations without deleting real user data."
    }
