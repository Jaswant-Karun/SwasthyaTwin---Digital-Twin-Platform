"""
SwasthyaTwin Machine Learning Metrics & Evaluation Framework
Computes rigorous, honest evaluation metrics:
- Per-class Precision, Recall, F1-Score, Support
- Balanced Accuracy & Macro F1 (class-imbalance aware)
- Multi-class Confusion Matrix
- Cohen's Kappa (inter-rater agreement with PSG)
- Probability Calibration & Brier Score
Never conflates training performance with held-out generalization.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    cohen_kappa_score,
    roc_auc_score,
    brier_score_loss
)

from app.ml.config import CLASS_NAMES

class ModelEvaluator:
    """Evaluates classification models with clinically grounded, multi-dimensional metrics."""

    @staticmethod
    def evaluate_predictions(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_prob: Optional[np.ndarray] = None,
        model_name: str = "CandidateModel",
        split_name: str = "held_out_test"
    ) -> Dict[str, Any]:
        """
        Computes comprehensive evaluation metrics for 3-class sleep staging.
        """
        acc = float(accuracy_score(y_true, y_pred))
        bal_acc = float(balanced_accuracy_score(y_true, y_pred))
        kappa = float(cohen_kappa_score(y_true, y_pred))

        # Multi-class precision, recall, F1 (macro and weighted)
        p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(
            y_true, y_pred, average="macro", zero_division=0
        )
        p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(
            y_true, y_pred, average="weighted", zero_division=0
        )

        # Per-class breakdown
        p_per_class, r_per_class, f1_per_class, support = precision_recall_fscore_support(
            y_true, y_pred, labels=[0, 1, 2], zero_division=0
        )

        class_breakdown = {}
        for c_idx in [0, 1, 2]:
            c_name = CLASS_NAMES.get(c_idx, f"Class_{c_idx}")
            class_breakdown[c_name] = {
                "class_id": c_idx,
                "precision": round(float(p_per_class[c_idx]) * 100.0, 2),
                "recall": round(float(r_per_class[c_idx]) * 100.0, 2),
                "f1_score": round(float(f1_per_class[c_idx]) * 100.0, 2),
                "support": int(support[c_idx]),
                "prevalence_pct": round(float(support[c_idx]) / len(y_true) * 100.0, 2)
            }

        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
        cm_norm = cm.astype(float) / np.maximum(cm.sum(axis=1, keepdims=True), 1)

        # ROC-AUC & Calibration (if probabilities provided)
        roc_auc_ovr = None
        brier_scores = {}
        if y_prob is not None:
            try:
                roc_auc_ovr = round(float(roc_auc_score(y_true, y_prob, multi_class="ovr", average="macro")) * 100.0, 2)
            except Exception:
                roc_auc_ovr = None

            # Brier score per class (one-vs-rest binary calibration)
            for c_idx in [0, 1, 2]:
                c_name = CLASS_NAMES.get(c_idx, f"Class_{c_idx}")
                y_bin = (y_true == c_idx).astype(int)
                brier = float(brier_score_loss(y_bin, y_prob[:, c_idx]))
                brier_scores[c_name] = round(brier, 4)

        return {
            "model_name": model_name,
            "split_name": split_name,
            "total_samples": len(y_true),
            "overall_accuracy": round(acc * 100.0, 2),
            "balanced_accuracy": round(bal_acc * 100.0, 2),
            "macro_f1": round(float(f1_macro) * 100.0, 2),
            "macro_precision": round(float(p_macro) * 100.0, 2),
            "macro_recall": round(float(r_macro) * 100.0, 2),
            "weighted_f1": round(float(f1_weighted) * 100.0, 2),
            "cohen_kappa": round(kappa, 4),
            "roc_auc_ovr": roc_auc_ovr,
            "brier_scores": brier_scores,
            "class_metrics": class_breakdown,
            "confusion_matrix": {
                "raw": cm.tolist(),
                "normalized": np.round(cm_norm * 100.0, 2).tolist(),
                "labels": [CLASS_NAMES[i] for i in [0, 1, 2]]
            }
        }
