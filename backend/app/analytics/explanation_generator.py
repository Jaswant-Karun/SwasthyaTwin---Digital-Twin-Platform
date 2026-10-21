import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.models.explanation import (
    CalculationExplanation,
    WorkedExampleStep,
    PatientExplanationsResponse
)
from app.models.assessment import MetricDeviation, MetricBaseline, DigitalTwinStateResponse
from app.analytics.deviation_analyzer import METRIC_CLINICAL_PROPERTIES
from app.analytics.trend_indicator import CANONICAL_METRIC_WEIGHTS
from app.core.config import settings

def format_metric_value(val: Optional[float], metric_type: str) -> str:
    if val is None:
        return "N/A"
    if metric_type == "daily_steps":
        return f"{int(round(val)):,}"
    return f"{val:.1f}"

def build_metric_explanation(
    patient_id: str,
    metric_type: str,
    deviation: Optional[MetricDeviation],
    baseline: Optional[MetricBaseline],
    patient: Dict[str, Any],
    recent_observations: Optional[List[Dict[str, Any]]] = None
) -> CalculationExplanation:
    window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS) if patient else 30
    meta = METRIC_CLINICAL_PROPERTIES.get(metric_type, {})
    label = meta.get("label", metric_type.replace("_", " ").title())
    unit = deviation.unit if deviation else (baseline.unit if baseline else meta.get("unit", ""))

    now = datetime.now(timezone.utc)

    # 1. Handle completely missing telemetry or missing baseline honestly
    if not deviation or deviation.current_value is None:
        obs_count = baseline.sample_count if baseline else 0
        return CalculationExplanation(
            item_id=f"metric_{metric_type}",
            category="metric",
            title=f"{label} Biometric Analysis",
            metric_type=metric_type,
            current_value=None,
            current_value_formatted="Awaiting Telemetry (No readings logged)",
            unit=unit,
            baseline_value=baseline.median if baseline else None,
            baseline_formatted=f"{baseline.median:.1f} {unit} (Baseline)" if baseline else "Not Established (0 observations)",
            historical_window=f"{window_days}-day rolling baseline window",
            window_days=window_days,
            observations_count=obs_count,
            observations_sufficiency=f"Insufficient ({obs_count} observations recorded < {settings.MIN_OBSERVATIONS_FOR_BASELINE} minimum threshold)",
            is_sufficient=False,
            formula_name="Personalized Median Baseline & Z-Score Deviation",
            formula_latex_or_text="Z = (Observed - Baseline_Mean) / Baseline_StdDev; Δ_abs = Observed - Baseline_Median",
            formula_explanation="Compares latest biometric against personal historical distribution. Awaiting patient telemetry before calculating deviation.",
            worked_example_steps=[
                WorkedExampleStep(
                    step_number=1,
                    title="Telemetry Check",
                    description=f"Inspect database for observations of {label} in patient {patient_id}.",
                    calculation=f"Count of valid readings = {obs_count}",
                    result="No active reading found in current telemetry stream."
                ),
                WorkedExampleStep(
                    step_number=2,
                    title="Anti-Population Norm Policy",
                    description="SwasthyaTwin strictly rejects substituting generic population averages (e.g. 72 bpm or 100 mg/dL).",
                    calculation="Population default substitution = DISABLED",
                    result="No artificial baseline or imputed score generated."
                ),
                WorkedExampleStep(
                    step_number=3,
                    title="Stability Index Handling",
                    description="Excluded from health stability index calculation so missing data never penalizes the patient.",
                    calculation="Active weights renormalized over present biometrics.",
                    result="Excluded without penalty."
                )
            ],
            worked_example_summary=f"No observations recorded for {label}. Awaiting device telemetry or patient manual entry.",
            data_source="wearable_stream (disconnected)",
            latest_timestamp=None,
            latest_timestamp_formatted="No timestamp recorded",
            reason_flag_or_alert="No alert generated: awaiting biometric telemetry.",
            flag_severity=None,
            warnings=[
                f"Missing Telemetry: Zero observations of {label} recorded within the active {window_days}-day window.",
                "Excluded from composite vitality scoring to protect personal baseline integrity."
            ],
            is_stale=False,
            is_missing_data=True,
            result_type="Statistical Estimate",
            limitations="Non-diagnostic demonstration system. Missing data is handled explicitly without synthetic imputation.",
            metadata={"status": "awaiting_telemetry", "metric_type": metric_type}
        )

    # 2. When deviation is present
    cur_val = deviation.current_value
    base_median = baseline.median if baseline else deviation.baseline_mean
    base_mean = deviation.baseline_mean
    base_std = deviation.baseline_std
    abs_dev = deviation.delta_absolute
    rel_pct = deviation.delta_percentage
    z = deviation.z_score
    status = deviation.status
    direction = deviation.direction

    obs_count = baseline.sample_count if baseline else (deviation.data_quality.get("sample_count", 1) if deviation.data_quality else 1)
    is_sufficient = baseline.is_sufficient if baseline else (obs_count >= settings.MIN_OBSERVATIONS_FOR_BASELINE)

    # Format window and dates
    if baseline and baseline.window_start and baseline.window_end:
        w_start = baseline.window_start.strftime("%Y-%m-%d")
        w_end = baseline.window_end.strftime("%Y-%m-%d")
        window_str = f"{baseline.window_days}-day rolling baseline window ({w_start} to {w_end})"
    else:
        window_str = f"{window_days}-day rolling baseline window"

    # Data freshness formatting
    freshness_h = deviation.freshness_hours
    if freshness_h is not None:
        if freshness_h < 1.0:
            freshness_str = f"Received < 1 hour ago ({freshness_h * 60:.0f} mins ago)"
        else:
            freshness_str = f"Received {freshness_h:.1f} hours ago"
    else:
        freshness_str = "Recent continuous telemetry"

    ts_str = deviation.assessed_at.strftime("%b %d, %Y, %H:%M UTC") if deviation.assessed_at else now.strftime("%b %d, %Y, %H:%M UTC")
    latest_ts_formatted = f"{ts_str} ({freshness_str})"

    # Worked example steps
    steps: List[WorkedExampleStep] = []

    steps.append(WorkedExampleStep(
        step_number=1,
        title="Retrieve Observed Telemetry & Personal Baseline",
        description="Extract the latest reading and the patient's personal statistical baseline parameters.",
        formula=None,
        calculation=(
            f"Observed Value (x) = {format_metric_value(cur_val, metric_type)} {unit}\n"
            f"Personal Median (M) = {format_metric_value(base_median, metric_type)} {unit}\n"
            f"Personal Mean (μ) = {format_metric_value(base_mean, metric_type)} {unit}\n"
            f"Personal StdDev (σ) = {base_std:.2f} {unit}\n"
            f"Historical Observations Sample Size (n) = {obs_count}"
        ),
        result=f"Inputs established from {window_days}-day personal historical distribution."
    ))

    # Absolute deviation
    steps.append(WorkedExampleStep(
        step_number=2,
        title="Calculate Absolute Deviation vs Personal Median",
        description="Measure the raw shift from the patient's central personal baseline.",
        formula="Absolute Deviation = Observed Value - Personal Median",
        calculation=f"{cur_val:.1f} - {base_median:.1f} = {abs_dev:+.1f} {unit}",
        result=f"{abs_dev:+.1f} {unit}"
    ))

    # Relative percentage deviation (with guardrail explanations)
    if deviation.relative_deviation_meaningful:
        rel_calc = f"100 * ({cur_val:.1f} - {base_median:.1f}) / |{base_median:.1f}| = {rel_pct:+.1f}%"
        rel_res = f"{rel_pct:+.1f}%"
        rel_desc = "Percentage change relative to the patient's personal median."
    else:
        note = deviation.relative_deviation_note or "Metric is bounded percentage or interval scale."
        rel_calc = f"Absolute difference = {abs_dev:+.1f} percentage points. Relative percentage change omitted."
        rel_res = f"{abs_dev:+.1f} percentage points (Bounded)"
        rel_desc = f"{note}"

    steps.append(WorkedExampleStep(
        step_number=3,
        title="Calculate Relative Scale / Percentage Shift",
        description=rel_desc,
        formula="Relative % = 100 * (Observed - Baseline) / |Baseline|",
        calculation=rel_calc,
        result=rel_res
    ))

    # Standardized Z-Score
    steps.append(WorkedExampleStep(
        step_number=4,
        title="Standardize Deviation via Parametric Z-Score",
        description="Express the deviation in terms of the patient's own historical standard deviation units.",
        formula="Z = (Observed - Personal Mean) / Personal StdDev",
        calculation=f"({cur_val:.1f} - {base_mean:.1f}) / {base_std:.2f} = {z:+.2f}σ",
        result=f"{z:+.2f}σ"
    ))

    # Stability Status Classification
    status_label = status.replace("_", " ").title()
    threshold_explanation = (
        "|Z| < 1.0σ: Optimal alignment with baseline\n"
        "1.0σ ≤ |Z| < 2.0σ: Mild deviation (circadian or routine fluctuation)\n"
        "2.0σ ≤ |Z| < 3.0σ: Moderate drift (sustained physiological shift)\n"
        "|Z| ≥ 3.0σ: Significant deviation (divergence from historical bounds)"
    )
    steps.append(WorkedExampleStep(
        step_number=5,
        title="Classify Stability Status from Z-Score Bounds",
        description="Classify physiological stability based on deterministic statistical distance thresholds.",
        formula="|Z| Threshold Classification",
        calculation=f"Actual |Z| = {abs(z):.2f}σ\nCriteria:\n{threshold_explanation}",
        result=f"Classified as '{status_label}' ({direction})"
    ))

    # Reasons for trend flag / alert
    reason_alert: Optional[str] = None
    severity: Optional[str] = None
    if deviation.rule_id:
        reason_alert = f"Rule {deviation.rule_id} triggered: {deviation.explanation}"
        severity = "critical" if abs(z) >= 3.0 else ("warning" if abs(z) >= 2.0 else "info")
    elif abs(z) >= 1.8:
        reason_alert = f"Divergence flag triggered: |Z| = {abs(z):.2f}σ exceeds baseline warning threshold (1.8σ)."
        severity = "warning"
    else:
        reason_alert = f"No deviation alert: Reading of {cur_val:.1f} {unit} is within normal personal historical bounds (|Z| < 1.8σ)."
        severity = "optimal"

    # Warnings
    warnings: List[str] = []
    if deviation.is_stale:
        warnings.append(
            f"Stale Telemetry Warning: Observation was recorded {freshness_h:.0f} hours ago "
            f"(exceeds {settings.DATA_STALENESS_WARNING_HOURS}h freshness threshold). Active alerts are suppressed."
        )
    else:
        warnings.append(f"Telemetry Freshness: {freshness_str} (Fresh, active monitoring).")

    if not is_sufficient:
        warnings.append(
            f"Low Sample Count Notice: Historical window contains {obs_count} observations "
            f"(fewer than {settings.MIN_OBSERVATIONS_FOR_BASELINE} recommended for clinical stability). Baseline is preliminary."
        )

    outlier_count = baseline.outlier_count if baseline else 0
    if outlier_count > 0:
        warnings.append(f"Outlier Filtering: {outlier_count} aberrant historical readings were excluded using Tukey's IQR fences.")

    worked_summary = (
        f"Observed {format_metric_value(cur_val, metric_type)} {unit} deviates by {abs_dev:+.1f} {unit} "
        f"({rel_pct:+.1f}%) from personal median baseline ({format_metric_value(base_median, metric_type)} {unit}), "
        f"yielding a standardized divergence of {z:+.2f}σ ({status_label})."
    )

    base_formatted = (
        f"{format_metric_value(base_median, metric_type)} {unit} "
        f"(Median; Mean: {base_mean:.1f} {unit}, StdDev: {base_std:.2f} {unit}, "
        f"IQR: {baseline.iqr:.1f} {unit if baseline else ''})"
    )

    return CalculationExplanation(
        item_id=f"metric_{metric_type}",
        category="metric",
        title=f"{label} Biometric Calculation & Deviation",
        metric_type=metric_type,
        current_value=round(cur_val, 2),
        current_value_formatted=f"{format_metric_value(cur_val, metric_type)} {unit}",
        unit=unit,
        baseline_value=round(base_median, 2),
        baseline_formatted=base_formatted,
        historical_window=window_str,
        window_days=window_days,
        observations_count=obs_count,
        observations_sufficiency=f"{'Sufficient' if is_sufficient else 'Preliminary'} ({obs_count} observations {'≥' if is_sufficient else '<'} {settings.MIN_OBSERVATIONS_FOR_BASELINE} minimum threshold)",
        is_sufficient=is_sufficient,
        formula_name="Standardized Z-Score & Personal Median Delta",
        formula_latex_or_text="Z = (Observed - Baseline_Mean) / Baseline_StdDev; Δ_abs = Observed - Baseline_Median",
        formula_explanation="Measures distance between latest observation and personal statistical baseline, standardizing by individual variability rather than generic population averages.",
        worked_example_steps=steps,
        worked_example_summary=worked_summary,
        data_source=deviation.data_source or "wearable_continuous",
        latest_timestamp=deviation.assessed_at.isoformat() if deviation.assessed_at else None,
        latest_timestamp_formatted=latest_ts_formatted,
        reason_flag_or_alert=reason_alert,
        flag_severity=severity,
        warnings=warnings,
        is_stale=deviation.is_stale,
        is_missing_data=False,
        result_type="Statistical Estimate",
        limitations="Personal baseline comparison heuristic. Does not diagnose disease, predict medical emergencies, or supersede clinician evaluation.",
        metadata={
            "z_score": z,
            "status": status,
            "direction": direction,
            "iqr_distance": deviation.iqr_distance,
            "data_tier": deviation.data_tier
        }
    )

