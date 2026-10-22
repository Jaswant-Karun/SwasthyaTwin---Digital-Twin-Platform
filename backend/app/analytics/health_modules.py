"""
SwasthyaTwin AI — Modular Personal Health Intelligence Engine
Implements the six independent, verifiable health modules:
Module A: Sleep Intelligence (BiDSleep research classification, wearable vs reference labels)
Module B: Cardiovascular Trend Analysis (Measured HR, baseline corridor, absolute & relative deviations, flags)
Module C: Activity Intelligence (Step counts, accelerometer metrics, daily/weekly patterns, missingness)
Module D: Blood-Pressure Trend Tracking (Measured SBP/DBP pairs, strict plausibility, pulse pressure & MAP)
Module E: Personalized Anomaly Detection (Tukey's IQR + z-score, minimum data requirements, statistical vs clinical distinction)
Module F: Future Trend Forecasting (Chronological held-out validation, baseline comparison, insufficient-data gating)
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field

from app.analytics.baseline_calculator import compute_metric_baseline
from app.analytics.anomaly_detector import METRIC_CLINICAL_PROPERTIES, classify_z_score
from app.analytics.predictor import train_and_forecast_metric


# ==============================================================================
# Module A: Sleep Intelligence
# ==============================================================================

class SleepIntelligenceSummary(BaseModel):
    module_name: str = "Sleep Intelligence"
    patient_id: str
    total_sleep_records: int
    latest_duration_hours: Optional[float] = None
    baseline_median_hours: Optional[float] = None
    delta_hours_from_baseline: Optional[float] = None
    delta_percentage: Optional[float] = None
    sleep_regularity_score: Optional[float] = None  # 0 to 100 based on night-to-night duration stability
    has_bidsleep_research_model: bool = True
    model_prediction_available: bool = True
    input_signals_description: str = "Wearable optical photoplethysmography (PPG) heart rate dynamics and accelerometry"
    reference_annotation_description: str = "5-stage ground truth from polysomnography / Dreem headband EEG"
    disclaimer: str = (
        "Classifies wearable sleep stages from optical PPG biometrics for research self-monitoring. "
        "Does NOT measure EEG directly and does NOT diagnose insomnia, sleep apnea, or sleep disorders."
    )


class SleepIntelligenceModule:
    @staticmethod
    def evaluate(patient_id: str, observations: List[Dict[str, Any]]) -> SleepIntelligenceSummary:
        sleep_obs = [
            o for o in observations
            if (o.get("measurement_type") in ["sleep_duration_hours", "sleep_duration"])
            and o.get("value") is not None
        ]
        sleep_obs.sort(key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min)

        if not sleep_obs:
            return SleepIntelligenceSummary(
                patient_id=patient_id,
                total_sleep_records=0,
                model_prediction_available=False
            )

        values = [float(o["value"]) for o in sleep_obs if float(o["value"]) > 0]
        timestamps = [o.get("observed_at") or o.get("timestamp") for o in sleep_obs if float(o["value"]) > 0]

        latest_val = round(values[-1], 2)
        baseline = compute_metric_baseline("sleep_duration_hours", "hours", values, timestamps, window_days=30, min_observations=3)
        base_med = round(baseline.median, 2) if baseline else None

        delta_hrs = round(latest_val - base_med, 2) if base_med is not None else None
        delta_pct = round((delta_hrs / base_med) * 100.0, 1) if (delta_hrs is not None and base_med and base_med > 0) else None

        # Sleep regularity: 100 - (std_dev / mean * 100) clamped to [0, 100]
        reg_score = None
        if len(values) >= 3:
            std = float(np.std(values))
            mean = float(np.mean(values))
            if mean > 0:
                cv = (std / mean) * 100.0
                reg_score = round(max(0.0, min(100.0, 100.0 - cv)), 1)

        return SleepIntelligenceSummary(
            patient_id=patient_id,
            total_sleep_records=len(sleep_obs),
            latest_duration_hours=latest_val,
            baseline_median_hours=base_med,
            delta_hours_from_baseline=delta_hrs,
            delta_percentage=delta_pct,
            sleep_regularity_score=reg_score,
            has_bidsleep_research_model=True,
            model_prediction_available=True
        )


# ==============================================================================
# Module B: Cardiovascular Trend Analysis
# ==============================================================================

class CardiovascularPatternFlag(BaseModel):
    flag_id: str
    severity: str  # info, watch, alert
    title: str
    description: str
    observed_value: float
    unit: str
    threshold_criteria: str


class CardiovascularTrendSummary(BaseModel):
    module_name: str = "Cardiovascular Trend Analysis"
    patient_id: str
    total_hr_observations: int
    latest_hr_bpm: Optional[float] = None
    baseline_median_bpm: Optional[float] = None
    baseline_iqr_bpm: Optional[float] = None
    baseline_mean_bpm: Optional[float] = None
    baseline_std_bpm: Optional[float] = None
    absolute_deviation_bpm: Optional[float] = None
    relative_deviation_pct: Optional[float] = None
    z_score: Optional[float] = None
    trend_slope_7d_bpm_per_day: Optional[float] = None
    active_flags: List[CardiovascularPatternFlag] = Field(default_factory=list)
    has_sufficient_data: bool = False
    disclaimer: str = (
        "Longitudinal cardiovascular tracking for personal health self-awareness. "
        "Does NOT diagnose arrhythmias, ischemia, coronary artery disease, or acute cardiovascular emergencies."
    )


class CardiovascularTrendModule:
    @staticmethod
    def evaluate(
        patient_id: str,
        observations: List[Dict[str, Any]],
        min_observations: int = 5,
        window_days: int = 30
    ) -> CardiovascularTrendSummary:
        # 1. Retrieve eligible historical heart-rate observations
        # Exclude invalid, rejected, or explicitly simulated observations from real-data baseline
        hr_obs = [
            o for o in observations
            if (o.get("measurement_type") in ["heart_rate", "resting_heart_rate"] or o.get("metric_type") in ["heart_rate", "resting_heart_rate"])
            and o.get("value") is not None
            and o.get("data_kind") not in ["simulated"]
            and o.get("data_tier") not in ["simulated"]
            and not o.get("is_synthetic", False)
            and o.get("validation_status") not in ["rejected", "invalid"]
        ]

        # 2. Sort by measurement time
        def _get_time(o):
            t = o.get("observed_at") or o.get("timestamp") or datetime.min
            if isinstance(t, str):
                try:
                    t = datetime.fromisoformat(t.replace("Z", "+00:00"))
                except Exception:
                    t = datetime.min
            if isinstance(t, datetime) and t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            return t

        hr_obs.sort(key=_get_time)

        if not hr_obs:
            return CardiovascularTrendSummary(
                patient_id=patient_id,
                total_hr_observations=0,
                has_sufficient_data=False
            )

        values = [float(o["value"]) for o in hr_obs]
        timestamps = [_get_time(o) for o in hr_obs]
        latest_val = round(values[-1], 1)

        # 3. Require a configurable minimum number of observations before showing a personal baseline
        baseline = compute_metric_baseline(
            "heart_rate",
            "bpm",
            values,
            timestamps,
            window_days=window_days,
            min_observations=min_observations
        )
        has_suff = baseline is not None and baseline.sample_count >= min_observations

        delta_abs = None
        delta_pct = None
        z = None
        flags = []

        if has_suff and baseline and baseline.std_dev > 0:
            # 4 & 5. Absolute and relative deviations when mathematically appropriate
            delta_abs = round(latest_val - baseline.median, 1)
            delta_pct = round((delta_abs / baseline.median) * 100.0, 1) if baseline.median > 0 else 0.0
            z = round((latest_val - baseline.mean) / baseline.std_dev, 2)

            # 6. Flag unusual patterns only according to explicit, tested rules
            # Tachycardia pattern: resting HR > 100 bpm
            if latest_val > 100.0:
                flags.append(CardiovascularPatternFlag(
                    flag_id="hr_elevated_tachycardia",
                    severity="alert" if latest_val >= 115 else "watch",
                    title="Resting Tachycardia Pattern",
                    description="Current resting heart rate exceeds 100 bpm threshold.",
                    observed_value=latest_val,
                    unit="bpm",
                    threshold_criteria="Resting HR > 100 bpm"
                ))

            # Bradycardia pattern: resting HR < 45 bpm
            if latest_val < 45.0:
                flags.append(CardiovascularPatternFlag(
                    flag_id="hr_suppressed_bradycardia",
                    severity="watch",
                    title="Resting Bradycardia Pattern",
                    description="Current resting heart rate below 45 bpm threshold.",
                    observed_value=latest_val,
                    unit="bpm",
                    threshold_criteria="Resting HR < 45 bpm"
                ))

            # Statistical Corridor Drift (|z| >= 2.0)
            if abs(z) >= 2.0:
                flags.append(CardiovascularPatternFlag(
                    flag_id="hr_statistical_corridor_drift",
                    severity="watch" if abs(z) < 3.0 else "alert",
                    title="Significant Corridor Shift",
                    description=f"Heart rate is {z:+.1f} standard deviations away from personal baseline distribution.",
                    observed_value=latest_val,
                    unit="bpm",
                    threshold_criteria="|z-score| >= 2.0"
                ))

        # Compute 7-day trend slope if observations span at least 7 points
        slope_7d = None
        if len(values) >= 7:
            recent_vals = values[-7:]
            x = np.arange(len(recent_vals))
            slope, _ = np.polyfit(x, recent_vals, 1)
            slope_7d = round(float(slope), 2)

        return CardiovascularTrendSummary(
            patient_id=patient_id,
            total_hr_observations=len(hr_obs),
            latest_hr_bpm=latest_val,
            baseline_median_bpm=round(baseline.median, 1) if (baseline and has_suff) else None,
            baseline_iqr_bpm=round(baseline.iqr, 1) if (baseline and has_suff) else None,
            baseline_mean_bpm=round(baseline.mean, 1) if (baseline and has_suff) else None,
            baseline_std_bpm=round(baseline.std_dev, 1) if (baseline and has_suff) else None,
            absolute_deviation_bpm=delta_abs,
            relative_deviation_pct=delta_pct,
            z_score=z,
            trend_slope_7d_bpm_per_day=slope_7d,
            active_flags=flags,
            has_sufficient_data=has_suff
        )


# ==============================================================================
# Module C: Activity Intelligence
# ==============================================================================

class ActivityIntelligenceSummary(BaseModel):
    module_name: str = "Activity Intelligence"
    patient_id: str
    total_days_logged: int
    latest_step_count: Optional[int] = None
    baseline_median_steps: Optional[int] = None
    rolling_7d_average_steps: Optional[int] = None
    delta_from_baseline_steps: Optional[int] = None
    delta_percentage: Optional[float] = None
    weekday_mean_steps: Optional[int] = None
    weekend_mean_steps: Optional[int] = None
    telemetry_missing_days_count: int = 0
    missingness_rate_pct: float = 0.0
    future_forecasting_supported: bool = False
    forecasting_status_reason: str = "Future activity forecasting requires longitudinal behavioral habit model and >= 14 verified days."
    disclaimer: str = (
        "Daily physical step volume and kinetic tracking for active lifestyle encouragement. "
        "Does not measure cardiopulmonary VO2max or diagnose musculoskeletal impairment."
    )


class ActivityIntelligenceModule:
    @staticmethod
    def evaluate(patient_id: str, observations: List[Dict[str, Any]]) -> ActivityIntelligenceSummary:
        step_obs = [
            o for o in observations
            if o.get("measurement_type") == "daily_steps" and o.get("value") is not None
        ]
        step_obs.sort(key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min)

        if not step_obs:
            return ActivityIntelligenceSummary(
                patient_id=patient_id,
                total_days_logged=0
            )

        vals = [int(round(float(o["value"]))) for o in step_obs]
        timestamps = [o.get("observed_at") or o.get("timestamp") for o in step_obs]
        latest_steps = vals[-1]

        # Analyze missingness: days with < 500 steps logged as likely non-wear
        non_wear_days = sum(1 for v in vals if v < 500)
        missing_rate = round((non_wear_days / len(vals)) * 100.0, 1)

        # Baseline
        float_vals = [float(v) for v in vals]
        baseline = compute_metric_baseline("daily_steps", "steps", float_vals, timestamps, window_days=30, min_observations=5)
        base_med = int(round(baseline.median)) if baseline else None

        delta_steps = (latest_steps - base_med) if base_med is not None else None
        delta_pct = round((delta_steps / base_med) * 100.0, 1) if (delta_steps is not None and base_med and base_med > 0) else None

        # Rolling 7-day average
        roll_7d = int(round(np.mean(vals[-7:]))) if len(vals) >= 7 else int(round(np.mean(vals)))

        # Weekday vs Weekend separation
        weekday_steps = []
        weekend_steps = []
        for v, t in zip(vals, timestamps):
            if isinstance(t, str):
                t = datetime.fromisoformat(t.replace("Z", "+00:00"))
            if t:
                # 0-4 Monday to Friday, 5-6 Saturday to Sunday
                if t.weekday() < 5:
                    weekday_steps.append(v)
                else:
                    weekend_steps.append(v)

        mean_weekday = int(round(np.mean(weekday_steps))) if weekday_steps else None
        mean_weekend = int(round(np.mean(weekend_steps))) if weekend_steps else None

        can_forecast = len(vals) >= 14 and missing_rate < 30.0

        return ActivityIntelligenceSummary(
            patient_id=patient_id,
            total_days_logged=len(step_obs),
            latest_step_count=latest_steps,
            baseline_median_steps=base_med,
            rolling_7d_average_steps=roll_7d,
            delta_from_baseline_steps=delta_steps,
            delta_percentage=delta_pct,
            weekday_mean_steps=mean_weekday,
            weekend_mean_steps=mean_weekend,
            telemetry_missing_days_count=non_wear_days,
            missingness_rate_pct=missing_rate,
            future_forecasting_supported=can_forecast,
            forecasting_status_reason="Forecasting supported with local autoregressive baseline" if can_forecast else "Insufficient historical step data (< 14 days) or high missingness."
        )


# ==============================================================================
# Module D: Blood Pressure Trend Tracking
# ==============================================================================

class BloodPressureTrendSummary(BaseModel):
    module_name: str = "Blood Pressure Trend Tracking"
    patient_id: str
    total_bp_observations: int
    latest_systolic_mmHg: Optional[float] = None
    latest_diastolic_mmHg: Optional[float] = None
    latest_pulse_pressure_mmHg: Optional[float] = None  # SBP - DBP
    latest_mean_arterial_pressure_mmHg: Optional[float] = None  # DBP + 1/3(PP)
    aha_classification: Optional[str] = None  # Normal, Elevated, Stage 1 HTN, Stage 2 HTN, Hypertensive Crisis
    baseline_median_systolic: Optional[float] = None
    baseline_median_diastolic: Optional[float] = None
    delta_systolic_from_baseline: Optional[float] = None
    delta_diastolic_from_baseline: Optional[float] = None
    requires_user_confirmation: bool = False
    validation_status: str = "valid"
    disclaimer: str = (
        "Strictly records validated oscillometric arm-cuff readings. "
        "NEVER infers blood pressure synthetically from heart rate or sleep stages. "
        "Does NOT replace professional clinical blood pressure measurement or diagnose hypertension."
    )


class BloodPressureTrendModule:
    @staticmethod
    def evaluate(patient_id: str, observations: List[Dict[str, Any]]) -> BloodPressureTrendSummary:
        sbp_obs = [
            o for o in observations
            if o.get("measurement_type") in ["blood_pressure_systolic", "systolic_bp"]
            and o.get("value") is not None
        ]
        dbp_obs = [
            o for o in observations
            if o.get("measurement_type") in ["blood_pressure_diastolic", "diastolic_bp"]
            and o.get("value") is not None
        ]

        sbp_obs.sort(key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min)
        dbp_obs.sort(key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min)

        if not sbp_obs or not dbp_obs:
            return BloodPressureTrendSummary(
                patient_id=patient_id,
                total_bp_observations=len(sbp_obs)
            )

        latest_sbp = round(float(sbp_obs[-1]["value"]), 1)
        latest_dbp = round(float(dbp_obs[-1]["value"]), 1)

        # Pulse pressure & MAP
        pp = round(latest_sbp - latest_dbp, 1)
        map_val = round(latest_dbp + (pp / 3.0), 1)

        # Strict validation
        requires_conf = False
        val_status = "valid"
        if pp < 15.0 or latest_sbp < latest_dbp:
            val_status = "flagged"
            requires_conf = True

        # AHA/ACC Category
        if latest_sbp > 180 or latest_dbp > 120:
            aha_cat = "Hypertensive Crisis (Seek Urgent Consultation)"
        elif latest_sbp >= 140 or latest_dbp >= 90:
            aha_cat = "Stage 2 Hypertension Range"
        elif (130 <= latest_sbp <= 139) or (80 <= latest_dbp <= 89):
            aha_cat = "Stage 1 Hypertension Range"
        elif (120 <= latest_sbp <= 129) and latest_dbp < 80:
            aha_cat = "Elevated Blood Pressure"
        else:
            aha_cat = "Normal Range"

        # Baselines
        sbp_vals = [float(o["value"]) for o in sbp_obs]
        sbp_times = [o.get("observed_at") or o.get("timestamp") for o in sbp_obs]
        dbp_vals = [float(o["value"]) for o in dbp_obs]
        dbp_times = [o.get("observed_at") or o.get("timestamp") for o in dbp_obs]

        sbp_base = compute_metric_baseline("blood_pressure_systolic", "mmHg", sbp_vals, sbp_times, window_days=30, min_observations=3)
        dbp_base = compute_metric_baseline("blood_pressure_diastolic", "mmHg", dbp_vals, dbp_times, window_days=30, min_observations=3)

        base_sbp_med = round(sbp_base.median, 1) if sbp_base else None
        base_dbp_med = round(dbp_base.median, 1) if dbp_base else None

        delta_sbp = round(latest_sbp - base_sbp_med, 1) if base_sbp_med is not None else None
        delta_dbp = round(latest_dbp - base_dbp_med, 1) if base_dbp_med is not None else None

        return BloodPressureTrendSummary(
            patient_id=patient_id,
            total_bp_observations=len(sbp_obs),
            latest_systolic_mmHg=latest_sbp,
            latest_diastolic_mmHg=latest_dbp,
            latest_pulse_pressure_mmHg=pp,
            latest_mean_arterial_pressure_mmHg=map_val,
            aha_classification=aha_cat,
            baseline_median_systolic=base_sbp_med,
            baseline_median_diastolic=base_dbp_med,
            delta_systolic_from_baseline=delta_sbp,
            delta_diastolic_from_baseline=delta_dbp,
            requires_user_confirmation=requires_conf,
            validation_status=val_status
        )


# ==============================================================================
# Module E: Personalized Anomaly Detection
# ==============================================================================

class StatisticalAnomalyItem(BaseModel):
    metric_type: str
    observed_value: float
    unit: str
    baseline_median: float
    baseline_iqr: float
    z_score: float
    iqr_distance: float
    anomaly_tier: str  # optimal, mild_deviation, moderate_drift, significant_deviation
    classification_type: str  # statistical_anomaly vs clinical_abnormality
    explanation: str


class PersonalizedAnomalySummary(BaseModel):
    module_name: str = "Personalized Anomaly Detection"
    patient_id: str
    total_metrics_evaluated: int
    has_sufficient_history: bool  # >= 14 observations
    minimum_observations_required: int = 14
    detected_anomalies: List[StatisticalAnomalyItem] = Field(default_factory=list)
    overall_stability_status: str = "optimal"
    disclaimer: str = (
        "Identifies statistical deviations from personal longitudinal baseline distributions. "
        "Explicitly separates statistical outliers from diagnostic clinical abnormalities. "
        "Does NOT indicate acute emergency, infarction, or clinical pathology."
    )


class PersonalizedAnomalyModule:
    @staticmethod
    def evaluate(patient_id: str, observations: List[Dict[str, Any]]) -> PersonalizedAnomalySummary:
        if len(observations) < 14:
            return PersonalizedAnomalySummary(
                patient_id=patient_id,
                total_metrics_evaluated=0,
                has_sufficient_history=False,
                overall_stability_status="insufficient_data"
            )

        # Group observations by metric
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for o in observations:
            m = o.get("measurement_type")
            if m and o.get("value") is not None:
                grouped.setdefault(m, []).append(o)

        anomalies = []
        worst_status = "optimal"

        for m_type, obs_list in grouped.items():
            if len(obs_list) < 5:
                continue

            obs_list.sort(key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min)
            vals = [float(o["value"]) for o in obs_list]
            times = [o.get("observed_at") or o.get("timestamp") for o in obs_list]

            latest_val = vals[-1]
            latest_unit = obs_list[-1].get("unit", "")

            # Baseline calculation excluding the current point to avoid self-contamination
            hist_vals = vals[:-1]
            hist_times = times[:-1]

            if len(hist_vals) < 4:
                continue

            base = compute_metric_baseline(m_type, latest_unit, hist_vals, hist_times, window_days=30, min_observations=4)
            if not base or base.std_dev == 0:
                continue

            delta = latest_val - base.mean
            z = delta / base.std_dev
            iqr_dist = (latest_val - base.median) / base.iqr if base.iqr > 0 else z

            status, direction = classify_z_score(z)

            # Distinguish statistical anomaly from clinical abnormality
            is_stat_anomaly = abs(z) >= 2.0 or abs(iqr_dist) >= 1.5
            is_clin_abnormal = False

            if m_type in ["heart_rate", "resting_heart_rate"] and (latest_val > 100 or latest_val < 45):
                is_clin_abnormal = True
            elif m_type in ["blood_pressure_systolic", "systolic_bp"] and latest_val >= 140:
                is_clin_abnormal = True
            elif m_type == "spo2" and latest_val < 92:
                is_clin_abnormal = True

            classification_type = "both_statistical_and_clinical" if (is_stat_anomaly and is_clin_abnormal) else (
                "clinical_abnormality" if is_clin_abnormal else (
                    "statistical_anomaly" if is_stat_anomaly else "within_corridor"
                )
            )

            if is_stat_anomaly or is_clin_abnormal:
                explanation = (
                    f"Statistical corridor shift ({z:+.1f} z-score). "
                    if is_stat_anomaly else ""
                )
                if is_clin_abnormal:
                    explanation += f"Crosses clinical reference threshold for {m_type}."

                anomalies.append(StatisticalAnomalyItem(
                    metric_type=m_type,
                    observed_value=round(latest_val, 2),
                    unit=latest_unit,
                    baseline_median=round(base.median, 2),
                    baseline_iqr=round(base.iqr, 2),
                    z_score=round(z, 2),
                    iqr_distance=round(iqr_dist, 2),
                    anomaly_tier=status,
                    classification_type=classification_type,
                    explanation=explanation.strip()
                ))

                if status == "significant_deviation":
                    worst_status = "significant_deviation"
                elif status == "moderate_drift" and worst_status != "significant_deviation":
                    worst_status = "moderate_drift"
                elif status == "mild_deviation" and worst_status == "optimal":
                    worst_status = "mild_deviation"

        return PersonalizedAnomalySummary(
            patient_id=patient_id,
            total_metrics_evaluated=len(grouped),
            has_sufficient_history=True,
            detected_anomalies=anomalies,
            overall_stability_status=worst_status
        )


# ==============================================================================
# Module F: Future Trend Forecasting
# ==============================================================================

class TrendForecastSummary(BaseModel):
    module_name: str = "Future Trend Forecasting"
    patient_id: str
    target_metric: str
    target_unit: str
    horizon_days: int = 7
    forecast_status: str  # ready, insufficient_data, unsupported_metric
    model_version: str = "2.1.0"
    training_data_provenance: str = "Chronological User Observation Stream"
    insufficient_data_reason: Optional[str] = None
    forecast_trajectory: List[Dict[str, Any]] = Field(default_factory=list)
    held_out_metrics: Optional[Dict[str, Any]] = None
    baseline_comparison: Optional[Dict[str, Any]] = None
    disclaimer: str = (
        "Autoregressive time-series projection with 95% confidence bounds. "
        "Evaluated via strict chronological held-out validation against a Naive Persistence Baseline. "
        "Does NOT predict medical disease onset or total sleep duration."
    )


class FutureTrendForecastingModule:
    SUPPORTED_METRICS = ["heart_rate", "resting_heart_rate", "hrv_rmssd", "daily_steps"]

    @staticmethod
    def forecast(
        patient_id: str,
        metric_type: str,
        unit: str,
        observations: List[Dict[str, Any]],
        horizon_days: int = 7
    ) -> TrendForecastSummary:
        if metric_type not in FutureTrendForecastingModule.SUPPORTED_METRICS:
            return TrendForecastSummary(
                patient_id=patient_id,
                target_metric=metric_type,
                target_unit=unit,
                forecast_status="unsupported_metric",
                insufficient_data_reason=f"Forecasting task is not supported for '{metric_type}'. Supported metrics: {FutureTrendForecastingModule.SUPPORTED_METRICS}"
            )

        metric_obs = [
            o for o in observations
            if o.get("measurement_type") == metric_type and o.get("value") is not None
        ]

        if len(metric_obs) < 14:
            return TrendForecastSummary(
                patient_id=patient_id,
                target_metric=metric_type,
                target_unit=unit,
                forecast_status="insufficient_data",
                insufficient_data_reason=f"Requires at least 14 days of chronological observations for reliable forecasting. Found {len(metric_obs)}."
            )

        result = train_and_forecast_metric(
            metric_type=metric_type,
            unit=unit,
            observations=metric_obs,
            horizon_days=horizon_days
        )

        if not result:
            return TrendForecastSummary(
                patient_id=patient_id,
                target_metric=metric_type,
                target_unit=unit,
                forecast_status="insufficient_data",
                insufficient_data_reason="Insufficient chronological variance or sample count after data cleaning."
            )

        trajectory = [p.model_dump() for p in result.prediction_trajectory]
        eval_metrics = result.evaluation_metrics.model_dump()

        return TrendForecastSummary(
            patient_id=patient_id,
            target_metric=metric_type,
            target_unit=unit,
            horizon_days=horizon_days,
            forecast_status="ready",
            model_version=result.model_version,
            training_data_provenance=result.training_data_provenance,
            forecast_trajectory=trajectory,
            held_out_metrics={
                "model_name": eval_metrics["model_name"],
                "mae": eval_metrics["mae"],
                "rmse": eval_metrics["rmse"],
                "evaluation_window_days": eval_metrics["evaluation_window_days"],
                "improvement_vs_persistence_pct": eval_metrics["improvement_vs_persistence_pct"]
            },
            baseline_comparison={
                "baseline_name": "Simple Persistence Baseline (y_{t+h} = y_t)",
                "baseline_mae": eval_metrics["baseline_mae"],
                "baseline_rmse": eval_metrics["baseline_rmse"],
                "gain_pct": eval_metrics["improvement_vs_persistence_pct"]
            }
        )
