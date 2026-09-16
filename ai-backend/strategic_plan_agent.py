"""Strategic Plan Agent API.

This module owns the strategic-planning engine and its public endpoints. The
generic document-agent workspace may call these endpoints, while the dedicated
routes also make the agent independently discoverable and testable.
"""

from copy import deepcopy
from typing import Any, Callable
import re

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from business_plan_agent import (
    AgentAttachment,
    _attachment_text,
    _extract_json_object,
    _populate_strategic_document,
    _strategic_plan_content,
)
from document_provenance import document_provenance_headers


STRATEGIC_PLAN_FIELDS: list[tuple[str, str]] = [
    ("vision", "If the business is doing well three years from now, what will be different?"),
    ("strategicPriorities", "What are the two or three most important improvements to work on first?"),
    ("risks", "What is most likely to get in the way of that progress?"),
    ("timeHorizon", "Should this plan cover one year, three years, or five years?"),
]

STRATEGIC_PLAN_DOCUMENTS = [
    "Current business or company profile",
    "Previous strategy or business plan",
    "Recent performance or financial reports",
    "Organisation structure",
    "Market, programme, or stakeholder research",
]


class StrategicPlanChatRequest(BaseModel):
    message: str = Field(default="", max_length=6000)
    answers: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)
    attachments: list[AgentAttachment] = Field(default_factory=list, max_length=5)
    interventionContext: dict[str, Any] | None = None


class StrategicPlanDocumentRequest(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)


def _step_updates(parsed: dict[str, Any], context: dict[str, Any] | None) -> list[dict[str, str]]:
    supplied = (context or {}).get("steps", [])
    supplied_ids = {str(step.get("id")) for step in supplied if isinstance(step, dict)}
    updates = parsed.get("stepUpdates") if isinstance(parsed.get("stepUpdates"), list) else []
    return [
        {
            "id": str(update.get("id")),
            "status": str(update.get("status")),
            "evidence": str(update.get("evidence") or ""),
        }
        for update in updates
        if isinstance(update, dict)
        and str(update.get("id")) in supplied_ids
        and update.get("status") in {"not_started", "in_progress", "completed"}
    ]


