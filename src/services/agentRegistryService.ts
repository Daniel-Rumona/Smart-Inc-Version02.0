import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'
import type {
  AgentDefinition,
  AgentId,
  AgentRegistryInput,
  AgentStatus,
} from '@/types/agentOrchestration'
import {
  getAgentImplementation,
} from '@/config/agentImplementations'

const AGENTS_COLLECTION = 'agents'

const AGENT_STATUSES: AgentStatus[] = ['active', 'inactive', 'archived']

// These two agents ran without any Firestore dependency before the agent registry
// existed. Keeping a built-in fallback here means a company's core document agents
// never go down just because the `agents` collection hasn't been seeded yet, or a
// Firestore rules deploy is pending. Newer/outsourced agents (e.g. pitch-coach) are
// intentionally NOT included here — they should only work once properly registered.
const BUILT_IN_AGENT_FALLBACKS: Record<string, AgentDefinition> = {
  'business-plan': {
    id: 'business-plan',
    name: 'Business Plan Agent',
    description: 'Guides an SME through a structured business or growth plan and produces an editable Word document.',
    implementationKey: 'business-plan',
    workspacePath: '/incubatee/business-plan',
    capabilities: ['Business plan drafting', 'Growth planning', 'Word document generation'],
    provider: 'smart-incubation',
    executionMode: 'internal',
    status: 'active',
    supportsAssignment: true,
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
  },
  'strategic-plan': {
    id: 'strategic-plan',
    name: 'Strategic Plan Agent',
    description: 'Builds a practical multi-year strategic plan with priorities, measures, implementation ownership, and risks.',
    implementationKey: 'strategic-plan',
    workspacePath: '/incubatee/strategic-plan',
    capabilities: ['Strategic analysis', 'Objectives and measures', 'Implementation roadmap', 'Word document generation'],
    provider: 'smart-incubation',
    executionMode: 'internal',
    status: 'active',
    supportsAssignment: true,
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
  },
}

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

const normaliseAgent = (
  id: string,
  data: DocumentData,
): AgentDefinition => {
  const implementationKey = asString(data.implementationKey)
  const implementation = getAgentImplementation(implementationKey)
  const status = asString(data.status)

  return {
    id,
    name: asString(data.name),
    description: asString(data.description),
    implementationKey:
      implementation?.key ?? 'business-plan',
    workspacePath:
      asString(data.workspacePath) || implementation?.workspacePath || '',
    capabilities: asStringArray(data.capabilities),
    provider:
      data.provider === 'pitchfy' || data.provider === 'other'
        ? data.provider
        : 'smart-incubation',
    executionMode:
      data.executionMode === 'external_api'
        ? 'external_api'
        : 'internal',
    status: AGENT_STATUSES.includes(status as AgentStatus)
      ? (status as AgentStatus)
      : 'inactive',
    supportsAssignment: asBoolean(data.supportsAssignment, true),
    supportsVoice: asBoolean(
      data.supportsVoice,
      implementation?.supportsVoice ?? false,
    ),
    supportsDocuments: asBoolean(
      data.supportsDocuments,
      implementation?.supportsDocuments ?? false,
    ),
    billable: asBoolean(
      data.billable,
      implementation?.billable ?? false,
    ),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdByUid: asString(data.createdByUid) || null,
    updatedByUid: asString(data.updatedByUid) || null,
  }
}

const cleanAgentId = (value: string): string =>
  value.trim().toLowerCase()

const assertValidAgentId = (agentId: string): void => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentId)) {
    throw new Error(
      'Agent key may contain only lowercase letters, numbers, and single hyphens.',
    )
  }
}

const buildRegistryPayload = (
  values: AgentRegistryInput,
): AgentRegistryInput => {
  const implementation = getAgentImplementation(values.implementationKey)

  if (!implementation) {
    throw new Error('The selected agent implementation is not supported.')
  }

  const name = values.name.trim()
  const description = values.description.trim()
  const capabilities = [...new Set(values.capabilities.map((item) => item.trim()).filter(Boolean))]

  if (!name) throw new Error('Agent name is required.')
  if (!description) throw new Error('Agent description is required.')
  if (!capabilities.length) throw new Error('Add at least one capability.')

  return {
    name,
    description,
    implementationKey: implementation.key,
    workspacePath: implementation.workspacePath,
    capabilities,
    provider: implementation.provider,
    executionMode: implementation.executionMode,
    status: values.status,
    supportsAssignment: values.supportsAssignment,
    supportsVoice: implementation.supportsVoice,
    supportsDocuments: implementation.supportsDocuments,
    billable: implementation.billable,
  }
}

export const listAgents = async (): Promise<AgentDefinition[]> => {
  const snapshot = await getDocs(
    query(
      collection(getFirebaseDb(), AGENTS_COLLECTION),
      orderBy('name'),
    ),
  )

  return snapshot.docs.map((snapshotDoc) =>
    normaliseAgent(snapshotDoc.id, snapshotDoc.data()),
  )
}

export const listActiveAgents = async (): Promise<AgentDefinition[]> =>
  (await listAgents()).filter((agent) => agent.status === 'active')

export const subscribeAgents = (
  callback: (agents: AgentDefinition[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const agentsQuery = query(
    collection(getFirebaseDb(), AGENTS_COLLECTION),
    orderBy('name'),
  )

  return onSnapshot(
    agentsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((snapshotDoc) =>
          normaliseAgent(snapshotDoc.id, snapshotDoc.data()),
        ),
      )
    },
    (error) => onError?.(error),
  )
}

export const getAgentDefinition = async (
  agentId?: string | null,
): Promise<AgentDefinition | null> => {
  if (!agentId) return null

  try {
    const snapshot = await getDoc(
      doc(getFirebaseDb(), AGENTS_COLLECTION, agentId),
    )

    if (snapshot.exists()) {
      return normaliseAgent(snapshot.id, snapshot.data())
    }
  } catch {
    // Firestore unreachable or rules not yet deployed for this collection —
    // fall through to the built-in fallback below.
  }

  return BUILT_IN_AGENT_FALLBACKS[agentId] ?? null
}

export const createAgent = async (
  agentId: AgentId,
  values: AgentRegistryInput,
  user: FullIdentity,
): Promise<void> => {
  const cleanId = cleanAgentId(agentId)
  assertValidAgentId(cleanId)

  const reference = doc(
    getFirebaseDb(),
    AGENTS_COLLECTION,
    cleanId,
  )
  const existing = await getDoc(reference)

  if (existing.exists()) {
    throw new Error('An agent with this key already exists.')
  }

  const payload = buildRegistryPayload(values)

  await setDoc(reference, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: user.uid,
    updatedByUid: user.uid,
  })
}

export const updateAgent = async (
  agentId: AgentId,
  values: AgentRegistryInput,
  user: FullIdentity,
): Promise<void> => {
  const payload = buildRegistryPayload(values)

  await updateDoc(
    doc(getFirebaseDb(), AGENTS_COLLECTION, agentId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
    },
  )
}

export const setAgentStatus = async (
  agentId: AgentId,
  status: AgentStatus,
  user: FullIdentity,
): Promise<void> => {
  await updateDoc(
    doc(getFirebaseDb(), AGENTS_COLLECTION, agentId),
    {
      status,
      supportsAssignment: status === 'active',
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
    },
  )
}

export const archiveAgent = async (
  agentId: AgentId,
  user: FullIdentity,
): Promise<void> => {
  await setAgentStatus(agentId, 'archived', user)
}
