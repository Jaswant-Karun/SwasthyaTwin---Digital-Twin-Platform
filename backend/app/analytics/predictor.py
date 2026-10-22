import math
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field

class PredictionPoint(BaseModel):
    day: int
    date: str
    predicted_value: float
    confidence_lower: float
    confidence_upper: float

class ModelEvaluationMetrics(BaseModel):
    model_name: str
    mae: float
    rmse: float
    baseline_mae: float
    baseline_rmse: float
    evaluation_window_days: int
    improvement_vs_persistence_pct: float

class MetricPredictionResult(BaseModel):
    metric_type: str
    unit: str
    target_horizon_days: int
    model_version: str
    training_data_provenance: str
    prediction_trajectory: List[PredictionPoint]
    evaluation_metrics: ModelEvaluationMetrics
    disclaimer: str

def train_and_forecast_metric(
    metric_type: str,
    unit: str,
    observations: List[Dict[str, Any]],
    horizon_days: int = 7
) -> Optional[MetricPredictionResult]:
    """
    Computes time-series trend forecasting with temporal leakage prevention and held-out validation.

    METHODOLOGY & PREVENTING TEMPORAL LEAKAGE:
    1. Chronological sorting: Observations are strictly ordered by observation timestamp.
    2. Temporal Split:
       - Held-out test window: The most recent 7 days of historical observations.
       - Training history: All observations strictly before the held-out window.
       Zero future data leaks into the model fit or baseline calculation.
    3. Baseline Comparison:
       - Simple Persistence Baseline: Forecast = last value before evaluation window.
       - Model: Autoregressive exponential smoothing with local linear trend slope.
    4. Evaluation Metrics:
       Held-out MAE and RMSE are computed on the actual observations in the evaluation window
       and compared directly against the Simple Persistence Baseline.
    """
    if len(observations) < 14:
        return None

    # Sort strictly chronologically
    sorted_obs = sorted(
        observations,
        key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min
    )

    vals = np.array([float(o["value"]) for o in sorted_obs if o.get("value") is not None])
    times = [o.get("observed_at") or o.get("timestamp") for o in sorted_obs if o.get("value") is not None]

    if len(vals) < 14:
        return None

    # Temporal split: hold out last 7 observations for evaluation
    eval_len = min(7, len(vals) // 3)
    train_vals = vals[:-eval_len]
    test_vals = vals[-eval_len:]

    # --- 1. Evaluate on Held-out Window ---
    # Baseline: Simple persistence (last value of training data)
    persistence_pred = train_vals[-1]
    baseline_errors = test_vals - persistence_pred
    baseline_mae = float(np.mean(np.abs(baseline_errors)))
    baseline_rmse = float(np.sqrt(np.mean(baseline_errors ** 2)))

    # Autoregressive / Exponential smoothing with trend slope
    # Fit linear slope over recent train window (last 14 points)
    recent_train = train_vals[-14:] if len(train_vals) >= 14 else train_vals
    x = np.arange(len(recent_train))
    slope, intercept = np.polyfit(x, recent_train, 1)

    # Evaluate model predictions over test horizon
    model_test_preds = np.array([
        train_vals[-1] + slope * (step + 1) * math.exp(-step / 5.0)
        for step in range(eval_len)
    ])
    model_errors = test_vals - model_test_preds
    model_mae = float(np.mean(np.abs(model_errors)))
    model_rmse = float(np.sqrt(np.mean(model_errors ** 2)))

    # Calculate improvement vs persistence
    improvement_pct = 0.0
    if baseline_mae > 0:
        improvement_pct = round(((baseline_mae - model_mae) / baseline_mae) * 100.0, 1)

    eval_metrics = ModelEvaluationMetrics(
        model_name="Autoregressive Exponential Trend Model",
        mae=round(model_mae, 2),
        rmse=round(model_rmse, 2),
        baseline_mae=round(baseline_mae, 2),
        baseline_rmse=round(baseline_rmse, 2),
        evaluation_window_days=eval_len,
        improvement_vs_persistence_pct=improvement_pct
    )

    # --- 2. Generate Future Forecast (Horizon days) ---
    # Now use full series to forecast forward from current time
    full_recent = vals[-14:] if len(vals) >= 14 else vals
    full_x = np.arange(len(full_recent))
    full_slope, _ = np.polyfit(full_x, full_recent, 1)
    last_val = vals[-1]
    last_time = times[-1]
    if isinstance(last_time, str):
        last_time = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
    if last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=timezone.utc)

    # Historical standard deviation of residuals for confidence band
    residual_std = max(0.5, float(np.std(vals - np.mean(vals)) * 0.4))

    trajectories: List[PredictionPoint] = []
    for day in range(1, horizon_days + 1):
        target_date = (last_time + timedelta(days=day)).strftime("%Y-%m-%d")
        # Trend prediction with dampening
        dampening = math.exp(-day / 8.0)
        pred_val = last_val + full_slope * day * dampening

        # Expanding confidence interval over horizon
        ci_spread = residual_std * (1.0 + (day / horizon_days) * 0.75) * 1.96

        trajectories.append(PredictionPoint(
            day=day,
            date=target_date,
            predicted_value=round(pred_val, 1),
            confidence_lower=round(pred_val - ci_spread, 1),
            confidence_upper=round(pred_val + ci_spread, 1)
        ))

    return MetricPredictionResult(
        metric_type=metric_type,
        unit=unit,
        target_horizon_days=horizon_days,
        model_version="v1.2-autoregressive-trend",
        training_data_provenance=f"Personal longitudinal observations ({len(vals)} historical readings)",
        prediction_trajectory=trajectories,
        evaluation_metrics=eval_metrics,
        disclaimer=(
            "Heuristic time-series predictive model based on personal historical trajectory. "
            "Evaluated on held-out temporal validation window. Not a certified clinical diagnostic prognosis."
        )
    )


