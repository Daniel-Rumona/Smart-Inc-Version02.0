from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from fastapi import HTTPException


DEFAULT_BASE_URL = "https://rairo-pitch-helper-api.hf.space"


class PitchfyClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.api_key = (
            api_key if api_key is not None else os.getenv("PITCHFY_API_KEY", "")
        ).strip()
        self.base_url = (
            base_url
            if base_url is not None
            else os.getenv("PITCHFY_BASE_URL", DEFAULT_BASE_URL)
        ).strip().rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        timeout: int = 90,
    ) -> dict[str, Any]:
        if not self.configured:
            raise HTTPException(
                status_code=503,
                detail="The pitch coaching integration is not configured.",
            )

        headers = {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
        }
        body: bytes | None = None

        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url=f"{self.base_url}{path}",
            data=body,
            headers=headers,
            method=method.upper(),
        )

        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read().decode("utf-8", errors="replace").strip()

            if not raw:
                return {"ok": True}

            result = json.loads(raw)
            if not isinstance(result, dict):
                raise HTTPException(
                    status_code=502,
                    detail="The pitch coaching service returned an invalid response.",
                )
            return result

        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace").strip()
            try:
                error_payload = json.loads(raw)
            except json.JSONDecodeError:
                error_payload = {}

            provider_type = str(error_payload.get("type") or "provider_error")
            provider_message = str(
                error_payload.get("error")
                or error_payload.get("message")
                or error_payload.get("detail")
                or "The pitch coaching request failed."
            )
            friendly = {
                "authentication_error": "The pitch coaching integration is not authorised.",
                "insufficient_credits": "The pitch coaching service has used all available credits for now. Please try again later or contact your programme administrator.",
                "permission_error": "The current Pitchfy plan does not include this feature.",
                "not_found": "The requested pitch coaching project or session was not found.",
                "rate_limit_error": "The pitch coaching service is receiving too many requests.",
                "server_error": "The pitch coaching service is temporarily unavailable.",
            }
            normalized_message = provider_message.lower()
            friendly_message = friendly.get(provider_type)
            if not friendly_message and (
                "quota" in normalized_message
                or "credit" in normalized_message
                or "usage limit" in normalized_message
            ):
                friendly_message = (
                    "The pitch coaching service has used all available credits for now. "
                    "Please try again later or contact your programme administrator."
                )

            raise HTTPException(
                status_code=exc.code,
                detail={
                    "message": friendly_message or provider_message,
                    "type": provider_type,
                },
            ) from exc

        except urllib.error.URLError as exc:
            raise HTTPException(
                status_code=502,
                detail="The pitch coaching service could not be reached.",
            ) from exc
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail="The pitch coaching service returned malformed data.",
            ) from exc

    @staticmethod
    def _project_path(project_id: str, suffix: str = "") -> str:
        safe_id = urllib.parse.quote(project_id, safe="")
        return f"/v1/projects/{safe_id}{suffix}"

    def get_account(self) -> dict[str, Any]:
        return self._request("GET", "/v1/me")

    def create_project(self, text: str) -> dict[str, Any]:
        return self._request("POST", "/v1/projects", {"text": text}, timeout=120)

    def list_projects(self) -> dict[str, Any]:
        return self._request("GET", "/v1/projects")

    def get_project(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", self._project_path(project_id))

    def rename_project(self, project_id: str, title: str) -> dict[str, Any]:
        return self._request(
            "PATCH",
            self._project_path(project_id),
            {"title": title},
        )

    def delete_project(self, project_id: str) -> dict[str, Any]:
        return self._request("DELETE", self._project_path(project_id))

    def get_briefing(
        self,
        project_id: str,
        mode: str = "interactive",
    ) -> dict[str, Any]:
        query = urllib.parse.urlencode({"mode": mode})
        return self._request(
            "GET",
            f"{self._project_path(project_id, '/briefing')}?{query}",
        )

    def analyze_transcript(
        self,
        project_id: str,
        transcript: str,
        duration_seconds: float,
        session_mode: str = "interactive",
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            self._project_path(project_id, "/analyze"),
            {
                "transcript": transcript,
                "durationSeconds": duration_seconds,
                "sessionMode": session_mode,
            },
            timeout=240,
        )

    def list_sessions(self, project_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            self._project_path(project_id, "/sessions"),
        )

    def get_session(
        self,
        project_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        safe_session_id = urllib.parse.quote(session_id, safe="")
        return self._request(
            "GET",
            self._project_path(project_id, f"/sessions/{safe_session_id}"),
        )

    def get_analytics(self, project_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            self._project_path(project_id, "/analytics"),
        )

    def generate_insights(self, project_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            self._project_path(project_id, "/insights"),
            timeout=180,
        )

    def get_insights(self, project_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            self._project_path(project_id, "/insights"),
        )

    def start_voice_session(
        self,
        project_id: str,
        mode: str = "interactive",
    ) -> dict[str, Any]:
        query = urllib.parse.urlencode({"projectId": project_id, "mode": mode})
        return self._request("GET", f"/v1/voice/session?{query}")
