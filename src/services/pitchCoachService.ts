import { getAuth } from 'firebase/auth'
import { agentApiBaseUrl, isAgentApiConfigured } from '@/config/agent'

export type PitchSessionMode = 'interactive' | 'pitch_first'

export type PitchProjectSummary = {
  id: string
  externalProjectId: string
  companyCode: string
  assignmentId?: string | null
  participantId?: string | null
  title?: string | null
  uiTitle?: string | null
  status: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type PitchProjectCreateInput = {
  companyCode: string
  assignmentId?: string
  participantId?: string
  text: string
  uiTitle?: string
}

export type PitchProviderStatus = {
  ok: boolean
  configured: boolean
  reachable?: boolean
  provider: 'pitchfy'
  statusCode?: number
  providerErrorType?: string | null
  message?: string
  creditsRemaining?: number | null
  accountPlan?: string | null
}

const authHeaders = async (): Promise<Record<string, string>> => {
  const currentUser = getAuth().currentUser

  if (!currentUser) {
    throw new Error('You must be signed in to use the pitch coach.')
  }

  return {
    Authorization: `Bearer ${await currentUser.getIdToken()}`,
    'Content-Type': 'application/json',
  }
}

const friendlyPitchCoachError = (message: string): string => {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('quota') ||
    normalized.includes('insufficient credit') ||
    normalized.includes('usage limit')
  ) {
    return 'The pitch coaching service has used all available credits for now. Please try again later or contact your programme administrator.'
  }

  return message
}

const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  if (!isAgentApiConfigured) {
    throw new Error('VITE_AGENT_API_BASE_URL is not configured.')
  }

  const headers = await authHeaders()
  const response = await fetch(`${agentApiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = body?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message || body?.error || 'The pitch coach request failed.'

    throw new Error(friendlyPitchCoachError(message))
  }

  return body as T
}

export const getPitchProviderStatus = async (): Promise<PitchProviderStatus> =>
  request<PitchProviderStatus>('/api/pitch-coach/status')

export const createPitchProject = async (
  input: PitchProjectCreateInput,
): Promise<{ ok: true; project: Record<string, unknown>; mapping: PitchProjectSummary }> =>
  request('/api/pitch-coach/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const listPitchProjects = async (
  companyCode: string,
  assignmentId?: string,
): Promise<{ ok: true; projects: PitchProjectSummary[] }> => {
  const params = new URLSearchParams({ companyCode })
  if (assignmentId) params.set('assignmentId', assignmentId)

  return request(`/api/pitch-coach/projects?${params.toString()}`)
}

export const deletePitchProject = async (
  projectId: string,
  companyCode: string,
): Promise<{ ok: true }> =>
  request(
    `/api/pitch-coach/projects/${encodeURIComponent(projectId)}?companyCode=${encodeURIComponent(companyCode)}`,
    { method: 'DELETE' },
  )

export const getPitchProject = async (
  projectId: string,
  companyCode: string,
): Promise<{ ok: true; project: Record<string, unknown> }> =>
  request(
    `/api/pitch-coach/projects/${encodeURIComponent(projectId)}?companyCode=${encodeURIComponent(companyCode)}`,
  )

export const getPitchBriefing = async (
  projectId: string,
  companyCode: string,
  mode: PitchSessionMode,
): Promise<{ ok: true; briefing: Record<string, unknown> }> => {
  const params = new URLSearchParams({ companyCode, mode })

  return request(
    `/api/pitch-coach/projects/${encodeURIComponent(projectId)}/briefing?${params.toString()}`,
  )
}

export const getPitchAnalytics = async (
  projectId: string,
  companyCode: string,
): Promise<{ ok: true; analytics: Record<string, unknown> }> =>
  request(
    `/api/pitch-coach/projects/${encodeURIComponent(projectId)}/analytics?companyCode=${encodeURIComponent(companyCode)}`,
  )

export const startPitchVoiceSession = async (
  projectId: string,
  companyCode: string,
  mode: PitchSessionMode,
): Promise<{ ok: true; voiceSession: Record<string, unknown> }> => {
  const params = new URLSearchParams({ projectId, companyCode, mode })
  return request(`/api/pitch-coach/voice/session?${params.toString()}`)
}
