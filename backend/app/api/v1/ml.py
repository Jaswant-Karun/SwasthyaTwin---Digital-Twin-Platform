"""
FastAPI Endpoints for Machine Learning Health Intelligence & Live AI Optical Scanning
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from app.api.deps import get_database
from app.analytics.ml_health_engine import ml_health_engine
from app.analytics.prediction_safeguards import PredictionSafeguards
from app.services.observation_service import ObservationService
from app.services.assessment_service import AssessmentService
from app.models.observation import ObservationCreate

router = APIRouter(prefix="", tags=["Machine Learning Intelligence"])

class InputValidationRequest(BaseModel):
    measurement_type: str
    value: float
    unit: str
    patient_id: Optional[str] = None
    paired_measurements: Optional[Dict[str, float]] = None

class AIScanRequest(BaseModel):
    heart_rate: float = Field(..., ge=30, le=240, description="Optical pulse rate in bpm")
    hrv_rmssd: float = Field(..., ge=5, le=250, description="Optical heart rate variability in ms")
    respiratory_rate: Optional[float] = Field(default=16.0, ge=6, le=60)
    signal_quality_pct: Optional[float] = Field(default=95.0, ge=10, le=100)
    auto_persist_twin: bool = Field(default=True, description="Whether to automatically log verified biometrics to the patient twin")

@router.post("/ml/validate-input")
def validate_input_plausibility(
    req: InputValidationRequest,
    db: Database = Depends(get_database)
):
    """
    AI Multi-Variate Plausibility Guard:
    Checks physiological validity, detects typos (e.g. 700 bpm or systolic <= diastolic),
    and returns a plausibility score with suggested corrections.
    """
    baseline_mean = None
    baseline_std = None

    if req.patient_id:
        patient = db.patients.find_one({"patient_id": req.patient_id})
        if patient:
            twin_baselines = AssessmentService.get_patient_baselines(db, req.patient_id)
            base = twin_baselines.get(req.measurement_type.lower())
            if base:
                baseline_mean = base.get("mean")
                baseline_std = base.get("std_dev")

    result = ml_health_engine.validate_input_plausibility(
        measurement_type=req.measurement_type,
        value=req.value,
        unit=req.unit,
        existing_baseline_mean=baseline_mean,
        existing_baseline_std=baseline_std,
        paired_measurements=req.paired_measurements
    )
    return result

@router.get("/patients/{patient_id}/ml/prediction")
def get_patient_ml_prediction(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Runs the trained Machine Learning ensemble on the patient's current multi-modal twin telemetry.
    Applies strict Prediction Safeguards:
    1. Checks feature availability and forbids zero-imputation.
    2. Validates freshness and flags or withholds expired telemetry.
    3. Verifies physiological ranges and consistency.
    4. Returns structured response with status, warnings, prediction, units, model_version, and limitations.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    twin_state = AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    
    # Extract latest metrics for ML model and their timestamps/sources
    current_metrics = {}
    metric_timestamps = {}
    metric_sources = {}
    if twin_state and twin_state.metrics:
        for m_type, m_val in twin_state.metrics.items():
            current_metrics[m_type] = m_val.current_value
            latest_obs = db.observations.find_one(
                {"patient_id": patient_id, "measurement_type": m_type},
                sort=[("observed_at", -1)]
            )
            if latest_obs:
                metric_timestamps[m_type] = latest_obs.get("observed_at") or latest_obs.get("timestamp")
                metric_sources[m_type] = latest_obs.get("source_type") or latest_obs.get("source", "unknown")

    # Run Prediction Safeguards pre-inference audit
    audit = PredictionSafeguards.audit_features_for_inference(
        patient_id=patient_id,
        features=current_metrics,
        feature_timestamps=metric_timestamps,
        feature_sources=metric_sources
    )

    provenance_meta = {
        "patient_id": patient_id,
        "is_synthetic": bool(patient.get("is_synthetic") or patient.get("demo_data")),
        "feature_sources": metric_sources,
        "features_evaluated": list(current_metrics.keys()),
        "missing_features": audit["missing_features"],
        "stale_features": audit["stale_features"]
    }

    if not audit["is_ready"]:
        res = PredictionSafeguards.format_safeguarded_response(
            status=audit["status"],
            warnings=audit["warnings"],
            prediction=None,
            units=None,
            model_version="2.4.0-safeguarded",
            limitations=audit["limitations"],
            patient_id=patient_id,
            data_provenance=provenance_meta
        )
        res["patient_name"] = patient.get("display_name") or patient.get("full_name") or patient_id
        return res

    max_z = 0.5
    if twin_state and twin_state.metrics:
        z_scores = [abs(m.z_score) for m in twin_state.metrics.values()]
        if z_scores:
            max_z = float(max(z_scores))

    prediction = ml_health_engine.predict_health_trajectory(
        current_metrics=current_metrics,
        age=patient.get("age", 38),
        baseline_z_max=max_z
    )

    safeguarded_res = PredictionSafeguards.format_safeguarded_response(
        status="ready",
        warnings=audit["warnings"],
        prediction=prediction,
        units={
            "vitality_delta": "points",
            "risk_probabilities": "%",
            "pca_coordinates": "dimensionless"
        },
        model_version=prediction.get("model_metadata", {}).get("version", "2.4.0"),
        limitations=audit["limitations"],
        patient_id=patient_id,
        data_provenance=provenance_meta
    )
    # Backward compatibility: flatten prediction properties to root
    for k, v in prediction.items():
        if k not in safeguarded_res:
            safeguarded_res[k] = v
    safeguarded_res["patient_name"] = patient.get("display_name") or patient.get("full_name") or patient_id
    return safeguarded_res

@router.post("/patients/{patient_id}/ai-scan")
def process_ai_optical_scan(
    patient_id: str,
    scan_req: AIScanRequest,
    db: Database = Depends(get_database)
):
    """
    Processes real-time camera rPPG / bio-sensor scan telemetry.
    1. Validates optical signal quality and physiological consistency.
    2. Runs trained ML predictive ensemble on the extracted biometrics.
    3. If valid and auto_persist_twin=True, updates the patient's Digital Twin with verified biometrics.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    # Process scan telemetry
    telemetry = scan_req.model_dump()
    scan_result = ml_health_engine.process_ai_optical_scan(
        patient_id=patient_id,
        scan_telemetry=telemetry
    )

    # If valid and requested, persist both Heart Rate and HRV observations
    persisted_observations = []
    if scan_req.auto_persist_twin and scan_result["is_valid"]:
        try:
            hr_obs = ObservationService.add_observation(
                db=db,
                obs_in=ObservationCreate(
                    patient_id=patient_id,
                    measurement_type="heart_rate",
                    value=round(scan_req.heart_rate, 1),
                    unit="bpm",
                    source="ai_optical_rppg",
                    data_kind="measured",
                    notes="Automated optical photoplethysmography face scan"
                )
            )
            persisted_observations.append(hr_obs.get("observation_id"))

            hrv_obs = ObservationService.add_observation(
                db=db,
                obs_in=ObservationCreate(
                    patient_id=patient_id,
                    measurement_type="hrv_rmssd",
                    value=round(scan_req.hrv_rmssd, 1),
                    unit="ms",
                    source="ai_optical_rppg",
                    data_kind="measured",
                    notes="Automated optical photoplethysmography face scan"
                )
            )
            persisted_observations.append(hrv_obs.get("observation_id"))
        except Exception as e:
            logger.warning(f"Error persisting scan biometrics: {e}")

    scan_result["persisted_observation_ids"] = persisted_observations
    scan_result["twin_updated"] = len(persisted_observations) > 0
    return scan_result


