import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase'

export type OnboardingQuestion = {
  id: string
  label?: string
  question?: string
  type?: string
  options?: string[] | string
  required?: boolean
  maxSelections?: number
}

export type OnboardingDocument = {
  id: string
  title: string
  required: boolean
}

export type ProgramOnboardingConfig = {
  name: string
  questions: OnboardingQuestion[]
  documents: OnboardingDocument[]
}

const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const functionsBaseUrl = String(
  import.meta.env.VITE_FUNCTIONS_BASE_URL
    || (projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : ''),
).replace(/\/$/, '')

export type NewParticipant = {
  email: string
  participantName: string
  businessName: string
  phone?: string
  programId: string
  programName?: string
  sector?: string
  stage?: string
  province?: string
  beeLevel?: string
  onboardingAnswers?: Record<string, string | string[]>
}

const cleanKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const getProgramOnboardingConfig = async (programId: string): Promise<ProgramOnboardingConfig> => {
  const db = getFirebaseDb()
  const snapshot = await getDoc(doc(db, 'programs', programId))
  const data = snapshot.data()
  const documentSource = Array.isArray(data?.complianceRequirements) ? data.complianceRequirements : []

  return {
    name: String(data?.name || data?.programName || data?.title || programId),
    questions: Array.isArray(data?.onboardingQuestions) ? data.onboardingQuestions : [],
    documents: documentSource.flatMap((item: Record<string, unknown>) => {
      const title = String(item.name || '').trim()
      return title ? [{ id: String(item.id || cleanKey(title)), title, required: item.required !== false }] : []
    }),
  }
}

export const createOperationsParticipant = async (values: NewParticipant) => {
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) throw new Error('You are not signed in.')
  const response = await fetch(`${functionsBaseUrl}/createParticipantAccount`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
  const result = await response.json() as { error?: string, uid?: string }
  if (!response.ok) throw new Error(result.error || 'Participant could not be created.')
  if (!result.uid) throw new Error('Participant account was created without an identifier.')
  return result.uid
}
