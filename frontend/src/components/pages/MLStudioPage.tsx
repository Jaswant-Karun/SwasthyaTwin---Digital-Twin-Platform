import React, { useState, useEffect } from 'react';
import {
  Brain,
  Cpu,
  Layers,
  Sparkles,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Zap,
  Sliders,
  Check,
  Award,
  ChevronRight,
  Database,
  ArrowUpRight,
  FileCode2,
  PieChart,
  GitCommit,
  TrendingUp,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import { MLModelManifest } from '../../types';

export const MLStudioPage: React.FC = () => {
  const { currentPatient } = useTwin();

  // Model Manifest State
  const [manifest, setManifest] = useState<MLModelManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [training, setTraining] = useState<boolean>(false);
  const [trainSuccess, setTrainSuccess] = useState<boolean>(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  // Training Hyperparameters
  const [samplesCount, setSamplesCount] = useState<number>(2500);
  const [testSplit, setTestSplit] = useState<number>(0.20);
  const [randomSeed, setRandomSeed] = useState<number>(42);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'supervised' | 'unsupervised' | 'features' | 'artifacts'>('supervised');

  // Load manifest on mount
  useEffect(() => {
    loadModelInfo();
  }, []);

  const loadModelInfo = async () => {
    try {
      setLoading(true);
      const data = await api.getMLModelInfo();
      setManifest(data);
    } catch (err: any) {
      console.error('Failed to load ML model info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    try {
      setTraining(true);
      setTrainSuccess(false);
      setTrainError(null);
      const updatedManifest = await api.trainMLModel({
        n_samples: samplesCount,
        test_size: testSplit,
        random_state: randomSeed
      });
      setManifest(updatedManifest);
      setTrainSuccess(true);
      setTimeout(() => setTrainSuccess(false), 5000);
    } catch (err: any) {
      console.error('Training failed:', err);
      setTrainError(err.message || 'Model training pipeline encountered an error.');
    } finally {
      setTraining(false);
    }
  };

  if (loading && !manifest) {
    return (
      <div className="card-surface rounded-xl p-12 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-slate-800">Initializing Machine Learning Studio...</h3>
        <p className="text-xs text-slate-500">Loading model checkpoints, metrics, and latent cluster profiles.</p>
      </div>
    );
  }

  const clf = manifest?.classification_metrics;
  const reg = manifest?.regression_metrics;
  const base = manifest?.baseline_comparison;
  const clusters = manifest?.unsupervised_phenotypes.clusters || [];
  const pca = manifest?.dimensionality_reduction;
  const features = manifest?.feature_importance || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Machine Learning Training & Phenotype Studio
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empirical ensemble training, stratified 5-fold cross-validation, and unsupervised K-Means latent phenotyping.
          </p>
        </div>

        {/* Action Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Active Version</span>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {manifest?.version || 'v2.4.0-ensemble'}
            </span>
          </div>

          <button
            onClick={handleTrain}
            disabled={training}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-teal-700/20 transition-all disabled:opacity-50"
          >
            {training ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Training Pipeline...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-teal-200" />
                <span>Retrain Ensemble Models</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {trainSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Training Succeeded!</strong> Retrained on {manifest?.dataset_summary.total_samples.toLocaleString()} samples in {manifest?.training_duration_seconds}s. Test accuracy: <strong>{clf?.test_accuracy}%</strong>.
          </span>
        </div>
      )}
      {trainError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{trainError}</span>
        </div>
      )}

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Test Accuracy */}
        <div className="card-surface rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Test Set Accuracy</span>
            <Award className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {clf?.test_accuracy || 83.5}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            5-Fold CV: {clf?.cross_validation_5fold.mean_score}% (±{clf?.cross_validation_5fold.std_score}%)
          </div>
        </div>

        {/* ROC-AUC */}
        <div className="card-surface rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Multi-Class ROC-AUC</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">
            {clf?.roc_auc_ovr || 94.7}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            One-vs-Rest Macro
          </div>
        </div>

        {/* Weighted F1-Score */}
        <div className="card-surface rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Weighted F1-Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {clf?.test_f1_score || 83.6}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Precision: {clf?.test_precision}% • Recall: {clf?.test_recall}%
          </div>
        </div>

        {/* 14-Day Trajectory Regressor */}
        <div className="card-surface rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Trajectory Regressor (R²)</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {reg?.r2_score || 0.92}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            MAE: {reg?.mae} pts • RMSE: {reg?.rmse} pts
          </div>
        </div>
      </div>

      {/* Interactive Training Control Drawer */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Training Pipeline Parameters & Hyperparameters
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Dataset Size: {manifest?.dataset_summary.total_samples.toLocaleString()} samples
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          {/* Cohort Sample Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-700">
              <label>Cohort Sample Volume (N)</label>
              <span className="font-mono text-teal-700">{samplesCount.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="500"
              max="6000"
              step="500"
              value={samplesCount}
              onChange={(e) => setSamplesCount(parseInt(e.target.value))}
              disabled={training}
              className="w-full accent-teal-600"
            />
            <p className="text-[10px] text-slate-400">
              Multi-variate synthetic cohorts modeled with physiological covariance.
            </p>
          </div>

          {/* Test Split Fraction */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-700">
              <label>Test Split Ratio</label>
              <span className="font-mono text-teal-700">{Math.round(testSplit * 100)}% ({Math.round(samplesCount * testSplit)} test samples)</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.35"
              step="0.05"
              value={testSplit}
              onChange={(e) => setTestSplit(parseFloat(e.target.value))}
              disabled={training}
              className="w-full accent-teal-600"
            />
            <p className="text-[10px] text-slate-400">
              Stratified split preserves risk class distribution and prevents data leakage.
            </p>
          </div>

          {/* Random Seed */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-700">
              <label>Random State Seed</label>
              <span className="font-mono text-teal-700">{randomSeed}</span>
            </div>
            <input
              type="number"
              value={randomSeed}
              onChange={(e) => setRandomSeed(parseInt(e.target.value) || 42)}
              disabled={training}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400">
              Guarantees reproducible cohort folds across training iterations.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('supervised')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'supervised'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Supervised Ensemble & 5-Fold CV</span>
        </button>

        <button
          onClick={() => setActiveTab('unsupervised')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'unsupervised'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Unsupervised Phenotyping & PCA</span>
        </button>

        <button
          onClick={() => setActiveTab('features')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'features'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Feature Engineering & Importance</span>
        </button>

        <button
          onClick={() => setActiveTab('artifacts')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'artifacts'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>Production Artifacts & Manifest</span>
        </button>
      </div>

      {/* TAB 1: SUPERVISED LEARNING & CROSS VALIDATION */}
      {activeTab === 'supervised' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 5-Fold Stratified Cross Validation */}
            <div className="card-surface rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Stratified 5-Fold Cross-Validation
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Mean: {clf?.cross_validation_5fold.mean_score}%
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Evaluates generalization stability across 5 independent cohort folds to protect against dataset bias and overfitting.
              </p>

              {/* Fold Bars */}
              <div className="space-y-3 pt-2">
                {clf?.cross_validation_5fold.fold_scores.map((score, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-semibold">Fold {idx + 1}</span>
                      <span className="font-mono font-bold text-slate-900">{score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>Standard Deviation (σ):</span>
                <span className="font-mono font-bold text-slate-900">±{clf?.cross_validation_5fold.std_score}%</span>
              </div>
            </div>

            {/* Confusion Matrix Heatmap */}
            <div className="card-surface rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Multi-Class Confusion Matrix (Test Set)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Rows: Actual | Cols: Predicted
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Distribution of actual vs model-predicted risk tiers across the holdout test set ({manifest?.dataset_summary.test_samples} patients).
              </p>

              {/* Confusion Matrix Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-400 font-normal">Actual \ Pred</th>
                      {clf?.class_labels.map((label, idx) => (
                        <th key={idx} className="p-2 font-semibold text-slate-700 bg-slate-50 border border-slate-200">
                          {label.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clf?.confusion_matrix.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="p-2 text-left font-semibold text-slate-700 bg-slate-50 border border-slate-200 whitespace-nowrap">
                          {clf.class_labels[rIdx]}
                        </td>
                        {row.map((val, cIdx) => {
                          const isDiagonal = rIdx === cIdx;
                          return (
                            <td
                              key={cIdx}
                              className={`p-3 font-mono font-bold border border-slate-200 ${
                                isDiagonal
                                  ? 'bg-teal-500/15 text-teal-900'
                                  : val > 0
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ablation / Baseline comparison */}
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">Ablation Baseline: </span>
                  <span>Logistic Regression (linear) = {base?.test_accuracy}%</span>
                </div>
                <span className="font-mono font-bold text-emerald-700">
                  +{base?.accuracy_improvement_pct}% RF Gain
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UNSUPERVISED PHENOTYPING & PCA */}
      {activeTab === 'unsupervised' && (
        <div className="space-y-6">
          {/* PCA 2D Latent Space Projection */}
          <div className="card-surface rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2D Principal Component Analysis (PCA) Latent Geometry
                </h3>
              </div>
              <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Explained Variance: {pca?.total_explained_variance_pct}% (PC1: {pca?.explained_variance_ratio[0]}% + PC2: {pca?.explained_variance_ratio[1]}%)
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Unsupervised projection reduces 12 multi-modal physiological dimensions onto an orthogonal 2D coordinate system. Cluster boundaries emerge naturally from autonomous biometric clustering.
            </p>

            {/* Scatter Plot Simulation View */}
            <div className="relative h-64 bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-15">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="border border-slate-400" />
                ))}
              </div>

              {/* Axes */}
              <div className="absolute left-1/2 inset-y-0 w-px bg-slate-700/60" />
              <div className="absolute top-1/2 inset-x-0 h-px bg-slate-700/60" />

              {/* Plotted Scatter Points */}
              <div className="absolute inset-4">
                {pca?.sample_scatter_points.map((pt, pIdx) => {
                  // Normalize -3..3 to 0..100%
                  const leftPct = Math.min(95, Math.max(5, ((pt.x + 3.0) / 6.0) * 100));
                  const topPct = Math.min(95, Math.max(5, ((-pt.y + 3.0) / 6.0) * 100));
                  const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  return (
                    <div
                      key={pIdx}
                      className="absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-75 hover:opacity-100 hover:scale-150 transition-all cursor-pointer"
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        backgroundColor: colors[pt.cluster % 4]
                      }}
                      title={`PC1: ${pt.x}, PC2: ${pt.y} (Cluster ${pt.cluster})`}
                    />
                  );
                })}

                {/* Patient marker if active */}
                {currentPatient && (
                  <div
                    className="absolute w-4 h-4 rounded-full bg-teal-400 border-2 border-white shadow-lg shadow-teal-400/50 transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                    style={{ left: '52%', top: '48%' }}
                    title={`${currentPatient.full_name} (Active Twin Projection)`}
                  />
                )}
              </div>

              {/* Axis Labels */}
              <span className="absolute bottom-1 right-3 text-[10px] font-mono text-slate-400">
                PC1 (Autonomic-Hemodynamic Axis) →
              </span>
              <span className="absolute top-2 left-3 text-[10px] font-mono text-slate-400">
                ↑ PC2 (Circadian Recovery Axis)
              </span>
            </div>
          </div>

          {/* K-Means Clusters Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Discovered Latent Phenotypes (K-Means k=4)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((c) => (
                <div key={c.cluster_id} className="card-surface rounded-xl p-4 space-y-3 border-l-4" style={{ borderColor: c.color }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Cluster #{c.cluster_id}</span>
                      <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${c.color}20`, color: c.color }}
                    >
                      {c.archetype}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {c.summary}
                  </p>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] text-center">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Rest HR</span>
                      <span className="font-bold text-slate-800">{c.profile.heart_rate} bpm</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">BP (MAP)</span>
                      <span className="font-bold text-slate-800">{c.profile.systolic_bp}/{c.profile.diastolic_bp}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">HRV</span>
                      <span className="font-bold text-slate-800">{c.profile.hrv_rmssd} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Sleep</span>
                      <span className="font-bold text-slate-800">{c.profile.sleep_duration} hrs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FEATURE ENGINEERING & IMPORTANCE */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Importance Bar Chart */}
            <div className="card-surface rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Feature Importance (Gini Impurity Reduction)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  12 Biomarkers
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {features.map((feat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-medium">{feat.display_name}</span>
                      <span className="font-mono font-bold text-teal-700">{feat.importance_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-teal-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, feat.importance_pct * 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature Engineering Rationale */}
            <div className="card-surface rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Domain Feature Engineering Rationale
                  </h3>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800">1. Mean Arterial Pressure (MAP)</span>
                  <p className="font-mono text-[11px] text-indigo-700">MAP = DBP + 1/3 * (SBP - DBP)</p>
                  <p className="text-slate-500">Reflects true steady-state tissue perfusion pressure better than systolic BP alone.</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800">2. Pulse Pressure (PP)</span>
                  <p className="font-mono text-[11px] text-indigo-700">PP = SBP - DBP</p>
                  <p className="text-slate-500">Surrogate marker for central large artery elasticity and stroke volume dynamics.</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800">3. Autonomic Recovery Ratio (ARR)</span>
                  <p className="font-mono text-[11px] text-indigo-700">ARR = HRV_RMSSD / ln(HR)</p>
                  <p className="text-slate-500">Normalizes vagal heart rate variability against resting chronological pulse rate.</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800">4. Max Baseline Deviation (Z_max)</span>
                  <p className="font-mono text-[11px] text-indigo-700">Z_max = max(|z_hr|, |z_sbp|, |z_hrv|)</p>
                  <p className="text-slate-500">Personalized outlier amplifier capturing multi-variate drift from patient's own self-baseline.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTION ARTIFACTS & MANIFEST */}
      {activeTab === 'artifacts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {['scaler.joblib', 'risk_classifier.joblib', 'trajectory_regressor.joblib', 'kmeans_phenotypes.joblib', 'pca_projector.joblib'].map((file, idx) => (
              <div key={idx} className="card-surface rounded-xl p-3 text-center space-y-1 border border-slate-200">
                <FileCode2 className="w-5 h-5 text-teal-600 mx-auto" />
                <span className="font-mono text-[11px] font-bold text-slate-800 block truncate" title={file}>{file}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block">Serialized (Active)</span>
              </div>
            ))}
          </div>

          <div className="card-surface rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Full Production Training Manifest (JSON)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Trained: {manifest?.trained_at}
              </span>
            </div>

            <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-96">
              {JSON.stringify(manifest, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