class ModelTrainingRequest(BaseModel):
    n_samples: int = Field(default=2500, ge=100, le=10000, description="Training cohort sample count")
    test_size: float = Field(default=0.20, ge=0.05, le=0.50, description="Fraction of dataset reserved for testing")
    random_state: int = Field(default=42, description="Random seed for reproducibility")


@router.post("/ml/train")
def train_ml_models(
    req: ModelTrainingRequest = ModelTrainingRequest(),
    db: Database = Depends(get_database)
):
    """
    Triggers end-to-end Machine Learning training pipeline:
    - Feature engineering (MAP, Pulse Pressure, Autonomic Recovery Ratio)
    - Stratified Train/Test Split (leakage prevention)
    - 5-Fold Stratified Cross-Validation on Random Forest Classifier
    - Gradient Boosting Regressor for 14-day continuous trajectory delta
    - Unsupervised K-Means Latent Phenotype Clustering (k=4)
    - PCA 2D Latent Space Projection
    - Model artifact serialization to disk
    """
    report = ml_health_engine.retrain_models(
        n_samples=req.n_samples,
        test_size=req.test_size,
        random_state=req.random_state
    )
    return report


@router.get("/ml/model-info")
def get_ml_model_info():
    """
    Returns current production Machine Learning model metadata,
    evaluation metrics, cross-validation scores, confusion matrix,
    feature importance, and unsupervised cluster centroids.
    """
    manifest = getattr(ml_health_engine, "manifest", None)
    if not manifest:
        from app.analytics.ml_trainer import ml_trainer
        manifest = ml_trainer.get_manifest()
    if not manifest:
        manifest = ml_health_engine.retrain_models()
    return manifest


