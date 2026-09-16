export type AgentCrudAction = {
  key: string
  label: string
  description: string
  requiresConfirmation?: boolean
}

export type AgentPageContext = {
  pageKey: string
  pageName: string
  purpose: string
  currentFilters?: Record<string, unknown>
  metrics?: Record<string, unknown>
  dataSummary?: Record<string, unknown>
  allowedActions?: AgentCrudAction[]
  updatedAt: string
}

export type AgentChatMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
  rateable?: boolean
  rating?: number
}
