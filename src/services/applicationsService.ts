import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'

type ApplicationOwner = {
  uid: string
  email?: string | null
}

const applicationOwnerFields = ['uid', 'userId', 'participantId'] as const
const participantOwnerFields = ['uid', 'userId', 'participantId', 'ownerUid'] as const

export const hasApplicationForUser = async ({ uid, email }: ApplicationOwner) => {
  const db = getFirebaseDb()
  const directSnapshot = await getDoc(doc(db, 'applications', uid))

  if (directSnapshot.exists()) return true

  for (const field of applicationOwnerFields) {
    const snapshot = await getDocs(
      query(collection(db, 'applications'), where(field, '==', uid), limit(1)),
    )

    if (!snapshot.empty) return true
  }

  if (email) {
    const snapshot = await getDocs(
      query(collection(db, 'applications'), where('email', '==', email), limit(1)),
    )

    if (!snapshot.empty) return true
  }

  return false
}

export const hasParticipantForUser = async ({ uid, email }: ApplicationOwner) => {
  const db = getFirebaseDb()
  const directSnapshot = await getDoc(doc(db, 'participants', uid))

  if (directSnapshot.exists()) return true

  for (const field of participantOwnerFields) {
    const snapshot = await getDocs(
      query(collection(db, 'participants'), where(field, '==', uid), limit(1)),
    )

    if (!snapshot.empty) return true
  }

  if (email) {
    const normalizedEmail = email.toLowerCase()
    const emailSnapshot = await getDocs(
      query(collection(db, 'participants'), where('email', '==', email), limit(1)),
    )

    if (!emailSnapshot.empty) return true

    const lowerEmailSnapshot = await getDocs(
      query(collection(db, 'participants'), where('emailLower', '==', normalizedEmail), limit(1)),
    )

    if (!lowerEmailSnapshot.empty) return true
  }

  return false
}

export const isApplicantWorkspaceUser = async ({ uid, email }: ApplicationOwner, explicitIsApplicant?: unknown) => {
  if (typeof explicitIsApplicant === 'boolean') return explicitIsApplicant

  try {
    if (await hasParticipantForUser({ uid, email })) return false

    return !(await hasApplicationForUser({ uid, email }))
  } catch (error) {
    console.warn('Could not resolve applicant/incubatee workspace state. Defaulting to incubatee workspace.', error)
    return false
  }
}