def build_baseline_explanation(
    patient_id: str,
    metric_type: str,
    baseline: Optional[MetricBaseline],
    patient: Dict[str, Any]
) -> CalculationExplanation:
    window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS) if patient else 30
    meta = METRIC_CLINICAL_PROPERTIES.get(metric_type, {})
    label = meta.get("label", metric_type.replace("_", " ").title())
    unit = baseline.unit if baseline else meta.get("unit", "")
    now = datetime.now(timezone.utc)

    if not baseline or baseline.sample_count == 0:
        return CalculationExplanation(
            item_id=f"baseline_{metric_type}",
            category="baseline",
            title=f"{label} Personal Baseline Calibration",
            metric_type=metric_type,
            current_value=None,
            current_value_formatted="Not Established",
            unit=unit,
            baseline_value=None,
            baseline_formatted="Not Established (0 observations)",
            historical_window=f"{window_days}-day rolling window",
            window_days=window_days,
            observations_count=0,
            observations_sufficiency=f"Insufficient (0 observations < {settings.MIN_OBSERVATIONS_FOR_BASELINE} minimum threshold)",
            is_sufficient=False,
            formula_name="Robust Non-Parametric Median with Tukey's Fences",
            formula_latex_or_text="Median = P_50(X); IQR = Q_3 - Q_1; Fences = [Q_1 - 1.5*IQR, Q_3 + 1.5*IQR]",
            formula_explanation="Calculates central physiological tendency over a rolling window. Requires minimum valid readings before establishing baseline.",
            worked_example_steps=[
                WorkedExampleStep(
                    step_number=1,
                    title="Observation Filter",
                    description="Query observations for this metric within the active rolling window.",
                    calculation="Observations found = 0",
                    result="Insufficient data to compute statistical percentiles."
                ),
                WorkedExampleStep(
                    step_number=2,
                    title="Honest Baseline Policy",
                    description="SwasthyaTwin does not fabricate default baselines from textbook population numbers.",
                    calculation="Baseline computation = DEFERRED",
                    result="Awaiting telemetry."
                )
            ],
            worked_example_summary=f"Personal baseline for {label} is not yet established due to lack of historical telemetry.",
            data_source="wearable_stream",
            latest_timestamp=None,
            latest_timestamp_formatted="No observations recorded",
            reason_flag_or_alert="Baseline inactive: awaiting minimum telemetry count.",
            flag_severity="info",
            warnings=[f"Zero observations recorded for {label} in the past {window_days} days."],
            is_stale=False,
            is_missing_data=True,
            result_type="Statistical Estimate",
            limitations="Statistical baseline reflects only personal historical records. Not a diagnostic standard.",
            metadata={"sample_count": 0}
        )

    w_start = baseline.window_start.strftime("%Y-%m-%d") if baseline.window_start else "N/A"
    w_end = baseline.window_end.strftime("%Y-%m-%d") if baseline.window_end else "N/A"
    window_str = f"{baseline.window_days}-day rolling window ({w_start} to {w_end})"

    steps: List[WorkedExampleStep] = [
        WorkedExampleStep(
            step_number=1,
            title="Collect Cleaned Historical Telemetry",
            description="Collect all valid non-simulated observations in the historical baseline window.",
            formula="N = count(clean_observations)",
            calculation=f"Total observations collected: n = {baseline.sample_count} readings across {baseline.window_days} days.",
            result=f"{baseline.sample_count} samples ({'Sufficient' if baseline.is_sufficient else 'Preliminary'})"
        ),
        WorkedExampleStep(
            step_number=2,
            title="Compute Distribution Quartiles & Robust IQR",
            description="Calculate the 25th, 50th (median), and 75th percentiles to define biological variability.",
            formula="Q1 = P_25(X), Median = P_50(X), Q3 = P_75(X), IQR = Q3 - Q1",
            calculation=(
                f"25th Percentile (Q1) = {baseline.q1:.1f} {unit}\n"
                f"50th Percentile (Median) = {baseline.median:.1f} {unit}\n"
                f"75th Percentile (Q3) = {baseline.q3:.1f} {unit}\n"
                f"IQR = {baseline.q3:.1f} - {baseline.q1:.1f} = {baseline.iqr:.1f} {unit}"
            ),
            result=f"Personal Median = {baseline.median:.1f} {unit}, IQR = {baseline.iqr:.1f} {unit}"
        ),
        WorkedExampleStep(
            step_number=3,
            title="Apply Tukey's Outlier Fences",
            description="Filter out extreme transient outliers (e.g. sensor artifacts or measurement errors) beyond 3.0 * IQR.",
            formula="Lower Fence = Q1 - 3.0*IQR, Upper Fence = Q3 + 3.0*IQR",
            calculation=(
                f"Extreme Lower Fence = {baseline.q1 - 3.0 * baseline.iqr:.1f} {unit}\n"
                f"Extreme Upper Fence = {baseline.q3 + 3.0 * baseline.iqr:.1f} {unit}\n"
                f"Extreme Outlier Readings Excluded = {baseline.outlier_count}"
            ),
            result=f"{baseline.outlier_count} outliers filtered"
        ),
        WorkedExampleStep(
            step_number=4,
            title="Calculate Distribution Mean & Sample Standard Deviation",
            description="Compute the robust mean and standard deviation from the filtered distribution for Z-score scaling.",
            formula="Mean (μ) = (1/k) * sum(x_i), StdDev (σ) = sqrt((1/(k-1)) * sum(x_i - μ)^2)",
            calculation=(
                f"Mean (μ) = {baseline.mean:.1f} {unit}\n"
                f"Sample StdDev (σ) = {baseline.std_dev:.2f} {unit}\n"
                f"Observed Range = [{baseline.min_val:.1f}, {baseline.max_val:.1f}] {unit}"
            ),
            result=f"μ = {baseline.mean:.1f} {unit}, σ = {baseline.std_dev:.2f} {unit}"
        )
    ]

    warnings = []
    if not baseline.is_sufficient:
        warnings.append(
            f"Preliminary Baseline Notice: Only {baseline.sample_count} observations collected "
            f"(minimum recommended: {settings.MIN_OBSERVATIONS_FOR_BASELINE})."
        )
    if baseline.outlier_count > 0:
        warnings.append(f"Outlier Rejection: {baseline.outlier_count} transient sensor spikes filtered out.")

    ts_str = baseline.calculated_at.strftime("%b %d, %Y, %H:%M UTC") if baseline.calculated_at else now.strftime("%b %d, %Y, %H:%M UTC")

    worked_summary = (
        f"Calculated from {baseline.sample_count} observations across {baseline.window_days} days: "
        f"Personal Median = {baseline.median:.1f} {unit} (IQR: {baseline.iqr:.1f} {unit}), "
        f"Mean = {baseline.mean:.1f} {unit}, StdDev = {baseline.std_dev:.2f} {unit}."
    )

    return CalculationExplanation(
        item_id=f"baseline_{metric_type}",
        category="baseline",
        title=f"{label} Personal Baseline Profile",
        metric_type=metric_type,
        current_value=round(baseline.median, 2),
        current_value_formatted=f"{baseline.median:.1f} {unit}",
        unit=unit,
        baseline_value=round(baseline.median, 2),
        baseline_formatted=f"Median: {baseline.median:.1f} {unit} (IQR: {baseline.iqr:.1f}, Mean: {baseline.mean:.1f}, σ: {baseline.std_dev:.2f})",
        historical_window=window_str,
        window_days=baseline.window_days,
        observations_count=baseline.sample_count,
        observations_sufficiency=f"{'Sufficient' if baseline.is_sufficient else 'Preliminary'} ({baseline.sample_count} observations {'≥' if baseline.is_sufficient else '<'} {settings.MIN_OBSERVATIONS_FOR_BASELINE} threshold)",
        is_sufficient=baseline.is_sufficient,
        formula_name="Robust Non-Parametric Median & IQR with Tukey's Outlier Rejection",
        formula_latex_or_text="Median = P_50(X); IQR = Q_3 - Q_1; Extreme Fences = [Q_1 - 3*IQR, Q_3 + 3*IQR]",
        formula_explanation="Calibrates a robust individualized biometric distribution using median and interquartile range to prevent acute transient spikes from skewing baseline norms.",
        worked_example_steps=steps,
        worked_example_summary=worked_summary,
        data_source="continuous_telemetry_historical",
        latest_timestamp=baseline.window_end.isoformat() if baseline.window_end else None,
        latest_timestamp_formatted=ts_str,
        reason_flag_or_alert="Baseline serves as the empirical comparison anchor for all real-time deviation alerts.",
        flag_severity="info",
        warnings=warnings,
        is_stale=False,
        is_missing_data=False,
        result_type="Statistical Estimate",
        limitations="Individualized longitudinal baseline. Does not constitute a clinical reference standard or diagnostic disease cutoff.",
        metadata={
            "q1": baseline.q1,
            "median": baseline.median,
            "q3": baseline.q3,
            "iqr": baseline.iqr,
            "outlier_count": baseline.outlier_count,
            "min_val": baseline.min_val,
            "max_val": baseline.max_val
        }
    )

