export type AgentId = string

export type AgentProvider = 'smart-incubation' | 'pitchfy' | 'other'

export type AgentExecutionMode = 'internal' | 'external_api'

export type AgentStatus = 'active' | 'inactive' | 'archived'

export type AgentImplementationKey =
  | 'business-plan'
  | 'strategic-plan'
  | 'pitchfy'

export type AgentDefinition = {
  id: AgentId
  name: string
  description: string
  implementationKey: AgentImplementationKey
  workspacePath: string
  capabilities: string[]
  provider: AgentProvider
  executionMode: AgentExecutionMode
  status: AgentStatus
  supportsAssignment: boolean
  supportsVoice: boolean
  supportsDocuments: boolean
  billable: boolean
  createdAt?: unknown
  updatedAt?: unknown
  createdByUid?: string | null
  updatedByUid?: string | null
}

export type AgentRegistryInput = Omit<
  AgentDefinition,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdByUid'
  | 'updatedByUid'
>

export type InterventionDeliveryStrategy =
  | 'human_only'
  | 'agent_only'
  | 'agent_with_ops_review'
  | 'agent_with_consultant_review'

export type CompanyAgentSettings = {
  companyCode: string
  enabledAgentIds: AgentId[]
  updatedAt?: unknown
  updatedByUid?: string | null
  updatedByEmail?: string | null
}
