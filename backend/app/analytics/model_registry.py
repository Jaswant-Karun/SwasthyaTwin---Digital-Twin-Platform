"""
SwasthyaTwin AI — Machine Learning & Health Analytics Model Registry
Defines the authoritative model registry for all supported intelligence tasks.
Enforces task separation, dataset provenance, held-out evaluation tracking,
and strict clinical guardrails.
"""

import os
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Root directory resolution
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

class ModelRegistryEntry(BaseModel):
    task_id: str = Field(..., description="Unique task identifier")
    task_name: str = Field(..., description="Human-readable task name")
    category: str = Field(..., description="sleep, cardiovascular, activity, blood_pressure, anomaly, forecast")
    target_definition: str = Field(..., description="Clinical / predictive target variable and canonical units")
    dataset_source: str = Field(..., description="Dataset provenance name")
    dataset_version: str = Field(..., description="Dataset version or user-measured")
    dataset_doi: Optional[str] = Field(default=None, description="DOI or source URL")
    feature_schema_version: str = Field(..., description="Version of the feature matrix schema")
    feature_columns: List[str] = Field(default_factory=list, description="Explicit feature names")
    model_version: str = Field(..., description="Version of the serialized model artifact")
    model_architecture: str = Field(..., description="Algorithm and pipeline description")
    artifact_location: Optional[str] = Field(default=None, description="Relative path to serialized model artifact")
    is_available: bool = Field(default=True, description="Whether model artifact and dependencies are ready")
    minimum_observations_required: int = Field(default=1, description="Minimum historical samples required for inference")
    split_strategy: str = Field(..., description="Participant-level or chronological splitting strategy")
    held_out_metrics: Dict[str, Any] = Field(default_factory=dict, description="Real metrics from held-out evaluation")
    baseline_comparison: Dict[str, Any] = Field(default_factory=dict, description="Comparison against reference baseline")
    limitations: List[str] = Field(default_factory=list, description="Documented scientific and medical limitations")
    clinical_disclaimer: str = Field(..., description="Mandatory non-diagnostic legal disclaimer")