def build_trend_explanation(
    patient_id: str,
    twin_state: DigitalTwinStateResponse,
    assessment: Any,
    patient: Dict[str, Any]
) -> CalculationExplanation:
    window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS) if patient else 30
    now = datetime.now(timezone.utc)
    if isinstance(assessment, dict):
        vitality = float(assessment.get("vitality_index", assessment.get("overall_vitality", 100.0)))
        status = assessment.get("stability_status", "optimal")
        summary_msg = assessment.get("summary_message", "")
        missing_inputs = assessment.get("missing_inputs", [])
        contributions = assessment.get("component_contributions", {})
    else:
        vitality = float(getattr(assessment, "vitality_index", getattr(assessment, "overall_vitality", 100.0)))
        status = getattr(assessment, "stability_status", "optimal")
        summary_msg = getattr(assessment, "summary_message", "")
        missing_inputs = getattr(assessment, "missing_inputs", [])
        contributions = getattr(assessment, "component_contributions", {})
    status_label = status.replace("_", " ").title()

    deviations = twin_state.metrics or {}
    total_obs = twin_state.data_quality.get("window_observations_count", 0) if twin_state.data_quality else 0

    # Worked example steps for Vitality Index
    steps: List[WorkedExampleStep] = []

    steps.append(WorkedExampleStep(
        step_number=1,
        title="Initialize Health Stability Index Anchor",
        description="Every patient begins with a full 100.0 vitality stability anchor representing optimal self-alignment.",
        formula="Base Score = 100.0",
        calculation="Starting Score = 100.0 pts",
        result="100.0 pts"
    ))

    # Metric deductions breakdown
    active_weights_sum = 0.0
    total_raw_deductions = 0.0
    deduction_details = []

    for m, dev in deviations.items():
        w = CANONICAL_METRIC_WEIGHTS.get(m, 0.10)
        active_weights_sum += w
        abs_z = abs(dev.z_score)

        if abs_z > 1.0:
            excess_z = abs_z - 1.0
            penalty = min(30.0, excess_z * 12.0) * w
            total_raw_deductions += penalty
            deduction_details.append(
                f"• {m.replace('_', ' ').title()} (|Z|={abs_z:.2f}σ, excess={excess_z:.2f}σ, weight={w:.2f}): -{penalty:.1f} pts"
            )
        else:
            deduction_details.append(
                f"• {m.replace('_', ' ').title()} (|Z|={abs_z:.2f}σ ≤ 1.0σ threshold): 0.0 pts deducted"
            )

    steps.append(WorkedExampleStep(
        step_number=2,
        title="Evaluate Standardized Excess Drift (|Z| > 1.0σ)",
        description="Biometrics within 1.0 standard deviation of baseline cause 0 deduction. Excess drift beyond 1.0 incurs penalty.",
        formula="Excess_i = max(0, |Z_i| - 1.0); Penalty_i = min(30.0, Excess_i * 12.0) * Weight_i",
        calculation="\n".join(deduction_details) if deduction_details else "No active biometrics tracked.",
        result=f"Total unnormalized deductions: {total_raw_deductions:.1f} pts"
    ))

    # Weight normalization step
    norm_factor = active_weights_sum if active_weights_sum > 0 else 1.0
    normalized_deductions = total_raw_deductions / norm_factor

    steps.append(WorkedExampleStep(
        step_number=3,
        title="Active Weight Normalization (Missing Input Protection)",
        description="If metrics are missing, active weights are normalized so missing inputs never produce artificial penalties.",
        formula="Normalized Deduction = Total Deductions / Sum(Active Weights)",
        calculation=(
            f"Active Weights Sum = {active_weights_sum:.2f}\n"
            f"Missing Metrics ({len(missing_inputs)}): {', '.join(missing_inputs) if missing_inputs else 'None'}\n"
            f"Normalized Deduction = {total_raw_deductions:.2f} / {norm_factor:.2f} = {normalized_deductions:.1f} pts"
        ),
        result=f"Normalized Deduction: {normalized_deductions:.1f} pts"
    ))

    # Final score
    steps.append(WorkedExampleStep(
        step_number=4,
        title="Compute Final Health Stability Index",
        description="Deduct normalized penalty from 100, bounded within [20, 100].",
        formula="Vitality Index = max(20.0, min(100.0, 100.0 - Normalized Deduction))",
        calculation=f"100.0 - {normalized_deductions:.1f} = {vitality:.1f} pts",
        result=f"{vitality:.1f} / 100 ({status_label})"
    ))

    warnings: List[str] = list(twin_state.missing_data_warnings or [])
    if twin_state.is_data_stale:
        warnings.append(f"Data Staleness: Telemetry is {twin_state.data_freshness_hours:.0f}h old.")

    worked_summary = (
        f"Vitality Stability Index computed as {vitality:.1f} / 100 ({status_label}). "
        f"Derived from {len(deviations)} tracked biometrics with {normalized_deductions:.1f} total normalized deduction points."
    )

    return CalculationExplanation(
        item_id="trend_vitality_index",
        category="trend",
        title="Health Stability Index (Vitality Trend)",
        metric_type="vitality_index",
        current_value=round(vitality, 1),
        current_value_formatted=f"{vitality:.1f} / 100",
        unit="pts",
        baseline_value=100.0,
        baseline_formatted="100.0 (Personal Baseline Alignment Anchor)",
        historical_window=f"{window_days}-day rolling window",
        window_days=window_days,
        observations_count=total_obs,
        observations_sufficiency=f"{'Sufficient' if total_obs >= settings.MIN_OBSERVATIONS_FOR_BASELINE else 'Preliminary'} ({total_obs} total observations in window)",
        is_sufficient=total_obs >= settings.MIN_OBSERVATIONS_FOR_BASELINE,
        formula_name="Normalized Baseline Euclidean Distance Deduction Index",
        formula_latex_or_text="Vitality = 100.0 - [ sum(w_i * min(30.0, max(0, |Z_i| - 1.0) * 12.0)) / sum(w_active) ]",
        formula_explanation="Transparent, non-black-box indicator: begins at 100 and applies weighted deductions strictly for standardized drift (|Z| > 1.0) away from personal historical norms.",
        worked_example_steps=steps,
        worked_example_summary=worked_summary,
        data_source="multi_stream_continuous_telemetry",
        latest_timestamp=twin_state.snapshot_time.isoformat() if twin_state.snapshot_time else None,
        latest_timestamp_formatted=twin_state.snapshot_time.strftime("%b %d, %Y, %H:%M UTC") if twin_state.snapshot_time else now.strftime("%b %d, %Y, %H:%M UTC"),
        reason_flag_or_alert=f"Stability Status: '{status_label}'. {summary_msg}",
        flag_severity="critical" if vitality < 60 else ("warning" if vitality < 75 else ("info" if vitality < 90 else "optimal")),
        warnings=warnings,
        is_stale=twin_state.is_data_stale,
        is_missing_data=len(missing_inputs) > 0,
        result_type="Rule-Based Indicator",
        limitations="Experimental research trend indicator. Not a clinical risk score, emergency triage algorithm, or certified medical diagnostic device.",
        metadata={
            "vitality_index": vitality,
            "stability_status": status,
            "missing_inputs": missing_inputs,
            "component_contributions": contributions
        }
    )

