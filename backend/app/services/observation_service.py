import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pymongo.database import Database
from app.models.observation import (
    ObservationCreate,
    ObservationBase,
    BaselineSummary,
    DeviationSummary,
    AssessmentUpdateMetadata
)
from app.repositories.observation_repository import ObservationRepository
from app.repositories.audit_repository import AuditRepository
from app.services.assessment_service import AssessmentService
from app.analytics.deviation_analyzer import is_relative_deviation_meaningful
from app.core.config import settings

logger = logging.getLogger(__name__)

class ObservationService:
    @staticmethod
    def _build_assessment_update(
        db: Database,
        patient: Dict[str, Any],
        obs: ObservationBase,
        twin_state: Any,
        prev_base: Optional[Dict[str, Any]] = None,
        prev_vitality: Optional[float] = None,
        is_first_obs: bool = False,
        is_duplicate: bool = False
    ) -> Dict[str, Any]:
        m_type = obs.measurement_type
        new_base = twin_state.baselines.get(m_type) if twin_state and twin_state.baselines else None
        new_dev = twin_state.metrics.get(m_type) if twin_state and twin_state.metrics else None

        # Build updated baseline summary
        updated_base_dict = None
        if new_base:
            updated_base_dict = {
                "mean": round(float(new_base.mean), 2),
                "median": round(float(new_base.median), 2),
                "std_dev": round(float(new_base.std_dev), 2),
                "iqr": round(float(new_base.iqr), 2),
                "sample_count": int(new_base.sample_count),
                "window_days": int(new_base.window_days),
                "is_sufficient": bool(new_base.is_sufficient),
                "unit": new_base.unit or obs.unit
            }

        # Build previous baseline summary
        prev_base_dict = None
        if prev_base:
            prev_base_dict = {
                "mean": round(float(prev_base.get("mean", 0.0)), 2),
                "median": round(float(prev_base.get("median", 0.0)), 2),
                "std_dev": round(float(prev_base.get("std_dev", 1.0)), 2),
                "iqr": round(float(prev_base.get("iqr", 0.0)), 2),
                "sample_count": int(prev_base.get("sample_count", 0)),
                "window_days": int(prev_base.get("window_days", 30)),
                "is_sufficient": bool(prev_base.get("is_sufficient", False)),
                "unit": prev_base.get("unit") or obs.unit
            }

        # Build deviation summary
        deviation_dict = None
        if new_dev:
            meaningful, excl_reason = is_relative_deviation_meaningful(m_type, new_dev.baseline_mean)
            deviation_dict = {
                "delta_absolute": round(float(new_dev.delta_absolute), 2),
                "delta_percentage": round(float(new_dev.delta_percentage), 1),
                "z_score": round(float(new_dev.z_score), 2),
                "status": new_dev.status,
                "direction": new_dev.direction,
                "relative_is_excluded": not meaningful,
                "exclusion_reason": excl_reason
            }

        # Build sufficiency message
        min_obs = settings.MIN_OBSERVATIONS_FOR_BASELINE
        if is_first_obs:
            sufficiency_msg = (
                f"First observation recorded for {m_type.replace('_', ' ')}. "
                f"More historical observations (minimum {min_obs}) are needed to establish a reliable personal baseline."
            )
        elif new_base and not new_base.is_sufficient:
            sufficiency_msg = (
                f"Personal baseline is provisional ({new_base.sample_count} of {min_obs} required observations). "
                f"Statistical deviations and alert thresholds remain conservative."
            )
        else:
            sufficiency_msg = None

        # Check for active alert for this metric
        alert_doc = db.alerts.find_one({
            "patient_id": obs.patient_id,
            "metric_type": m_type,
            "is_acknowledged": False
        }, sort=[("timestamp", -1)])
        triggered_alert_dict = None
        if alert_doc:
            triggered_alert_dict = {
                "alert_id": alert_doc.get("alert_id") or alert_doc.get("id"),
                "severity": alert_doc.get("severity"),
                "title": alert_doc.get("title"),
                "description": alert_doc.get("description"),
                "suggested_action": alert_doc.get("suggested_action")
            }

        # Explanation of what changed
        m_label = m_type.replace('_', ' ').title()
        vit_now = round(float(twin_state.overall_vitality), 1) if twin_state else 85.0
        vit_prev_str = f" (previously {round(float(prev_vitality), 1)})" if prev_vitality is not None else ""
        status_now = twin_state.stability_status if twin_state else "optimal"

        if is_duplicate:
            explanation = (
                f"Duplicate reading detected for {m_label} at {obs.value} {obs.unit}. "
                f"Existing database entry preserved without generating duplicate historical artifacts."
            )
        elif is_first_obs:
            explanation = (
                f"First measurement for {m_label} saved in MongoDB ({obs.value} {obs.unit}). "
                f"Digital Twin initialized tracking for this metric; personal baseline corridor will form after {min_obs} readings."
            )
        else:
            prev_str = f"{prev_base_dict['median']} {obs.unit}" if prev_base_dict and prev_base_dict.get('is_sufficient') else "None (Sparse)"
            new_str = f"{new_base.median} {obs.unit}" if new_base and new_base.is_sufficient else f"{new_base.median} {obs.unit} (Provisional)" if new_base else f"{obs.value} {obs.unit}"
            dev_str = f"Δ: {new_dev.delta_absolute:+g} {obs.unit} (z={new_dev.z_score:+.1f})" if new_dev else "aligned"
            explanation = (
                f"{m_label} updated to {obs.value} {obs.unit} ({dev_str}). "
                f"Baseline: {prev_str} → {new_str} across {new_base.sample_count if new_base else 1} observations. "
                f"Autonomic Vitality Index: {vit_now}{vit_prev_str} ({status_now.replace('_', ' ')})."
            )

        return {
            "patient_id": obs.patient_id,
            "metric_type": m_type,
            "observed_value": obs.value,
            "unit": obs.unit,
            "observed_at": obs.observed_at,
            "is_first_observation": is_first_obs,
            "sufficiency_message": sufficiency_msg,
            "previous_baseline": prev_base_dict,
            "updated_baseline": updated_base_dict,
            "deviation": deviation_dict,
            "vitality_index": vit_now,
            "previous_vitality_index": round(float(prev_vitality), 1) if prev_vitality is not None else None,
            "stability_status": status_now,
            "triggered_alert": triggered_alert_dict,
            "explanation": explanation
        }

    @staticmethod
    def add_observation(db: Database, obs_in: ObservationCreate) -> Dict[str, Any]:
        # 1. Validate patient exists
        patient = db.patients.find_one({"patient_id": obs_in.patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{obs_in.patient_id}' does not exist.")

        repo = ObservationRepository(db)
        base_obs = obs_in.to_observation_base()

        # Timezone-aware handling
        now_utc = datetime.now(timezone.utc)
        obs_time = base_obs.observed_at
        if obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)
            base_obs.observed_at = obs_time

        # Reject timestamps in future beyond 5 minutes clock skew
        if obs_time > now_utc + timedelta(minutes=5):
            raise ValueError("Observation timestamp cannot be in the future.")

        # Check for duplicate submission safely
        m_type = base_obs.measurement_type
        existing_dup = db.observations.find_one({
            "patient_id": base_obs.patient_id,
            "$or": [{"measurement_type": m_type}, {"metric_type": m_type}],
            "$or": [{"observed_at": obs_time}, {"timestamp": obs_time}],
            "value": base_obs.value,
            "unit": base_obs.unit
        })
        if existing_dup:
            existing_dup["id"] = existing_dup.get("observation_id")
            existing_dup["_id"] = existing_dup["id"]
            twin_state = AssessmentService.evaluate_twin_state(db=db, patient_id=base_obs.patient_id)
            existing_dup["assessment_update"] = ObservationService._build_assessment_update(
                db=db,
                patient=patient,
                obs=base_obs,
                twin_state=twin_state,
                is_duplicate=True
            )
            return existing_dup

        # 3. Retrieve prior baseline before adding new observation
        window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS)
        prev_baselines = AssessmentService.get_patient_baselines(db, patient_id=base_obs.patient_id, window_days=window_days)
        prev_base = prev_baselines.get(m_type)
        prev_asmt = db.health_assessments.find_one({"patient_id": base_obs.patient_id}, sort=[("assessed_at", -1)])
        prev_vitality = prev_asmt.get("vitality_index") if prev_asmt else None

        # Check if first observation for this measurement type
        prev_obs_count = db.observations.count_documents({
            "patient_id": base_obs.patient_id,
            "$or": [{"measurement_type": m_type}, {"metric_type": m_type}],
            "data_kind": {"$ne": "simulated"},
            "data_tier": {"$ne": "simulated"}
        })
        is_first_obs = (prev_obs_count == 0)

        # 2. Persist observation in MongoDB
        doc = base_obs.model_dump()
        doc["metric_type"] = base_obs.measurement_type
        doc["timestamp"] = base_obs.observed_at
        doc["data_tier"] = "user_reported" if base_obs.data_kind == "user_entered" else base_obs.data_kind

        created = repo.create(doc)
        created["id"] = created.get("observation_id")
        created["_id"] = created["id"]

        # Increment patient's observation count
        db.patients.update_one(
            {"patient_id": base_obs.patient_id},
            {
                "$inc": {"total_observations_count": 1},
                "$set": {"updated_at": now_utc}
            }
        )

        # 7. Preserve provenance via audit logging (non-sensitive)
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "create_observation",
            "resource_type": "observation",
            "resource_id": created["id"],
            "patient_id": base_obs.patient_id,
            "actor": "api_client",
            "details": {
                "measurement_type": base_obs.measurement_type,
                "value": base_obs.value,
                "unit": base_obs.unit,
                "data_kind": base_obs.data_kind,
                "source": base_obs.source,
                "observed_at": base_obs.observed_at.isoformat()
            }
        })

        # 4, 5, 6. Recalculate patient baseline, deviations, trend assessments
        twin_state = AssessmentService.evaluate_twin_state(db=db, patient_id=base_obs.patient_id)

        # 8. Return saved observation and updated assessment metadata
        created["assessment_update"] = ObservationService._build_assessment_update(
            db=db,
            patient=patient,
            obs=base_obs,
            twin_state=twin_state,
            prev_base=prev_base,
            prev_vitality=prev_vitality,
            is_first_obs=is_first_obs
        )

        return created

    @staticmethod
    def batch_add_observations(db: Database, observations: List[ObservationCreate]) -> int:
        if not observations:
            return 0
            
        pids = set(o.patient_id for o in observations)
        for pid in pids:
            if not db.patients.find_one({"patient_id": pid}):
                raise ValueError(f"Patient with ID '{pid}' does not exist.")

        repo = ObservationRepository(db)
        docs = []
        for obs in observations:
            base_obs = obs.to_observation_base()
            d = base_obs.model_dump()
            d["metric_type"] = base_obs.measurement_type
            d["timestamp"] = base_obs.observed_at
            d["data_tier"] = "user_reported" if base_obs.data_kind == "user_entered" else base_obs.data_kind
            docs.append(d)

        count = repo.create_batch(docs)
        return count

    @staticmethod
    def update_observation(
        db: Database,
        patient_id: str,
        observation_id: str,
        val: Optional[float] = None,
        unit: Optional[str] = None,
        observed_at: Optional[datetime] = None,
        notes: Optional[str] = None,
        correction_reason: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        repo = ObservationRepository(db)
        existing = repo.get_by_id(observation_id)
        if not existing or existing.get("patient_id") != patient_id:
            return None

        update_dict: Dict[str, Any] = {}
        target_type = existing.get("measurement_type") or existing.get("metric_type")
        target_val = val if val is not None else existing.get("value")
        target_unit = unit if unit is not None else existing.get("unit")

        if val is not None or unit is not None:
            from app.models.observation import validate_and_normalize_measurement
            normalized_val, normalized_unit = validate_and_normalize_measurement(target_type, target_val, target_unit)
            update_dict["value"] = normalized_val
            update_dict["unit"] = normalized_unit

        if observed_at is not None:
            update_dict["observed_at"] = observed_at
            update_dict["timestamp"] = observed_at

        if notes is not None:
            update_dict["notes"] = notes

        if not update_dict:
            return existing

        updated = repo.update(observation_id, update_dict)
        if updated:
            updated["id"] = updated.get("observation_id")
            updated["_id"] = updated["id"]

        # Audit logging with correction reason
        audit_repo = AuditRepository(db)
        audit_repo.record_event({
            "action": "correct_observation",
            "resource_type": "observation",
            "resource_id": observation_id,
            "patient_id": patient_id,
            "actor": "api_client",
            "details": {
                "correction_reason": correction_reason or "Manual correction by user",
                "previous_value": existing.get("value"),
                "new_value": updated.get("value") if updated else None,
                "measurement_type": target_type
            }
        })

        return updated

    @staticmethod
    def delete_observation(db: Database, patient_id: str, observation_id: str) -> bool:
        repo = ObservationRepository(db)
        existing = repo.get_by_id(observation_id)
        if not existing or existing.get("patient_id") != patient_id:
            return False

        deleted = repo.delete_one(observation_id)
        if deleted:
            audit_repo = AuditRepository(db)
            audit_repo.record_event({
                "action": "delete_observation",
                "resource_type": "observation",
                "resource_id": observation_id,
                "patient_id": patient_id,
                "actor": "api_client",
                "details": {
                    "measurement_type": existing.get("measurement_type"),
                    "value": existing.get("value"),
                    "unit": existing.get("unit")
                }
            })
        return deleted

    @staticmethod
    def validate_csv_rows(db: Database, patient_id: str, raw_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate an array of raw CSV rows against schema, physiological bounds, and duplicate check."""
        from app.models.observation import validate_and_normalize_measurement, VALID_UNITS
        
        patient_exists = bool(db.patients.find_one({"patient_id": patient_id}))
        
        # Load existing observation timestamps for this patient to detect duplicates
        existing_signatures = set()
        for doc in db.observations.find({"patient_id": patient_id}, {"measurement_type": 1, "metric_type": 1, "observed_at": 1, "timestamp": 1}):
            m = doc.get("measurement_type") or doc.get("metric_type")
            t = doc.get("observed_at") or doc.get("timestamp")
            if m and t:
                t_str = t.isoformat() if hasattr(t, "isoformat") else str(t)
                existing_signatures.add((m, t_str[:19]))

        validated_rows = []
        valid_count = 0
        invalid_count = 0
        duplicate_count = 0

        for idx, row in enumerate(raw_rows, start=1):
            errors = []
            if not patient_exists:
                errors.append(f"Patient '{patient_id}' does not exist in SwasthyaTwin database.")

            m_type = str(row.get("measurement_type") or row.get("metric_type") or "").strip().lower()
            if not m_type:
                errors.append("Missing required column 'measurement_type'.")
            elif m_type not in VALID_UNITS:
                errors.append(f"Unsupported measurement_type '{m_type}'. Supported: {list(VALID_UNITS.keys())}")

            raw_val = row.get("value")
            val: Optional[float] = None
            if raw_val is None or str(raw_val).strip() == "":
                errors.append("Missing required numeric 'value'.")
            else:
                try:
                    val = float(raw_val)
                except ValueError:
                    errors.append(f"Value '{raw_val}' must be a valid number.")

            unit = str(row.get("unit") or "").strip()
            if not unit:
                errors.append("Missing required 'unit'.")

            # Timestamp check
            raw_time = row.get("observed_at") or row.get("timestamp")
            parsed_time = None
            time_str = ""
            if not raw_time:
                errors.append("Missing required 'observed_at' ISO timestamp.")
            else:
                try:
                    time_str = str(raw_time).strip()
                    parsed_time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                except Exception:
                    errors.append(f"Invalid timestamp format '{raw_time}'. Expected ISO 8601 (e.g. 2026-10-21T08:00:00Z).")

            # Validate physiological ranges & unit conversions if basic types pass
            if val is not None and m_type in VALID_UNITS and unit:
                try:
                    val, unit = validate_and_normalize_measurement(m_type, val, unit)
                except ValueError as ve:
                    errors.append(str(ve))

            # Duplicate check
            is_dup = False
            if parsed_time and m_type:
                sig = (m_type, parsed_time.isoformat()[:19])
                if sig in existing_signatures:
                    is_dup = True
                    duplicate_count += 1
                    errors.append("Duplicate record: an identical measurement and timestamp already exists.")

            is_valid = len(errors) == 0
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            validated_rows.append({
                "row_number": idx,
                "patient_id": patient_id,
                "measurement_type": m_type,
                "value": val,
                "unit": unit,
                "observed_at": parsed_time.isoformat() if parsed_time else time_str,
                "source": str(row.get("source") or "wearable_imported"),
                "data_kind": str(row.get("data_kind") or "wearable_imported"),
                "notes": str(row.get("notes") or "").strip() or None,
                "is_valid": is_valid,
                "errors": errors,
                "is_duplicate": is_dup
            })

        return {
            "total_rows": len(raw_rows),
            "valid_rows_count": valid_count,
            "invalid_rows_count": invalid_count,
            "duplicate_rows_count": duplicate_count,
            "rows": validated_rows,
            "can_import": valid_count > 0
        }
