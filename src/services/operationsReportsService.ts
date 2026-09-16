import { agentApiBaseUrl, isAgentApiConfigured } from '@/config/agent'

export type ReportActionPlanItem = {
  action: string
  owner: string
  priority: string
  due: string
  successMeasure: string
}

export type ReportInsights = {
  executiveSummary: string
  operationalHighlights: string[]
  risks: string[]
  attendanceSummary: string
  actionPlan: ReportActionPlanItem[]
  templateFields: Record<string, string>
}

export type GenerateReportInsightsPayload = {
  reportTitle: string
  periodLabel: string
  companyName?: string | null
  audience?: string
  metrics: Record<string, unknown>
  demandCoverage: Array<Record<string, unknown>>
  attentionItems: Array<Record<string, unknown>>
  attendance: Record<string, unknown>
  compliance: Record<string, unknown>
}

export const OPERATIONS_REPORT_TEMPLATE_PATH = '/templates/operations-report-template.docx'

export const generateOperationsReportInsights = async (payload: GenerateReportInsightsPayload) => {
  if (!isAgentApiConfigured) throw new Error('agent-api-not-configured')

  const response = await fetch(`${agentApiBaseUrl}/api/reports/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error('report-insights-failed')

  return response.json() as Promise<{
    insights: ReportInsights
    model: string
    templatePath: string
  }>
}