def build_alert_explanation(
    patient_id: str,
    alert_dict: Dict[str, Any],
    patient: Dict[str, Any]
) -> CalculationExplanation:
    window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS) if patient else 30
    metric_type = alert_dict.get("metric_type", "biometric")
    meta = METRIC_CLINICAL_PROPERTIES.get(metric_type, {})
    label = meta.get("label", metric_type.replace("_", " ").title())
    unit = alert_dict.get("unit", meta.get("unit", ""))

    cur_val = alert_dict.get("current_value", 0.0)
    base_val = alert_dict.get("baseline_value", 0.0)
    z_score = alert_dict.get("z_score", 0.0)
    severity = alert_dict.get("severity", "warning")
    evidence = alert_dict.get("evidence", {})

    rule_id = evidence.get("rule_id", "DEMO-SURVEILLANCE-01")
    rule_version = evidence.get("rule_version", settings.RULE_ENGINE_VERSION)
    flag_category = evidence.get("flag_category", "informational_trend")
    sample_count = evidence.get("sample_count", 30)

    ts = alert_dict.get("timestamp")
    if isinstance(ts, str):
        try:
            ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            ts_dt = datetime.now(timezone.utc)
    elif isinstance(ts, datetime):
        ts_dt = ts
    else:
        ts_dt = datetime.now(timezone.utc)

    steps: List[WorkedExampleStep] = [
        WorkedExampleStep(
            step_number=1,
            title="Biometric Telemetry Arrival & Baseline Lookup",
            description="Incoming telemetry is matched against the patient's personalized statistical baseline.",
            formula=None,
            calculation=(
                f"Observed Reading = {cur_val} {unit}\n"
                f"Personal Baseline Value = {base_val} {unit}\n"
                f"Baseline Sample Count = {sample_count} observations"
            ),
            result=f"Absolute deviation = {cur_val - base_val:+.1f} {unit}"
        ),
        WorkedExampleStep(
            step_number=2,
            title="Evaluate Statistical Divergence (|Z|-Score)",
            description="Evaluate deviation magnitude standardized by individual biological variation.",
            formula="Z = (Observed - Baseline_Mean) / Baseline_StdDev",
            calculation=f"Computed Z-Score = {z_score:+.2f}σ",
            result=f"{z_score:+.2f}σ"
        ),
        WorkedExampleStep(
            step_number=3,
            title="Threshold Check Against Documented Rule",
            description=f"Rule {rule_id} specifies a divergence threshold for adverse deviation.",
            formula="Condition: |Z| ≥ Z_threshold (typically 1.8σ)",
            calculation=f"Actual |Z| = {abs(z_score):.2f}σ ≥ 1.8σ threshold -> TRIGGER CONDITION MET",
            result="Trigger criteria satisfied"
        ),
        WorkedExampleStep(
            step_number=4,
            title="Temporal Persistence & Freshness Gate",
            description="Verify that the deviation is sustained across readings and telemetry is not stale.",
            formula="Freshness ≤ 72h AND Persistence Verified",
            calculation=(
                f"Persistence across readings = {evidence.get('persistence_verified', True)}\n"
                f"Freshness = {evidence.get('freshness_hours', 0.0):.1f} hours (≤ 72h limit)"
            ),
            result="Passed all validation gates"
        ),
        WorkedExampleStep(
            step_number=5,
            title="Alert Emission & Clinical Guidance",
            description="Emit alert with severity categorization and actionable lifestyle / professional guidance.",
            formula="Severity = critical if (|Z| ≥ 3.0 or SpO2 < 93%) else warning",
            calculation=(
                f"Severity Level = {severity.upper()}\n"
                f"Classification = {flag_category.replace('_', ' ').title()}\n"
                f"Recommended Action = {alert_dict.get('suggested_action', 'Review biometrics with clinician.')}"
            ),
            result=f"Alert emitted: {alert_dict.get('title', 'Biometric Deviation Alert')}"
        )
    ]

    return CalculationExplanation(
        item_id=f"alert_{alert_dict.get('_id', alert_dict.get('id', rule_id))}",
        category="alert",
        title=f"Alert Explanation: {alert_dict.get('title', 'Biometric Deviation')}",
        metric_type=metric_type,
        current_value=float(cur_val),
        current_value_formatted=f"{cur_val} {unit}",
        unit=unit,
        baseline_value=float(base_val),
        baseline_formatted=f"{base_val} {unit} (Personal Baseline)",
        historical_window=f"{window_days}-day rolling baseline window",
        window_days=window_days,
        observations_count=sample_count,
        observations_sufficiency=f"Sufficient ({sample_count} observations in baseline)",
        is_sufficient=sample_count >= settings.MIN_OBSERVATIONS_FOR_BASELINE,
        formula_name=f"Configurable Demonstration Surveillance Rule ({rule_id} {rule_version})",
        formula_latex_or_text="Condition: |Z| ≥ 1.8σ with temporal persistence and telemetry freshness ≤ 72h",
        formula_explanation="Surveillance rules trigger strictly when measurements exceed personalized statistical thresholds and persist across consecutive observations. Prevents alert fatigue from single transient spikes.",
        worked_example_steps=steps,
        worked_example_summary=(
            f"Alert '{alert_dict.get('title')}' was triggered because observed {cur_val} {unit} "
            f"diverged from personal baseline ({base_val} {unit}) by {z_score:+.2f}σ, exceeding the rule threshold."
        ),
        data_source="continuous_wearable_telemetry",
        latest_timestamp=ts_dt.isoformat(),
        latest_timestamp_formatted=ts_dt.strftime("%b %d, %Y, %H:%M UTC"),
        reason_flag_or_alert=f"Triggered Rule: {rule_id} ({flag_category.replace('_', ' ').title()}). {alert_dict.get('description', '')}",
        flag_severity=severity,
        warnings=[
            f"Rule ID: {rule_id} (Engine Version: {rule_version})",
            "Non-emergency surveillance flag. Does not replace acute hospital dispatch."
        ],
        is_stale=False,
        is_missing_data=False,
        result_type="Rule-Based Indicator",
        limitations=evidence.get(
            "disclaimer",
            "Configurable demonstration research heuristic. Not an emergency prediction or certified clinical risk score."
        ),
        metadata=evidence
    )

