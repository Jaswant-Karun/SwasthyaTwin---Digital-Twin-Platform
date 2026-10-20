from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.models.assessment import MetricDeviation
from app.models.alert import AlertBase
from app.core.config import settings

# Documented, configurable demonstration rules
# NOTE: These thresholds are demonstration research heuristics, NOT established clinical guidelines.
DEMONSTRATION_RULES: Dict[str, Dict[str, Any]] = {
    "DEMO-HR-ELEV-01": {
        "rule_id": "DEMO-HR-ELEV-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "heart_rate",
        "label": "Elevated Resting Heart Rate",
        "directionality": "higher_worse",
        "warning_z": 1.8,
        "critical_z": 3.0,
        "require_persistence": 2,  # Sustained across 2 consecutive readings
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Resting heart rate has drifted significantly above the patient's personal median baseline.",
        "lifestyle_guidance": "Review recent sleep patterns, physical exertion, hydration, and caffeine intake.",
        "professional_note": "If accompanied by chest discomfort, shortness of breath, or palpitations, consult a healthcare provider."
    },
    "DEMO-BP-SYS-ELEV-01": {
        "rule_id": "DEMO-BP-SYS-ELEV-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "blood_pressure_systolic",
        "label": "Elevated Systolic Blood Pressure",
        "directionality": "higher_worse",
        "warning_z": 1.8,
        "critical_z": 2.8,
        "require_persistence": 2,
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Systolic blood pressure reading exceeds typical personal distribution bounds.",
        "lifestyle_guidance": "Take a repeat measurement after 5 minutes of quiet rest with appropriate cuff placement.",
        "professional_note": "Persistent elevation across multiple days warrants discussion with your primary care provider."
    },
    "DEMO-BP-DIA-ELEV-01": {
        "rule_id": "DEMO-BP-DIA-ELEV-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "blood_pressure_diastolic",
        "label": "Elevated Diastolic Blood Pressure",
        "directionality": "higher_worse",
        "warning_z": 1.8,
        "critical_z": 2.8,
        "require_persistence": 2,
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Diastolic blood pressure reading is elevated compared to historical distribution.",
        "lifestyle_guidance": "Ensure seated rest before logging. Monitor dietary sodium and hydration.",
        "professional_note": "Discuss persistent diastolic elevation with a medical professional."
    },
    "DEMO-HRV-SUPP-01": {
        "rule_id": "DEMO-HRV-SUPP-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "hrv_rmssd",
        "label": "Suppressed Autonomic HRV",
        "directionality": "lower_worse",
        "warning_z": -1.8,
        "critical_z": -2.8,
        "require_persistence": 1,
        "max_freshness_hours": 48.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "informational_trend",
        "rationale": "Reduced root mean square of successive differences (RMSSD) reflects temporary vagal withdrawal or training fatigue.",
        "lifestyle_guidance": "Prioritize restorative rest, gentle ambulation, and stress-reduction techniques.",
        "professional_note": "Autonomic markers naturally fluctuate with stress, travel, and sleep quality."
    },
    "DEMO-SPO2-DROP-01": {
        "rule_id": "DEMO-SPO2-DROP-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "spo2",
        "label": "Blood Oxygen Desaturation",
        "directionality": "lower_worse",
        "warning_z": -2.0,
        "critical_z": -3.0,
        "require_persistence": 1,
        "max_freshness_hours": 24.0,
        "flag_category_warning": "warrants_professional_review",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Oxygen saturation reading is lower than personal baseline. Probe placement or respiratory restriction should be verified.",
        "lifestyle_guidance": "Warm extremities and ensure correct sensor placement before re-testing.",
        "professional_note": "If oxygen saturation persists below 94% or is accompanied by breathlessness, seek immediate medical evaluation."
    },
    "DEMO-SLEEP-DEF-01": {
        "rule_id": "DEMO-SLEEP-DEF-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "sleep_duration_hours",
        "label": "Acute Sleep Duration Deficit",
        "directionality": "lower_worse",
        "warning_z": -1.5,
        "critical_z": -2.5,
        "require_persistence": 2,
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "informational_trend",
        "rationale": "Sleep duration across recent nights is noticeably lower than patient baseline window.",
        "lifestyle_guidance": "Maintain consistent sleep-wake timing and limit blue-light screen exposure prior to bed.",
        "professional_note": "Chronic sleep insufficiency compounds cardiovascular and metabolic risk."
    },
    "DEMO-STEPS-DECL-01": {
        "rule_id": "DEMO-STEPS-DECL-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "daily_steps",
        "label": "Reduced Daily Ambulation",
        "directionality": "lower_worse",
        "warning_z": -1.8,
        "critical_z": -2.8,
        "require_persistence": 3,
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "informational_trend",
        "rationale": "Step count has fallen significantly below regular baseline activity routines.",
        "lifestyle_guidance": "Incorporate short active walking breaks throughout the day when feasible.",
        "professional_note": "Sustained declines in ambulation can accompany recovery periods or sedentary work schedules."
    },
    "DEMO-GLUCOSE-ELEV-01": {
        "rule_id": "DEMO-GLUCOSE-ELEV-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "fasting_blood_glucose",
        "label": "Elevated Fasting Glucose",
        "directionality": "higher_worse",
        "warning_z": 1.8,
        "critical_z": 3.0,
        "require_persistence": 2,
        "max_freshness_hours": 72.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Fasting glucose measurement is elevated compared to historical glycemic distribution.",
        "lifestyle_guidance": "Ensure full 8-12 hour fasting conditions prior to morning blood testing.",
        "professional_note": "Consult your clinician for standard HbA1c or venous metabolic testing."
    },
    "DEMO-RESP-ELEV-01": {
        "rule_id": "DEMO-RESP-ELEV-01",
        "rule_version": "v1.4.0-demo",
        "metric_type": "respiratory_rate",
        "label": "Elevated Respiratory Rate",
        "directionality": "higher_worse",
        "warning_z": 1.8,
        "critical_z": 2.8,
        "require_persistence": 2,
        "max_freshness_hours": 48.0,
        "flag_category_warning": "informational_trend",
        "flag_category_critical": "warrants_professional_review",
        "rationale": "Resting breaths per minute exceed normal individual baseline variation.",
        "lifestyle_guidance": "Ensure measurement was taken at rest without prior vigorous exertion.",
        "professional_note": "If breathing difficulty or discomfort is present, seek clinical review."
    }
}

