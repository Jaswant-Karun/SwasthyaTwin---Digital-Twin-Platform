"""
SwasthyaTwin Machine Learning Model Training CLI
Executes full supervised & unsupervised model training pipeline,
evaluates metrics, and exports serialized production model artifacts.

Usage:
  python scripts/train_ml_models.py [--samples 2500] [--test-split 0.2]
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

# Ensure backend root is in python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.analytics.ml_trainer import ml_trainer

def format_banner():
    print("=" * 72)
    print(" [ML] SWASTHYATWIN MACHINE LEARNING MODEL TRAINING PIPELINE")
    print("=" * 72)
    print(" Core ML Concepts:")
    print("  * Feature Engineering (MAP, Pulse Pressure, Autonomic Recovery Ratio)")
    print("  * Stratified 80/20 Train/Test Split (Data Leakage Guard)")
    print("  * Random Forest Classifier + 5-Fold Stratified Cross Validation")
    print("  * Gradient Boosting Regressor (14-Day Trajectory Delta)")
    print("  * Baseline Benchmark (Logistic Regression comparison)")
    print("  * Unsupervised K-Means Phenotyping (k=4) + 2D PCA Dimensionality Reduction")
    print("=" * 72)

def main():
    parser = argparse.ArgumentParser(description="Train SwasthyaTwin ML Models")
    parser.add_argument("--samples", type=int, default=2500, help="Number of cohort training samples (default: 2500)")
    parser.add_argument("--test-split", type=float, default=0.20, help="Test set fraction (default: 0.20)")
    parser.add_argument("--seed", type=int, default=42, help="Random state seed (default: 42)")
    args = parser.parse_args()

    format_banner()
    print(f"\n[1/4] Generating synthetic physiological cohort ({args.samples} patient vectors)...")
    
    print("[2/4] Executing stratified train/test split, standardization & 5-fold cross-validation...")
    report = ml_trainer.train_and_evaluate(
        n_samples=args.samples,
        test_size=args.test_split,
        random_state=args.seed
    )

    clf_metrics = report["classification_metrics"]
    baseline = report["baseline_comparison"]
    reg_metrics = report["regression_metrics"]
    cv = clf_metrics["cross_validation_5fold"]
    pca_data = report["dimensionality_reduction"]
    clusters = report["unsupervised_phenotypes"]["clusters"]

    print("\n[3/4] MODEL EVALUATION RESULTS:")
    print("-" * 72)
    print(f" * Classifier Algorithm:       {clf_metrics['algorithm']}")
    print(f" * Test Set Accuracy:          {clf_metrics['test_accuracy']}%")
    print(f" * Test Weighted F1-Score:     {clf_metrics['test_f1_score']}%")
    print(f" * Test Weighted Precision:    {clf_metrics['test_precision']}%")
    print(f" * Test Weighted Recall:       {clf_metrics['test_recall']}%")
    print(f" * Multi-class ROC-AUC (OvR):  {clf_metrics['roc_auc_ovr']}%")
    print(f" * 5-Fold Stratified CV Mean:  {cv['mean_score']}% (+/- {cv['std_score']}%)")
    print(f"   Fold breakdown:             {cv['fold_scores']}")
    print("-" * 72)
    print(" * Benchmark Comparison (Ablation Study):")
    print(f"   - Baseline Logistic Reg Acc: {baseline['test_accuracy']}%")
    print(f"   - Random Forest Gain:        +{baseline['accuracy_improvement_pct']}% over linear baseline")
    print("-" * 72)
    print(f" * 14-Day Trajectory Regressor: {reg_metrics['algorithm']}")
    print(f"   - Mean Absolute Error (MAE): {reg_metrics['mae']} pts")
    print(f"   - Root Mean Sq Error (RMSE): {reg_metrics['rmse']} pts")
    print(f"   - R-squared (R2):            {reg_metrics['r2_score']}")
    print("-" * 72)
    print(" * Unsupervised Phenotypes (K-Means k=4):")
    for cl in clusters:
        print(f"   [{cl['cluster_id']}] {cl['name']} ({cl['archetype']}):")
        print(f"       HR: {cl['profile']['heart_rate']} bpm | BP: {cl['profile']['systolic_bp']}/{cl['profile']['diastolic_bp']} mmHg | HRV: {cl['profile']['hrv_rmssd']} ms | Sleep: {cl['profile']['sleep_duration']} hrs")
    print("-" * 72)
    print(f" * PCA Latent Projection: Total Explained Variance = {pca_data['total_explained_variance_pct']}%")
    print(" * Top 5 Feature Importances (Gini Impurity Reduction):")
    for feat in report["feature_importance"][:5]:
        bar = "#" * int(feat["importance_pct"] * 1.5)
        print(f"   {feat['display_name']:<28} {feat['importance_pct']:>5.1f}%  {bar}")

    print("\n[4/4] SAVED PRODUCTION ARTIFACTS:")
    models_dir = ml_trainer.models_dir
    print(f" Destination directory: {models_dir}")
    print(f"  [OK] scaler.joblib")
    print(f"  [OK] risk_classifier.joblib")
    print(f"  [OK] trajectory_regressor.joblib")
    print(f"  [OK] kmeans_phenotypes.joblib")
    print(f"  [OK] pca_projector.joblib")
    print(f"  [OK] training_manifest.json")
    print(f"\nTraining completed in {report['training_duration_seconds']}s successfully!\n")

if __name__ == "__main__":
    main()
