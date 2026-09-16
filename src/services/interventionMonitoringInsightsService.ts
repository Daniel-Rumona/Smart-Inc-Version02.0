import { agentApiBaseUrl, isAgentApiConfigured } from '@/config/agent'

export type MonitoringInsightSeverity = 'success' | 'info' | 'warning' | 'danger'

export type MonitoringInsight = {
  title: string
  body: string
  severity: MonitoringInsightSeverity
}

export type MonitoringRecommendedAction = {
  action: string
  owner: string
  priority: string
  due: string
  reason: string
}

export type InterventionMonitoringInsights = {
  summary: string
  insights: MonitoringInsight[]
  recommendedActions: MonitoringRecommendedAction[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  focusAreas: string[]
}

export type InterventionMonitoringInsightsPayload = {
  companyName?: string | null
  filters: Record<string, unknown>
  metrics: Record<string, unknown>
  statusBreakdown: Array<Record<string, unknown>>
  holdUps: Array<Record<string, unknown>>
  progressBuckets: Array<Record<string, unknown>>
  overdue: Array<Record<string, unknown>>
  groupedRisks: Array<Record<string, unknown>>
  sampleAssignments: Array<Record<string, unknown>>
}

export const generateInterventionMonitoringInsights = async (
  payload: InterventionMonitoringInsightsPayload,
) => {
  if (!isAgentApiConfigured) throw new Error('agent-api-not-configured')

  const response = await fetch(`${agentApiBaseUrl}/api/interventions/monitoring-insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error('intervention-monitoring-insights-failed')

  return response.json() as Promise<{
    insights: InterventionMonitoringInsights
    model: string
    generatedAt: string
  }>
}
