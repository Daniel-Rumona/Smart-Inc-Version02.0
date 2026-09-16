# Agent Orchestration

## Principle

Agents are centrally registered capabilities. They are not standalone menu products. An incubatee reaches an agent workspace through an assigned intervention.

## Control layers

1. **System administrator** enables approved agents for each company in `companyAgentSettings/{companyCode}`.
2. **Operations** configures each intervention with a delivery strategy and one of the company-enabled agents.
3. **Assignment** copies the delivery strategy, agent, and review requirements into `assignedInterventions` for an auditable execution record.
4. **Incubatee** sees the delivery owner on the Interventions page and opens the agent workspace from the active intervention.
5. **Operations monitoring** tracks human and agent work together. Layered agent work enters a review queue before participant completion confirmation.

## Programme modes

- `simultaneous`: a programme can mix human-only and agent-delivered interventions.
- `post_diagnostic`: diagnostics are completed first; agent-configured interventions then enter delivery.
- `fully_agentic`: only agent-configured interventions enter the delivery queue. Operations monitors delivery and performs reviews where configured.

## Intervention delivery strategies

- `human_only`
- `agent_only`
- `agent_with_ops_review`
- `agent_with_consultant_review`

## Collections

- `companyAgentSettings`: company entitlements controlled by system administrators.
- `interventions`: stores `deliveryStrategy`, `agentId`, `reviewRequired`, and `reviewerType`.
- `assignedInterventions`: execution snapshot plus `agentWorkStatus`, `reviewStatus`, and reviewer ownership.
- `agentWorkRuns`: agent inputs, generated draft, template metadata, status, and review audit fields.

## Agent workspace contract

An agent route must receive `assignmentId`, validate that the assignment belongs to that agent and company, persist work to `agentWorkRuns`, and update the matching `assignedInterventions` record. Direct menu access is disabled.

All document agents use one conversational workspace contract:

- no intake forms;
- one natural question at a time, while accepting a full information dump;
- PDF, DOCX, TXT, and CSV evidence attachments;
- facts extracted only from the conversation and supplied documents;
- visible readiness progress;
- downloadable editable Word output;
- the same review and monitoring lifecycle regardless of document type.

Registered document agents currently include `business-plan` and `strategic-plan`. Their interface is shared; their question guide, evidence requests, drafting prompt, and document builder are agent-specific.
