import { getFirebaseAuth } from '@/config/firebase'

const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const functionsBaseUrl = String(
  import.meta.env.VITE_FUNCTIONS_BASE_URL
    || (projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : ''),
).replace(/\/$/, '')

export type EmailDeliveryLog = {
  id: string
  source: string
  status: string
  reason: string
  error: string
  recipients: string[]
  accepted: string[]
  rejected: string[]
  createdAt?: string | null
}

export type EmailSuppression = {
  id: string
  email: string
  reason: string
  failureCount: number
  updatedAt?: string | null
}

export type EmailOperationsSummary = {
  sent: number
  failed: number
  rejected: number
  bounced: number
  suppressed: number
  invalid: number
}

export type EmailOperations = {
  summary: EmailOperationsSummary
  logs: EmailDeliveryLog[]
  suppressions: EmailSuppression[]
}

const post = async <T>(path: string, body: Record<string, unknown>) => {
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) throw new Error('You are not signed in.')
  const response = await fetch(`${functionsBaseUrl}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Email request failed.')
  return result
}

export const getEmailOperations = () => post<EmailOperations>('getEmailOperations', {})

export const sendAdminEmail = (values: { to: string, subject: string, message: string }) =>
  post<{ ok: true, id: string }>('sendAdminEmail', values)