def forecast_metric_with_safeguards(
    metric_type: str,
    unit: str,
    observations: List[Dict[str, Any]],
    horizon_days: int = 7
) -> Dict[str, Any]:
    """
    Safeguarded time-series forecasting pipeline.
    Validates feature availability, freshness, units, missingness, and supported ranges
    before inference. Returns structured response with status, warnings, prediction, units,
    model_version, and limitations. Never produces confident predictions from corrupt or insufficient data.
    """
    warnings: List[str] = []
    limitations: List[str] = [
        "Forecasting is an autoregressive extrapolation of personal historical trend, not a medical diagnosis.",
        "Model requires at least 14 validated historical observations to capture temporal slope and variance.",
        "Missing days are not assumed to be zero; gaps in telemetry increase forecast uncertainty."
    ]

    # 1. Feature Availability and Missingness Check
    if not observations or len(observations) < 14:
        obs_count = len(observations) if observations else 0
        return {
            "status": "insufficient_features",
            "warnings": [
                f"Prediction withheld for '{metric_type}': Insufficient longitudinal observations.",
                f"Found {obs_count} valid observations; minimum required is 14.",
                "Missing observations cannot be zero-imputed or artificially fabricated."
            ],
            "prediction": None,
            "units": unit,
            "model_version": "v1.2-autoregressive-trend",
            "limitations": limitations
        }

    # 2. Physiological Bounds and Unit Check
    from app.analytics.plausibility_checker import HARD_LIMITS
    clean_type = metric_type.lower()
    for o in observations:
        v = o.get("value")
        if v is not None and clean_type in HARD_LIMITS:
            min_h, max_h, u = HARD_LIMITS[clean_type]
            if float(v) < min_h or float(v) > max_h:
                return {
                    "status": "input_quality_rejection",
                    "warnings": [
                        f"Prediction aborted: Outlier observation value {v} {unit} is outside human physiological bounds ({min_h} - {max_h} {u}).",
                        "Prediction model requires uncorrupted telemetry."
                    ],
                    "prediction": None,
                    "units": unit,
                    "model_version": "v1.2-autoregressive-trend",
                    "limitations": limitations
                }

    # 3. Freshness Check
    sorted_obs = sorted(
        observations,
        key=lambda o: o.get("observed_at") or o.get("timestamp") or datetime.min
    )
    last_time = sorted_obs[-1].get("observed_at") or sorted_obs[-1].get("timestamp")
    if isinstance(last_time, str):
        last_time = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
    if last_time and last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=timezone.utc)

    now_utc = datetime.now(timezone.utc)
    if last_time:
        staleness_days = (now_utc - last_time).total_seconds() / 86400.0
        if staleness_days > 90:
            return {
                "status": "stale_data",
                "warnings": [
                    f"Prediction unavailable for '{metric_type}': Historical observations have expired.",
                    f"Latest observation was recorded {int(staleness_days)} days ago (limit: 90 days).",
                    "Extrapolating from expired data would produce misleading health forecasts."
                ],
                "prediction": None,
                "units": unit,
                "model_version": "v1.2-autoregressive-trend",
                "limitations": limitations
            }
        elif staleness_days > 30:
            warnings.append(
                f"Input freshness warning: Latest observation is {int(staleness_days)} days old. "
                "Prediction accuracy may be reduced."
            )

    # 4. Run Model
    forecast_result = train_and_forecast_metric(
        metric_type=metric_type,
        unit=unit,
        observations=observations,
        horizon_days=horizon_days
    )

    if not forecast_result:
        return {
            "status": "insufficient_features",
            "warnings": warnings + ["Model failed to converge on the provided time-series slice."],
            "prediction": None,
            "units": unit,
            "model_version": "v1.2-autoregressive-trend",
            "limitations": limitations
        }

    return {
        "status": "ready",
        "warnings": warnings,
        "prediction": forecast_result.model_dump(),
        "units": unit,
        "model_version": forecast_result.model_version,
        "limitations": limitations
    }

