"""
SwasthyaTwin AI — Sleep-Stage Model Evaluation Module (Phase 5)
Honest evaluation strictly on the held-out test participants.
Generates comprehensive clinical/statistical metrics, per-class tables,
confusion matrix plots, and machine-readable artifacts.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List

import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import (
    f1_score,
    balanced_accuracy_score,
    accuracy_score,
    precision_score,
    recall_score,
    confusion_matrix,
    cohen_kappa_score,
    classification_report
)

from ml_pipeline.config import (
    PROCESSED_FEATURES_CSV,
    SPLIT_MANIFEST_PATH,
    MODEL_ARTIFACT_PATH,
    MODELS_DIR,
    REPORTS_DIR,
    MODEL_EVALUATION_PATH,
    PER_CLASS_METRICS_PATH,
    CONFUSION_MATRIX_PATH,
    CORE_FEATURE_COLUMNS,
    SLEEP_STAGE_MAP,
    CLASS_NAMES_5
)


def evaluate_held_out_test(
    model_path: str = MODEL_ARTIFACT_PATH,
    features_csv: str = PROCESSED_FEATURES_CSV,
    manifest_path: str = SPLIT_MANIFEST_PATH
) -> Dict[str, Any]:
    """
    Evaluates trained pipeline exclusively on the unseen test participant cohort.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model artifact not found at {model_path}. Train the model first.")
    if not os.path.exists(features_csv):
        raise FileNotFoundError(f"Processed features not found at {features_csv}")
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Split manifest not found at {manifest_path}")

    # Load artifacts
    pipeline = joblib.load(model_path)
    baseline_path = os.path.join(MODELS_DIR, "sleep_stage_baseline_model.joblib")
    baseline_model = joblib.load(baseline_path) if os.path.exists(baseline_path) else None

    df = pd.read_csv(features_csv)
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    test_subs = manifest["splits"]["test"]["participants"]
    train_subs = manifest["splits"]["train"]["participants"]
    val_subs = manifest["splits"]["validation"]["participants"]

    test_df = df[df["subject_id"].isin(test_subs)].copy()
    if test_df.empty:
        raise ValueError(f"No test samples found for participants: {test_subs}")

    X_test = test_df[CORE_FEATURE_COLUMNS].to_numpy()
    y_test = test_df["raw_stage_id"].to_numpy(dtype=int)

    # 1. Model Predictions
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test) if hasattr(pipeline, "predict_proba") else None

    # Baseline Predictions
    if baseline_model is not None:
        y_dummy = baseline_model.predict(X_test)
    else:
        # Fallback to majority class in train manifest
        y_dummy = np.full_like(y_test, fill_value=2)  # N2 is typically majority

    # 2. Compute Primary Research Metrics
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    balanced_acc = float(balanced_accuracy_score(y_test, y_pred))
    overall_acc = float(accuracy_score(y_test, y_pred))
    kappa = float(cohen_kappa_score(y_test, y_pred))

    # Baseline metrics
    dummy_macro_f1 = float(f1_score(y_test, y_dummy, average="macro", zero_division=0))
    dummy_balanced_acc = float(balanced_accuracy_score(y_test, y_dummy))
    dummy_overall_acc = float(accuracy_score(y_test, y_dummy))
    dummy_kappa = float(cohen_kappa_score(y_test, y_dummy))

    # 3. Per-Class Metrics Table
    present_classes = sorted(list(np.unique(np.concatenate([y_test, y_pred]))))
    class_labels = [c for c in [0, 1, 2, 3, 4] if c in present_classes]
    class_names = [SLEEP_STAGE_MAP[c] for c in class_labels]

    precisions = precision_score(y_test, y_pred, labels=class_labels, average=None, zero_division=0)
    recalls = recall_score(y_test, y_pred, labels=class_labels, average=None, zero_division=0)
    f1s = f1_score(y_test, y_pred, labels=class_labels, average=None, zero_division=0)
    
    per_class_list: List[Dict[str, Any]] = []
    for c_id, name, p, r, f in zip(class_labels, class_names, precisions, recalls, f1s):
        support = int(np.sum(y_test == c_id))
        pred_count = int(np.sum(y_pred == c_id))
        per_class_list.append({
            "class_id": int(c_id),
            "stage_name": name,
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1_score": round(float(f), 4),
            "support": support,
            "predicted_count": pred_count
        })

    df_per_class = pd.DataFrame(per_class_list)
    df_per_class.to_csv(PER_CLASS_METRICS_PATH, index=False)

    # 4. Confusion Matrix
    cm = confusion_matrix(y_test, y_pred, labels=class_labels)
    cm_dict = {
        "labels": class_names,
        "matrix": cm.tolist()
    }

    # Plot Confusion Matrix if matplotlib is available
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(7, 6))
        im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax)
        ax.set(
            xticks=np.arange(cm.shape[1]),
            yticks=np.arange(cm.shape[0]),
            xticklabels=class_names,
            yticklabels=class_names,
            title="BiDSleep Held-Out Test Set Confusion Matrix",
            ylabel="Expert EEG Ground Truth",
            xlabel="Apple Watch ML Prediction"
        )
        plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

        # Loop over data dimensions and create text annotations.
        thresh = cm.max() / 2.0
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(j, i, format(cm[i, j], "d"),
                        ha="center", va="center",
                        color="white" if cm[i, j] > thresh else "black")
        fig.tight_layout()
        os.makedirs(os.path.dirname(CONFUSION_MATRIX_PATH), exist_ok=True)
        fig.savefig(CONFUSION_MATRIX_PATH, dpi=150)
        plt.close(fig)
        has_plot = True
    except Exception as e:
        print(f"Warning: Plot generation skipped: {e}")
        has_plot = False

    # 5. Compile Comprehensive Evaluation Report
    report: Dict[str, Any] = {
        "evaluation_title": "BiDSleep Sleep-Stage ML Held-Out Test Evaluation",
        "dataset_name": "BiDSleep v1.0.1 (PhysioNet)",
        "model_architecture": "RobustScaler + Class-Weighted RandomForestClassifier",
        "held_out_test_participants": test_subs,
        "held_out_test_epochs": len(test_df),
        "held_out_test_duration_hours": round(len(test_df) * 30.0 / 3600.0, 2),
        "cohort_counts": {
            "train_participants": train_subs,
            "train_epochs": manifest["splits"]["train"]["epoch_count"],
            "val_participants": val_subs,
            "val_epochs": manifest["splits"]["validation"]["epoch_count"],
            "test_participants": test_subs,
            "test_epochs": len(test_df)
        },
        "metrics": {
            "macro_f1": round(macro_f1, 4),
            "balanced_accuracy": round(balanced_acc, 4),
            "overall_accuracy": round(overall_acc, 4),
            "weighted_f1": round(weighted_f1, 4),
            "cohens_kappa": round(kappa, 4)
        },
        "baseline_comparison": {
            "majority_class_macro_f1": round(dummy_macro_f1, 4),
            "majority_class_balanced_accuracy": round(dummy_balanced_acc, 4),
            "majority_class_overall_accuracy": round(dummy_overall_acc, 4),
            "majority_class_kappa": round(dummy_kappa, 4),
            "macro_f1_lift_over_baseline": round(macro_f1 - dummy_macro_f1, 4),
            "balanced_accuracy_lift": round(balanced_acc - dummy_balanced_acc, 4)
        },
        "per_class_performance": per_class_list,
        "confusion_matrix": cm_dict,
        "plots": {
            "confusion_matrix_png": CONFUSION_MATRIX_PATH if has_plot else None
        },
        "disclaimer": (
            "Research Prototype Notice: This evaluation reflects wearable sensor sleep-stage "
            "classification using heart rate dynamics against polysomnography reference labels. "
            "It is not a medical device, is not intended for diagnostic use, and does not predict total sleep duration."
        )
    }

    with open(MODEL_EVALUATION_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


def main():
    parser = argparse.ArgumentParser(description="Evaluate sleep stage classification on held-out test data.")
    parser.add_argument("--data-dir", default=None, help="Directory containing processed features (e.g. data/processed)")
    parser.add_argument("--features-csv", default=None, help="Explicit path to features CSV/Parquet")
    parser.add_argument("--manifest", default=SPLIT_MANIFEST_PATH, help="Path to split manifest JSON")
    parser.add_argument("--model-path", default=MODEL_ARTIFACT_PATH, help="Path to trained model artifact")
    args = parser.parse_args()

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

    print("=" * 70)
    print("SwasthyaTwin AI — Honest Held-Out Test Set Evaluation")
    print("=" * 70)

    report = evaluate_held_out_test(
        model_path=args.model_path,
        features_csv=features_path,
        manifest_path=args.manifest
    )

    print(f"\nHeld-Out Test Participants: {report['held_out_test_participants']}")
    print(f"Test Epochs (30s):          {report['held_out_test_epochs']:,} (~{report['held_out_test_duration_hours']} hours)")
    print("\n--- Model vs Majority Baseline ---")
    print(f"Random Forest Macro F1:       {report['metrics']['macro_f1']:.4f}  (Baseline: {report['baseline_comparison']['majority_class_macro_f1']:.4f})")
    print(f"Random Forest Balanced Acc:   {report['metrics']['balanced_accuracy']:.4f}  (Baseline: {report['baseline_comparison']['majority_class_balanced_accuracy']:.4f})")
    print(f"Random Forest Overall Acc:    {report['metrics']['overall_accuracy']:.4f}  (Baseline: {report['baseline_comparison']['majority_class_overall_accuracy']:.4f})")
    print(f"Cohen's Kappa:                {report['metrics']['cohens_kappa']:.4f}")

    print("\n--- Per-Class Metrics ---")
    for row in report["per_class_performance"]:
        print(f"  {row['stage_name']:<6} | Prec: {row['precision']:.3f} | Rec: {row['recall']:.3f} | F1: {row['f1_score']:.3f} | Support: {row['support']:>5}")

    print(f"\nEvaluation JSON written to: {MODEL_EVALUATION_PATH}")
    print(f"Per-Class CSV written to:  {PER_CLASS_METRICS_PATH}")
    if report["plots"]["confusion_matrix_png"]:
        print(f"Confusion Matrix Plot:     {CONFUSION_MATRIX_PATH}")


if __name__ == "__main__":
    main()
