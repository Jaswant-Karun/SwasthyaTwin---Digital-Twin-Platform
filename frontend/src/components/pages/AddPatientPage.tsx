import React, { useState } from 'react';
import { useTwin } from '../../context/TwinContext';
import { Patient, PatientCreateInput, BiologicalSex } from '../../types';
import {
  UserPlus,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  Users,
  Eye,
  Info,
  X,
  HeartPulse,
  Clock,
  Sparkles
} from 'lucide-react';

interface AddPatientPageProps {
  onNavigate?: (tab: string) => void;
}

export const AddPatientPage: React.FC<AddPatientPageProps> = ({ onNavigate }) => {
  const {
    patients,
    currentPatient,
    setCurrentPatientId,
    createPatient,
    deletePatient,
    updatePatientProfile
  } = useTwin();

  // Form state
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<string>('');
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>('male');
  const [baselineWindowDays, setBaselineWindowDays] = useState<number>(30);
  const [conditionsText, setConditionsText] = useState('');
  const [primaryPhysician, setPrimaryPhysician] = useState('');
  const [sleepHours, setSleepHours] = useState<number>(7.5);
  const [dailySteps, setDailySteps] = useState<number>(6500);
  const [activityLevel, setActivityLevel] = useState<string>('moderate');
  const [notes, setNotes] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // Submitting & status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<Patient | null>(null);

  // Edit Patient Modal State
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editConditions, setEditConditions] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Patient Modal State
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [cascadeDelete, setCascadeDelete] = useState(true);
  const [isDeletingSubmitting, setIsDeletingSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const resetForm = () => {
    setFullName('');
    setAge('');
    setBiologicalSex('male');
    setBaselineWindowDays(30);
    setConditionsText('');
    setPrimaryPhysician('');
    setSleepHours(7.5);
    setDailySteps(6500);
    setActivityLevel('moderate');
    setNotes('');
    setConsentConfirmed(false);
    setFormError(null);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatedResult(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFormError('Display name or pseudonym is required.');
      return;
    }

    let parsedAge: number | undefined = undefined;
    if (age.trim()) {
      const num = Number(age);
      if (isNaN(num) || num < 1 || num > 125) {
        setFormError('Age must be a valid number between 1 and 125 years.');
        return;
      }
      parsedAge = Math.round(num);
    }

    if (!consentConfirmed) {
      setFormError('Consent and authorization confirmation is required to create a patient profile.');
      return;
    }

    const chronicConditions = conditionsText
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const inputData: PatientCreateInput = {
      full_name: trimmedName,
      age: parsedAge,
      biological_sex: biologicalSex,
      baseline_window_days: baselineWindowDays,
      chronic_conditions: chronicConditions,
      primary_physician: primaryPhysician.trim() || undefined,
      lifestyle_profile: {
        baseline_sleep_hours: sleepHours,
        baseline_daily_steps: dailySteps,
        activity_level: activityLevel
      },
      notes: notes.trim() || undefined,
      consent_confirmed: true
    };

    setIsSubmitting(true);
    try {
      const newPatient = await createPatient(inputData);
      setCreatedResult(newPatient);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save patient profile to MongoDB.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setEditFullName(patient.full_name);
    setEditAge(patient.age ? String(patient.age) : '');
    setEditConditions(patient.chronic_conditions?.join(', ') || '');
    setEditNotes(patient.notes || '');
    setEditError(null);
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setEditError(null);

    const trimmedName = editFullName.trim();
    if (!trimmedName) {
      setEditError('Display name or pseudonym is required.');
      return;
    }

    let parsedAge = editingPatient.age;
    if (editAge.trim()) {
      const num = Number(editAge);
      if (isNaN(num) || num < 1 || num > 125) {
        setEditError('Age must be between 1 and 125.');
        return;
      }
      parsedAge = Math.round(num);
    }

    const chronicConditions = editConditions
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    setIsEditingSubmitting(true);
    try {
      await updatePatientProfile(editingPatient.patient_id, {
        full_name: trimmedName,
        age: parsedAge,
        chronic_conditions: chronicConditions,
        notes: editNotes.trim() || undefined
      });
      setEditingPatient(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update patient profile.');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const openDeleteModal = (patient: Patient) => {
    setDeletingPatient(patient);
    setDeleteConfirmationText('');
    setCascadeDelete(true);
    setDeleteError(null);
  };

  const handleDeletePatient = async () => {
    if (!deletingPatient) return;
    if (deleteConfirmationText.trim().toLowerCase() !== deletingPatient.patient_id.toLowerCase()) {
      setDeleteError(`Please type "${deletingPatient.patient_id}" to confirm deletion.`);
      return;
    }

    setIsDeletingSubmitting(true);
    setDeleteError(null);
    try {
      await deletePatient(deletingPatient.patient_id, cascadeDelete);
      setDeletingPatient(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to safely delete patient record.');
    } finally {
      setIsDeletingSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
              <UserPlus className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Add Patient
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Register a new patient profile or pseudonym. All profiles are stored directly in MongoDB and immediately available for digital twin modeling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Active Cohort: {patients.length} Patients
          </span>
        </div>
      </div>

      {/* 2. Success Banner */}
      {createdResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">
                Patient Successfully Saved to MongoDB!
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Profile for <strong className="font-semibold">{createdResult.full_name}</strong> created with Backend ID:{' '}
                <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">
                  {createdResult.patient_id}
                </span>. It is now active in the patient selector.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setCurrentPatientId(createdResult.patient_id);
                if (onNavigate) onNavigate('add-observation');
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Add Observation
            </button>
            <button
              onClick={() => {
                setCurrentPatientId(createdResult.patient_id);
                if (onNavigate) onNavigate('digital-twin');
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-xs transition-colors"
            >
              View Twin
            </button>
            <button
              onClick={() => setCreatedResult(null)}
              className="p-1.5 text-emerald-700 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs font-medium">{formError}</div>
        </div>
      )}

      {/* 4. Onboarding Form */}
      <form onSubmit={handleCreatePatient} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            Patient Profile Information
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Backend automatically assigns a unique patient ID (e.g. PT-1006). Real profiles are never replaced by synthetic data.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Row 1: Name & Age & Sex */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Display Name or Pseudonym <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Alex M. or Runner42"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Use a pseudonym if preferred for privacy.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Age (years) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                min="1"
                max="125"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 48"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Used in physiological baseline norms.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Biological Sex
              </label>
              <select
                value={biologicalSex}
                onChange={e => setBiologicalSex(e.target.value as BiologicalSex)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 outline-hidden bg-white transition-all"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Not Disclosed</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                For demographic reference baselines.
              </span>
            </div>
          </div>

          {/* Row 2: Baseline window, conditions & physician */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Baseline Window (Days)
              </label>
              <input
                type="number"
                min="7"
                max="180"
                value={baselineWindowDays}
                onChange={e => setBaselineWindowDays(Math.max(7, Math.min(180, Number(e.target.value) || 30)))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 outline-hidden transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Rolling historical window (default 30 days).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chronic Conditions <span className="text-slate-400 font-normal">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={conditionsText}
                onChange={e => setConditionsText(e.target.value)}
                placeholder="e.g. Hypertension, Pre-diabetes"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Informs risk evaluation algorithms.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Primary Physician / Clinic <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={primaryPhysician}
                onChange={e => setPrimaryPhysician(e.target.value)}
                placeholder="e.g. Dr. Priya Rao"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Clinical lead or surveillance source.
              </span>
            </div>
          </div>

          {/* Row 3: Initial Lifestyle Baseline Values */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              Default Lifestyle Baseline Context
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Expected Daily Sleep (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="14"
                  value={sleepHours}
                  onChange={e => setSleepHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Expected Daily Steps
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  max="40000"
                  value={dailySteps}
                  onChange={e => setDailySteps(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  General Activity Level
                </label>
                <select
                  value={activityLevel}
                  onChange={e => setActivityLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  <option value="sedentary">Sedentary (&lt; 5,000 steps)</option>
                  <option value="light">Light Activity (5,000 - 7,500 steps)</option>
                  <option value="moderate">Moderate Activity (7,500 - 10,000 steps)</option>
                  <option value="active">High Activity (&gt; 10,000 steps)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 4: Privacy Warning & Notes */}
          <div className="space-y-2">
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Privacy Protection Warning:</strong>
                <span className="text-amber-800 ml-1">
                  Do <strong>NOT</strong> enter unnecessary sensitive personal information such as government identity numbers (SSN, PAN, Aadhaar), full residential address, bank accounts, or phone numbers. Only non-identifying clinical and lifestyle observations are processed by SwasthyaTwin.
                </span>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Clinical & Contextual Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Patient is training for a 10k road race; reporting morning fatigue when sleep is below 6.5h."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
            />
          </div>

          {/* Row 5: Consent Confirmation */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={e => setConsentConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="text-slate-900 font-semibold">Consent & Authorization Confirmation:</strong> I confirm patient authorization to ingest, persist in MongoDB, and simulate physiological deviations using the SwasthyaTwin engine.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Clear Form
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold shadow-xs transition-colors"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Persisting to MongoDB...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Save Patient Profile</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 5. Patient Directory & Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Patient Cohort Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select, inspect, edit, or delete registered patient records stored in MongoDB.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Active: <strong className="text-teal-600">{currentPatient?.patient_id}</strong> ({currentPatient?.full_name})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="px-5 py-3">Patient ID</th>
                <th className="px-5 py-3">Name / Pseudonym</th>
                <th className="px-5 py-3">Demographics</th>
                <th className="px-5 py-3">Conditions</th>
                <th className="px-5 py-3">Observations</th>
                <th className="px-5 py-3">Stability Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No patients currently registered in MongoDB. Add one above!
                  </td>
                </tr>
              ) : (
                patients.map(p => {
                  const isCurrent = currentPatient?.patient_id === p.patient_id;
                  return (
                    <tr
                      key={p.patient_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="w-2 h-2 rounded-full bg-teal-500" title="Active Patient" />
                          )}
                          <span>{p.patient_id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {p.full_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {p.age ? `${p.age}y` : 'Age N/A'} • {p.biological_sex}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.chronic_conditions && p.chronic_conditions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.chronic_conditions.map((c, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {p.total_observations_count ?? 0}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.stability_status === 'optimal'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.stability_status === 'mild_deviation'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {p.stability_status ? p.stability_status.replace('_', ' ') : 'stable'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => {
                            setCurrentPatientId(p.patient_id);
                            if (onNavigate) onNavigate('digital-twin');
                          }}
                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-semibold border border-teal-200 transition-colors"
                          title="View Digital Twin"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(p)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Profile: {editingPatient.patient_id}
                </h3>
              </div>
              <button
                onClick={() => setEditingPatient(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePatient} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name / Pseudonym
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={editAge}
                  onChange={e => setEditAge(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chronic Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  value={editConditions}
                  onChange={e => setEditConditions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditingSubmitting}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {isEditingSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Safe Delete Confirmation Modal */}
      {deletingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-rose-100 bg-rose-50 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <h3 className="text-sm font-bold text-rose-900">
                Confirm Safe Patient Deletion
              </h3>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                You are about to permanently delete patient profile{' '}
                <strong className="text-slate-900">{deletingPatient.full_name}</strong> (
                <span className="font-mono font-bold text-rose-700">{deletingPatient.patient_id}</span>
                ) from MongoDB.
              </p>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cascadeDelete}
                  onChange={e => setCascadeDelete(e.target.checked)}
                  className="rounded text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <span>Also cascade delete all associated observations, alerts, and simulation snapshots</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type <span className="font-mono font-bold text-rose-700">{deletingPatient.patient_id}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={e => setDeleteConfirmationText(e.target.value)}
                  placeholder={deletingPatient.patient_id}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingPatient(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePatient}
                  disabled={isDeletingSubmitting || deleteConfirmationText.trim().toLowerCase() !== deletingPatient.patient_id.toLowerCase()}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold"
                >
                  {isDeletingSubmitting ? 'Deleting...' : 'Delete Patient Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
