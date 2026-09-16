from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import HTTPException
from firebase_admin import auth as firebase_auth


@dataclass(frozen=True)
class AuthenticatedIdentity:
    uid: str
    role: str | None
    company_code: str | None
    email: str | None
    is_service: bool = False


def _clean(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def create_request_authenticator(
    db: Any,
    shared_secret: str = "",
) -> Callable[[str | None], AuthenticatedIdentity]:
    allow_unauthenticated = (
        os.getenv("ALLOW_UNAUTHENTICATED_AGENT_API", "false").strip().lower()
        == "true"
    )
    clean_shared_secret = shared_secret.strip()

    def authenticate(authorization: str | None) -> AuthenticatedIdentity:
        if not authorization:
            if allow_unauthenticated:
                return AuthenticatedIdentity(
                    uid="local-development",
                    role="systemadmin",
                    company_code=None,
                    email=None,
                    is_service=True,
                )
            raise HTTPException(status_code=401, detail="Authentication is required")

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(status_code=401, detail="Invalid authorization header")

        clean_token = token.strip()

        if clean_shared_secret and clean_token == clean_shared_secret:
            return AuthenticatedIdentity(
                uid="agent-service",
                role="systemadmin",
                company_code=None,
                email=None,
                is_service=True,
            )

        try:
            claims = firebase_auth.verify_id_token(clean_token, check_revoked=True)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired session") from exc

        uid = _clean(claims.get("uid") or claims.get("sub"))
        if not uid:
            raise HTTPException(status_code=401, detail="Authenticated user could not be resolved")

        user_data: dict[str, Any] = {}
        try:
            snapshot = db.collection("users").document(uid).get()
            if snapshot.exists:
                user_data = snapshot.to_dict() or {}
        except Exception:
            user_data = {}

        role = _clean(
            user_data.get("role")
            or claims.get("role")
            or claims.get("userRole")
        )
        company_code = _clean(
            user_data.get("companyCode")
            or claims.get("companyCode")
            or claims.get("company_code")
        )
        email = _clean(user_data.get("email") or claims.get("email"))

        return AuthenticatedIdentity(
            uid=uid,
            role=role.lower() if role else None,
            company_code=company_code,
            email=email,
            is_service=False,
        )

    return authenticate