# --- Authentic PhysioNet Sleep Staging ML Pipeline Endpoints ---

from app.ml.inference import inference_engine
from app.ml.trainer import pipeline_trainer
from app.ml.validator import InputFeatureValidationError

import os
import sys
import json

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from ml_pipeline.predict import default_predictor, SleepStagePredictor
from ml_pipeline.config import (
    MODEL_EVALUATION_PATH,
    MODEL_METADATA_PATH,
    PROCESSED_FEATURES_CSV,
    CORE_FEATURE_COLUMNS,
    SLEEP_STAGE_MAP,
    CLASS_3_MAP,
    CLASS_NAMES_3,
    CLASS_NAMES_5
)

class SleepStagePredictRequest(BaseModel):
    hr_mean: float = Field(..., ge=30, le=240, description="Mean heart rate in 30s epoch (bpm)")
    hr_std: float = Field(default=0.0, ge=0, le=60, description="Heart rate standard deviation in epoch (bpm)")
    hr_median: Optional[float] = Field(default=None, description="Median heart rate (bpm)")
    hr_min: float = Field(..., ge=30, le=240, description="Minimum heart rate in epoch (bpm)")
    hr_max: float = Field(..., ge=30, le=260, description="Maximum heart rate in epoch (bpm)")
    hr_q25: Optional[float] = Field(default=None, description="25th percentile heart rate (bpm)")
    hr_q75: Optional[float] = Field(default=None, description="75th percentile heart rate (bpm)")
    hr_valid_count: float = Field(default=6.0, ge=0, description="Valid PPG sample count in epoch")
    hr_delta_baseline: float = Field(default=0.0, ge=-60, le=60, description="Delta from pre-sleep baseline (bpm)")
    hr_rolling_mean_5m: float = Field(..., ge=30, le=240, description="5-minute rolling mean heart rate (bpm)")
    hr_rolling_std_5m: float = Field(default=0.0, ge=0, le=60, description="5-minute rolling heart rate standard deviation (bpm)")
    time_elapsed_minutes: float = Field(default=0.0, ge=0, le=1440, description="Minutes elapsed since sleep opportunity start")
    epoch_index: Optional[int] = Field(default=None, description="Optional 30s epoch index")

@router.get("/ml/sleep-stage/status")
def get_sleep_stage_status():
    """
    Returns deployment status, architecture, and feature schema of the BiDSleep ML model.
    """
    is_ready = default_predictor.is_ready
    metadata = default_predictor.metadata
    return {
        "status": "ready" if is_ready else "model_unavailable",
        "model_name": metadata.get("model_name", "BiDSleep Sleep-Stage Classifier"),
        "model_version": default_predictor.model_version,
        "model_architecture": metadata.get("model_architecture", "RobustScaler + Class-Weighted RandomForestClassifier"),
        "features_schema": CORE_FEATURE_COLUMNS,
        "features_count": len(CORE_FEATURE_COLUMNS),
        "target_classes_5": CLASS_NAMES_5,
        "target_classes_3": CLASS_NAMES_3,
        "training_samples_count": metadata.get("training_samples_count", 0),
        "validation_samples_count": metadata.get("validation_samples_count", 0),
        "dataset_attribution": {
            "name": "BiDSleep v1.0.1 (PhysioNet)",
            "doi": "10.13026/rees-1092",
            "citation": "Song, T.-A., Zhang, Y., Zhou, Z., & Dutta, J. (2026). A Multi-Night Instantaneous Heart Rate and Accelerometry Dataset with EEG Sleep Stage Labels.",
            "license": "ODC-By v1.0"
        }
    }

