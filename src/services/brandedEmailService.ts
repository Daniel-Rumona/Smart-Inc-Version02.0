import { getFirebaseAuth } from '@/config/firebase'

const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const functionsBaseUrl = String(
  import.meta.env.VITE_FUNCTIONS_BASE_URL
    || (projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : ''),
).replace(/\/$/, '')

type EmailRequestResult = {
  ok?: boolean
  verified?: boolean
  throttled?: boolean
  error?: string
}

const post = async (path: string, body: Record<string, unknown>, token?: string) => {
  if (!functionsBaseUrl) throw new Error('Functions base URL is not configured.')
  const response = await fetch(`${functionsBaseUrl}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const result = await response.json() as EmailRequestResult
  if (!response.ok) throw new Error(result.error || 'Email request failed.')
  return result
}

export const requestBrandedVerificationEmail = async () => {
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) throw new Error('You are not signed in.')
  return post('requestBrandedVerificationEmail', {}, token)
}

export const requestBrandedPasswordReset = async (email: string) => {
  await post('requestBrandedPasswordReset', { email })
}
