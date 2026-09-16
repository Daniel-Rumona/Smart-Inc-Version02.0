import type {
  AgentExecutionMode,
  AgentImplementationKey,
  AgentProvider,
} from '@/types/agentOrchestration'

export type AgentImplementationDefinition = {
  key: AgentImplementationKey
  label: string
  provider: AgentProvider
  executionMode: AgentExecutionMode
  workspacePath: string
  supportsVoice: boolean
  supportsDocuments: boolean
  billable: boolean
  defaultCapabilities: string[]
}

export const AGENT_IMPLEMENTATIONS: AgentImplementationDefinition[] = [
  {
    key: 'business-plan',
    label: 'Business Plan',
    provider: 'smart-incubation',
    executionMode: 'internal',
    workspacePath: '/incubatee/business-plan',
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
    defaultCapabilities: [
      'Business plan drafting',
      'Growth planning',
      'Word document generation',
    ],
  },
  {
    key: 'strategic-plan',
    label: 'Strategic Plan',
    provider: 'smart-incubation',
    executionMode: 'internal',
    workspacePath: '/incubatee/strategic-plan',
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
    defaultCapabilities: [
      'Strategic analysis',
      'Objectives and measures',
      'Implementation roadmap',
      'Word document generation',
    ],
  },
  {
    key: 'pitchfy',
    label: 'Pitchfy Pitch Coach',
    provider: 'pitchfy',
    executionMode: 'external_api',
    workspacePath: '/incubatee/pitch-coach',
    supportsVoice: true,
    supportsDocuments: false,
    billable: true,
    defaultCapabilities: [
      'Brief analysis',
      'Pitch preparation',
      'Interview practice',
      'Voice practice',
      'Transcript scoring',
      'Performance analytics',
    ],
  },
]

export const getAgentImplementation = (
  implementationKey?: string | null,
): AgentImplementationDefinition | undefined =>
  AGENT_IMPLEMENTATIONS.find(
    (implementation) => implementation.key === implementationKey,
  )
