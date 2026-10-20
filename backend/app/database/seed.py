import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index
from app.services.alert_service import AlertService
from app.services.assessment_service import AssessmentService
from app.repositories.audit_repository import AuditRepository

DEMO_PATIENT_IDS = ["PT-1001", "PT-1002", "PT-1003", "PT-1004", "PT-1005"]

def reset_demo_data(db: Database, confirm: bool = False) -> Dict[str, Any]:
    """
    Safely resets or removes clearly identified synthetic demonstration records.
    Requires explicit invocation with confirm=True.
    Protects all real user accounts and real telemetry records by filtering strictly
    on demo_data: True or recognized synthetic demo IDs.
    """
    if not confirm:
        return {
            "status": "confirmation_required",
            "message": "Explicit invocation with confirm=True is required to reset synthetic demo data.",
            "affected_records": 0
        }

    now = datetime.now(timezone.utc)
    demo_filter = {"$or": [{"demo_data": True}, {"patient_id": {"$in": DEMO_PATIENT_IDS}}]}

    # Count before deletion
    deleted_patients = db.patients.delete_many(demo_filter).deleted_count
    deleted_observations = db.observations.delete_many(demo_filter).deleted_count
    deleted_assessments = db.health_assessments.delete_many(demo_filter).deleted_count
    deleted_simulations = db.simulations.delete_many(demo_filter).deleted_count
    deleted_alerts = db.alerts.delete_many({"patient_id": {"$in": DEMO_PATIENT_IDS}}).deleted_count

    # Audit log entry for tracking
    audit_repo = AuditRepository(db)
    audit_repo.record_event({
        "event_id": f"aud_reset_{uuid.uuid4().hex[:8]}",
        "action": "reset_demo_data",
        "resource_type": "cohort",
        "resource_id": "demo_patients",
        "actor": "user_or_admin",
        "timestamp": now,
        "details": {
            "deleted_patients": deleted_patients,
            "deleted_observations": deleted_observations,
            "deleted_assessments": deleted_assessments,
            "deleted_simulations": deleted_simulations,
            "deleted_alerts": deleted_alerts
        }
    })

    return {
        "status": "success",
        "message": f"Successfully reset synthetic demo cohort. Removed {deleted_patients} demo patients and {deleted_observations} observations.",
        "deleted_counts": {
            "patients": deleted_patients,
            "observations": deleted_observations,
            "assessments": deleted_assessments,
            "simulations": deleted_simulations,
            "alerts": deleted_alerts
        }
    }