class HealthModelRegistry:
    """
    Central, verifiable Model Registry.
    Guarantees:
    1. One distinct entry per task.
    2. Never reuses the sleep classifier for another health task.
    3. Reads real evaluation artifacts from disk; never displays fabricated metrics.
    4. Explicitly withholds predictions when historical data is insufficient.
    """

    def __init__(self):
        self._registry: Dict[str, ModelRegistryEntry] = {}
        self._load_registry()

    def _load_registry(self):
        # 1. BiDSleep Sleep-Stage Classifier
        bidsleep_eval_path = os.path.join(ROOT_DIR, "reports", "model_evaluation.json")
        bidsleep_metrics = {}
        bidsleep_baseline = {}
        if os.path.exists(bidsleep_eval_path):
            try:
                with open(bidsleep_eval_path, "r", encoding="utf-8") as f:
                    eval_data = json.load(f)
                    bidsleep_metrics = eval_data.get("metrics", {})
                    bidsleep_baseline = eval_data.get("baseline_comparison", {})
            except Exception:
                pass

        sleep_rf_path = os.path.join(ROOT_DIR, "models", "sleep_stage_rf_model.joblib")
        sleep_is_ready = os.path.exists(sleep_rf_path)

        self._registry["sleep_stage_classification"] = ModelRegistryEntry(
            task_id="sleep_stage_classification",
            task_name="BiDSleep Wearable Sleep-Stage Classifier",
            category="sleep",
            target_definition="5-Stage AASM Sleep Classification (Wake=0, N1=1, N2=2, N3=3, REM=4) per 30-second epoch",
            dataset_source="BiDSleep v1.0.1 (PhysioNet)",
            dataset_version="1.0.1",
            dataset_doi="10.13026/rees-1092",
            feature_schema_version="v1.0-12features",
            feature_columns=[
                "hr_mean", "hr_std", "hr_median", "hr_min", "hr_max",
                "hr_q25", "hr_q75", "hr_valid_count", "hr_delta_baseline",
                "hr_rolling_mean_5m", "hr_rolling_std_5m", "time_elapsed_minutes"
            ],
            model_version="1.0.0",
            model_architecture="RobustScaler + Class-Weighted RandomForestClassifier (n_estimators=100, max_depth=12)",
            artifact_location="models/sleep_stage_rf_model.joblib",
            is_available=sleep_is_ready,
            minimum_observations_required=1,
            split_strategy="Participant-Level Group Split (Train: Bidslab00, Val: Bidslab01, Held-out Test: Bidslab02; 0% participant leakage)",
            held_out_metrics=bidsleep_metrics,
            baseline_comparison=bidsleep_baseline,
            limitations=[
                "Classifies sleep stages solely from 30s optical PPG heart rate dynamics and accelerometry; not a substitute for 10-20 EEG polysomnography.",
                "Subject to wrist motion artifacts and peripheral vasoconstriction variations.",
                "Trained on healthy adult sleep research cohort; not validated for sleep apnea, insomnia, or pediatric populations."
            ],
            clinical_disclaimer="Non-diagnostic research classification tool. Not for medical diagnosis or clinical decision making."
        )

        # 2. Cardiovascular Resting Heart Rate Trend Forecaster
        self._registry["cardiovascular_trend_forecasting"] = ModelRegistryEntry(
            task_id="cardiovascular_trend_forecasting",
            task_name="Resting Heart Rate 7-Day Trajectory Forecaster",
            category="forecast",
            target_definition="7-day future resting heart rate trajectory (bpm) with 95% confidence bounds",
            dataset_source="Patient Personal Telemetry Archive",
            dataset_version="Live User Chronological Stream",
            feature_schema_version="v2.0-time_series_chronological",
            feature_columns=["value", "observed_at", "rolling_7d_mean", "rolling_7d_std"],
            model_version="2.1.0",
            model_architecture="Autoregressive Exponential Smoothing with Local Linear Trend & 95% Prediction Intervals",
            artifact_location="backend/app/analytics/predictor.py",
            is_available=True,
            minimum_observations_required=14,
            split_strategy="Chronological Held-Out Split (Last 7 days held out for backtesting against Naive Persistence Baseline)",
            held_out_metrics={
                "metric_tested": "Resting Heart Rate",
                "backtest_methodology": "Held-out chronological backtest on user history",
                "min_history_days": 14
            },
            baseline_comparison={
                "reference_baseline": "Naive Last-Observation Persistence (y_{t+h} = y_t)",
                "comparison_metric": "Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE)"
            },
            limitations=[
                "Captures baseline cardiovascular recovery drift; does not anticipate unobserved acute events, acute exercise, or medication changes.",
                "Requires a minimum of 14 historical daily observations; strictly returns 'insufficient_data' if fewer exist."
            ],
            clinical_disclaimer="Trend projection for lifestyle self-monitoring only. Does not diagnose arrhythmias, heart failure, or coronary disease."
        )

        # 3. Activity Kinetics Pattern Analyzer
        self._registry["activity_kinetics_analyzer"] = ModelRegistryEntry(
            task_id="activity_kinetics_analyzer",
            task_name="Longitudinal Step & Kinetic Volume Pattern Analyzer",
            category="activity",
            target_definition="Daily step count pattern, weekday vs weekend volume, and telemetry missingness",
            dataset_source="Wrist Wearable Pedometer / Accelerometer",
            dataset_version="Continuous User Observations",
            feature_schema_version="v1.0-activity_daily",
            feature_columns=["daily_steps", "day_of_week", "observed_at"],
            model_version="1.2.0",
            model_architecture="Parametric & Non-Parametric Activity Corridor Analysis (Tukey's IQR fences + rolling median)",
            artifact_location="backend/app/analytics/health_modules.py",
            is_available=True,
            minimum_observations_required=7,
            split_strategy="Chronological Rolling 30-Day Window",
            held_out_metrics={
                "coverage_target": "Daily step completeness",
                "missingness_threshold": "< 500 steps logged as potential non-wear rather than true zero"
            },
            baseline_comparison={
                "reference_baseline": "Personal 30-day median daily steps",
                "comparison_metric": "Percentage deviation from personal median"
            },
            limitations=[
                "Does not forecast future step counts without an explicit longitudinal habit model.",
                "Non-wear periods and off-wrist hours can falsely deflate daily step totals if not flagged."
            ],
            clinical_disclaimer="Activity tracking for general wellness. Does not evaluate physical disability, cardiopulmonary fitness, or exercise tolerance."
        )

        # 4. Blood Pressure Hemodynamic Trend Tracker
        self._registry["blood_pressure_trend_tracker"] = ModelRegistryEntry(
            task_id="blood_pressure_trend_tracker",
            task_name="Hemodynamic Pulse Pressure & MAP Longitudinal Tracker",
            category="blood_pressure",
            target_definition="Systolic Blood Pressure (mmHg), Diastolic Blood Pressure (mmHg), Pulse Pressure, and Mean Arterial Pressure",
            dataset_source="Validated Oscillometric Upper-Arm Blood Pressure Cuff",
            dataset_version="User Measured Observations",
            feature_schema_version="v1.0-hemodynamic_pairs",
            feature_columns=["systolic", "diastolic", "pulse_pressure", "mean_arterial_pressure", "observed_at"],
            model_version="1.1.0",
            model_architecture="AHA/ACC Hemodynamic Classification with Strict Input Plausibility & Pulse Pressure Consistency",
            artifact_location="backend/app/analytics/health_modules.py",
            is_available=True,
            minimum_observations_required=3,
            split_strategy="Longitudinal Observational Chronology",
            held_out_metrics={
                "plausibility_rule": "SBP >= DBP + 15 mmHg",
                "bounds_systolic": "45 to 300 mmHg",
                "bounds_diastolic": "25 to 180 mmHg"
            },
            baseline_comparison={
                "reference_baseline": "Personal 30-day median SBP and DBP",
                "comparison_metric": "Delta from personal median (mmHg)"
            },
            limitations=[
                "Zero synthetic generation: Never infers blood pressure from heart rate, PPG, or sleep stages.",
                "Requires validated oscillometric arm cuff measurement under resting conditions."
            ],
            clinical_disclaimer="Tracking tool for measured blood pressure trends. Does not replace physician diagnosis of essential or secondary hypertension."
        )

        # 5. Personalized Anomaly Detector
        self._registry["personalized_anomaly_detector"] = ModelRegistryEntry(
            task_id="personalized_anomaly_detector",
            task_name="Multi-Tier Statistical Anomaly Detection Engine",
            category="anomaly",
            target_definition="Statistical outlier classification (optimal, mild_deviation, moderate_drift, significant_deviation)",
            dataset_source="Patient Personal Baseline Corridor",
            dataset_version="Rolling 30-Day Robust Statistics",
            feature_schema_version="v2.1-z_score_and_iqr",
            feature_columns=["value", "baseline_median", "baseline_iqr", "baseline_mean", "baseline_std"],
            model_version="2.0.0",
            model_architecture="Dual-Gate Robust IQR Fences (Tukey 1.5x) and Standardized Gaussian Z-Score Classification",
            artifact_location="backend/app/analytics/anomaly_detector.py",
            is_available=True,
            minimum_observations_required=14,
            split_strategy="Historical Baseline Window (30-day lookback excluding current epoch)",
            held_out_metrics={
                "warning_threshold_z": 1.8,
                "critical_threshold_z": 3.0,
                "outlier_filter_fence": "3.0 * IQR (Tukey extreme fence for robust baseline calculation)"
            },
            baseline_comparison={
                "reference_baseline": "Tukey Robust Median & IQR Corridor",
                "comparison_metric": "Z-Score and IQR Distance from Median"
            },
            limitations=[
                "Explicitly distinguishes statistical anomaly from clinically significant abnormality.",
                "Requires at least 14 observations before establishing a baseline to prevent high false-alarm rates during onboarding."
            ],
            clinical_disclaimer="Statistical deviation indicator only. Does not identify acute medical danger, infarction, or clinical pathology."
        )

    def get_all_entries(self) -> List[ModelRegistryEntry]:
        return list(self._registry.values())

    def get_entry(self, task_id: str) -> Optional[ModelRegistryEntry]:
        return self._registry.get(task_id)

    def get_entries_by_category(self, category: str) -> List[ModelRegistryEntry]:
        return [entry for entry in self._registry.values() if entry.category == category]


# Global singleton instance
model_registry = HealthModelRegistry()
