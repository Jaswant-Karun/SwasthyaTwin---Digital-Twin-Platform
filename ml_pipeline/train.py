"""
SwasthyaTwin AI — Sleep Stage Model Training Module (Phase 4)
Trains:
1. Majority-class baseline (DummyClassifier)
2. Class-weighted Random Forest Classifier with fitted RobustScaler preprocessing

Strict Leakage Safeguards:
- Fits scaler and classifier exclusively on Train participants.
- Uses Validation participants for hyperparameter inspection.
- Test participants remain untouched until final evaluation.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import f1_score, balanced_accuracy_score, classification_report

from ml_pipeline.config import (
    PROCESSED_FEATURES_CSV,
    SPLIT_MANIFEST_PATH,
    MODELS_DIR,
    MODEL_ARTIFACT_PATH,
    MODEL_METADATA_PATH,
    CORE_FEATURE_COLUMNS,
    RANDOM_SEED,
    SLEEP_STAGE_MAP,
    CLASS_NAMES_5
)


def load_split_data(
    features_csv: str = PROCESSED_FEATURES_CSV,
    manifest_path: str = SPLIT_MANIFEST_PATH
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Loads dataset and partitions according to split_manifest.json.
    """
    if not os.path.exists(features_csv):
        raise FileNotFoundError(f"Processed features not found at {features_csv}")
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Split manifest not found at {manifest_path}")

    df = pd.read_csv(features_csv)
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_subs = manifest["splits"]["train"]["participants"]
    val_subs = manifest["splits"]["validation"]["participants"]
    test_subs = manifest["splits"]["test"]["participants"]

    train_df = df[df["subject_id"].isin(train_subs)].copy()
    val_df = df[df["subject_id"].isin(val_subs)].copy()
    test_df = df[df["subject_id"].isin(test_subs)].copy()

    return train_df, val_df, test_df, manifest


def train_models(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    seed: int = RANDOM_SEED
) -> Tuple[Pipeline, DummyClassifier, Dict[str, Any]]:
    """
    Fits scaler and models on train data, evaluates on validation data.
    """
    X_train = train_df[CORE_FEATURE_COLUMNS].to_numpy()
    y_train = train_df["raw_stage_id"].to_numpy(dtype=int)

    X_val = val_df[CORE_FEATURE_COLUMNS].to_numpy()
    y_val = val_df["raw_stage_id"].to_numpy(dtype=int)

    print(f"Training feature matrix: {X_train.shape}, Labels: {y_train.shape}")
    print(f"Validation feature matrix: {X_val.shape}, Labels: {y_val.shape}")

    # 1. Majority-class baseline
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train, y_train)

    y_val_dummy = dummy.predict(X_val)
    dummy_val_f1 = float(f1_score(y_val, y_val_dummy, average="macro", zero_division=0))
    dummy_val_bal_acc = float(balanced_accuracy_score(y_val, y_val_dummy))

    # 2. Class-weighted Random Forest with RobustScaler
    rf_pipeline = Pipeline([
        ("scaler", RobustScaler()),
        ("classifier", RandomForestClassifier(
            n_estimators=150,
            max_depth=12,
            min_samples_leaf=4,
            class_weight="balanced",
            random_state=seed,
            n_jobs=-1
        ))
    ])

    print("Fitting Random Forest pipeline...")
    rf_pipeline.fit(X_train, y_train)

    y_val_pred = rf_pipeline.predict(X_val)
    rf_val_f1 = float(f1_score(y_val, y_val_pred, average="macro", zero_division=0))
    rf_val_bal_acc = float(balanced_accuracy_score(y_val, y_val_pred))

    metadata = {
        "model_name": "BiDSleep Sleep-Stage Classifier",
        "model_version": "1.0.0",
        "model_architecture": "RobustScaler + Class-Weighted RandomForestClassifier",
        "random_seed": seed,
        "features_schema": CORE_FEATURE_COLUMNS,
        "classes_mapping": SLEEP_STAGE_MAP,
        "classes_5": CLASS_NAMES_5,
        "hyperparameters": {
            "n_estimators": 150,
            "max_depth": 12,
            "min_samples_leaf": 4,
            "class_weight": "balanced"
        },
        "training_samples_count": len(train_df),
        "validation_samples_count": len(val_df),
        "validation_metrics": {
            "majority_baseline_macro_f1": round(dummy_val_f1, 4),
            "majority_baseline_balanced_accuracy": round(dummy_val_bal_acc, 4),
            "random_forest_macro_f1": round(rf_val_f1, 4),
            "random_forest_balanced_accuracy": round(rf_val_bal_acc, 4)
        }
    }

    print(f"\n--- Validation Performance ---")
    print(f"Majority Baseline: Macro F1 = {dummy_val_f1:.4f}, Balanced Acc = {dummy_val_bal_acc:.4f}")
    print(f"Random Forest:     Macro F1 = {rf_val_f1:.4f}, Balanced Acc = {rf_val_bal_acc:.4f}")

    return rf_pipeline, dummy, metadata


def main():
    parser = argparse.ArgumentParser(description="Train baseline and ML models for sleep-stage classification.")
    parser.add_argument("--data-dir", default=None, help="Directory containing processed features (e.g. data/processed)")
    parser.add_argument("--features-csv", default=None, help="Explicit path to features CSV/Parquet")
    parser.add_argument("--manifest", default=SPLIT_MANIFEST_PATH, help="Path to split manifest JSON")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)

    # Determine features CSV/Parquet path
    if args.features_csv:
        features_path = args.features_csv
    elif args.data_dir:
        candidate_csv = os.path.join(args.data_dir, "bidsleep_features.csv")
        candidate_parquet = os.path.join(args.data_dir, "bidsleep_features.parquet")
        if os.path.exists(candidate_csv):
            features_path = candidate_csv
        elif os.path.exists(candidate_parquet):
            features_path = candidate_parquet
        else:
            features_path = candidate_csv
    else:
        features_path = PROCESSED_FEATURES_CSV

    train_df, val_df, test_df, manifest = load_split_data(features_path, args.manifest)
    rf_pipeline, dummy_model, metadata = train_models(train_df, val_df, seed=args.seed)

    # Save models and metadata
    joblib.dump(rf_pipeline, MODEL_ARTIFACT_PATH)
    baseline_path = os.path.join(MODELS_DIR, "sleep_stage_baseline_model.joblib")
    joblib.dump(dummy_model, baseline_path)

    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nModel pipeline saved to: {MODEL_ARTIFACT_PATH}")
    print(f"Baseline saved to:       {baseline_path}")
    print(f"Metadata saved to:       {MODEL_METADATA_PATH}")


if __name__ == "__main__":
    main()
