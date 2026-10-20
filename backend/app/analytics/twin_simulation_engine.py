import math
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from app.models.simulation import (
    InterventionParams,
    TrajectoryPoint,
    SimulationResponse
)

def run_twin_simulation(
    patient_id: str,
    scenario_name: str,
    params: InterventionParams,
    baseline_stats: Dict[str, float]
) -> Dict[str, Any]:
    """
    Simulates physiological adaptation over time using pharmacokinetic/pharmacodynamic
    exponential response models with physiological saturation.
    """
    # Extract starting baseline or set reasonable physiological defaults
    base_rhr = baseline_stats.get("heart_rate", 72.0)
    base_sbp = baseline_stats.get("blood_pressure_systolic", 124.0)
    base_hrv = baseline_stats.get("hrv_rmssd", 42.0)

    # Time constants (in days)
    tau_sleep = 4.0      # Sleep changes affect autonomic tone quickly (~4 days)
    tau_activity = 12.0  # Physical conditioning adapts over ~12 days
    tau_sodium = 7.0     # Blood pressure response to dietary sodium (~7 days)

    # Effect coefficients (grounded in literature: e.g., ~1.5 bpm drop per extra hour sleep; ~2 mmHg per 3k steps)
    k_hr_sleep = 1.6
    k_bp_activity = 0.0008 # per step: +3000 steps = -2.4 mmHg
    k_bp_sodium = 0.12     # per percent sodium reduction: 20% reduction = -2.4 mmHg
    k_hrv_sleep = 3.2      # +1 hr sleep = +3.2 ms HRV
    k_hrv_stress = 0.25    # -20% stress = +5.0 ms HRV

    trajectories: List[TrajectoryPoint] = []
    start_date = datetime.now(timezone.utc)

    for day in range(1, params.duration_days + 1):
        curr_date = (start_date + timedelta(days=day)).strftime("%Y-%m-%d")

        # Response factors: 1 - exp(-t / tau)
        resp_sleep = 1.0 - math.exp(-day / tau_sleep)
        resp_act = 1.0 - math.exp(-day / tau_activity)
        resp_sod = 1.0 - math.exp(-day / tau_sodium)

        # Delta computations
        delta_rhr = (
            -params.delta_sleep_hours * k_hr_sleep * resp_sleep
            - (params.delta_daily_steps / 4000.0) * 1.2 * resp_act
            + (params.delta_stress_level / 20.0) * 1.5 * resp_sleep
        )

        delta_sbp = (
            -params.delta_daily_steps * k_bp_activity * resp_act
            - params.sodium_reduction_pct * k_bp_sodium * resp_sod
            - params.delta_sleep_hours * 1.1 * resp_sleep
            + (params.delta_stress_level / 25.0) * 1.8 * resp_sleep
        )

        delta_hrv = (
            params.delta_sleep_hours * k_hrv_sleep * resp_sleep
            - params.delta_stress_level * k_hrv_stress * resp_sleep
            + (params.delta_daily_steps / 5000.0) * 2.5 * resp_act
        )

        # Forecasted metric values
        projected_rhr = max(45.0, min(120.0, base_rhr + delta_rhr))
        projected_sbp = max(90.0, min(180.0, base_sbp + delta_sbp))
        projected_hrv = max(15.0, min(130.0, base_hrv + delta_hrv))

        # Expanding confidence interval over time (t/duration) representing predictive uncertainty
        uncertainty_factor = 1.0 + (day / params.duration_days) * 0.8
        hr_ci = 2.5 * uncertainty_factor
        bp_ci = 3.8 * uncertainty_factor
        hrv_ci = 4.2 * uncertainty_factor

        # Projected vitality score
        vitality_improvement = (
            (base_rhr - projected_rhr) * 0.8 +
            (base_sbp - projected_sbp) * 0.6 +
            (projected_hrv - base_hrv) * 0.5
        )
        projected_vitality = max(30.0, min(100.0, 80.0 + vitality_improvement))

        trajectories.append(TrajectoryPoint(
            day=day,
            date=curr_date,
            resting_hr=round(projected_rhr, 1),
            resting_hr_upper=round(projected_rhr + hr_ci, 1),
            resting_hr_lower=round(projected_rhr - hr_ci, 1),
            systolic_bp=round(projected_sbp, 1),
            systolic_bp_upper=round(projected_sbp + bp_ci, 1),
            systolic_bp_lower=round(projected_sbp - bp_ci, 1),
            hrv_rmssd=round(projected_hrv, 1),
            hrv_rmssd_upper=round(projected_hrv + hrv_ci, 1),
            hrv_rmssd_lower=round(projected_hrv - hrv_ci, 1),
            vitality_projected=round(projected_vitality, 1)
        ))

    final_pt = trajectories[-1]
    outcomes = {
        "final_resting_hr": final_pt.resting_hr,
        "delta_resting_hr": round(final_pt.resting_hr - base_rhr, 1),
        "final_systolic_bp": final_pt.systolic_bp,
        "delta_systolic_bp": round(final_pt.systolic_bp - base_sbp, 1),
        "final_hrv_rmssd": final_pt.hrv_rmssd,
        "delta_hrv_rmssd": round(final_pt.hrv_rmssd - base_hrv, 1),
        "final_vitality": final_pt.vitality_projected
    }

    assumptions = [
        "Cardiovascular response follows an exponential adaptation curve with empirical saturation.",
        "Sleep interventions are assumed to be consistent on consecutive nights.",
        "Activity interventions assume moderate aerobic intensity (e.g. brisk walking).",
        "Predictive variance expands linearly over the projection horizon to reflect clinical uncertainty."
    ]

    return {
        "patient_id": patient_id,
        "scenario_name": scenario_name,
        "created_at": datetime.now(timezone.utc),
        "parameters": params.model_dump(),
        "baseline_summary": {
            "resting_hr": round(base_rhr, 1),
            "systolic_bp": round(base_sbp, 1),
            "hrv_rmssd": round(base_hrv, 1)
        },
        "projected_outcomes": outcomes,
        "trajectories": [t.model_dump() for t in trajectories],
        "model_assumptions": assumptions,
        "disclaimer": (
            "Simulated data generated by mathematical digital twin model. For educational and lifestyle "
            "exploration only. Does not constitute clinical prognosis or guaranteed medical outcomes."
        )
    }
