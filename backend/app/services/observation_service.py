import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pymongo.database import Database
from app.models.observation import ObservationCreate, ObservationBase
from app.repositories.observation_repository import ObservationRepository
from app.repositories.audit_repository import AuditRepository

logger = logging.getLogger(__name__)

class ObservationService:
    @staticmethod
    def query_observations(
        db: Database,
        patient_id: str,
        metric_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        data_tier: Optional[str] = None,
        skip: int = 0,
        limit: int = 200
    ) -> Dict[str, Any]:
        repo = ObservationRepository(db)
        items, total = repo.list_observations(
            patient_id=patient_id,
            measurement_type=metric_type,
            start_date=start_date,
            end_date=end_date,
            data_kind=data_tier,
            skip=skip,
            limit=limit
        )

        # Ensure id and compatibility fields are present for UI and tests
        for item in items:
            item["id"] = item.get("observation_id", f"obs_{str(item.get('patient_id', ''))}")
            item["_id"] = item["id"]

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "items": items
        }

    @staticmethod
    def add_observation(db: Database, obs_in: ObservationCreate) -> Dict[str, Any]:
        # Validate patient exists
        patient = db.patients.find_one({"patient_id": obs_in.patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{obs_in.patient_id}' does not exist.")

        repo = ObservationRepository(db)
        base_obs = obs_in.to_observation_base()
        doc = base_obs.model_dump()

        # Add compatibility fields
        doc["metric_type"] = base_obs.measurement_type
        doc["timestamp"] = base_obs.observed_at
        doc["data_tier"] = "user_reported" if base_obs.data_kind == "user_entered" else base_obs.data_kind

        created = repo.create(doc)
        created["id"] = created.get("observation_id")
        created["_id"] = created["id"]

        # Audit logging (non-sensitive)
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
                "source": base_obs.source
            }
        })

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
