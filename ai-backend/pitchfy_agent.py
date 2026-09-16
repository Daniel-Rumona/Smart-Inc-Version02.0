from __future__ import annotations

import asyncio
import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Callable, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from firebase_admin import firestore
from pydantic import BaseModel, Field

from pitchfy_client import PitchfyClient


PITCH_AGENT_ID = "pitch-coach"
PITCH_IMPLEMENTATION_KEY = "pitchfy"
SessionMode = Literal["interactive", "pitch_first"]
PRIVILEGED_ROLES = {"systemadmin"}


class PitchProjectCreateRequest(BaseModel):
    companyCode: str = Field(min_length=1, max_length=100)
    assignmentId: str | None = Field(default=None, max_length=240)
    participantId: str | None = Field(default=None, max_length=240)
    text: str = Field(min_length=1, max_length=200_000)
    uiTitle: str | None = Field(default=None, max_length=120)


class PitchTranscriptAnalyzeRequest(BaseModel):
    companyCode: str = Field(min_length=1, max_length=100)
    transcript: str = Field(min_length=1, max_length=500_000)
    durationSeconds: float = Field(gt=0, le=10_800)
    sessionMode: SessionMode = "interactive"


def _clean(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return str(value)


def _mapping_doc_id(project_id: str) -> str:
    return hashlib.sha256(project_id.encode("utf-8")).hexdigest()


def _extract_project_id(result: dict[str, Any]) -> str | None:
    direct = _clean(result.get("projectId") or result.get("id"))
    if direct:
        return direct

    project = result.get("project")
    if isinstance(project, dict):
        return _clean(project.get("projectId") or project.get("id"))

    return None


def _extract_project_title(result: dict[str, Any]) -> str | None:
    direct = _clean(
        result.get("title")
        or result.get("name")
        or result.get("short_description")
    )
    if direct:
        return direct

    project = result.get("project")
    if isinstance(project, dict):
        return _clean(project.get("title") or project.get("name"))

    return None


def _identity_value(identity: Any, key: str) -> Any:
    return getattr(identity, key, None)


def _resolve_company_code(identity: Any, requested: str | None) -> str:
    requested_code = _clean(requested)
    identity_company = _clean(_identity_value(identity, "company_code"))
    role = (_clean(_identity_value(identity, "role")) or "").lower()
    is_service = bool(_identity_value(identity, "is_service"))

    if is_service or role in PRIVILEGED_ROLES:
        if not requested_code:
            raise HTTPException(status_code=400, detail="A company code is required")
        return requested_code

    if not identity_company:
        raise HTTPException(
            status_code=403,
            detail="Your user profile is not linked to a company.",
        )

    if requested_code and requested_code.upper() != identity_company.upper():
        raise HTTPException(
            status_code=403,
            detail="You cannot use an agent for another company.",
        )

    return identity_company


def _require_company_agent_enabled(db: Any, company_code: str) -> None:
    snapshot = db.collection("companyAgentSettings").document(company_code).get()
    settings = snapshot.to_dict() or {}
    enabled = settings.get("enabledAgentIds")

    if isinstance(enabled, list):
        enabled_ids = [
            agent_id.strip()
            for agent_id in enabled
            if isinstance(agent_id, str) and agent_id.strip()
        ]

        # Registry entries can use any stable agent key, so authorization must
        # also recognise the enabled Pitchfy implementation behind that key.
        if PITCH_AGENT_ID in enabled_ids:
            return

        for agent_id in enabled_ids:
            agent_snapshot = db.collection("agents").document(agent_id).get()
            if not agent_snapshot.exists:
                continue

            agent = agent_snapshot.to_dict() or {}
            if (
                agent.get("implementationKey") == PITCH_IMPLEMENTATION_KEY
                and agent.get("status") == "active"
            ):
                return

    raise HTTPException(
        status_code=403,
        detail="The Pitch Preparation Agent is not enabled for this company.",
    )


def _load_mapping(db: Any, project_id: str) -> tuple[Any, dict[str, Any]]:
    reference = db.collection("externalAgentProjects").document(
        _mapping_doc_id(project_id)
    )
    snapshot = reference.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Pitch coaching project not found")
    return reference, snapshot.to_dict() or {}


def _require_project_access(
    db: Any,
    identity: Any,
    project_id: str,
    requested_company_code: str | None,
) -> tuple[Any, dict[str, Any], str]:
    reference, mapping = _load_mapping(db, project_id)
    company_code = _resolve_company_code(identity, requested_company_code)

    if str(mapping.get("companyCode") or "").upper() != company_code.upper():
        raise HTTPException(
            status_code=403,
            detail="This pitch coaching project belongs to another company.",
        )

    _require_company_agent_enabled(db, company_code)
    return reference, mapping, company_code


def _public_mapping(snapshot_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return _json_safe(
        {
            "id": snapshot_id,
            "externalProjectId": data.get("externalProjectId"),
            "companyCode": data.get("companyCode"),
            "assignmentId": data.get("assignmentId"),
            "participantId": data.get("participantId"),
            "title": data.get("title"),
            "uiTitle": data.get("uiTitle"),
            "status": data.get("status") or "active",
            "sessionCount": data.get("sessionCount") or 0,
            "createdAt": data.get("createdAt"),
            "updatedAt": data.get("updatedAt"),
            "lastAnalyzedAt": data.get("lastAnalyzedAt"),
        }
    )


def _feedback_summary(result: dict[str, Any]) -> dict[str, Any]:
    feedback = result.get("feedback")
    if not isinstance(feedback, dict):
        nested = result.get("result")
        feedback = nested.get("feedback") if isinstance(nested, dict) else {}
    if not isinstance(feedback, dict):
        feedback = {}

    allowed_keys = {
        "compositeScore",
        "communicationScore",
        "contentMasteryScore",
        "engagementDeliveryScore",
        "resilienceScore",
        "qualitativeStrengths",
        "qualitativeImprovements",
        "contextSpecificFeedback",
        "phase1",
        "phase2",
    }
    return {
        key: _json_safe(value)
        for key, value in feedback.items()
        if key in allowed_keys
    }


def create_pitchfy_router(
    client: PitchfyClient,
    db: Any,
    require_auth: Callable[[str | None], Any],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/pitch-coach",
        tags=["pitch-coach-agent"],
    )

    @router.get("/metadata")
    async def metadata(
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_auth(authorization)
        return {
            "ok": True,
            "agentId": PITCH_AGENT_ID,
            "name": "Pitch Preparation Agent",
            "provider": "pitchfy",
            "executionMode": "external_api",
            "capabilities": [
                "brief analysis",
                "pitch preparation",
                "interview practice",
                "voice practice",
                "transcript scoring",
                "performance analytics",
            ],
            "sessionModes": ["interactive", "pitch_first"],
        }

    @router.get("/status")
    async def status(
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        role = (_clean(_identity_value(identity, "role")) or "").lower()
        is_privileged = bool(_identity_value(identity, "is_service")) or role in PRIVILEGED_ROLES

        if not client.configured:
            return {
                "ok": True,
                "configured": False,
                "provider": "pitchfy",
            }

        if not is_privileged:
            return {
                "ok": True,
                "configured": True,
                "provider": "pitchfy",
            }

        account = await asyncio.to_thread(client.get_account)
        credits = account.get("creditsRemaining")
        if credits is None:
            credits = account.get("credits") or account.get("balance")
        plan = account.get("plan") or account.get("planName")

        return {
            "ok": True,
            "configured": True,
            "provider": "pitchfy",
            "creditsRemaining": credits,
            "accountPlan": plan,
        }

    @router.post("/projects")
    async def create_project(
        payload: PitchProjectCreateRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        company_code = _resolve_company_code(identity, payload.companyCode)
        _require_company_agent_enabled(db, company_code)

        result = await asyncio.to_thread(client.create_project, payload.text)
        project_id = _extract_project_id(result)
        if not project_id:
            raise HTTPException(
                status_code=502,
                detail="Pitchfy created the project but did not return a project identifier.",
            )

        reference = db.collection("externalAgentProjects").document(
            _mapping_doc_id(project_id)
        )
        mapping = {
            "provider": "pitchfy",
            "agentId": PITCH_AGENT_ID,
            "externalProjectId": project_id,
            "companyCode": company_code,
            "assignmentId": _clean(payload.assignmentId),
            "participantId": _clean(payload.participantId),
            "title": _extract_project_title(result),
            "uiTitle": _clean(payload.uiTitle),
            "status": "active",
            "sessionCount": 0,
            "createdByUid": _identity_value(identity, "uid"),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        reference.set(mapping)

        saved = reference.get().to_dict() or mapping
        return {
            "ok": True,
            "project": _json_safe(result),
            "mapping": _public_mapping(reference.id, saved),
        }

    @router.get("/projects")
    async def list_projects(
        companyCode: str = Query(min_length=1, max_length=100),
        assignmentId: str | None = Query(default=None, max_length=240),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        company_code = _resolve_company_code(identity, companyCode)
        _require_company_agent_enabled(db, company_code)

        docs = (
            db.collection("externalAgentProjects")
            .where("companyCode", "==", company_code)
            .stream()
        )
        rows: list[dict[str, Any]] = []
        for snapshot in docs:
            data = snapshot.to_dict() or {}
            if data.get("provider") != "pitchfy":
                continue
            if assignmentId and data.get("assignmentId") != assignmentId:
                continue
            external_project_id = _clean(data.get("externalProjectId"))
            if not external_project_id:
                snapshot.reference.delete()
                continue
            try:
                await asyncio.to_thread(client.get_project, external_project_id)
            except HTTPException as exc:
                if exc.status_code == 404:
                    snapshot.reference.delete()
                    continue
            rows.append(_public_mapping(snapshot.id, data))

        rows.sort(
            key=lambda item: str(item.get("createdAt") or ""),
            reverse=True,
        )
        return {"ok": True, "projects": rows}

    @router.get("/projects/{project_id}")
    async def get_project(
        project_id: str,
        companyCode: str = Query(min_length=1, max_length=100),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        _require_project_access(db, identity, project_id, companyCode)
        result = await asyncio.to_thread(client.get_project, project_id)
        return {"ok": True, "project": _json_safe(result)}

    @router.delete("/projects/{project_id}")
    async def delete_project(
        project_id: str,
        companyCode: str = Query(min_length=1, max_length=100),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        reference, _, _ = _require_project_access(
            db,
            identity,
            project_id,
            companyCode,
        )
        await asyncio.to_thread(client.delete_project, project_id)
        reference.delete()
        return {"ok": True}

    @router.get("/projects/{project_id}/briefing")
    async def get_briefing(
        project_id: str,
        companyCode: str = Query(min_length=1, max_length=100),
        mode: SessionMode = Query(default="interactive"),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        _require_project_access(db, identity, project_id, companyCode)
        result = await asyncio.to_thread(client.get_briefing, project_id, mode)
        return {"ok": True, "briefing": _json_safe(result)}

    @router.post("/projects/{project_id}/analyze")
    async def analyze_transcript(
        project_id: str,
        payload: PitchTranscriptAnalyzeRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        reference, _, _ = _require_project_access(
            db,
            identity,
            project_id,
            payload.companyCode,
        )
        estimated_credits = math.ceil(payload.durationSeconds / 60) * 3

        result = await asyncio.to_thread(
            client.analyze_transcript,
            project_id,
            payload.transcript,
            payload.durationSeconds,
            payload.sessionMode,
        )

        reference.set(
            {
                "sessionCount": firestore.Increment(1),
                "lastAnalyzedAt": firestore.SERVER_TIMESTAMP,
                "lastFeedback": _feedback_summary(result),
                "lastCreditsCharged": result.get("creditsCharged"),
                "lastCreditsRemaining": result.get("creditsRemaining"),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

        return {
            "ok": True,
            "estimatedCredits": estimated_credits,
            "analysis": _json_safe(result),
        }

    @router.get("/projects/{project_id}/sessions")
    async def list_sessions(
        project_id: str,
        companyCode: str = Query(min_length=1, max_length=100),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        _require_project_access(db, identity, project_id, companyCode)
        result = await asyncio.to_thread(client.list_sessions, project_id)
        return {"ok": True, "sessions": _json_safe(result)}

    @router.get("/projects/{project_id}/analytics")
    async def get_analytics(
        project_id: str,
        companyCode: str = Query(min_length=1, max_length=100),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        _require_project_access(db, identity, project_id, companyCode)
        result = await asyncio.to_thread(client.get_analytics, project_id)
        return {"ok": True, "analytics": _json_safe(result)}

    @router.get("/voice/session")
    async def start_voice_session(
        projectId: str = Query(min_length=1, max_length=240),
        companyCode: str = Query(min_length=1, max_length=100),
        mode: SessionMode = Query(default="interactive"),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        identity = require_auth(authorization)
        _require_project_access(db, identity, projectId, companyCode)
        result = await asyncio.to_thread(client.start_voice_session, projectId, mode)
        return {"ok": True, "voiceSession": _json_safe(result)}

    return router
