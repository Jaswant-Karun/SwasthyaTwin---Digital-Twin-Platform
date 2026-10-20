import math
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index
from app.services.alert_service import AlertService

def seed_synthetic_patients(db: Database) -> Dict[str, Any]:
    """
    Deterministically populates realistic 90-day longitudinal healthcare telemetry for 3 demonstration patients.
    """
    random.seed(42) # Deterministic repeatable seed
    now = datetime.now(timezone.utc)

    # Clean existing data for clean demo state
    db.patients.delete_many({})
    db.observations.delete_many({})
    db.health_assessments.delete_many({})
    db.simulations.delete_many({})
    db.alerts.delete_many({})

    demo_patients = [
        {
            "patient_id": "PT-1001",
            "full_name": "Aarav Mehta",
            "age": 38,
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
            "profile_type": "sleep_deprivation_drift",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1002",
            "full_name": "Priya Sharma",
            "age": 54,
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
            "profile_type": "lifestyle_improvement",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1003",
            "full_name": "Devan Nair",
            "age": 28,
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
            "profile_type": "overtraining_autonomic_drift",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        }
    ]

    inserted_patients = 0
    total_observations = 0

    for p in demo_patients:
        profile_type = p.pop("profile_type")
        db.patients.insert_one(p)
        inserted_patients += 1
        pid = p["patient_id"]

        patient_observations = []

        # Generate 90 days of daily readings
        for day in range(90, -1, -1):
            obs_time = now - timedelta(days=day, hours=random.randint(1, 4))
            day_idx = 90 - day # 0 to 90

            # Base parameters according to profile
            if profile_type == "sleep_deprivation_drift":
                # First 75 days: steady baseline (sleep ~7.5h, HR ~65, HRV ~55)
                # Last 15 days: acute project crunch -> sleep drops to ~5.0h, HR drifts to ~78, HRV drops to ~32
                drift_factor = max(0.0, (day_idx - 75) / 15.0) # 0.0 -> 1.0 in last 15 days
                sleep_hrs = max(4.0, 7.5 - drift_factor * 2.6 + random.gauss(0, 0.35))
                hr = 64.0 + drift_factor * 13.0 + random.gauss(0, 2.0)
                hrv = max(20.0, 56.0 - drift_factor * 24.0 + random.gauss(0, 3.5))
                sbp = 118.0 + drift_factor * 8.0 + random.gauss(0, 3.0)
                dbp = 76.0 + drift_factor * 5.0 + random.gauss(0, 2.5)
                steps = max(2000, int(7500 - drift_factor * 2500 + random.gauss(0, 800)))
                spo2 = round(min(100.0, 98.0 + random.gauss(0, 0.5)), 1)
                glucose = round(92.0 + drift_factor * 7.0 + random.gauss(0, 3.0), 1)

            elif profile_type == "lifestyle_improvement":
                # Starts with hypertension & low activity; steadily improves habits
                improve_factor = min(1.0, day_idx / 80.0)
                sleep_hrs = round(6.5 + improve_factor * 1.0 + random.gauss(0, 0.4), 1)
                hr = round(78.0 - improve_factor * 7.0 + random.gauss(0, 2.2), 1)
                hrv = round(32.0 + improve_factor * 12.0 + random.gauss(0, 3.0), 1)
                sbp = round(142.0 - improve_factor * 16.0 + random.gauss(0, 3.5), 1)
                dbp = round(92.0 - improve_factor * 10.0 + random.gauss(0, 2.5), 1)
                steps = max(1500, int(3800 + improve_factor * 4500 + random.gauss(0, 600)))
                spo2 = round(min(100.0, 97.5 + random.gauss(0, 0.6)), 1)
                glucose = round(108.0 - improve_factor * 12.0 + random.gauss(0, 3.5), 1)

            else: # overtraining_autonomic_drift
                # Highly trained runner: normally RHR 48, HRV 85.
                # In days 70-90, acute overtraining causes autonomic fatigue: RHR jumps to 62, HRV plunges to 44
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
                ("heart_rate", round(hr, 1), "bpm", "wearable_continuous"),
                ("blood_pressure_systolic", round(sbp, 1), "mmHg", "clinical_lab" if day % 14 == 0 else "manual_entry"),
                ("blood_pressure_diastolic", round(dbp, 1), "mmHg", "clinical_lab" if day % 14 == 0 else "manual_entry"),
                ("hrv_rmssd", round(hrv, 1), "ms", "wearable_continuous"),
                ("sleep_duration_hours", round(sleep_hrs, 1), "hours", "wearable_continuous"),
                ("daily_steps", float(steps), "steps", "wearable_continuous"),
                ("spo2", round(spo2, 1), "%", "wearable_continuous"),
                ("fasting_blood_glucose", round(glucose, 1), "mg/dL", "clinical_lab" if day % 7 == 0 else "user_reported")
            ]

            for m_type, val, unit, src in metrics_data:
                patient_observations.append({
                    "patient_id": pid,
                    "timestamp": obs_time,
                    "metric_type": m_type,
                    "value": val,
                    "unit": unit,
                    "source": src,
                    "data_tier": "measured" if "wearable" in src or "clinical" in src else "user_reported",
                    "metadata": {"device": "Synthetic Telemetry Engine v1.0", "confidence": 0.96}
                })

        db.observations.insert_many(patient_observations)
        total_observations += len(patient_observations)

        # Compute initial baselines & twin assessment
        from app.services.assessment_service import AssessmentService
        AssessmentService.evaluate_twin_state(db, pid)

    return {
        "status": "success",
        "patients_created": inserted_patients,
        "observations_created": total_observations,
        "message": f"Successfully seeded {inserted_patients} demo patients with {total_observations} longitudinal observations."
    }
