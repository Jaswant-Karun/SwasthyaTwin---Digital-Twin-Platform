"""
Unit Tests for Security, Authentication, and Patient Isolation
"""

import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.core.security import get_current_actor, SecurityContext, require_patient_access
from app.core.config import settings

@pytest.mark.asyncio
async def test_demo_mode_allows_open_access():
    with patch.object(settings, "DEMO_MODE", True), patch.object(settings, "API_SECRET_KEY", None):
        actor = await get_current_actor(authorization=None, x_api_key=None)
        assert actor.is_demo_actor is True
        assert actor.role == "researcher"
        assert actor.can_access_patient("PT-1001") is True

@pytest.mark.asyncio
async def test_secret_configured_rejects_missing_credentials():
    with patch.object(settings, "API_SECRET_KEY", "super-secure-production-key"):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_actor(authorization=None, x_api_key=None)
        assert exc_info.value.status_code == 401
        assert "Missing authentication" in exc_info.value.detail

@pytest.mark.asyncio
async def test_secret_configured_rejects_invalid_key():
    with patch.object(settings, "API_SECRET_KEY", "super-secure-production-key"):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_actor(authorization=None, x_api_key="wrong-key")
        assert exc_info.value.status_code == 401
        assert "Invalid authentication" in exc_info.value.detail

@pytest.mark.asyncio
async def test_secret_configured_accepts_valid_api_key_header():
    with patch.object(settings, "API_SECRET_KEY", "super-secure-production-key"):
        actor = await get_current_actor(authorization=None, x_api_key="super-secure-production-key")
        assert actor.is_authenticated is True
        assert actor.is_demo_actor is False
        assert actor.role == "clinician"

@pytest.mark.asyncio
async def test_secret_configured_accepts_valid_bearer_token():
    with patch.object(settings, "API_SECRET_KEY", "super-secure-production-key"):
        actor = await get_current_actor(authorization="Bearer super-secure-production-key", x_api_key=None)
        assert actor.is_authenticated is True
        assert actor.is_demo_actor is False

@pytest.mark.asyncio
async def test_production_mode_without_secret_fails_closed():
    with patch.object(settings, "DEMO_MODE", False), patch.object(settings, "API_SECRET_KEY", None):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_actor(authorization=None, x_api_key=None)
        assert exc_info.value.status_code == 500
        assert "Security configuration error" in exc_info.value.detail

def test_patient_isolation_enforcement():
    # Restricted patient actor
    patient_actor = SecurityContext(
        actor_id="patient_alice",
        role="patient",
        is_authenticated=True,
        is_demo_actor=False,
        authorized_patient_id="PT-1001"
    )
    # Accessing own data is permitted
    assert patient_actor.can_access_patient("PT-1001") is True
    # Accessing another patient's data is denied
    assert patient_actor.can_access_patient("PT-1002") is False

    # require_patient_access raises 403 on mismatch
    with pytest.raises(HTTPException) as exc_info:
        require_patient_access(target_patient_id="PT-1002", actor=patient_actor)
    assert exc_info.value.status_code == 403
    assert "not authorized" in exc_info.value.detail