def run_strategic_plan_chat(payload: StrategicPlanChatRequest, call_ai: Callable[..., str]) -> dict[str, Any]:
    answers = {key: value.strip() for key, value in payload.answers.items() if isinstance(value, str) and value.strip()}
    documents = [{"name": item.name, "text": _attachment_text(item)} for item in payload.attachments]
    missing_before = [key for key, _ in STRATEGIC_PLAN_FIELDS if not answers.get(key)]
    current_key = missing_before[0] if missing_before else None
    acknowledgement = "I will guide you through the strategic plan one question at a time."
    step_updates: list[dict[str, str]] = []
    message_text = payload.message.strip()
    normalized_message = message_text.lower()

    def result_with(reply: str) -> dict[str, Any]:
        missing = [key for key, _ in STRATEGIC_PLAN_FIELDS if not answers.get(key)]
        return {
            "ok": True,
            "reply": reply,
            "answers": answers,
            "missingFields": missing,
            "ready": not missing,
            "requestedDocuments": deepcopy(STRATEGIC_PLAN_DOCUMENTS),
            "documentsRead": [item["name"] for item in documents if item["text"]],
            "stepUpdates": step_updates,
        }

    if message_text and re.fullmatch(r"(good\s*(day|morning|afternoon|evening)|hi|hie|hello|hey)[!. ]*", normalized_message):
        next_question = next((question for key, question in STRATEGIC_PLAN_FIELDS if key == current_key), "How can I help with the strategic plan today?")
        return result_with(f"Good day! We can work through this together. {next_question}")

    if message_text and ("sharpen" in normalized_message or "help" in normalized_message) and ("priorit" in normalized_message or "strategy" in normalized_message):
        sector = answers.get("sectorLocation", "your market")
        challenges = answers.get("currentPosition", "the organisation's current constraints")
        return result_with(
            f"Absolutely. Based on what I know about {sector}, we can shape priorities around outcomes rather than vague themes. "
            f"A useful starting set is: 1) strengthen the core offer and customer value, 2) build predictable revenue and financial resilience, "
            f"3) improve delivery capability and systems, and 4) develop the partnerships or market access needed for growth. "
            f"Considering {challenges}, which two would make the biggest difference in the next 12 months—or what important priority is missing?"
        )

    uncertainty = re.search(r"\b(not sure|don'?t know|do not know|still trying|trying to figure|no idea|unsure|help me|not yet)\b", normalized_message)
    if message_text and uncertainty:
        coaching = {
            "vision": "That is completely fine—the vision is something we can discover, not a test you have to pass. Let’s make it smaller: three years from now, what would make you proudest—serving many more customers, operating in new locations, creating jobs, becoming consistently profitable, or being known for a particular impact? Choose one or two, and I’ll help turn them into a vision.",
            "mission": "Let’s build it together. In one rough sentence: who do you help, what problem do you solve for them, and how do you solve it differently? Fragments are fine—I’ll shape the wording.",
            "strategicPriorities": "We can derive the priorities together. Which pressure is most urgent right now: getting more customers, improving cash flow, strengthening operations, building the team, or entering a new market?",
            "marketContext": "No problem. Think about what has changed around the business recently: customer behaviour, competitors, prices, regulation, or technology. Which change is affecting you most?",
            "resources": "Let’s inventory this simply. What do you already have—people, equipment, systems, funding, or partners—and what is the single biggest missing resource?",
            "risks": "A useful way to find risks is to ask what could derail the plan. Is the biggest concern cash flow, customer demand, staff capacity, suppliers, regulation, or execution discipline?",
        }
        return result_with(coaching.get(current_key or "", "That is fine—we can work it out together. Tell me the roughest version of your thinking, even if it is incomplete, and I’ll help shape it."))

    if current_key == "vision" and normalized_message in {"money", "moneu", "profit", "profits"}:
        return result_with(
            "Financial success can definitely be part of the vision. When you say money, which outcome matters most: stable profitability, a specific revenue level, attracting investment, or building personal and business financial security? We can combine that with the customers or impact you want the business to create."
        )

    if message_text or documents:
        try:
            raw = call_ai(
                "You are a rigorous strategic-planning agent for SMEs and organisations. Extract only supplied facts; never invent evidence, figures, baselines, customers, or results. Return JSON only with answers, acknowledgement, and stepUpdates. answers may use only fieldGuide keys. Always place a valid response to currentField into answers[currentField]. acknowledgement must not ask the next field question because the application adds it. For intervention steps, mark completed only when explicit conversation or document evidence satisfies the step; otherwise use in_progress.",
                {
                    "fieldGuide": dict(STRATEGIC_PLAN_FIELDS),
                    "existingAnswers": answers,
                    "currentField": current_key,
                    "message": payload.message,
                    "documents": documents,
                    "recentHistory": payload.history[-8:],
                    "interventionContext": payload.interventionContext,
                },
                max_output_tokens=1800,
                response_mime_type="application/json",
            )
            parsed = _extract_json_object(raw) or {}
            allowed = {key for key, _ in STRATEGIC_PLAN_FIELDS}
            extracted = parsed.get("answers") if isinstance(parsed.get("answers"), dict) else {}
            for key, value in extracted.items():
                if key in allowed and isinstance(value, str) and value.strip():
                    answers[key] = value.strip()
            if current_key and current_key not in answers and message_text:
                word_count = len(re.findall(r"\b\w+\b", message_text))
                action_count = len(re.findall(r"\b(expand|grow|improve|strengthen|develop|build|increase|reduce|enter|launch|enhance|diversify|streamline|retain)\w*\b", normalized_message))
                numbered_items = len(re.findall(r"(?:^|\n)\s*\d+[.)]", message_text))
                uncertainty_text = re.search(r"\b(not sure|don'?t know|still trying|no idea|unsure)\b", normalized_message)
                valid_priorities = current_key == "strategicPriorities" and word_count >= 8 and (action_count >= 2 or numbered_items >= 2)
                valid_general_answer = current_key != "strategicPriorities" and word_count >= 4 and not uncertainty_text
                if valid_priorities or valid_general_answer:
                    answers[current_key] = message_text
            acknowledgement = str(parsed.get("acknowledgement") or "Thank you — I have added that to the strategic plan.").strip()
            step_updates = _step_updates(parsed, payload.interventionContext)
        except Exception:
            if current_key and payload.message.strip():
                answers[current_key] = payload.message.strip()
            acknowledgement = "Thank you — I have added that to the strategic plan."

    missing = [key for key, _ in STRATEGIC_PLAN_FIELDS if not answers.get(key)]
    next_question = next((question for key, question in STRATEGIC_PLAN_FIELDS if key in missing), "")
    ready = not missing
    if ready:
        reply = f"{acknowledgement} I have enough information to create the first strategic-plan draft. You can refine anything or create the document now."
    elif next_question.lower() in acknowledgement.lower() or acknowledgement.rstrip().endswith("?"):
        reply = acknowledgement
    else:
        reply = f"{acknowledgement} {next_question}".strip()
    return {
        "ok": True,
        "reply": reply,
        "answers": answers,
        "missingFields": missing,
        "ready": ready,
        "requestedDocuments": deepcopy(STRATEGIC_PLAN_DOCUMENTS),
        "documentsRead": [item["name"] for item in documents if item["text"]],
        "stepUpdates": step_updates,
    }


def create_strategic_plan_router(
    call_ai: Callable[..., str],
    require_auth: Callable[[str | None], None],
) -> APIRouter:
    router = APIRouter(prefix="/api/strategic-plan", tags=["strategic-plan-agent"])

    @router.get("/metadata")
    async def metadata(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        require_auth(authorization)
        return {
            "ok": True,
            "agentId": "strategic-plan",
            "name": "Strategic Plan Agent",
            "capabilities": ["guided discovery", "step-aware delivery", "strategic analysis", "Word document generation"],
            "fields": [{"key": key, "question": question} for key, question in STRATEGIC_PLAN_FIELDS],
        }

    @router.post("/chat")
    async def chat(payload: StrategicPlanChatRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        require_auth(authorization)
        return run_strategic_plan_chat(payload, call_ai)

    @router.post("/document")
    async def document(payload: StrategicPlanDocumentRequest, authorization: str | None = Header(default=None)) -> StreamingResponse:
        require_auth(authorization)
        missing = [key for key, _ in STRATEGIC_PLAN_FIELDS if not str(payload.answers.get(key, "")).strip()]
        if missing:
            raise HTTPException(status_code=400, detail=f"The strategic-plan conversation is incomplete: {', '.join(missing)}")
        content = _strategic_plan_content(payload.answers, call_ai)
        output = _populate_strategic_document(payload.answers, content)
        name = str(payload.answers.get("organizationName") or "organisation")
        safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-") or "organisation"
        provenance = document_provenance_headers(output.getvalue())
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}-strategic-plan.docx"', **provenance},
        )

    return router
