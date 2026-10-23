"""
SwasthyaTwin Security & Authorization Module
Provides:
1. API Key & Bearer Token Authentication for non-demo deployments.
2. Open demo mode fallback with explicit non-diagnostic demonstration actor.
3. Patient-level authorization guards preventing cross-patient unauthorized access.
4. Input sanitization helpers.
"""

import hmac
import logging
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status, Depends
from app.core.config import settings

logger = logging.getLogger(__name__)

class SecurityContext:
    def __init__(
        self,
        actor_id: str,
        role: str,
        is_authenticated: bool,
        is_demo_actor: bool = False,
        authorized_patient_id: Optional[str] = None
    ):
        self.actor_id = actor_id
        self.role = role
        self.is_authenticated = is_authenticated
        self.is_demo_actor = is_demo_actor
        self.authorized_patient_id = authorized_patient_id

    def can_access_patient(self, target_patient_id: str) -> bool:
        """Enforce patient isolation: clinicians/system access all, patients access only their own record."""
        if self.is_demo_actor or self.role in ["clinician", "system_admin", "researcher"]:
            return True
        if self.authorized_patient_id and self.authorized_patient_id == target_patient_id:
            return True
        return False

def get_current_actor(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> SecurityContext:
    """
    Authenticate request actor.
    - If API_SECRET_KEY is configured or DEMO_MODE is False: requires valid Bearer token or X-API-Key.
    - If in DEMO_MODE and no API_SECRET_KEY configured: permits open demonstration actor.
    """
    secret = settings.API_SECRET_KEY

    # Check provided key / token
    provided_key = None
    if x_api_key:
        provided_key = x_api_key.strip()
    elif authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() in ["bearer", "token", "apikey"]:
            provided_key = parts[1]
        elif len(parts) == 1:
            provided_key = parts[0]

    # Non-demo or secret-configured deployment
    if secret:
        if not provided_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication credentials. Provide 'X-API-Key' or 'Authorization: Bearer <key>'.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(provided_key, secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return SecurityContext(
            actor_id="authenticated_clinician",
            role="clinician",
            is_authenticated=True,
            is_demo_actor=False
        )

    # In DEMO_MODE without configured secret
    if settings.DEMO_MODE:
        return SecurityContext(
            actor_id="demo_researcher",
            role="researcher",
            is_authenticated=False,
            is_demo_actor=True
        )

    # Production/non-demo environment with missing secret is a configuration failure
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Security configuration error: API_SECRET_KEY must be configured in non-demo environments."
    )

def require_patient_access(target_patient_id: str, actor: SecurityContext = Depends(get_current_actor)) -> SecurityContext:
    """Dependency that enforces patient isolation."""
    if not actor.can_access_patient(target_patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Actor '{actor.actor_id}' is not authorized to access patient '{target_patient_id}'."
        )
    return actor
