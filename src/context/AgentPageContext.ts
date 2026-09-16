import { useEffect } from 'react'
import { useOptionalAgent } from '@/providers/AgentProvider'

type LegacyAgentPageContext = {
  pageKey?: string
  pageName: string
  pagePurpose?: string
  purpose?: string
  filters?: Record<string, unknown>
  currentFilters?: Record<string, unknown>
  metrics?: unknown
  dataSummary?: Record<string, unknown>
  allowedActions?: unknown
  updatedAt?: string
  tables?: unknown
  selectedRecord?: unknown
  formFields?: unknown
  notes?: unknown
}

export const useRegisterAgentPageContext = (context: LegacyAgentPageContext) => {
  const agent = useOptionalAgent()
  const serialized = JSON.stringify(context)

  useEffect(() => {
    if (!agent) return
    agent.registerPageContext({
      pageKey: context.pageKey ?? context.pageName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      pageName: context.pageName,
      purpose: context.purpose ?? context.pagePurpose ?? '',
      currentFilters: context.currentFilters ?? context.filters,
      metrics: { items: context.metrics },
      dataSummary: context.dataSummary ?? {
        tables: context.tables,
        selectedRecord: context.selectedRecord,
        formFields: context.formFields,
        notes: context.notes,
      },
      updatedAt: new Date().toISOString(),
    })
  // Serialized context is the stable change signal for recovered pages that build objects inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, serialized])
}
