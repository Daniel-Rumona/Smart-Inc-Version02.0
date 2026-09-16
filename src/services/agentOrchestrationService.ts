import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'
import type {
  AgentDefinition,
  AgentId,
  CompanyAgentSettings,
  InterventionDeliveryStrategy,
} from '@/types/agentOrchestration'
import {
  getAgentDefinition,
  listActiveAgents,
} from '@/services/agentRegistryService'

export const DELIVERY_STRATEGY_OPTIONS: Array<{
  value: InterventionDeliveryStrategy
  label: string
  description: string
}> = [
  {
    value: 'human_only',
    label: 'Human delivery',
    description: 'Operations assigns a human delivery owner.',
  },
  {
    value: 'agent_only',
    label: 'Agent delivery',
    description: 'The agent completes the intervention with the SME.',
  },
  {
    value: 'agent_with_ops_review',
    label: 'Agent + operations review',
    description: 'The agent does the work and operations approves the result.',
  },
  {
    value: 'agent_with_consultant_review',
    label: 'Agent + consultant review',
    description: 'The agent works from start to finish and an assigned consultant reviews it.',
  },
]

export { getAgentDefinition }

export const getAgentWorkspaceUrl = async (
  agentId: string,
  assignmentId: string,
): Promise<string | null> => {
  const agent = await getAgentDefinition(agentId)

  if (!agent || agent.status !== 'active' || !agent.workspacePath) {
    return null
  }

  return `${agent.workspacePath}?assignmentId=${encodeURIComponent(assignmentId)}`
}

export const getCompanyAgentSettings = async (
  companyCode: string,
  knownActiveAgents?: AgentDefinition[],
): Promise<CompanyAgentSettings> => {
  const [snapshot, activeAgents] = await Promise.all([
    getDoc(doc(getFirebaseDb(), 'companyAgentSettings', companyCode)),
    knownActiveAgents ? Promise.resolve(knownActiveAgents) : listActiveAgents(),
  ])

  const data = snapshot.data() || {}
  const knownIds = new Set(activeAgents.map((agent) => agent.id))

  const enabledAgentIds = Array.isArray(data.enabledAgentIds)
    ? data.enabledAgentIds.filter(
        (id): id is AgentId =>
          typeof id === 'string' && knownIds.has(id),
      )
    : []

  return {
    ...data,
    companyCode,
    enabledAgentIds,
  }
}

export const getCompanyAvailableAgents = async (
  companyCode: string,
): Promise<AgentDefinition[]> => {
  const activeAgents = await listActiveAgents()
  const settings = await getCompanyAgentSettings(companyCode, activeAgents)
  const enabledIds = new Set(settings.enabledAgentIds)

  return activeAgents.filter(
    (agent) => agent.supportsAssignment && enabledIds.has(agent.id),
  )
}

export const saveCompanyAgentSettings = async (
  companyCode: string,
  enabledAgentIds: AgentId[],
  user: FullIdentity,
): Promise<void> => {
  const activeAgents = await listActiveAgents()
  const activeIds = new Set(activeAgents.map((agent) => agent.id))
  const validAgentIds = [
    ...new Set(enabledAgentIds.filter((agentId) => activeIds.has(agentId))),
  ]

  await setDoc(
    doc(getFirebaseDb(), 'companyAgentSettings', companyCode),
    {
      companyCode,
      enabledAgentIds: validAgentIds,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      updatedByEmail: user.email,
    },
    { merge: true },
  )
}

export const isAgentStrategy = (strategy?: string | null): boolean =>
  strategy === 'agent_only' ||
  strategy === 'agent_with_ops_review' ||
  strategy === 'agent_with_consultant_review'

export const strategyRequiresHumanReviewer = (
  strategy?: string | null,
): boolean =>
  strategy === 'agent_with_ops_review' ||
  strategy === 'agent_with_consultant_review'
