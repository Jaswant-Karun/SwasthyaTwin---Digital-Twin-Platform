"""
SwasthyaTwin Personalized Heart-Rate Anomaly Intelligence Engine
Implements robust, transparent, and non-diagnostic statistical anomaly detection
for longitudinal heart-rate observations using Normalized Median Absolute Deviation (nMAD).

Core Principles:
1. Median Baseline: Resilient to extreme biometric spikes compared to sample mean.
2. Robust Variability: nMAD = 1.4826 * median(|x - median(x)|), matching Gaussian standard deviation for normal data.
3. Safe Variability Floor: Prevents division-by-zero or infinite scores when readings are identical.
4. Chronological Integrity: Never leaks future observations into historical baselines.
5. Self-Exclusion: The evaluated observation is strictly excluded from its own reference baseline.
6. Honest Abstention: Returns 'insufficient_data' if prior sample count < min_observations.
7. Non-Diagnostic Boundary: Statistical anomaly is not evidence of medical emergency or arrhythmia diagnosis.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field

ALGORITHM_VERSION = "v1.2.0-robust-mad"
DEFAULT_WINDOW_DAYS = 30
DEFAULT_MIN_OBSERVATIONS = 10
DEFAULT_Z_THRESHOLD = 2.5
DEFAULT_VARIABILITY_FLOOR_BPM = 1.0


class HeartRateBaseline(BaseModel):
    patient_id: str
    metric_type: str = "heart_rate"
    unit: str = "bpm"
    median: Optional[float] = None
    mad: Optional[float] = None
    n_mad: Optional[float] = None
    variability_floor_applied: bool = False
    observation_count: int = 0
    window_days: int = DEFAULT_WINDOW_DAYS
    window_start: Optional[datetime] = None
    newest_timestamp: Optional[datetime] = None
    is_sufficient: bool = False
    status: str = "insufficient_data"  # "established" | "insufficient_data"
    reason: Optional[str] = None
    algorithm_version: str = ALGORITHM_VERSION


class HeartRateAnomalyRecord(BaseModel):
    patient_id: str
    observation_id: str
    timestamp: datetime
    measured_heart_rate: float
    unit: str = "bpm"
    baseline_median: Optional[float] = None
    baseline_unit: str = "bpm"
    delta_absolute: Optional[float] = None
    delta_percentage: Optional[float] = None
    variability_measure: str = "nMAD"
    variability_value: Optional[float] = None
    robust_score: Optional[float] = None
    status: str  # "insufficient_data" | "within_personal_range" | "unusual_high" | "unusual_low" | "review_data_quality"
    reason: str
    baseline_observation_count: int = 0
    baseline_window_days: int = DEFAULT_WINDOW_DAYS
    newest_baseline_timestamp: Optional[datetime] = None
    source_type: Optional[str] = None
    device_id: Optional[str] = None
    data_quality_warnings: List[str] = Field(default_factory=list)
    algorithm_version: str = ALGORITHM_VERSION
    disclaimer: str = (
        "Statistical deviation from personal baseline for research and self-awareness. "
        "Does NOT diagnose arrhythmia, myocardial infarction, or acute cardiovascular disease."
    )


class HeartRateAnomalyExplanation(BaseModel):
    patient_id: str
    observation_id: str
    measured_heart_rate: float
    unit: str = "bpm"
    observed_at: datetime
    status: str
    reason: str
    formula: str
    calculation_breakdown: Dict[str, Any]
    baseline_summary: Dict[str, Any]
    data_quality_audit: Dict[str, Any]
    algorithm_version: str = ALGORITHM_VERSION
    clinical_limitations: str = (
        "This metric represents a statistical divergence from recent resting distribution. "
        "Ordinary wearable PPG telemetry is subject to motion artifacts and cannot substitute for 12-lead ECG."
    )


def parse_observation_timestamp(obs: Dict[str, Any]) -> datetime:
    t = obs.get("observed_at") or obs.get("timestamp") or datetime.min
    if isinstance(t, str):
        try:
            t = datetime.fromisoformat(t.replace("Z", "+00:00"))
        except Exception:
            t = datetime.min
    if isinstance(t, datetime) and t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return t


def is_eligible_observation(obs: Dict[str, Any]) -> bool:
    """
    Validates whether an observation is eligible for baseline inclusion.
    Excludes invalid, rejected, or simulated records.
    """
    m_type = obs.get("measurement_type") or obs.get("metric_type")
    if m_type not in ["heart_rate", "resting_heart_rate"]:
        return False

    val = obs.get("value")
    if val is None:
        return False
    try:
        fval = float(val)
        if np.isnan(fval) or np.isinf(fval):
            return False
    except (ValueError, TypeError):
        return False

    if obs.get("data_kind") in ["simulated"]:
        return False
    if obs.get("data_tier") in ["simulated"]:
        return False
    if obs.get("is_synthetic") is True:
        return False
    if obs.get("validation_status") in ["rejected", "invalid"]:
        return False

    return True


def calculate_hr_baseline(
    patient_id: str,
    observations: List[Dict[str, Any]],
    window_days: int = DEFAULT_WINDOW_DAYS,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    reference_time: Optional[datetime] = None,
    variability_floor_bpm: float = DEFAULT_VARIABILITY_FLOOR_BPM
) -> HeartRateBaseline:
    """
    Calculates the personal heart rate baseline over a configurable historical window.
    Strictly excludes readings occurring at or after reference_time (preventing future-leakage).
    Uses median and Normalized Median Absolute Deviation (nMAD).
    """
    now = reference_time or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=window_days)

    eligible: List[Tuple[float, datetime]] = []
    for o in observations:
        if not is_eligible_observation(o):
            continue
        t = parse_observation_timestamp(o)
        if cutoff <= t < now:
            eligible.append((float(o["value"]), t))

    if len(eligible) < min_observations:
        return HeartRateBaseline(
            patient_id=patient_id,
            observation_count=len(eligible),
            window_days=window_days,
            window_start=cutoff,
            newest_timestamp=max([p[1] for p in eligible]) if eligible else None,
            is_sufficient=False,
            status="insufficient_data",
            reason=f"Insufficient eligible observations ({len(eligible)} of {min_observations} required within {window_days}-day window)."
        )

    values = np.array([p[0] for p in eligible], dtype=float)
    timestamps = [p[1] for p in eligible]

    med = float(np.median(values))
    abs_deviations = np.abs(values - med)
    raw_mad = float(np.median(abs_deviations))

    # Normalized MAD (consistent with standard normal distribution std dev)
    n_mad = 1.4826 * raw_mad
    variability_floor_applied = False

    # Safe variability floor: prevents zero division if readings are identical
    if n_mad < variability_floor_bpm:
        n_mad = variability_floor_bpm
        variability_floor_applied = True

    return HeartRateBaseline(
        patient_id=patient_id,
        median=round(med, 1),
        mad=round(raw_mad, 2),
        n_mad=round(n_mad, 2),
        variability_floor_applied=variability_floor_applied,
        observation_count=len(values),
        window_days=window_days,
        window_start=min(timestamps),
        newest_timestamp=max(timestamps),
        is_sufficient=True,
        status="established",
        reason=f"Baseline established from {len(values)} validated readings over {window_days} days."
    )


def evaluate_heart_rate_observation(
    target_obs: Dict[str, Any],
    prior_observations: List[Dict[str, Any]],
    window_days: int = DEFAULT_WINDOW_DAYS,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    z_threshold: float = DEFAULT_Z_THRESHOLD,
    variability_floor_bpm: float = DEFAULT_VARIABILITY_FLOOR_BPM
) -> HeartRateAnomalyRecord:
    """
    Evaluates a single heart-rate observation against its preceding baseline.
    Guarantees:
    - Target observation is strictly excluded from baseline computation.
    - Future observations are strictly excluded.
    - Zero-variability is handled safely.
    """
    pid = str(target_obs.get("patient_id", "unknown"))
    obs_id = str(target_obs.get("observation_id") or target_obs.get("id", "unknown"))
    t_target = parse_observation_timestamp(target_obs)
    val = float(target_obs.get("value", 0.0))
    warnings = list(target_obs.get("validation_warnings") or [])

    # Filter strictly prior observations (t < t_target)
    strictly_prior = [
        o for o in prior_observations
        if parse_observation_timestamp(o) < t_target
    ]

    baseline = calculate_hr_baseline(
        patient_id=pid,
        observations=strictly_prior,
        window_days=window_days,
        min_observations=min_observations,
        reference_time=t_target,
        variability_floor_bpm=variability_floor_bpm
    )

    source_type = target_obs.get("source_type") or target_obs.get("source")
    device_id = target_obs.get("device_id")

    # If insufficient history
    if not baseline.is_sufficient or baseline.median is None or baseline.n_mad is None:
        return HeartRateAnomalyRecord(
            patient_id=pid,
            observation_id=obs_id,
            timestamp=t_target,
            measured_heart_rate=round(val, 1),
            baseline_median=None,
            delta_absolute=None,
            delta_percentage=None,
            variability_value=None,
            robust_score=None,
            status="insufficient_data",
            reason=baseline.reason or f"Insufficient prior history (< {min_observations} observations).",
            baseline_observation_count=baseline.observation_count,
            baseline_window_days=window_days,
            newest_baseline_timestamp=baseline.newest_timestamp,
            source_type=source_type,
            device_id=device_id,
            data_quality_warnings=warnings
        )

    # Calculate absolute delta & relative delta
    delta_abs = round(val - baseline.median, 1)
    delta_pct = round((delta_abs / baseline.median) * 100.0, 1) if baseline.median > 0 else 0.0

    # Robust Modified Z-Score: (x - median) / nMAD
    robust_score = round(delta_abs / baseline.n_mad, 2)

    # Flagging Logic
    status = "within_personal_range"
    reason = f"Within expected personal tolerance corridor (Score: {robust_score:+.2f})."

    # Quality review flag
    if warnings or target_obs.get("validation_status") == "confirmed_unusual":
        if abs(robust_score) >= z_threshold:
            status = "review_data_quality"
            reason = f"Statistical deviation with data quality warnings: {'; '.join(warnings) if warnings else 'Requires confirmation'}."
        else:
            status = "within_personal_range"

    # Unusual High
    if status != "review_data_quality" and robust_score >= z_threshold:
        status = "unusual_high"
        floor_note = " (variability floor applied)" if baseline.variability_floor_applied else ""
        reason = (
            f"Measurement of {val:.1f} bpm is {delta_abs:+.1f} bpm ({delta_pct:+.1f}%) above personal baseline of "
            f"{baseline.median:.1f} bpm (robust score: {robust_score:+.2f}{floor_note})."
        )

    # Unusual Low
    elif status != "review_data_quality" and robust_score <= -z_threshold:
        status = "unusual_low"
        floor_note = " (variability floor applied)" if baseline.variability_floor_applied else ""
        reason = (
            f"Measurement of {val:.1f} bpm is {delta_abs:+.1f} bpm ({delta_pct:+.1f}%) below personal baseline of "
            f"{baseline.median:.1f} bpm (robust score: {robust_score:+.2f}{floor_note})."
        )

    return HeartRateAnomalyRecord(
        patient_id=pid,
        observation_id=obs_id,
        timestamp=t_target,
        measured_heart_rate=round(val, 1),
        baseline_median=baseline.median,
        delta_absolute=delta_abs,
        delta_percentage=delta_pct,
        variability_value=baseline.n_mad,
        robust_score=robust_score,
        status=status,
        reason=reason,
        baseline_observation_count=baseline.observation_count,
        baseline_window_days=window_days,
        newest_baseline_timestamp=baseline.newest_timestamp,
        source_type=source_type,
        device_id=device_id,
        data_quality_warnings=warnings
    )


def analyze_patient_heart_rate_stream(
    patient_id: str,
    observations: List[Dict[str, Any]],
    window_days: int = DEFAULT_WINDOW_DAYS,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    z_threshold: float = DEFAULT_Z_THRESHOLD
) -> List[HeartRateAnomalyRecord]:
    """
    Sequentially processes a patient's historical heart-rate stream in strict chronological order.
    Ensures zero future-leakage and zero self-contamination for every single record.
    """
    # 1. Filter eligible records and sort chronologically
    hr_obs = [o for o in observations if is_eligible_observation(o)]
    hr_obs.sort(key=parse_observation_timestamp)

    results: List[HeartRateAnomalyRecord] = []
    for idx, obs in enumerate(hr_obs):
        # Prior observations are strictly elements before current idx
        prior = hr_obs[:idx]
        record = evaluate_heart_rate_observation(
            target_obs=obs,
            prior_observations=prior,
            window_days=window_days,
            min_observations=min_observations,
            z_threshold=z_threshold
        )
        results.append(record)

    return results


def explain_heart_rate_anomaly(
    target_obs: Dict[str, Any],
    prior_observations: List[Dict[str, Any]],
    window_days: int = DEFAULT_WINDOW_DAYS,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    z_threshold: float = DEFAULT_Z_THRESHOLD
) -> HeartRateAnomalyExplanation:
    """
    Builds a transparent, human-readable mathematical breakdown for a specific flagged observation.
    """
    record = evaluate_heart_rate_observation(
        target_obs=target_obs,
        prior_observations=prior_observations,
        window_days=window_days,
        min_observations=min_observations,
        z_threshold=z_threshold
    )

    t_target = parse_observation_timestamp(target_obs)
    val = float(target_obs.get("value", 0.0))

    if record.baseline_median is not None and record.variability_value is not None:
        formula_str = (
            f"Modified Z = (Measured HR - Baseline Median) / nMAD\n"
            f"= ({val:.1f} - {record.baseline_median:.1f}) / {record.variability_value:.2f}\n"
            f"= {record.robust_score:+.2f}"
        )
    else:
        formula_str = "Formula withheld: insufficient historical observations to establish personal baseline."

    return HeartRateAnomalyExplanation(
        patient_id=record.patient_id,
        observation_id=record.observation_id,
        measured_heart_rate=record.measured_heart_rate,
        observed_at=t_target,
        status=record.status,
        reason=record.reason,
        formula=formula_str,
        calculation_breakdown={
            "measured_value": record.measured_heart_rate,
            "baseline_median": record.baseline_median,
            "delta_absolute_bpm": record.delta_absolute,
            "delta_percentage": record.delta_percentage,
            "variability_n_mad_bpm": record.variability_value,
            "robust_score": record.robust_score,
            "z_threshold_applied": z_threshold
        },
        baseline_summary={
            "observation_count": record.baseline_observation_count,
            "window_days": record.baseline_window_days,
            "newest_baseline_timestamp": record.newest_baseline_timestamp.isoformat() if record.newest_baseline_timestamp else None
        },
        data_quality_audit={
            "source_type": record.source_type,
            "device_id": record.device_id,
            "warnings": record.data_quality_warnings
        }
    )