@router.post("/ml/sleep-stage/predict")
def predict_sleep_stage(req: SleepStagePredictRequest):
    """
    Predicts 5-class sleep stage (Wake, N1, N2, N3, REM) and 3-class mapping from 30-second
    wearable optical heart rate dynamics.
    Trained on BiDSleep v1.0.1 PhysioNet recordings aligned with polysomnography ground truth.
    """
    if not default_predictor.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Sleep Stage ML model artifact is unavailable. Train the model using python -m ml_pipeline.train"
        )

    feat_dict = req.model_dump()
    # Fill smart defaults for optional quantile fields if not provided
    if feat_dict["hr_median"] is None:
        feat_dict["hr_median"] = feat_dict["hr_mean"]
    if feat_dict["hr_q25"] is None:
        feat_dict["hr_q25"] = feat_dict["hr_min"] + 0.25 * (feat_dict["hr_max"] - feat_dict["hr_min"])
    if feat_dict["hr_q75"] is None:
        feat_dict["hr_q75"] = feat_dict["hr_min"] + 0.75 * (feat_dict["hr_max"] - feat_dict["hr_min"])

    try:
        pred_res = default_predictor.predict_epoch(feat_dict, epoch_idx=req.epoch_index)
        
        # Add 3-class summary
        stage_5_id = pred_res["predicted_stage_id"]
        stage_3_id = CLASS_3_MAP.get(stage_5_id, 1)
        stage_3_name = CLASS_NAMES_3[stage_3_id] if (0 <= stage_3_id < len(CLASS_NAMES_3)) else "NREM"

        # 3-class probabilities
        probs_5 = pred_res["probabilities"]
        probs_3 = {
            "Wake": round(probs_5.get("Wake", 0.0) * 100.0, 2),
            "NREM": round((probs_5.get("N1", 0.0) + probs_5.get("N2", 0.0) + probs_5.get("N3", 0.0)) * 100.0, 2),
            "REM": round(probs_5.get("REM", 0.0) * 100.0, 2)
        }

        return {
            "predicted_stage_name": stage_3_name,
            "predicted_stage_5class": pred_res["predicted_stage_name"],
            "predicted_stage_id_5class": stage_5_id,
            "predicted_stage_3class": stage_3_name,
            "predicted_stage_id_3class": stage_3_id,
            "confidence_pct": round(pred_res["confidence"] * 100.0, 2),
            "probabilities_5class": {k: round(v * 100.0, 2) for k, v in probs_5.items()},
            "probabilities_3class": probs_3,
            "epoch_index": pred_res["epoch_index"],
            "model_version": pred_res["model_version"],
            "feature_schema_version": pred_res["feature_schema_version"],
            "input_quality_status": pred_res["quality_status"],
            "input_quality_warnings": pred_res["warnings"],
            "is_trained_model": True,
            "is_demo_fixture": False,
            "model_metadata": {
                "name": default_predictor.metadata.get("model_name", "BiDSleep Sleep-Stage Classifier"),
                "version": pred_res["model_version"],
                "feature_schema_version": pred_res["feature_schema_version"],
                "selected_algorithm": "RandomForestClassifier",
                "target_unit": "sleep_stage_3class",
                "limitations": [
                    "Inferred from 30s wearable optical heart rate (PPG) dynamics; not a replacement for 10-20 EEG polysomnography.",
                    "Subject to motion artifacts and sensor contact variations during sleep.",
                    "Non-diagnostic investigational tool; not for medical decision making."
                ]
            },
            "limitations": [
                "Inferred from 30s wearable optical heart rate (PPG) dynamics; not a replacement for 10-20 EEG polysomnography.",
                "Subject to motion artifacts and sensor contact variations during sleep.",
                "Non-diagnostic investigational tool; not for medical decision making."
            ],
            "clinical_disclaimer": pred_res["disclaimer"]
        }
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@router.get("/ml/sleep-stage/evaluation")
def get_sleep_stage_evaluation():
    """
    Returns authentic research evaluation results from the held-out test cohort:
    - Held-out test participant metrics (Macro F1, Balanced Accuracy, Cohen's Kappa)
    - Majority baseline comparison and lift
    - Per-class precision, recall, and F1 table
    - Confusion matrix
    - Scientific limitations and clinical disclaimers
    """
    manifest = getattr(inference_engine, "manifest", None)
    if not manifest:
        manifest_path = os.path.join(inference_engine.artifacts_dir, "model_manifest.json")
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
            except Exception:
                manifest = None

    bidsleep_eval = None
    if os.path.exists(MODEL_EVALUATION_PATH):
        try:
            with open(MODEL_EVALUATION_PATH, "r", encoding="utf-8") as f:
                bidsleep_eval = json.load(f)
        except Exception:
            bidsleep_eval = None

    if bidsleep_eval and manifest:
        combined = dict(manifest)
        # Attach BiDSleep evaluation metrics
        combined["bidsleep_evaluation"] = bidsleep_eval
        combined["metrics"] = bidsleep_eval.get("metrics")
        combined["per_class_performance"] = bidsleep_eval.get("per_class_performance")
        combined["bidsleep_confusion_matrix"] = bidsleep_eval.get("confusion_matrix")
        combined["cohort_counts"] = bidsleep_eval.get("cohort_counts")
        return combined

    if bidsleep_eval:
        return bidsleep_eval

    if manifest:
        return manifest

    raise HTTPException(
        status_code=404,
        detail="Evaluation report not found. Run `python -m ml_pipeline.evaluate` to generate held-out test evaluation."
    )