def evaluate_demonstration_rules(
    patient_id: str,
    deviations: Dict[str, MetricDeviation],
    recent_history_map: Optional[Dict[str, List[Dict[str, Any]]]] = None
) -> Tuple[List[AlertBase], Dict[str, Dict[str, Any]]]:
    """
    Evaluates explainable demonstration rules against metric deviations.
    Considers:
    - Separate thresholds per measurement type
    - Persistence across historical readings
    - Sample count and baseline sufficiency
    - Data freshness (suppresses stale alarms)
    - Distinguishes informational trends from findings that warrant professional review
    - Explicitly avoids arbitrary disease probabilities or emergency triage claims.
    """
    alerts: List[AlertBase] = []
    triggered_rules_by_metric: Dict[str, Dict[str, Any]] = {}
    now = datetime.now(timezone.utc)

    # Map metric_type to its demonstration rule
    rules_by_metric: Dict[str, Dict[str, Any]] = {}
    for r in DEMONSTRATION_RULES.values():
        rules_by_metric[r["metric_type"]] = r

    for m_type, dev in deviations.items():
        rule = rules_by_metric.get(m_type)
        if not rule:
            continue

        # Data Freshness Check: Suppress alert if telemetry exceeds max allowed freshness hours
        freshness_h = dev.freshness_hours or 0.0
        if freshness_h > rule.get("max_freshness_hours", 72.0):
            # Telemetry is too old to trigger an active physiological flag
            continue

        z = dev.z_score
        abs_z = abs(z)
        directionality = rule["directionality"]
        warn_z = rule["warning_z"]
        crit_z = rule["critical_z"]

        is_adverse = False
        if directionality == "higher_worse" and z >= warn_z:
            is_adverse = True
        elif directionality == "lower_worse" and z <= warn_z:
            is_adverse = True

        if not is_adverse:
            continue

        # Check Persistence across recent observations if history is provided
        persistence_met = True
        history = (recent_history_map or {}).get(m_type, [])
        required_persistence = rule.get("require_persistence", 1)
        if len(history) >= required_persistence and required_persistence > 1:
            # Check the last N values
            recent_readings = history[-required_persistence:]
            # All must agree in adverse direction
            for r_obs in recent_readings:
                v = r_obs.get("value")
                if v is None:
                    continue
                if directionality == "higher_worse" and v < dev.baseline_mean:
                    persistence_met = False
                    break
                elif directionality == "lower_worse" and v > dev.baseline_mean:
                    persistence_met = False
                    break

        # Distinguish informational trend vs professional review
        is_critical = (abs_z >= abs(crit_z)) or (m_type == "spo2" and dev.current_value < 93.0)
        flag_category = (
            rule["flag_category_critical"] if is_critical else rule["flag_category_warning"]
        )
        severity = "critical" if is_critical else ("warning" if abs_z >= 2.0 else "info")

        # Plain language explanation
        delta_str = f"+{dev.delta_absolute}" if dev.delta_absolute > 0 else f"{dev.delta_absolute}"
        rel_str = f" ({dev.delta_percentage:+.1f}%)" if dev.relative_deviation_meaningful else ""
        category_label = "Finding Warrants Professional Review" if flag_category == "warrants_professional_review" else "Informational Lifestyle Trend"

        explanation = (
            f"Rule {rule['rule_id']} triggered ({category_label}). "
            f"Observed {dev.current_value} {dev.unit} deviates by {delta_str} {dev.unit}{rel_str} "
            f"from personal baseline (|Z|={abs_z:.2f}). {rule['rationale']} "
            f"{rule['lifestyle_guidance']} {rule['professional_note']}"
        )

        title = f"{rule['label']} ({category_label})"

        suggested_action = f"{rule['lifestyle_guidance']} {rule['professional_note']}"

        contributing_obs = [{
            "observation_id": dev.contributing_observation_id,
            "value": dev.current_value,
            "unit": dev.unit,
            "freshness_hours": dev.freshness_hours
        }]

        alert = AlertBase(
            patient_id=patient_id,
            timestamp=now,
            severity=severity,
            metric_type=m_type,
            title=title,
            description=explanation,
            current_value=dev.current_value,
            baseline_value=dev.baseline_mean,
            unit=dev.unit,
            z_score=dev.z_score,
            evidence={
                "rule_id": rule["rule_id"],
                "rule_version": rule["rule_version"],
                "flag_category": flag_category,
                "current_value": dev.current_value,
                "personal_baseline": dev.personal_baseline or dev.baseline_mean,
                "absolute_deviation": dev.delta_absolute,
                "relative_deviation_percent": dev.relative_deviation_percent,
                "z_score": dev.z_score,
                "iqr_distance": dev.iqr_distance,
                "contributing_observations": contributing_obs,
                "persistence_verified": persistence_met,
                "sample_count": dev.data_quality.get("sample_count", 0),
                "is_baseline_sufficient": dev.data_quality.get("is_sufficient", True),
                "freshness_hours": dev.freshness_hours,
                "disclaimer": (
                    "Configurable demonstration research heuristic. Not an emergency prediction, "
                    "certified medical diagnostic standard, or clinical risk score."
                )
            },
            suggested_action=suggested_action,
            is_acknowledged=False
        )
        alerts.append(alert)

        triggered_rules_by_metric[m_type] = {
            "rule_id": rule["rule_id"],
            "rule_version": rule["rule_version"],
            "flag_category": flag_category,
            "explanation": explanation,
            "suggested_action": suggested_action,
            "trigger_condition": f"Z-score {z:.2f} beyond threshold ({warn_z})"
        }

        # Also populate fields on the deviation itself
        dev.rule_id = rule["rule_id"]
        dev.rule_version = rule["rule_version"]
        dev.explanation = explanation

    return alerts, triggered_rules_by_metric
