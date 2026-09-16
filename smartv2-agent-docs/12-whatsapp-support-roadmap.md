# 12. WhatsApp Support Roadmap

## Goal

Build WhatsApp into a reliable, secure, first-class Smart Incubation channel rather than a standalone menu bot.

This checklist tracks implementation. An item is checked only after its code is implemented and the relevant project build or test passes.

## Current foundation

- [x] Meta webhook verification handshake.
- [x] Webhook HMAC signature validation.
- [x] Role-aware menus for incubatees, consultants, operations, and administrators.
- [x] Diagnostic plan, intervention, appointment, and platform-summary lookups.
- [x] Guided intervention-assignment workflow with confirmation.
- [x] Firestore conversation state and interaction ratings.
- [x] Text messages and interactive button/list replies.

## P0: Reliability and security foundations

### Durable, idempotent webhook processing

- [x] Derive a stable inbox document ID from the Meta message ID and receiving phone-number ID.
- [x] Persist inbound messages in `whatsappInboundEvents` before acknowledging the webhook.
- [x] Treat an already-created inbox document as a successfully accepted duplicate.
- [x] Return the webhook response after durable ingestion instead of after bot processing.
- [x] Process inbox documents asynchronously with a retry-enabled Firestore trigger.
- [x] Claim work with a processing lease to prevent concurrent workers handling the same event.
- [x] Record attempts, processing state, completion time, and sanitized errors.
- [x] Stop automatic retries after eight attempts and mark the event `dead_letter`.
- [x] Make intervention creation and its notification one atomic Firestore transaction.
- [x] Make a retried assignment message return the previously created assignment instead of creating another.
- [ ] Add emulator integration tests for duplicate webhook delivery, worker retry, lease recovery, and concurrent assignment attempts.
- [ ] Add an admin dead-letter replay and inspection workflow.

### Outbound delivery ledger

- [x] Capture the returned outbound `wamid` for every send.
- [x] Store outbound message type, recipient, tenant, source event, and timestamps.
- [x] Consume `sent`, `delivered`, `read`, and `failed` webhook statuses.
- [x] Correlate status events with the outbound message ledger.
- [x] Add bounded retry/backoff for retryable Graph API failures.
- [x] Add daily global/company delivery-health metrics and terminal-failure alerts.

### Authentication and tenant isolation

- [ ] Normalize and uniquely index WhatsApp identities in E.164 format.
- [ ] Replace suffix scanning of the first 500 users.
- [ ] Fail closed when a non-platform identity has no company scope.
- [ ] Replace the shared action PIN with per-user OTP or in-app approval.
- [ ] Add attempt limits, lockouts, audit records, and security alerts.
- [ ] Key conversations by WABA, receiving number, and sender identity.
- [ ] Move WhatsApp credentials to managed function secrets.

## P1: WhatsApp channel coverage

### Inbound messages

- [ ] Introduce a typed inbound event adapter and message dispatcher.
- [ ] Support images, documents, audio/voice notes, video, and stickers.
- [ ] Support locations and shared contacts.
- [ ] Support reactions, reply context, referrals, and Flow responses.
- [ ] Store unsupported/unknown events for diagnostics and send a useful fallback.
- [ ] Mark accepted inbound messages as read.

### Media safety

- [ ] Download media through authenticated Graph API requests.
- [ ] Validate MIME type, extension, and size.
- [ ] Scan files before making them available to platform users.
- [ ] Store media securely with tenant-aware authorization and retention rules.
- [ ] Redact security-sensitive message content after it has been consumed.

### Templates and proactive notifications

- [ ] Create a template registry with language, category, variables, and approval status.
- [ ] Enforce conversation-window and template requirements centrally.
- [ ] Record opt-in source, timestamp, preferences, and opt-outs.
- [ ] Add quiet hours, timezone handling, notification categories, and frequency limits.
- [ ] Send appointment, intervention, compliance, application, and diagnostic-plan notifications.
- [ ] Add template rejection, pause, and quality-degradation monitoring.

### Navigation and usability

- [ ] Paginate lists beyond WhatsApp's ten-row limit.
- [ ] Add search and filters for SMEs, programmes, interventions, and assignees.
- [ ] Bind choice tokens to the active flow and expire stale selections.
- [ ] Chunk or summarize text that exceeds WhatsApp limits.
- [ ] Add localized content, beginning with the platform's supported languages.

## P2: Workflow and operational completeness

### WhatsApp Flows

- [ ] Build a Flow for intervention assignment.
- [ ] Build appointment booking/rescheduling Flows.
- [ ] Build progress, metric, evidence, and feedback submission Flows.
- [ ] Validate Flow data server-side and preserve conversational fallbacks.

### Product workflows

- [ ] Incubatee compliance status and document upload.
- [ ] Incubatee roadmap, metrics, intervention requests, and progress updates.
- [ ] Consultant assignment acceptance, scheduling, delivery progress, and completion evidence.
- [ ] Operations application summaries, participant lookup, reminders, risks, and programme status.
- [ ] Administrator channel health, template health, opt-out, and delivery dashboards.

### Human handoff

- [ ] Add `bot_active`, `handoff_requested`, and `human_active` modes.
- [ ] Build a staff inbox with assignment, transcript, participant context, and internal notes.
- [ ] Add SLA, unread, escalation, resume-bot, and conversation-closure controls.
- [ ] Prevent bot replies while a human owns the conversation.

### Natural-language assistance

- [ ] Add intent routing for supported read-only actions.
- [ ] Ground answers in authorized platform data.
- [ ] Keep mutations deterministic and require explicit confirmation.
- [ ] Escalate uncertain, sensitive, or unsupported requests to a person.

## Definition of near-full support

Near-full support is reached when:

- inbound and outbound business-relevant message types are handled or explicitly rejected;
- webhook retries cannot duplicate business mutations;
- message delivery is observable end to end;
- proactive messaging follows template, consent, and frequency rules;
- users can complete the platform's main role-specific workflows;
- complex conversations can be handed to a human without losing context;
- tenant isolation, auditability, retention, and operational monitoring are enforced;
- automated tests cover duplicate delivery, retries, permissions, and critical workflows.
