from datetime import datetime, timezone
from typing import Dict, List, Tuple
from app.models.assessment import (
    MetricDeviation,
    ExplainabilityFactor,
    HealthAssessmentResponse
)

# Relative weight of each biometric domain in the overall stability score
METRIC_WEIGHTS = {
    "heart_rate": 0.22,
    "blood_pressure_systolic": 0.20,
    "blood_pressure_diastolic": 0.15,
    "hrv_rmssd": 0.15,
    "sleep_duration_hours": 0.15,
    "daily_steps": 0.08,
    "spo2": 0.05
}

def calculate_health_stability_index(
    patient_id: str,
    deviations: Dict[str, MetricDeviation]
) -> HealthAssessmentResponse:
    """
    Computes a transparent, explainable 0-100 Health Stability Index.
    Base score = 100.
    Points are deducted transparently based on standardized deviation (|Z| > 1.0) from the patient's personal baseline.
    """
    total_deductions = 0.0
    factors: List[ExplainabilityFactor] = []

    for m_type, dev in deviations.items():
        weight = METRIC_WEIGHTS.get(m_type, 0.10)
        abs_z = abs(dev.z_score)

        if abs_z > 1.0:
            # Linear deduction beyond 1.0 standard deviation, capped at 30 points weighted
            excess_z = abs_z - 1.0
            point_penalty = min(30.0, excess_z * 12.0) * weight
            total_deductions += point_penalty

            severity = "critical" if abs_z >= 3.0 else ("warning" if abs_z >= 2.0 else "info")
            factors.append(ExplainabilityFactor(
                metric_type=m_type,
                impact_score=round(point_penalty, 1),
                rule_name=f"Self-Baseline Deviation ({dev.direction})",
                rationale=(
                    f"Deviation of {dev.delta_percentage:+.1f}% from baseline (|Z|={abs_z:.2f}) "
                    f"in {m_type.replace('_', ' ').title()}."
                ),
                severity=severity
            ))

    # Calculate final stability index clamped between 20 and 100
    vitality_index = max(20.0, min(100.0, 100.0 - total_deductions))

    # Overall stability status classification
    if vitality_index >= 90:
        status = "optimal"
        summary = "Biometrics are closely aligned with your personal historical baseline."
    elif vitality_index >= 75:
        status = "mild_deviation"
        summary = "Subtle fluctuations detected compared to your personal baseline. Routine stability."
    elif vitality_index >= 60:
        status = "moderate_drift"
        summary = "Noticeable drift across key cardiovascular or recovery indicators from personal norms."
    else:
        status = "significant_deviation"
        summary = "Significant multi-metric divergence from baseline. Active monitoring and rest advised."

    return HealthAssessmentResponse(
        patient_id=patient_id,
        calculated_at=datetime.now(timezone.utc),
        vitality_index=round(vitality_index, 1),
        stability_status=status,
        deviations=deviations,
        explainability_factors=factors,
        summary_message=summary,
        safety_disclaimer=(
            "SwasthyaTwin provides mathematical trend indicators against personal baselines for research "
            "and wellness insight. This is not a clinical diagnosis or medical prognosis."
        )
    )