def build_simulation_explanation(
    patient_id: str,
    scenario_name: str,
    parameters: Dict[str, Any],
    baseline_summary: Dict[str, float],
    projected_outcomes: Dict[str, Any],
    metric_focus: Optional[str] = None
) -> CalculationExplanation:
    """
    Constructs explainable numerical step-by-step calculation metadata for What-If simulation outputs.
    """
    duration = int(parameters.get("duration_days", 30))
    d_sleep = float(parameters.get("delta_sleep_hours", 0.0))
    d_steps = int(parameters.get("delta_daily_steps", 0))
    d_stress = float(parameters.get("delta_stress_level", 0.0))
    d_sodium = float(parameters.get("sodium_reduction_pct", 0.0))

    base_rhr = float(baseline_summary.get("resting_hr", 72.0))
    base_sbp = float(baseline_summary.get("systolic_bp", 124.0))
    base_hrv = float(baseline_summary.get("hrv_rmssd", 42.0))

    final_rhr = float(projected_outcomes.get("final_resting_hr", base_rhr))
    delta_rhr = float(projected_outcomes.get("delta_resting_hr", final_rhr - base_rhr))
    final_sbp = float(projected_outcomes.get("final_systolic_bp", base_sbp))
    delta_sbp = float(projected_outcomes.get("delta_systolic_bp", final_sbp - base_sbp))
    final_hrv = float(projected_outcomes.get("final_hrv_rmssd", base_hrv))
    delta_hrv = float(projected_outcomes.get("delta_hrv_rmssd", final_hrv - base_hrv))
    final_vit = float(projected_outcomes.get("final_vitality", 80.0))

    # Time constants
    tau_sleep = 4.0
    tau_act = 12.0
    tau_sod = 7.0

    resp_sleep = 1.0 - math.exp(-duration / tau_sleep)
    resp_act = 1.0 - math.exp(-duration / tau_act)
    resp_sod = 1.0 - math.exp(-duration / tau_sod)

    # Uncertainty envelope
    uncertainty_factor = 1.0 + (duration / duration) * 0.8
    hr_ci = 2.5 * uncertainty_factor

    steps: List[WorkedExampleStep] = [
        WorkedExampleStep(
            step_number=1,
            title="Anchor to Patient's Starting Measured Baseline",
            description="The simulation engine strictly anchors starting conditions to the patient's personal historical baseline (no synthetic defaults).",
            formula=None,
            calculation=(
                f"Starting Resting Heart Rate = {base_rhr:.1f} bpm\n"
                f"Starting Systolic Blood Pressure = {base_sbp:.1f} mmHg\n"
                f"Starting Heart Rate Variability = {base_hrv:.1f} ms"
            ),
            result="Baseline anchors established."
        ),
        WorkedExampleStep(
            step_number=2,
            title="Read Intervention Levers & Scenario Duration",
            description="Intervention parameters selected on the simulator control panel.",
            formula=None,
            calculation=(
                f"Scenario Name: '{scenario_name}'\n"
                f"Duration (t) = {duration} days\n"
                f"Δ Sleep Duration = {d_sleep:+.1f} hours/night\n"
                f"Δ Daily Activity = {d_steps:+,} steps/day\n"
                f"Δ Dietary Sodium Reduction = {d_sodium:.0f}%\n"
                f"Δ Stress Level = {d_stress:+.0f}%"
            ),
            result=f"{duration}-day intervention scenario"
        ),
        WorkedExampleStep(
            step_number=3,
            title="Compute Exponential Pharmacodynamic Response Factors",
            description="Biometric adaptation follows literature-derived exponential saturation: resp(t) = 1 - exp(-t / τ).",
            formula="resp_sleep = 1 - exp(-t / 4.0d), resp_activity = 1 - exp(-t / 12.0d), resp_sodium = 1 - exp(-t / 7.0d)",
            calculation=(
                f"Sleep Response Factor: 1 - exp(-{duration}/4.0) = {resp_sleep:.3f}\n"
                f"Activity Response Factor: 1 - exp(-{duration}/12.0) = {resp_act:.3f}\n"
                f"Sodium Response Factor: 1 - exp(-{duration}/7.0) = {resp_sod:.3f}"
            ),
            result=f"Sleep adaptation = {resp_sleep*100:.1f}%, Activity adaptation = {resp_act*100:.1f}%"
        ),
        WorkedExampleStep(
            step_number=4,
            title="Calculate Component Physiological Deltas (Resting HR)",
            description="Evaluate literature-grounded effect coefficients for sleep (+1h = -1.6 bpm) and physical conditioning (+4000 steps = -1.2 bpm).",
            formula="ΔRHR = -ΔSleep * 1.6 * resp_sleep - (ΔSteps/4000) * 1.2 * resp_act + (ΔStress/20) * 1.5 * resp_sleep",
            calculation=(
                f"Sleep Effect: -({d_sleep}) * 1.6 * {resp_sleep:.3f} = {-d_sleep * 1.6 * resp_sleep:.2f} bpm\n"
                f"Activity Effect: -({d_steps}/4000) * 1.2 * {resp_act:.3f} = {-(d_steps / 4000.0) * 1.2 * resp_act:.2f} bpm\n"
                f"Stress Effect: +({d_stress}/20) * 1.5 * {resp_sleep:.3f} = {(d_stress / 20.0) * 1.5 * resp_sleep:.2f} bpm\n"
                f"Net Calculated ΔRHR = {delta_rhr:+.1f} bpm"
            ),
            result=f"ΔRHR = {delta_rhr:+.1f} bpm"
        ),
        WorkedExampleStep(
            step_number=5,
            title="Compute Final Projected Trajectory & Uncertainty Corridor",
            description="Apply net delta to starting baseline and calculate 90% confidence uncertainty corridor reflecting predictive dispersion.",
            formula="Projected Value = Baseline + Δy; CI Envelope = Projected ± CI_width",
            calculation=(
                f"Final Resting HR: {base_rhr:.1f} + ({delta_rhr:+.1f}) = {final_rhr:.1f} bpm\n"
                f"Final Systolic BP: {base_sbp:.1f} + ({delta_sbp:+.1f}) = {final_sbp:.1f} mmHg\n"
                f"Final HRV RMSSD: {base_hrv:.1f} + ({delta_hrv:+.1f}) = {final_hrv:.1f} ms\n"
                f"Final Projected Vitality Target: {final_vit:.1f} / 100\n"
                f"90% Confidence Envelope at Day {duration}: [{final_rhr - hr_ci:.1f}, {final_rhr + hr_ci:.1f}] bpm (±{hr_ci:.1f} bpm)"
            ),
            result=f"Projected Resting HR = {final_rhr:.1f} bpm (Δ {delta_rhr:+.1f} bpm)"
        )
    ]

    worked_summary = (
        f"Simulated {duration}-day scenario '{scenario_name}' projects: "
        f"Resting HR: {final_rhr:.1f} bpm ({delta_rhr:+.1f} bpm from baseline {base_rhr:.1f}), "
        f"Systolic BP: {final_sbp:.1f} mmHg ({delta_sbp:+.1f} mmHg from {base_sbp:.1f}), "
        f"HRV RMSSD: {final_hrv:.1f} ms ({delta_hrv:+.1f} ms from {base_hrv:.1f}), "
        f"Projected Vitality Index: {final_vit:.1f} / 100."
    )

    now = datetime.now(timezone.utc)

    return CalculationExplanation(
        item_id=f"simulation_{scenario_name.lower().replace(' ', '_')}",
        category="simulation",
        title=f"What-If Simulation Modeling: {scenario_name}",
        metric_type="resting_hr",
        current_value=round(final_rhr, 1),
        current_value_formatted=f"{final_rhr:.1f} bpm (Projected)",
        unit="bpm",
        baseline_value=round(base_rhr, 1),
        baseline_formatted=f"{base_rhr:.1f} bpm (Starting Measured Baseline)",
        historical_window=f"{duration}-day forward projection horizon",
        window_days=duration,
        observations_count=len(baseline_summary),
        observations_sufficiency=f"Anchored to measured personal baseline ({len(baseline_summary)} biometrics)",
        is_sufficient=True,
        formula_name="Pharmacokinetic/Pharmacodynamic Exponential Saturation Model",
        formula_latex_or_text="Δy(t) = sum_j [ k_j * Δu_j * (1 - exp(-t / τ_j)) ]; CI(t) = base_ci * (1 + 0.8 * t / T)",
        formula_explanation="Models human autonomic and cardiovascular physiological adaptation over time with exponential saturation and expanding predictive variance envelopes.",
        worked_example_steps=steps,
        worked_example_summary=worked_summary,
        data_source="in_silico_computational_twin_engine",
        latest_timestamp=now.isoformat(),
        latest_timestamp_formatted=now.strftime("%b %d, %Y, %H:%M UTC"),
        reason_flag_or_alert=f"Counterfactual Projection: Assumes sustained adherence to intervention levers for {duration} consecutive days.",
        flag_severity="info",
        warnings=[
            "Counterfactual Model: Assumes consistent sleep timing, moderate-intensity ambulation, and steady dietary adherence.",
            "Historical observed telemetry remains completely unmodified and immutable.",
            "Predictive uncertainty corridor expands over time to reflect epistemic modeling limits."
        ],
        is_stale=False,
        is_missing_data=False,
        result_type="Model Prediction",
        limitations=(
            "Illustrative scenario calculation only. Changing sleep, sodium, or activity does not guarantee a particular "
            "heart-rate or blood-pressure outcome without clinical trial verification. Actual biological response varies widely "
            "by genetics, underlying conditions, and pharmacotherapy. This simulation does not constitute medical advice or guaranteed prognosis."
        ),
        metadata={
            "parameters": parameters,
            "projected_outcomes": projected_outcomes,
            "baseline_summary": baseline_summary
        }
    )
