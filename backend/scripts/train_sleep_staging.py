"""
SwasthyaTwin Machine Learning Pipeline Training Script
Executes full ingestion, group-aware cross-validation, and held-out evaluation on authentic PhysioNet recordings.

Usage:
    python scripts/train_sleep_staging.py [--max-subjects 31]
"""

import sys
import os
import argparse
from pathlib import Path

# Fix Windows console UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.ml.trainer import pipeline_trainer
from app.ml.config import DATASET_NAME, DATASET_VERSION, MODEL_VERSION

def format_banner():
    print("=" * 76)
    print(" [ML] SWASTHYATWIN AUTHENTIC RESEARCH MACHINE LEARNING PIPELINE")
    print(f" Dataset: {DATASET_NAME} (v{DATASET_VERSION})")
    print(" Methodology: Group-Aware Participant Partitioning & 5-Fold GroupKFold CV")
    print(" Zero-Leakage Policy: Scaler fitted exclusively on training participants")
    print("=" * 76)

def main():
    parser = argparse.ArgumentParser(description="Train SwasthyaTwin Real ML Pipeline")
    parser.add_argument("--max-subjects", type=int, default=None, help="Limit number of subjects (optional)")
    args = parser.parse_args()

    format_banner()
    print("\n[1/4] Inspecting authentic research dataset and extracting aligned 30s epochs...")
    manifest = pipeline_trainer.run_training_pipeline(max_subjects=args.max_subjects)

    prov = manifest["dataset_provenance"]
    b_comp = manifest["baseline_comparison"]
    selected = b_comp["selected_model"]
    test_eval = manifest["held_out_test_evaluations"][selected]
    maj_eval = manifest["held_out_test_evaluations"]["Majority_Baseline"]
    heu_eval = manifest["held_out_test_evaluations"]["Heuristic_Baseline"]

    print("\n[2/4] PARTICIPANT SPLIT INTEGRITY:")
    print("-" * 76)
    print(f" * Total Subjects:          {prov['total_subjects']} ({prov['total_epochs']:,} epochs)")
    print(f" * Training Split:          {prov['train_subjects_count']} subjects ({prov['train_epochs_count']:,} epochs)")
    print(f" * Held-Out Test Split:     {prov['test_subjects_count']} subjects ({prov['test_epochs_count']:,} epochs)")
    print(f" * Held-Out Test Subjects:  {prov['test_subjects_list']}")

    print("\n[3/4] HELD-OUT TEST EVALUATION RESULTS:")
    print("-" * 76)
    print(f" * Selected Best Model:     {selected}")
    print(f" * Overall Test Accuracy:   {test_eval['overall_accuracy']}%")
    print(f" * Balanced Test Accuracy:  {test_eval['balanced_accuracy']}% (vs. Majority: {maj_eval['balanced_accuracy']}%, Heuristic: {heu_eval['balanced_accuracy']}%)")
    print(f" * Macro F1-Score:          {test_eval['macro_f1']}% (vs. Majority: {maj_eval['macro_f1']}%)")
    print(f" * Cohen's Kappa (PSG):     {test_eval['cohen_kappa']}")
    if test_eval.get("roc_auc_ovr"):
        print(f" * Multi-Class ROC-AUC:     {test_eval['roc_auc_ovr']}%")

    print("\n * Per-Class Breakdown (Held-Out Test Set):")
    for c_name, c_m in test_eval["class_metrics"].items():
        print(f"   [{c_name:<5}] Precision: {c_m['precision']:>5.1f}% | Recall: {c_m['recall']:>5.1f}% | F1: {c_m['f1_score']:>5.1f}% | Support: {c_m['support']} ({c_m['prevalence_pct']}%)")

    print("\n * Confusion Matrix (Normalized %):")
    labels = test_eval["confusion_matrix"]["labels"]
    norm_cm = test_eval["confusion_matrix"]["normalized"]
    print(f"   Actual \\ Pred:  {'    '.join(labels)}")
    for i, row in enumerate(norm_cm):
        print(f"   {labels[i]:<14}  {'%        '.join([f'{v:>5.1f}' for v in row])}%")

    print("\n[4/4] ARTIFACT PERSISTENCE:")
    print("-" * 76)
    print(f" Destination: {pipeline_trainer.artifacts_dir}")
    print("  [OK] best_model.joblib")
    print("  [OK] scaler.joblib")
    print("  [OK] feature_schema.json")
    print("  [OK] model_manifest.json")
    print("=" * 76)

if __name__ == "__main__":
    main()