@router.get("/ml/sleep-stage/research-samples")
def get_research_hypnogram_samples(subject_id: str = "Bidslab02", night_id: str = "1", limit: int = 120):
    """
    Returns a sequence of authentic research epochs from the held-out test cohort (e.g. Bidslab02/1),
    including continuous Apple Watch heart rate, ground truth expert EEG label, and model-predicted label.
    Provides the hypnogram data stream for the Digital Twin Sleep Research workspace.
    """
    if not os.path.exists(PROCESSED_FEATURES_CSV):
        raise HTTPException(status_code=404, detail="Processed research features not found.")

    try:
        import pandas as pd
        df = pd.read_csv(PROCESSED_FEATURES_CSV)
        filtered = df[(df["subject_id"] == subject_id) & (df["night_id"] == str(night_id))].copy()
        if filtered.empty:
            filtered = df[df["subject_id"] == subject_id].copy()
        if filtered.empty:
            filtered = df.head(limit).copy()
        else:
            filtered = filtered.head(limit).copy()

        # Generate model predictions for these epochs if model is ready
        samples = []
        for _, row in filtered.iterrows():
            feat_dict = {col: float(row[col]) for col in CORE_FEATURE_COLUMNS if col in row}
            pred_stage_5 = None
            pred_stage_3 = None
            confidence = None

            if default_predictor.is_ready:
                try:
                    res = default_predictor.predict_epoch(feat_dict, epoch_idx=int(row["epoch_idx"]))
                    pred_stage_5 = res["predicted_stage_name"]
                    s5_id = res["predicted_stage_id"]
                    pred_stage_3 = CLASS_NAMES_3.get(CLASS_3_MAP.get(s5_id, 1), "NREM")
                    confidence = round(res["confidence"] * 100.0, 1)
                except Exception:
                    pass

            samples.append({
                "sample_id": str(row.get("sample_id", f"{subject_id}_N{night_id}_E{int(row['epoch_idx']):04d}")),
                "epoch_idx": int(row["epoch_idx"]),
                "time_elapsed_minutes": round(float(row.get("time_elapsed_minutes", 0.0)), 1),
                "hr_mean": round(float(row["hr_mean"]), 1),
                "hr_min": round(float(row["hr_min"]), 1),
                "hr_max": round(float(row["hr_max"]), 1),
                "hr_std": round(float(row["hr_std"]), 2),
                "hr_delta_baseline": round(float(row.get("hr_delta_baseline", 0.0)), 2),
                "expert_label_5class": str(row.get("stage_name", "Unknown")),
                "expert_label_3class": str(row.get("stage_3class_name", "Unknown")),
                "dreem_stage_id": int(row.get("dreem_stage_id", -1)),
                "model_predicted_5class": pred_stage_5,
                "model_predicted_3class": pred_stage_3,
                "confidence_pct": confidence
            })

        return {
            "subject_id": subject_id,
            "night_id": night_id,
            "sample_count": len(samples),
            "dataset": "BiDSleep v1.0.1 (PhysioNet)",
            "data_type": "AUTHENTIC_PUBLIC_RESEARCH_COHORT",
            "epochs": samples
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading research samples: {e}")

@router.get("/ml/registry")
def get_model_registry(category: Optional[str] = Query(None, description="Optional category filter")):
    """
    Returns the authoritative Model Registry for all supported machine learning
    and analytical intelligence tasks.
    Guarantees explicit task separation, provenance tracking, and held-out evaluation links.
    """
    from app.analytics.model_registry import model_registry
    if category:
        entries = model_registry.get_entries_by_category(category)
    else:
        entries = model_registry.get_all_entries()
    return {
        "registry_version": "1.0.0",
        "task_count": len(entries),
        "tasks": [e.model_dump() for e in entries]
    }

@router.get("/ml/registry/{task_id}")
def get_model_registry_task(task_id: str):
    """
    Returns detailed specification for a specific machine learning task in the registry,
    including dataset provenance, feature schema, split strategy, held-out metrics, and limitations.
    """
    from app.analytics.model_registry import model_registry
    entry = model_registry.get_entry(task_id)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found in model registry."
        )
    return entry.model_dump()



