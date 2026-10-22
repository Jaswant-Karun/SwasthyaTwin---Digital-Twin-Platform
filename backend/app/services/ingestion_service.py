"""
SwasthyaTwin Common Validated Health Data Ingestion Service
The single, authoritative gateway for all health telemetry ingestion:
- Manual user entry
- CSV / file batch import
- Device & wearable streams
- Public research datasets
- Synthetic demonstration records

Guarantees:
1. Explicit unit conversion to canonical standard
2. Hard physiological rejection vs. Soft unusual confirmation
3. Inconsistent combinations & future timestamp prevention
4. Duplicate detection
5. Complete audit history & non-destructive correction
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from pymongo.database import Database

from app.models.observation import (
    ObservationCreate,
    ObservationBase,
    ObservationResponse
)
from app.analytics.unit_converter import convert_to_canonical_unit, UnitConversionError, CANONICAL_UNITS
from app.analytics.plausibility_checker import audit_observation_plausibility, PlausibilityCheckResult
from app.repositories.observation_repository import ObservationRepository
from app.repositories.audit_repository import AuditRepository
from app.services.assessment_service import AssessmentService

logger = logging.getLogger(__name__)

class IngestionService:
    """Centralized, validated ingestion coordinator for all biometric observation channels."""

    @staticmethod
    def ingest_single_observation(
        db: Database,
        patient_id: str,
        measurement_type: str,
        value: float,
        unit: str,
        observed_at: Optional[datetime] = None,
        source_type: str = "manual_entry",
        device_id: Optional[str] = None,
        notes: Optional[str] = None,
        confirm_unusual: bool = False,
        paired_measurements: Optional[Dict[str, float]] = None,
        user_id: str = "patient"
    ) -> Dict[str, Any]:
        """
        Ingests a single observation through the full data quality and plausibility audit pipeline.
        If an unusual value is detected and confirm_unusual=False, returns 'requires_confirmation'
        without saving or silently altering the measurement.
        """
        # 1. Verify patient exists
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{patient_id}' does not exist.")

        m_type = measurement_type.strip().lower()
        obs_time = observed_at or datetime.now(timezone.utc)
        if obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        # 2. Explicit Unit Conversion
        try:
            canon_val, canon_unit, was_converted, conversion_note = convert_to_canonical_unit(
                measurement_type=m_type,
                value=value,
                unit=unit
            )
        except UnitConversionError as ue:
            raise ValueError(f"Unit conversion error: {str(ue)}")

        # 3. Duplicate Detection (identical measurement timestamp and value)
        dup_query = {
            "patient_id": patient_id,
            "$or": [{"measurement_type": m_type}, {"metric_type": m_type}],
            "$or": [{"observed_at": obs_time}, {"timestamp": obs_time}],
            "value": canon_val
        }
        existing_dup = db.observations.find_one(dup_query)
        if existing_dup:
            existing_dup["id"] = existing_dup.get("observation_id")
            existing_dup["_id"] = str(existing_dup.get("_id", existing_dup["id"]))
            return {
                "status": "duplicate_retained",
                "message": f"Duplicate observation for '{m_type}' at {obs_time.isoformat()} with value {canon_val} {canon_unit} already recorded.",
                "observation": existing_dup,
                "twin_vitality_index": None,
                "validation_status": existing_dup.get("validation_status", "valid"),
                "warnings": ["Duplicate reading detected; retained existing record without duplicating telemetry."]
            }

        # 4. Plausibility & Consistency Audit
        audit = audit_observation_plausibility(
            measurement_type=m_type,
            value=canon_val,
            unit=canon_unit,
            observed_at=obs_time,
            confirmed_by_user=confirm_unusual,
            paired_measurements=paired_measurements
        )

        if not audit.is_technically_valid:
            # Hard rejection
            error_details = "; ".join(audit.errors)
            correction_hint = f" Did you mean {audit.suggested_correction} {canon_unit}?" if audit.suggested_correction else ""
            raise ValueError(f"Data quality rejection: {error_details}{correction_hint}")

        # If unusual value requires confirmation
        if audit.requires_confirmation:
            return {
                "status": "requires_confirmation",
                "message": "Unusual biometric measurement detected outside standard resting bounds.",
                "patient_id": patient_id,
                "measurement_type": m_type,
                "original_value": value,
                "original_unit": unit,
                "canonical_value": canon_val,
                "canonical_unit": canon_unit,
                "warnings": audit.warnings,
                "suggested_correction": audit.suggested_correction,
                "action_required": "Please verify this reading and resubmit with confirm_unusual=true to record."
            }

        # 5. Build Observation Record
        obs_id = f"obs_{uuid.uuid4().hex[:12]}"
        creation_now = datetime.now(timezone.utc)
        
        # Determine data_kind tag
        data_kind = "user_entered"
        if source_type in ["device_measurement", "wearable_continuous"]:
            data_kind = "measured"
        elif source_type in ["imported_file", "wearable_imported"]:
            data_kind = "wearable_imported"
        elif source_type in ["public_research_dataset"]:
            data_kind = "public_research_dataset"
        elif source_type in ["synthetic_demo"]:
            data_kind = "synthetic_demo"

        obs_doc = {
            "observation_id": obs_id,
            "patient_id": patient_id,
            "measurement_type": m_type,
            "metric_type": m_type,
            "value": canon_val,
            "unit": canon_unit,
            "original_value": value,
            "original_unit": unit,
            "was_unit_converted": was_converted,
            "conversion_note": conversion_note,
            "observed_at": obs_time,
            "timestamp": obs_time,
            "source": source_type,
            "source_type": source_type,
            "device_id": device_id,
            "data_kind": data_kind,
            "notes": notes,
            "validation_status": audit.validation_status,
            "validation_warnings": audit.warnings,
            "requires_confirmation": False,
            "confirmed_by_user": confirm_unusual,
            "edit_history": [],
            "demo_data": bool(patient.get("demo_data", False) or data_kind == "synthetic_demo"),
            "is_synthetic": bool(patient.get("is_synthetic", False) or data_kind == "synthetic_demo"),
            "metadata": {},
            "created_at": creation_now
        }

        # 6. Insert into MongoDB
        db.observations.insert_one(obs_doc)

        # 7. Audit Log
        AuditRepository.log_action(
            db=db,
            action="INGEST_OBSERVATION",
            entity_type="observation",
            entity_id=obs_id,
            patient_id=patient_id,
            details={
                "measurement_type": m_type,
                "value": canon_val,
                "unit": canon_unit,
                "source_type": source_type,
                "validation_status": audit.validation_status
            },
            user_id=user_id
        )

        # 8. Trigger real-time digital twin re-evaluation
        twin_state = None
        try:
            twin_state = AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
        except Exception as e:
            logger.warning(f"Error updating twin state following ingestion: {e}")

        obs_doc["_id"] = str(obs_doc.get("_id", ""))
        vitality_val = getattr(twin_state, "overall_vitality", getattr(twin_state, "vitality_index", None)) if twin_state else None
        return {
            "status": "success",
            "observation": obs_doc,
            "twin_vitality_index": vitality_val,
            "validation_status": audit.validation_status,
            "warnings": audit.warnings
        }


    @staticmethod
    def preview_and_validate_csv(
        db: Database,
        patient_id: str,
        raw_rows: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Parses and audits a batch of CSV rows before committing to the database.
        Returns detected columns, proposed unit conversions, valid rows,
        unusual rows requiring confirmation, and rejected rows with reasons.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        patient_exists = bool(patient)

        # Load existing signatures for duplicate detection
        existing_signatures = set()
        for doc in db.observations.find(
            {"patient_id": patient_id},
            {"measurement_type": 1, "observed_at": 1}
        ):
            m = doc.get("measurement_type")
            t = doc.get("observed_at")
            if m and t:
                t_str = t.isoformat()[:19] if hasattr(t, "isoformat") else str(t)[:19]
                existing_signatures.add((m, t_str))

        detected_columns = set()
        for r in raw_rows:
            detected_columns.update(r.keys())

        proposed_conversions = []
        validated_rows = []
        valid_count = 0
        unusual_count = 0
        rejected_count = 0
        duplicate_count = 0

        for idx, row in enumerate(raw_rows, start=1):
            errors = []
            warnings = []
            suggested_correction = None

            if not patient_exists:
                errors.append(f"Patient '{patient_id}' not found in database.")

            # Column variant detection (e.g. 'Heart Rate' -> 'heart_rate')
            raw_m_type = str(
                row.get("measurement_type") or row.get("metric_type") or
                row.get("metric") or row.get("biometric") or ""
            ).strip().lower().replace(" ", "_").replace("-", "_")

            if not raw_m_type:
                errors.append("Missing required 'measurement_type' column.")
            elif raw_m_type not in CANONICAL_UNITS:
                errors.append(f"Unsupported measurement_type '{raw_m_type}'. Supported: {list(CANONICAL_UNITS.keys())}")

            raw_val = row.get("value")
            val = None
            if raw_val is None or str(raw_val).strip() == "":
                errors.append("Missing required numeric 'value'.")
            else:
                try:
                    val = float(raw_val)
                except ValueError:
                    errors.append(f"Invalid non-numeric value '{raw_val}'.")

            raw_unit = str(row.get("unit") or "").strip()
            if not raw_unit:
                errors.append("Missing required 'unit' column.")

            # Timestamp check
            raw_time = row.get("observed_at") or row.get("timestamp") or row.get("date")
            parsed_time = None
            if not raw_time:
                errors.append("Missing required timestamp ('observed_at').")
            else:
                try:
                    time_str = str(raw_time).strip()
                    parsed_time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                    if parsed_time.tzinfo is None:
                        parsed_time = parsed_time.replace(tzinfo=timezone.utc)
                except Exception:
                    errors.append(f"Invalid timestamp format '{raw_time}'. Expected ISO-8601 (e.g. 2026-10-21T08:00:00Z).")

            # Duplicate check
            is_dup = False
            if parsed_time and raw_m_type:
                sig = (raw_m_type, parsed_time.isoformat()[:19])
                if sig in existing_signatures:
                    is_dup = True
                    duplicate_count += 1
                    errors.append("Duplicate: identical measurement and timestamp already exists.")

            # Unit conversion & Plausibility check
            canon_val = val
            canon_unit = raw_unit
            was_converted = False
            is_unusual = False
            requires_conf = False

            if not errors and val is not None and raw_m_type and raw_unit and parsed_time:
                try:
                    canon_val, canon_unit, was_converted, note = convert_to_canonical_unit(raw_m_type, val, raw_unit)
                    if was_converted:
                        proposed_conversions.append({
                            "row": idx,
                            "metric": raw_m_type,
                            "from_unit": raw_unit,
                            "to_unit": canon_unit,
                            "note": note
                        })
                except UnitConversionError as ue:
                    errors.append(str(ue))

                if not errors:
                    audit = audit_observation_plausibility(
                        measurement_type=raw_m_type,
                        value=canon_val,
                        unit=canon_unit,
                        observed_at=parsed_time,
                        confirmed_by_user=False
                    )
                    if not audit.is_technically_valid:
                        errors.extend(audit.errors)
                        suggested_correction = audit.suggested_correction
                    else:
                        warnings.extend(audit.warnings)
                        is_unusual = audit.is_unusual
                        requires_conf = audit.requires_confirmation

            is_valid = len(errors) == 0
            if is_valid:
                valid_count += 1
                if is_unusual:
                    unusual_count += 1
            else:
                rejected_count += 1

            validated_rows.append({
                "row_number": idx,
                "measurement_type": raw_m_type,
                "original_value": val,
                "original_unit": raw_unit,
                "canonical_value": canon_val,
                "canonical_unit": canon_unit,
                "observed_at": parsed_time.isoformat() if parsed_time else str(raw_time),
                "is_valid": is_valid,
                "is_unusual": is_unusual,
                "requires_confirmation": requires_conf,
                "is_duplicate": is_dup,
                "errors": errors,
                "warnings": warnings,
                "suggested_correction": suggested_correction
            })

        return {
            "total_rows": len(raw_rows),
            "valid_rows_count": valid_count,
            "invalid_rows_count": rejected_count,
            "unusual_rows_count": unusual_count,
            "rejected_rows_count": rejected_count,
            "duplicate_rows_count": duplicate_count,
            "detected_columns": sorted(list(detected_columns)),
            "proposed_unit_conversions": proposed_conversions,
            "rows_preview": validated_rows[:15],
            "all_rows": validated_rows,
            "can_import": valid_count > 0
        }

    @staticmethod
    def commit_csv_import(
        db: Database,
        patient_id: str,
        validated_rows: List[Dict[str, Any]],
        confirm_unusual_all: bool = False,
        user_id: str = "patient"
    ) -> Dict[str, Any]:
        """
        Commits validated CSV rows into MongoDB with full audit tracking.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{patient_id}' does not exist.")

        inserted_count = 0
        skipped_count = 0
        created_ids = []
        now_utc = datetime.now(timezone.utc)

        for row in validated_rows:
            if not row.get("is_valid"):
                skipped_count += 1
                continue

            if row.get("requires_confirmation") and not confirm_unusual_all:
                skipped_count += 1
                continue

            obs_id = f"obs_{uuid.uuid4().hex[:12]}"
            obs_time = datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00"))
            m_type = row["measurement_type"]
            canon_val = float(row["canonical_value"])
            canon_unit = row["canonical_unit"]

            status = "confirmed_unusual" if row.get("is_unusual") else "valid"

            doc = {
                "observation_id": obs_id,
                "patient_id": patient_id,
                "measurement_type": m_type,
                "metric_type": m_type,
                "value": canon_val,
                "unit": canon_unit,
                "original_value": row.get("original_value", canon_val),
                "original_unit": row.get("original_unit", canon_unit),
                "observed_at": obs_time,
                "timestamp": obs_time,
                "source": "imported_file",
                "source_type": "imported_file",
                "data_kind": "wearable_imported",
                "validation_status": status,
                "validation_warnings": row.get("warnings", []),
                "requires_confirmation": False,
                "confirmed_by_user": confirm_unusual_all or not row.get("is_unusual"),
                "edit_history": [],
                "demo_data": bool(patient.get("demo_data", False)),
                "is_synthetic": bool(patient.get("is_synthetic", False)),
                "metadata": {"import_batch": f"csv_import_{now_utc.strftime('%Y%m%d_%H%M%S')}"},
                "created_at": now_utc
            }
            db.observations.insert_one(doc)
            created_ids.append(obs_id)
            inserted_count += 1

        AuditRepository.log_action(
            db=db,
            action="CSV_BATCH_IMPORT",
            entity_type="observation",
            entity_id=f"batch_{len(created_ids)}",
            patient_id=patient_id,
            details={
                "imported_count": inserted_count,
                "skipped_count": skipped_count
            },
            user_id=user_id
        )

        try:
            AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
        except Exception as e:
            logger.warning(f"Error evaluating twin state post CSV import: {e}")

        return {
            "status": "success",
            "imported_count": inserted_count,
            "skipped_count": skipped_count,
            "created_observation_ids": created_ids
        }

    @staticmethod
    def edit_observation(
        db: Database,
        patient_id: str,
        observation_id: str,
        new_value: Optional[float] = None,
        new_unit: Optional[str] = None,
        new_observed_at: Optional[datetime] = None,
        new_notes: Optional[str] = None,
        edit_reason: str = "Patient correction",
        edited_by: str = "patient"
    ) -> Dict[str, Any]:
        """
        Updates an existing observation with complete, immutable audit trail.
        Never silently overwrites past measurements.
        """
        existing = db.observations.find_one({
            "observation_id": observation_id,
            "patient_id": patient_id
        })
        if not existing:
            raise ValueError(f"Observation '{observation_id}' for patient '{patient_id}' not found.")

        m_type = existing["measurement_type"]
        val = new_value if new_value is not None else existing["value"]
        unit = new_unit if new_unit is not None else existing["unit"]
        obs_time = new_observed_at if new_observed_at is not None else existing["observed_at"]

        # Validate & convert updated values
        canon_val, canon_unit, _, _ = convert_to_canonical_unit(m_type, val, unit)
        audit = audit_observation_plausibility(m_type, canon_val, canon_unit, obs_time, confirmed_by_user=True)
        if not audit.is_technically_valid:
            raise ValueError(f"Invalid updated measurement: {'; '.join(audit.errors)}")

        edit_entry = {
            "edited_at": datetime.now(timezone.utc),
            "previous_value": existing["value"],
            "previous_unit": existing["unit"],
            "previous_observed_at": existing["observed_at"],
            "new_value": canon_val,
            "new_unit": canon_unit,
            "reason": edit_reason,
            "edited_by": edited_by
        }

        update_fields = {
            "value": canon_val,
            "unit": canon_unit,
            "observed_at": obs_time,
            "timestamp": obs_time,
            "validation_status": audit.validation_status,
            "validation_warnings": audit.warnings
        }
        if new_notes is not None:
            update_fields["notes"] = new_notes

        db.observations.update_one(
            {"observation_id": observation_id},
            {
                "$set": update_fields,
                "$push": {"edit_history": edit_entry}
            }
        )

        AuditRepository.log_action(
            db=db,
            action="correct_observation",
            entity_type="observation",
            entity_id=observation_id,
            patient_id=patient_id,
            details={
                "previous_value": existing["value"],
                "new_value": canon_val,
                "reason": edit_reason
            },
            user_id=edited_by
        )


        try:
            AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
        except Exception:
            pass

        updated = db.observations.find_one({"observation_id": observation_id})
        updated["_id"] = str(updated.get("_id", ""))
        return updated
