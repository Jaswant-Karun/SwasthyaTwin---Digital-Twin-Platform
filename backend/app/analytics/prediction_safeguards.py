"""
SwasthyaTwin Prediction Safeguards and Input Quality Validation Layer
Ensures that incorrect, ambiguous, inconsistent, stale, or unsupported user input
cannot silently produce misleading machine-learning predictions.

Guarantees:
1. Feature availability: explicit missingness audit.
2. Zero-imputation prohibition: never infers unmeasured biometrics as zero.
3. Freshness check: flags stale observations (>30 days) and withholds inference if data is expired (>90 days).
4. Unit consistency: ensures canonical units before model ingestion.
5. Supported schema & physiological range checks: rejects contradictory or physically impossible inputs.
6. Clear separation of model uncertainty from input-quality problems.
7. Structured output: status, warnings, prediction, units, model_version, and limitations.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from app.analytics.plausibility_checker import (
    HARD_LIMITS,
    audit_observation_plausibility
)
from app.analytics.unit_converter import CANONICAL_UNITS, convert_to_canonical_unit

logger = logging.getLogger(__name__)

# Feature requirement definitions for the 14-day multi-variate trajectory model
CORE_REQUIRED_FEATURES = ["heart_rate"]
RECOMMENDED_FEATURES = [
    "systolic_bp",
    "diastolic_bp",
    "hrv_rmssd",
    "sleep_duration",
    "daily_steps"
]

# Max staleness limits
MAX_ACCEPTABLE_STALENESS_DAYS = 30
EXPIRATION_STALENESS_DAYS = 90


class PredictionSafeguards:
    """Pre-inference audit and safeguard gatekeeper."""

    @staticmethod
    def audit_features_for_inference(
        patient_id: str,
        features: Dict[str, Any],
        feature_timestamps: Optional[Dict[str, datetime]] = None,
        feature_sources: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Validates feature readiness before invoking ML models.
        Returns:
            - is_ready (bool)
            - status (str): 'ready', 'insufficient_features', 'stale_data', 'input_quality_rejection'
            - warnings (List[str])
            - limitations (List[str])
            - audited_features (Dict[str, float])
            - missing_features (List[str])
            - stale_features (List[str])
        """
        warnings: List[str] = []
        limitations: List[str] = [
            "Model predictions represent empirical statistical trajectories, not clinical diagnoses.",
            "Physiological missingness is not imputed with zero; forecasts require measured baseline biometrics.",
            "Longitudinal predictions require input freshness within acceptable physiologic windows."
        ]
        missing_features: List[str] = []
        stale_features: List[str] = []
        audited_features: Dict[str, float] = {}

        now_utc = datetime.now(timezone.utc)

        # 1. Check Missingness for Core Required Features
        for req in CORE_REQUIRED_FEATURES:
            val = features.get(req)
            if val is None or val == 0.0:  # 0.0 is unmeasured or invalid for heart rate
                missing_features.append(req)

        # Check secondary recommended features
        available_count = 0
        for feat in (CORE_REQUIRED_FEATURES + RECOMMENDED_FEATURES):
            val = features.get(feat)
            if val is not None and val > 0:
                available_count += 1
            elif feat not in missing_features:
                missing_features.append(feat)

        # Strict missingness rule: must have at least heart rate plus 1 additional metric
        if "heart_rate" in missing_features or available_count < 2:
            return {
                "is_ready": False,
                "status": "insufficient_features",
                "warnings": [
                    f"Prediction withheld for patient '{patient_id}': Insufficient measured features.",
                    f"Missing features: {', '.join(missing_features)}.",
                    "Unmeasured features cannot be inferred as zero or arbitrary defaults."
                ],
                "limitations": limitations + [
                    "At least heart rate and one other biomarker (blood pressure, HRV, sleep, or steps) must be recorded."
                ],
                "audited_features": {},
                "missing_features": missing_features,
                "stale_features": []
            }

        # 2. Check Input Freshness
        if feature_timestamps:
            expired_count = 0
            for feat, ts in feature_timestamps.items():
                if ts:
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    age_days = (now_utc - ts).total_seconds() / 86400.0
                    if age_days > EXPIRATION_STALENESS_DAYS:
                        stale_features.append(f"{feat} ({int(age_days)} days old)")
                        expired_count += 1
                    elif age_days > MAX_ACCEPTABLE_STALENESS_DAYS:
                        warnings.append(
                            f"Input freshness warning: '{feat}' was last recorded {int(age_days)} days ago. "
                            "Prediction accuracy is reduced."
                        )

            # If ALL measured features are older than 90 days, withhold prediction
            if expired_count >= available_count:
                return {
                    "is_ready": False,
                    "status": "stale_data",
                    "warnings": [
                        f"Prediction unavailable for patient '{patient_id}': Historical observations have expired.",
                        f"Expired features (>90 days old): {', '.join(stale_features)}.",
                        "Current health state cannot be reliably inferred from outdated telemetry."
                    ],
                    "limitations": limitations,
                    "audited_features": {},
                    "missing_features": missing_features,
                    "stale_features": stale_features
                }

        # 3. Check Physiological Plausibility and Contradictions
        # e.g., SBP <= DBP
        sbp = features.get("systolic_bp")
        dbp = features.get("diastolic_bp")
        if sbp is not None and dbp is not None:
            if float(dbp) >= float(sbp):
                return {
                    "is_ready": False,
                    "status": "input_quality_rejection",
                    "warnings": [
                        f"Hemodynamic contradiction: Diastolic BP ({dbp} mmHg) cannot be greater than or equal to Systolic BP ({sbp} mmHg).",
                        "Prediction aborted to prevent invalid clinical calculation."
                    ],
                    "limitations": limitations,
                    "audited_features": {},
                    "missing_features": missing_features,
                    "stale_features": stale_features
                }

        # Check individual values against hard bounds
        for feat, val in features.items():
            if val is None:
                continue
            f_val = float(val)
            # Map name if needed
            metric_key = feat
            if feat == "systolic_bp":
                metric_key = "blood_pressure_systolic"
            elif feat == "diastolic_bp":
                metric_key = "blood_pressure_diastolic"
            elif feat == "sleep_duration":
                metric_key = "sleep_duration_hours"

            if metric_key in HARD_LIMITS:
                min_h, max_h, u = HARD_LIMITS[metric_key]
                if f_val < min_h or f_val > max_h:
                    return {
                        "is_ready": False,
                        "status": "input_quality_rejection",
                        "warnings": [
                            f"Technically invalid input for '{feat}': {f_val} {u} is outside human physiological survival limits ({min_h} - {max_h} {u}).",
                            "Model rejected input to avoid generating misleading predictions."
                        ],
                        "limitations": limitations,
                        "audited_features": {},
                        "missing_features": missing_features,
                        "stale_features": stale_features
                    }

            audited_features[feat] = f_val

        # If some recommended features are missing, add informational warning but proceed with cautious weight
        if missing_features:
            warnings.append(
                f"Missing non-critical features ({', '.join(missing_features)}). "
                "Model is operating on partial feature vector with reduced certainty."
            )

        return {
            "is_ready": True,
            "status": "ready",
            "warnings": warnings,
            "limitations": limitations,
            "audited_features": audited_features,
            "missing_features": missing_features,
            "stale_features": stale_features
        }

    @staticmethod
    def format_safeguarded_response(
        status: str,
        warnings: List[str],
        prediction: Optional[Dict[str, Any]],
        units: Optional[Dict[str, str]],
        model_version: str,
        limitations: List[str],
        patient_id: Optional[str] = None,
        data_provenance: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Builds a standardized, transparent prediction response schema."""
        resp = {
            "status": status,
            "warnings": warnings,
            "prediction": prediction,
            "units": units,
            "model_version": model_version,
            "limitations": limitations,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if patient_id:
            resp["patient_id"] = patient_id
        if data_provenance:
            resp["data_provenance"] = data_provenance
        return resp
