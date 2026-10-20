from datetime import datetime, timezone
from typing import Dict, List, Any
from app.models.assessment import (
    MetricDeviation,
    ExplainabilityFactor,
    HealthAssessmentResponse
)
from app.core.config import settings

# Base weights for each metric domain when all standard metrics are present
CANONICAL_METRIC_WEIGHTS = {
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
    Computes an explainable, transparent 0-100 Experimental Health Stability Trend Indicator.
    Prefer individual measurement-specific indicators; this composite indicator is a macro overview.

    FORMULA & METHODOLOGY:
    1. Base Score = 100.0.
    2. For each tracked metric i present, calculate standardized excess deviation:
       E_i = max(0, |Z_i| - 1.0)
       Excess beyond 1.0 standard deviation from the patient's personal baseline represents adverse drift.
    3. Metric Penalty:
       P_i = min(30.0, E_i * 12.0) * w_i
    4. Weight Normalization over observed metrics:
       If some metrics are missing, active weights W_active = sum(w_i for active i) are normalized
       so missing metrics never produce artificial penalties or fabricated zero values.
    5. Final Vitality Index:
       Index = max(20.0, min(100.0, 100.0 - (total_penalties / W_active)))
    6. Non-diagnostic: Clearly labeled as an experimental trend indicator, NOT a clinical risk score or disease probability.
    """
    total_raw_deductions = 0.0
    active_weights_sum = 0.0
    factors: List[ExplainabilityFactor] = []
    contributions: Dict[str, Dict[str, Any]] = {}
    missing_inputs: List[str] = []

    # Identify which canonical metrics are present vs missing
    for canonical_m, w in CANONICAL_METRIC_WEIGHTS.items():
        if canonical_m not in deviations:
            missing_inputs.append(canonical_m)

    for m_type, dev in deviations.items():
        base_w = CANONICAL_METRIC_WEIGHTS.get(m_type, 0.10)
        active_weights_sum += base_w
        abs_z = abs(dev.z_score)

        if abs_z > 1.0:
            excess_z = abs_z - 1.0
            point_penalty = min(30.0, excess_z * 12.0) * base_w
            total_raw_deductions += point_penalty

            severity = "critical" if abs_z >= 3.0 else ("warning" if abs_z >= 2.0 else "info")
            factors.append(ExplainabilityFactor(
                metric_type=m_type,
                impact_score=round(point_penalty, 1),
                rule_name=f"Self-Baseline Deviation ({dev.direction})",
                rationale=(
                    f"Deviation of {dev.delta_percentage:+.1f}% from personal baseline (|Z|={abs_z:.2f}, "
                    f"delta: {dev.delta_absolute:+.1f} {dev.unit}) in {m_type.replace('_', ' ').title()}."
                ),
                severity=severity,
                rule_version=settings.RULE_ENGINE_VERSION,
                contributing_observation_id=dev.contributing_observation_id
            ))
        else:
            point_penalty = 0.0

        contributions[m_type] = {
            "weight": base_w,
            "impact_score": round(point_penalty, 1),
            "status": dev.status,
            "direction": dev.direction,
            "z_score": dev.z_score,
            "current_value": dev.current_value,
            "unit": dev.unit,
            "is_stale": dev.is_stale
        }

    # Normalize by active weights sum to prevent missing inputs from distorting score
    norm_factor = active_weights_sum if active_weights_sum > 0 else 1.0
    normalized_deductions = total_raw_deductions / norm_factor

    vitality_index = max(20.0, min(100.0, 100.0 - normalized_deductions))

    # Overall stability status classification
    if vitality_index >= 90:
        status = "optimal"
        summary = "Biometrics are closely aligned with your personal historical baseline."
    elif vitality_index >= 75:
        status = "mild_deviation"
        summary = "Subtle fluctuations detected compared to personal baseline. Routine stability."
    elif vitality_index >= 60:
        status = "moderate_drift"
        summary = "Noticeable drift across key cardiovascular or recovery indicators from personal norms."
    else:
        status = "significant_deviation"
        summary = "Significant multi-metric divergence from personal baseline. Active rest and clinician consult advised."

    methodology_disclosure = {
        "score_type": "Experimental Health Stability Trend Indicator",
        "formula": "100.0 - (sum(w_i * min(30.0, max(0, |Z_i| - 1.0) * 12.0)) / sum(w_active))",
        "weights": CANONICAL_METRIC_WEIGHTS,
        "missing_input_policy": "Normalized across active observed metrics; missing metrics are excluded without artificial penalties.",
        "limitations": "Demonstration research heuristic. Not a clinical risk score, emergency predictor, or disease probability."
    }

    return HealthAssessmentResponse(
        patient_id=patient_id,
        calculated_at=datetime.now(timezone.utc),
        vitality_index=round(vitality_index, 1),
        stability_status=status,
        deviations=deviations,
        explainability_factors=factors,
        summary_message=summary,
        safety_disclaimer=(
            "SwasthyaTwin provides mathematical trend indicators against personal self-baselines for research "
            "and lifestyle wellness insight. This is an experimental trend indicator, NOT a clinical risk score, "
            "disease probability score, or certified medical prognosis."
        ),
        missing_inputs=missing_inputs,
        component_contributions=contributions,
        model_version=settings.RULE_ENGINE_VERSION
    )
