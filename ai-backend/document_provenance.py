"""Cryptographic provenance for system-generated documents."""

import hashlib
import hmac
import os
from typing import Callable

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field


def _signing_secret() -> bytes:
    value = os.getenv("DOCUMENT_SIGNING_SECRET") or os.getenv("AGENT_SHARED_SECRET") or ""
    return value.encode("utf-8")


def document_provenance_headers(content: bytes) -> dict[str, str]:
    digest = hashlib.sha256(content).hexdigest()
    secret = _signing_secret()
    signature = hmac.new(secret, digest.encode("ascii"), hashlib.sha256).hexdigest() if secret else ""
    return {
        "X-Document-SHA256": digest,
        "X-Document-Signature": signature,
        "X-Document-Signature-Algorithm": "HMAC-SHA256" if signature else "unsigned",
    }


class VerificationRequest(BaseModel):
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    signature: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


def create_document_provenance_router(require_auth: Callable[[str | None], None]) -> APIRouter:
    router = APIRouter(prefix="/api/document-verification", tags=["document-verification"])

    @router.post("/verify")
    async def verify(payload: VerificationRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
        require_auth(authorization)
        secret = _signing_secret()
        expected = hmac.new(secret, payload.sha256.lower().encode("ascii"), hashlib.sha256).hexdigest() if secret else ""
        authentic = bool(secret) and hmac.compare_digest(expected, payload.signature.lower())
        return {"ok": True, "authentic": authentic, "algorithm": "HMAC-SHA256", "sha256": payload.sha256.lower()}

    return router