def seed_synthetic_patients(db: Database, force: bool = False) -> Dict[str, Any]:
    """
    Deterministically populates realistic 90-day longitudinal healthcare telemetry
    for 5 demonstration synthetic patient profiles.

    Safety Rules:
    - NEVER deletes user-entered data (only removes records explicitly flagged demo_data: True when force=True).
    - Repeatable and idempotent: if demo records already exist and force=False, returns current status without re-seeding.
    - Uses deterministic random.seed(42) for exact reproducibility.
    - Includes realistic temporal patterns, subtle noise, missing observations (to test incomplete data handling),
      and occasional documented deviations.
    """
    existing_demo_count = db.patients.count_documents({"$or": [{"demo_data": True}, {"patient_id": {"$in": DEMO_PATIENT_IDS}}]})
    if existing_demo_count >= len(DEMO_PATIENT_IDS) and not force:
        return {
            "status": "already_seeded",
            "patients_count": existing_demo_count,
            "message": f"Demo cohort already present ({existing_demo_count} demo patients). Pass force=True to re-seed."
        }

    random.seed(42)  # Deterministic repeatable seed
    now = datetime.now(timezone.utc)

    # Clean ONLY synthetic demo data to protect real user records
    reset_demo_data(db, confirm=True)

    demo_patients = [
        {
            "patient_id": "PT-1001",
            "display_name": "Aarav Mehta",
            "full_name": "Aarav Mehta",
            "age": 38,
            "gender": "male",
            "biological_sex": "male",
            "baseline_window_days": 30,
            "chronic_conditions": ["Occupational Stress & Circadian Disruption"],
            "primary_physician": "Dr. Ananya Sen, MD (Preventive Medicine)",
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
            "is_synthetic": True,
            "synthetic_archetype": "Circadian Strain & Sleep Drift",
            "clinical_notes_disclaimer": "SYNTHETIC PROFILE: Generated for demonstration and trend analysis algorithm validation.",
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
            "chronic_conditions": ["Cardiometabolic Risk Monitoring (DASH & Aerobic Program)"],
            "primary_physician": "Dr. Rajesh Kulkarni, MD (Cardiovascular Prevention)",
            "lifestyle_profile": {
                "baseline_sleep_hours": 6.8,
                "baseline_daily_steps": 4200,
                "activity_level": "improving_moderate",
                "diet_pattern": "low_sodium_dash",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "none",
                "stress_level": "moderate"
            },
            "demo_data": True,
            "is_synthetic": True,
            "synthetic_archetype": "Cardiovascular Lifestyle Optimization",
            "clinical_notes_disclaimer": "SYNTHETIC PROFILE: Generated for demonstration and trend analysis algorithm validation.",
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
            "chronic_conditions": ["High-Volume Endurance Training Overreaching Protocol"],
            "primary_physician": "Dr. Marcus Vance, MD (Sports Physiology)",
            "lifestyle_profile": {
                "baseline_sleep_hours": 8.4,
                "baseline_daily_steps": 14000,
                "activity_level": "very_active",
                "diet_pattern": "high_protein_athlete",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "none",
                "stress_level": "moderate"
            },
            "demo_data": True,
            "is_synthetic": True,
            "synthetic_archetype": "Athletic Conditioning & Autonomic Overreaching",
            "clinical_notes_disclaimer": "SYNTHETIC PROFILE: Generated for demonstration and trend analysis algorithm validation.",
            "profile_type": "overtraining_autonomic_drift",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1004",
            "display_name": "Sunita Rao",
            "full_name": "Sunita Rao",
            "age": 67,
            "gender": "female",
            "biological_sex": "female",
            "baseline_window_days": 30,
            "chronic_conditions": ["Healthy Aging Telemetry & Fall-Risk Prevention"],
            "primary_physician": "Dr. Meenakshi Iyer, MD (Geriatric & Preventive Medicine)",
            "lifestyle_profile": {
                "baseline_sleep_hours": 7.2,
                "baseline_daily_steps": 5800,
                "activity_level": "light_moderate",
                "diet_pattern": "traditional_plant_forward",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "none",
                "stress_level": "low"
            },
            "demo_data": True,
            "is_synthetic": True,
            "synthetic_archetype": "Healthy Senior Baseline & Circadian Regularity",
            "clinical_notes_disclaimer": "SYNTHETIC PROFILE: Generated for demonstration and trend analysis algorithm validation.",
            "profile_type": "healthy_active_senior",
            "created_at": now - timedelta(days=90),
            "updated_at": now
        },
        {
            "patient_id": "PT-1005",
            "display_name": "Kabir Sen",
            "full_name": "Kabir Sen",
            "age": 44,
            "gender": "male",
            "biological_sex": "male",
            "baseline_window_days": 30,
            "chronic_conditions": ["Sedentary Desk Ergonomics & Asymmetric Activity Burden"],
            "primary_physician": "Dr. Vikram Joshi, MD (Occupational Health)",
            "lifestyle_profile": {
                "baseline_sleep_hours": 6.9,
                "baseline_daily_steps": 4500,
                "activity_level": "bimodal_weekend_warrior",
                "diet_pattern": "standard_urban",
                "smoking_status": "non_smoker",
                "alcohol_consumption": "occasional",
                "stress_level": "moderate"
            },
            "demo_data": True,
            "is_synthetic": True,
            "synthetic_archetype": "Sedentary Desk Ergonomics & Weekend Cyclist",
            "clinical_notes_disclaimer": "SYNTHETIC PROFILE: Generated for demonstration and trend analysis algorithm validation.",
            "profile_type": "weekend_warrior_desk_worker",
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

        # Generate 90 days of daily readings with realistic temporal patterns and missing observations
        for day in range(90, -1, -1):
            obs_time = now - timedelta(days=day, hours=random.randint(1, 4))
            day_idx = 90 - day  # 0 (90 days ago) to 90 (today)
            day_of_week = obs_time.weekday()  # 0=Monday, 5=Saturday, 6=Sunday

            # -------------------------------------------------------------
            # Profile 1: Aarav Mehta (Sleep Deprivation Drift)
            # Days 0-75: Stable baseline
            # Days 75-90: Sleep disruption, HR elevation, HRV drop, resp rate climb
            # Day 85: Documented acute night with 3.8h sleep
            # -------------------------------------------------------------
            if profile_type == "sleep_deprivation_drift":
                drift_factor = max(0.0, (day_idx - 75) / 15.0)
                is_acute_day = (day == 5)  # 5 days ago (day_idx 85)

                if is_acute_day:
                    sleep_hrs = 3.8
                    hr = 83.2
                    hrv = 27.5
                    sbp = 128.0
                    dbp = 82.0
                    resp_rate = 19.0
                    steps = 4100
                    spo2 = 97.2
                    glucose = 99.0
                else:
                    sleep_hrs = max(4.0, 7.5 - drift_factor * 2.6 + random.gauss(0, 0.35))
                    hr = 64.0 + drift_factor * 13.0 + random.gauss(0, 1.8)
                    hrv = max(20.0, 56.0 - drift_factor * 24.0 + random.gauss(0, 3.2))
                    sbp = 118.0 + drift_factor * 8.0 + random.gauss(0, 2.5)
                    dbp = 76.0 + drift_factor * 5.0 + random.gauss(0, 2.0)
                    resp_rate = 14.0 + drift_factor * 3.5 + random.gauss(0, 0.6)
                    steps = max(2000, int(7500 - drift_factor * 2500 + random.gauss(0, 700)))
                    spo2 = min(100.0, 98.2 - drift_factor * 0.8 + random.gauss(0, 0.4))
                    glucose = 92.0 + drift_factor * 7.0 + random.gauss(0, 2.5)

                # Missing observation injection: Days 22 & 54 wearable charging / not worn
                include_wearables = day not in [22, 54]
                # Fasting glucose only tested every 14 days
                include_glucose = (day % 14 == 0)
                # Blood pressure measured weekly
                include_bp = (day % 7 == 0 or is_acute_day)

            # -------------------------------------------------------------
            # Profile 2: Priya Sharma (Cardiometabolic Lifestyle Improvement)
            # Baseline: Stage 1 elevated BP, low steps, elevated glucose
            # Days 20-90: DASH diet + aerobic walking, steady normalization
            # Day 48: Feast day transient elevation
            # -------------------------------------------------------------
            elif profile_type == "lifestyle_improvement":
                improve_factor = min(1.0, max(0.0, (day_idx - 15) / 75.0))
                is_feast_day = (day == 42)  # day_idx 48

                if is_feast_day:
                    sleep_hrs = 6.0
                    hr = 81.0
                    hrv = 29.0
                    sbp = 138.5
                    dbp = 91.0
                    resp_rate = 16.5
                    steps = 3200
                    spo2 = 97.4
                    glucose = 118.0
                else:
                    sleep_hrs = 6.5 + improve_factor * 1.0 + random.gauss(0, 0.35)
                    hr = 78.0 - improve_factor * 7.5 + random.gauss(0, 2.0)
                    hrv = 32.0 + improve_factor * 13.0 + random.gauss(0, 2.8)
                    sbp = 142.0 - improve_factor * 17.0 + random.gauss(0, 3.0)
                    dbp = 92.0 - improve_factor * 11.5 + random.gauss(0, 2.2)
                    resp_rate = 16.0 - improve_factor * 1.5 + random.gauss(0, 0.5)
                    steps = max(1800, int(3800 + improve_factor * 4500 + random.gauss(0, 550)))
                    spo2 = min(100.0, 97.5 + improve_factor * 1.0 + random.gauss(0, 0.5))
                    glucose = 108.0 - improve_factor * 13.0 + random.gauss(0, 3.0)

                include_wearables = day not in [18, 64]
                # Blood pressure measured 3 times a week (Mon, Wed, Fri)
                include_bp = (day_of_week in [0, 2, 4] or is_feast_day)
                # Glucose measured weekly by fingerstick
                include_glucose = (day % 7 == 0 or is_feast_day)

            # -------------------------------------------------------------
            # Profile 3: Devan Nair (Athletic Conditioning & Autonomic Overreaching)
            # Baseline: Low resting HR (48), high HRV (86), very high steps
            # Days 70-90: Training overload, parasympathetic saturation & fatigue
            # Day 83: Acute exhaustion spike
            # -------------------------------------------------------------
            elif profile_type == "overtraining_autonomic_drift":
                strain_factor = max(0.0, (day_idx - 70) / 20.0)
                is_strain_peak = (day == 7)  # day_idx 83

                if is_strain_peak:
                    sleep_hrs = 6.8
                    hr = 67.5
                    hrv = 31.0
                    sbp = 120.0
                    dbp = 76.0
                    resp_rate = 16.0
                    steps = 21500
                    spo2 = 98.0
                    glucose = 89.0
                else:
                    sleep_hrs = max(6.0, 8.4 - strain_factor * 1.3 + random.gauss(0, 0.3))
                    hr = 48.0 + strain_factor * 14.5 + random.gauss(0, 1.8)
                    hrv = max(25.0, 86.0 - strain_factor * 42.0 + random.gauss(0, 3.8))
                    sbp = 112.0 + strain_factor * 6.0 + random.gauss(0, 2.5)
                    dbp = 70.0 + strain_factor * 4.5 + random.gauss(0, 2.0)
                    resp_rate = 12.0 + strain_factor * 3.2 + random.gauss(0, 0.5)
                    steps = max(6000, int(14000 + strain_factor * 4500 + random.gauss(0, 1200)))
                    spo2 = min(100.0, 99.0 - strain_factor * 0.8 + random.gauss(0, 0.4))
                    glucose = 86.0 + random.gauss(0, 2.5)

                include_wearables = day not in [35, 68]
                include_bp = (day % 10 == 0)
                include_glucose = (day % 21 == 0)

            # -------------------------------------------------------------
            # Profile 4: Sunita Rao (Healthy Active Senior)
            # High stability across all 90 days, demonstrating normal aging
            # Tests robust missing data handling on weekends without alarm
            # -------------------------------------------------------------
            elif profile_type == "healthy_active_senior":
                sleep_hrs = 7.2 + random.gauss(0, 0.3)
                hr = 70.5 + random.gauss(0, 1.6)
                hrv = 44.0 + random.gauss(0, 2.5)
                sbp = 124.0 + random.gauss(0, 2.8)
                dbp = 78.0 + random.gauss(0, 2.0)
                resp_rate = 14.2 + random.gauss(0, 0.5)
                steps = max(3500, int(5800 + random.gauss(0, 500)))
                spo2 = min(99.0, 97.6 + random.gauss(0, 0.5))
                glucose = 93.5 + random.gauss(0, 2.5)

                # Removes wearable every 3rd weekend (Saturday & Sunday)
                is_weekend_break = (day_of_week in [5, 6] and (day // 7) % 3 == 0)
                include_wearables = not is_weekend_break
                # Blood pressure measured bi-weekly at community clinic
                include_bp = (day % 14 == 0)
                # Fasting glucose measured monthly
                include_glucose = (day % 30 == 0)

            # -------------------------------------------------------------
            # Profile 5: Kabir Sen (Sedentary Desk Worker / Weekend Warrior)
            # Bimodal: Mon-Fri sedentary (4200 steps), Sat-Sun active (16000 steps)
            # Monday recovery lag with transient HR elevation
            # Glucose untracked (validates missing input engine)
            # -------------------------------------------------------------
            else:
                is_weekend = day_of_week in [5, 6]
                is_monday = (day_of_week == 0)
                is_century_ride = (day == 14)  # day_idx 76

                if is_century_ride:
                    steps = 19500
                    hr = 81.5
                    hrv = 28.5
                    sleep_hrs = 5.2
                    sbp = 130.0
                    dbp = 84.0
                    resp_rate = 17.5
                    spo2 = 98.5
                elif is_weekend:
                    steps = int(15500 + random.gauss(0, 1500))
                    hr = 71.0 + random.gauss(0, 2.2)
                    hrv = 42.0 + random.gauss(0, 3.0)
                    sleep_hrs = 7.8 + random.gauss(0, 0.4)
                    sbp = 125.0 + random.gauss(0, 3.0)
                    dbp = 82.0 + random.gauss(0, 2.5)
                    resp_rate = 15.0 + random.gauss(0, 0.7)
                    spo2 = 98.4 + random.gauss(0, 0.4)
                elif is_monday:
                    # Post-weekend exertion lag
                    steps = int(4200 + random.gauss(0, 500))
                    hr = 76.5 + random.gauss(0, 2.0)
                    hrv = 36.5 + random.gauss(0, 2.8)
                    sleep_hrs = 6.4 + random.gauss(0, 0.35)
                    sbp = 127.0 + random.gauss(0, 2.5)
                    dbp = 83.0 + random.gauss(0, 2.0)
                    resp_rate = 15.8 + random.gauss(0, 0.5)
                    spo2 = 97.9 + random.gauss(0, 0.4)
                else:
                    # Tue-Fri routine desk work
                    steps = int(4400 + random.gauss(0, 600))
                    hr = 72.0 + random.gauss(0, 1.8)
                    hrv = 45.0 + random.gauss(0, 2.5)
                    sleep_hrs = 6.8 + random.gauss(0, 0.35)
                    sbp = 124.0 + random.gauss(0, 2.5)
                    dbp = 80.5 + random.gauss(0, 2.0)
                    resp_rate = 14.8 + random.gauss(0, 0.5)
                    spo2 = 98.1 + random.gauss(0, 0.4)

                glucose = 94.0  # Not logged as observation to test missing input
                include_wearables = True
                include_bp = (day_of_week == 0 or is_century_ride)  # Check BP on Mondays
                include_glucose = False  # Completely untracked for PT-1005

            # Assemble metric records respecting missing observation logic
            raw_metrics = []

            if include_wearables:
                raw_metrics.extend([
                    ("heart_rate", round(hr, 1), "bpm", "wearable_continuous", "measured"),
                    ("hrv_rmssd", round(hrv, 1), "ms", "wearable_continuous", "measured"),
                    ("sleep_duration_hours", round(sleep_hrs, 1), "hours", "wearable_continuous", "measured"),
                    ("daily_steps", float(steps), "steps", "wearable_continuous", "measured"),
                    ("respiratory_rate", round(resp_rate, 1), "breaths/min", "wearable_continuous", "measured"),
                    ("spo2", round(spo2, 1), "%", "wearable_continuous", "measured")
                ])

            if include_bp:
                raw_metrics.extend([
                    ("blood_pressure_systolic", round(sbp, 1), "mmHg", "manual_entry" if day % 14 != 0 else "clinical_lab", "user_entered" if day % 14 != 0 else "measured"),
                    ("blood_pressure_diastolic", round(dbp, 1), "mmHg", "manual_entry" if day % 14 != 0 else "clinical_lab", "user_entered" if day % 14 != 0 else "measured")
                ])

            if include_glucose:
                raw_metrics.append(
                    ("fasting_blood_glucose", round(glucose, 1), "mg/dL", "clinical_lab" if day % 30 == 0 else "manual_entry", "measured" if day % 30 == 0 else "user_entered")
                )

            for m_type, val, unit, src, kind in raw_metrics:
                obs_id = f"obs_syn_{pid.lower()}_{uuid.uuid4().hex[:8]}"
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
                    "metadata": {
                        "is_synthetic": True,
                        "fictional_profile": True,
                        "telemetry_engine": "SwasthyaTwin Synthetic Telemetry Engine v2.0",
                        "confidence": 0.96
                    },
                    "created_at": obs_time,
                    "demo_data": True
                })

        if patient_observations:
            db.observations.insert_many(patient_observations)
            total_observations += len(patient_observations)

        # Compute initial baselines, alerts & dynamic twin assessment
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
        "message": f"Successfully seeded {inserted_patients} synthetic demo patients with {total_observations} longitudinal observations without deleting real user data."
    }


def inject_live_observation(
    db: Database,
    patient_id: str = "PT-1001",
    metric_type: str = "heart_rate",
    value: Optional[float] = None,
    source: str = "wearable_continuous_live"
) -> Dict[str, Any]:
    """
    Live Demonstration Mode:
    Inserts a newly observed synthetic telemetry packet for the active patient,
    immediately triggers the digital twin dynamic re-assessment,
    and returns both the inserted observation and the newly recalculated twin state.
    """
    now = datetime.now(timezone.utc)

    # Defaults for acute demonstrations if not provided
    default_values = {
        "heart_rate": (86.5, "bpm", "measured"),
        "blood_pressure_systolic": (136.0, "mmHg", "measured"),
        "blood_pressure_diastolic": (88.0, "mmHg", "measured"),
        "hrv_rmssd": (28.0, "ms", "measured"),
        "sleep_duration_hours": (4.5, "hours", "measured"),
        "daily_steps": (11500.0, "steps", "measured"),
        "respiratory_rate": (19.5, "breaths/min", "measured"),
        "spo2": (96.5, "%", "measured")
    }

    preset = default_values.get(metric_type, (80.0, "bpm", "measured"))
    obs_val = value if value is not None else preset[0]
    unit = preset[1]
    kind = preset[2]

    obs_id = f"obs_live_{uuid.uuid4().hex[:8]}"
    obs_doc = {
        "observation_id": obs_id,
        "patient_id": patient_id,
        "measurement_type": metric_type,
        "metric_type": metric_type,
        "value": float(obs_val),
        "unit": unit,
        "observed_at": now,
        "timestamp": now,
        "source": source,
        "data_kind": kind,
        "data_tier": kind,
        "metadata": {
            "is_synthetic": True,
            "is_live_demonstration": True,
            "stream": "realtime_telemetry_webhook",
            "confidence": 0.98
        },
        "created_at": now,
        "demo_data": True
    }

    db.observations.insert_one(obs_doc)

    # Recalculate dynamic twin state
    twin_state = AssessmentService.evaluate_twin_state(db, patient_id)
    latest_assess = AssessmentService.get_latest_assessment(db, patient_id)

    return {
        "status": "success",
        "message": f"Live synthetic observation recorded for {patient_id}. Digital Twin recalculated.",
        "observation": {
            "observation_id": obs_id,
            "patient_id": patient_id,
            "metric_type": metric_type,
            "value": float(obs_val),
            "unit": unit,
            "timestamp": now.isoformat(),
            "source": source,
            "data_tier": kind,
            "is_live_demonstration": True
        },
        "recalculated_vitality_index": latest_assess.indicator_value if latest_assess else None,
        "twin_state": twin_state.model_dump() if twin_state and hasattr(twin_state, "model_dump") else twin_state
    }
