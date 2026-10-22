"""
Reproducible Evaluation Pipeline for Personalized Heart-Rate Anomaly Intelligence
Compares:
1. Static Population Threshold Detector (Resting HR < 50 bpm or > 100 bpm)
2. Personalized Robust nMAD Corridor Detector (Modified Z >= 2.5)

Evaluates strictly chronologically per patient without cross-temporal or cross-patient leakage.
Produces operational statistics and explicitly abstains from fabricating ground-truth clinical labels.
"""

import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
import numpy as np

from app.analytics.hr_anomaly_engine import (
    analyze_patient_heart_rate_stream,
    is_eligible_observation,
    parse_observation_timestamp,
    ALGORITHM_VERSION,
    DEFAULT_WINDOW_DAYS,
    DEFAULT_MIN_OBSERVATIONS,
    DEFAULT_Z_THRESHOLD
)
from app.database.connection import db_manager


def run_evaluation() -> Dict[str, Any]:
    print("=" * 70)
    print("Starting Chronological Evaluation of Heart-Rate Anomaly Intelligence")
    print(f"Algorithm Version: {ALGORITHM_VERSION}")
    print("=" * 70)

    db_manager.connect()
    db = db_manager.get_database()

    patients = list(db.patients.find({}, {"_id": 0, "patient_id": 1, "full_name": 1, "demo_data": 1}))
    print(f"Found {len(patients)} cohort subjects in database.")

    overall_observations = 0
    overall_eligible = 0
    overall_excluded = 0

    patient_reports = []

    total_pop_flagged = 0
    total_personalized_flagged = 0
    total_insufficient = 0
    total_normal = 0

    for p in patients:
        pid = p["patient_id"]
        # Fetch all HR observations for this patient
        all_obs = list(db.observations.find({
            "patient_id": pid,
            "$or": [
                {"measurement_type": "heart_rate"},
                {"measurement_type": "resting_heart_rate"},
                {"metric_type": "heart_rate"},
                {"metric_type": "resting_heart_rate"}
            ]
        }, {"_id": 0}))

        total_obs = len(all_obs)
        overall_observations += total_obs

        eligible_obs = [o for o in all_obs if is_eligible_observation(o)]
        excluded_count = total_obs - len(eligible_obs)
        overall_eligible += len(eligible_obs)
        overall_excluded += excluded_count

        if not eligible_obs:
            patient_reports.append({
                "patient_id": pid,
                "full_name": p.get("full_name"),
                "total_records": total_obs,
                "eligible_records": 0,
                "excluded_records": excluded_count,
                "coverage_status": "no_eligible_data"
            })
            continue

        # 1. Run Chronological Personalized nMAD Detector
        personalized_records = analyze_patient_heart_rate_stream(
            patient_id=pid,
            observations=eligible_obs,
            window_days=DEFAULT_WINDOW_DAYS,
            min_observations=DEFAULT_MIN_OBSERVATIONS,
            z_threshold=DEFAULT_Z_THRESHOLD
        )

        # 2. Run Static Population Detector (<50 or >100 bpm)
        pop_flags = 0
        for o in eligible_obs:
            v = float(o.get("value", 0))
            if v < 50.0 or v > 100.0:
                pop_flags += 1

        pers_high = sum(1 for r in personalized_records if r.status == "unusual_high")
        pers_low = sum(1 for r in personalized_records if r.status == "unusual_low")
        pers_flags = pers_high + pers_low
        insufficient = sum(1 for r in personalized_records if r.status == "insufficient_data")
        normal = sum(1 for r in personalized_records if r.status == "within_personal_range")
        quality_review = sum(1 for r in personalized_records if r.status == "review_data_quality")

        total_pop_flagged += pop_flags
        total_personalized_flagged += pers_flags
        total_insufficient += insufficient
        total_normal += normal

        patient_reports.append({
            "patient_id": pid,
            "full_name": p.get("full_name"),
            "total_records": total_obs,
            "eligible_records": len(eligible_obs),
            "excluded_records": excluded_count,
            "exclusion_rate_pct": round((excluded_count / total_obs) * 100.0, 1) if total_obs > 0 else 0.0,
            "population_detector": {
                "rules": "Resting HR < 50 bpm OR > 100 bpm",
                "flagged_count": pop_flags,
                "flag_rate_pct": round((pop_flags / len(eligible_obs)) * 100.0, 1) if eligible_obs else 0.0
            },
            "personalized_nmad_detector": {
                "algorithm": ALGORITHM_VERSION,
                "rules": f"Modified Z >= {DEFAULT_Z_THRESHOLD} against 30d median baseline",
                "total_evaluated": len(personalized_records),
                "unusual_high_count": pers_high,
                "unusual_low_count": pers_low,
                "total_flagged": pers_flags,
                "flag_rate_pct": round((pers_flags / len(personalized_records)) * 100.0, 1) if personalized_records else 0.0,
                "within_personal_range_count": normal,
                "insufficient_data_count": insufficient,
                "review_data_quality_count": quality_review
            }
        })

    # Summary Report
    eval_report = {
        "evaluation_title": "SwasthyaTwin Heart-Rate Anomaly Detection Operational Evaluation",
        "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
        "algorithm_version": ALGORITHM_VERSION,
        "parameters": {
            "window_days": DEFAULT_WINDOW_DAYS,
            "min_observations": DEFAULT_MIN_OBSERVATIONS,
            "z_threshold": DEFAULT_Z_THRESHOLD,
            "variability_measure": "Normalized Median Absolute Deviation (nMAD)",
            "variability_scale_factor": 1.4826
        },
        "operational_statistics": {
            "total_patients_analyzed": len(patients),
            "total_raw_observations": overall_observations,
            "total_eligible_observations": overall_eligible,
            "total_excluded_by_quality": overall_excluded,
            "exclusion_rate_pct": round((overall_excluded / overall_observations) * 100.0, 1) if overall_observations > 0 else 0.0,
            "total_population_flags": total_pop_flagged,
            "total_personalized_flags": total_personalized_flagged,
            "total_within_range": total_normal,
            "total_insufficient_history": total_insufficient
        },
        "patient_breakdown": patient_reports,
        "honest_validation_disclosure": {
            "supervised_ground_truth_status": "UNAVAILABLE",
            "justification": (
                "No independently reviewed clinician gold-standard anomaly labels are attached to ordinary "
                "continuous wearable HR streams. As per medical ML best practices, supervised precision, recall, "
                "ROC-AUC, and F1 metrics are explicitly withheld rather than manufactured with synthetic labels."
            ),
            "clinical_boundary": (
                "Anomalies detected are statistical deviations from personal resting distributions, intended for "
                "wellness reflection and health self-awareness, not clinical diagnosis of acute coronary syndrome or arrhythmias."
            )
        }
    }

    # Write report to disk
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    report_dir = os.path.join(repo_root, "reports")
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "heart_rate_anomaly_evaluation.json")

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_report, f, indent=2)

    print(f"Evaluation report successfully saved to: {report_path}")
    print(f"Operational Summary: {overall_eligible} eligible observations across {len(patients)} subjects.")
    print(f"Personalized Anomalies Flagged: {total_personalized_flagged} ({round(total_personalized_flagged / overall_eligible * 100, 1) if overall_eligible else 0}%)")
    print(f"Population Baseline Flags: {total_pop_flagged} ({round(total_pop_flagged / overall_eligible * 100, 1) if overall_eligible else 0}%)")
    print("=" * 70)
    return eval_report


if __name__ == "__main__":
    run_evaluation()
