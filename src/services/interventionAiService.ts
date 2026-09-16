import type { AiReview, AssignedInterventionLike } from '@/types/interventions'

const DEFAULT_AI_BASE_URL = 'https://yoursdvniel-smartinc-api.hf.space'

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const numeric = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()

const metricLabelFor = (metric?: string) => {
  const value = normalize(metric)
  if (value.includes('hour')) return 'Hours'
  if (value.includes('session')) return 'Session(s)'
  if (value.includes('document')) return 'Document(s)'
  if (value.includes('deliverable')) return 'Deliverable(s)'
  if (value.includes('report')) return 'Report(s)'
  if (value.includes('submission')) return 'Submission(s)'
  return metric || 'Units'
}

type ApiResponse = {
  summary?: string
  polishedNotes?: string
  blockers?: string[]
  nextSteps?: string[]
  warnings?: string[]
  confidence?: number
  completionReadiness?: 'not_ready' | 'close' | 'ready'
  proofSuggestions?: Array<{
    label?: string
    reason?: string
    required?: boolean
  }>
  calculation?: {
    suggestedHours?: number | null
    suggestedUnitsCompleted?: number | null
    suggestedProgressPct?: number | null
  }
  error?: string
}

const fallbackReview = (text: string, intervention: AssignedInterventionLike): AiReview => {
  const currentProgress = numeric(intervention.progress) ?? 0
  const targetType = normalize(intervention.targetType)
  const targetValue = numeric(intervention.targetValue)
  const targetActual = numeric(intervention.targetActual) ?? 0
  const metric = normalize(intervention.targetMetric)
  const hourMatches = text.match(/(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr)/i)
  const sessionMatches = text.match(/(\d+(?:\.\d+)?)\s*(sessions|session)/i)
  const documentMatches = text.match(/(\d+(?:\.\d+)?)\s*(documents|document|reports|report|deliverables|deliverable)/i)
  const percentMatches = text.match(/(\d+(?:\.\d+)?)\s*%/i)

  const suggestedHours = hourMatches ? numeric(hourMatches[1]) : undefined
  let suggestedUnits = undefined as number | undefined
  if (metric.includes('session')) suggestedUnits = sessionMatches ? numeric(sessionMatches[1]) : undefined
  if (!suggestedUnits && !metric.includes('hour')) suggestedUnits = documentMatches ? numeric(documentMatches[1]) : undefined

  let suggestedProgress = percentMatches ? numeric(percentMatches[1]) : undefined
  if (suggestedProgress == null && targetType === 'number' && targetValue && targetValue > 0) {
    const increment = metric.includes('hour') ? suggestedHours : suggestedUnits
    if (increment != null) suggestedProgress = ((targetActual + increment) / targetValue) * 100
  }
  if (suggestedProgress == null) suggestedProgress = Math.min(100, currentProgress + 15)

  const finalProgress = clampProgress(suggestedProgress)
  const mentionsBlocker = /block|blocked|delay|delayed|stuck|waiting|issue|problem/i.test(text)
  const mentionsEvidence = /proof|poe|evidence|document|attendance|register|invoice|photo|report/i.test(text)

  return {
    summary: `AI reviewed the update for ${intervention.interventionTitle || 'the intervention'} and converted it into a structured progress entry.`,
    polishedNotes: text.trim(),
    suggestedHours,
    suggestedUnits,
    suggestedProgress: finalProgress,
    confidence: mentionsBlocker ? 78 : 86,
    completionReadiness: finalProgress >= 95 ? 'ready' : finalProgress >= 70 ? 'close' : 'not_ready',
    warnings: mentionsBlocker ? ['The update mentions a blocker or delay. Review before marking the intervention as complete.'] : [],
    blockers: mentionsBlocker ? ['Possible implementation blocker detected from the update text.'] : [],
    nextSteps: finalProgress >= 95
      ? ['Request SME confirmation and attach final proof of execution.']
      : ['Capture proof of work and schedule the next progress checkpoint.'],
    proofSuggestions: [
      {
        id: 'attendance-register',
        label: metricLabelFor(intervention.targetMetric) === 'Session(s)' ? 'Attendance register' : 'Progress evidence',
        reason: mentionsEvidence ? 'The update references evidence or documents.' : 'Useful for validating the progress update.',
        required: finalProgress >= 95,
      },
      {
        id: 'consultant-notes',
        label: 'Facilitator notes',
        reason: 'Supports the structured progress captured from the AI review.',
        required: false,
      },
    ],
  }
}

const mapApiResponse = (data: ApiResponse, text: string, intervention: AssignedInterventionLike): AiReview => {
  const fallback = fallbackReview(text, intervention)
  return {
    summary: data.summary || fallback.summary,
    polishedNotes: data.polishedNotes || fallback.polishedNotes,
    suggestedHours: numeric(data.calculation?.suggestedHours) ?? fallback.suggestedHours,
    suggestedUnits: numeric(data.calculation?.suggestedUnitsCompleted) ?? fallback.suggestedUnits,
    suggestedProgress: data.calculation?.suggestedProgressPct != null
      ? clampProgress(Number(data.calculation.suggestedProgressPct))
      : fallback.suggestedProgress,
    confidence: numeric(data.confidence) ?? fallback.confidence,
    completionReadiness: data.completionReadiness || fallback.completionReadiness,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter(Boolean).map(String) : fallback.warnings,
    blockers: Array.isArray(data.blockers) ? data.blockers.filter(Boolean).map(String) : fallback.blockers,
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps.filter(Boolean).map(String) : fallback.nextSteps,
    proofSuggestions: Array.isArray(data.proofSuggestions) && data.proofSuggestions.length
      ? data.proofSuggestions.map((item, index) => ({
          id: `proof-${index}`,
          label: item.label || 'Supporting evidence',
          reason: item.reason || 'Recommended by AI based on the update.',
          required: !!item.required,
        }))
      : fallback.proofSuggestions,
  }
}

export const analyseInterventionUpdate = async (params: {
  sourceText: string
  intervention: AssignedInterventionLike
  endpoint?: string
}): Promise<AiReview> => {
  const sourceText = params.sourceText.trim()
  if (!sourceText) throw new Error('Progress update text is required.')

  const endpoint = params.endpoint || `${import.meta.env.VITE_AI_BASE_URL || DEFAULT_AI_BASE_URL}/analyze-intervention-update`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: sourceText,
        notes: sourceText,
        currentProgress: params.intervention.progress || 0,
        targetType: params.intervention.targetType,
        targetMetric: params.intervention.targetMetric,
        targetValue: params.intervention.targetValue,
        targetActual: params.intervention.targetActual,
        interventionTitle: params.intervention.interventionTitle,
        beneficiaryName: params.intervention.beneficiaryName,
      }),
    })

    const data = await response.json().catch(() => ({})) as ApiResponse
    if (!response.ok || data.error) throw new Error(data.error || 'AI analysis failed')
    return mapApiResponse(data, sourceText, params.intervention)
  } catch {
    return fallbackReview(sourceText, params.intervention)
  }
}
