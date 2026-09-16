import { agentApiBaseUrl, agentSharedSecret, isAgentApiConfigured } from '@/config/agent'
import type {
  BusinessPlanDraft,
  BusinessPlanDraftResult,
  BusinessPlanTemplate,
  BusinessProfile,
} from '@/types/businessPlan'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'

export type BusinessPlanAssignmentContext = {
  id: string
  companyCode: string
  participantId: string
  interventionId: string
  interventionTitle: string
  businessName: string
  programId?: string
  programName?: string
  deliveryStrategy?: string
  agentId: string
  reviewRequired: boolean
  reviewerType?: string
}

const requestHeaders = () => ({
  'Content-Type': 'application/json',
  ...(agentSharedSecret ? { Authorization: `Bearer ${agentSharedSecret}` } : {}),
})

const requireAgentApi = () => {
  if (!isAgentApiConfigured) throw new Error('The business plan agent endpoint is not configured.')
}

const errorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { detail?: string }
    return body.detail || fallback
  } catch {
    return fallback
  }
}

export const listBusinessPlanTemplates = async (): Promise<BusinessPlanTemplate[]> => {
  requireAgentApi()
  const response = await fetch(`${agentApiBaseUrl}/api/business-plan/templates`, {
    headers: requestHeaders(),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Templates could not be loaded.'))
  const result = await response.json() as { templates: BusinessPlanTemplate[] }
  return result.templates
}

export const draftBusinessPlan = async (profile: BusinessProfile): Promise<BusinessPlanDraftResult> => {
  requireAgentApi()
  const response = await fetch(`${agentApiBaseUrl}/api/business-plan/draft`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ profile }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'The business plan could not be drafted.'))
  return response.json() as Promise<BusinessPlanDraftResult>
}

export const downloadBusinessPlan = async (profile: BusinessProfile, draft: BusinessPlanDraft) => {
  requireAgentApi()
  const response = await fetch(`${agentApiBaseUrl}/api/business-plan/document`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ profile, draft }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'The Word document could not be created.'))

  const disposition = response.headers.get('Content-Disposition') || ''
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'business-plan.docx'
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const getBusinessPlanAssignment = async (
  assignmentId: string,
  user: FullIdentity,
): Promise<BusinessPlanAssignmentContext> => {
  const snapshot = await getDoc(doc(getFirebaseDb(), 'assignedInterventions', assignmentId))
  if (!snapshot.exists()) throw new Error('This assigned intervention could not be found.')
  const data = snapshot.data()
  if (data.agentId !== 'business-plan' || data.deliveryActorType !== 'agent') {
    throw new Error('This intervention is not assigned to the Business Plan Agent.')
  }
  if (user.companyCode && data.companyCode && user.companyCode !== data.companyCode) {
    throw new Error('You do not have access to this intervention.')
  }
  const directParticipant = await getDoc(doc(getFirebaseDb(), 'participants', user.uid))
  const participantIds = new Set([user.uid])
  if (directParticipant.exists()) participantIds.add(directParticipant.id)
  if (!directParticipant.exists() && user.email) {
    const participantSnapshot = await getDocs(query(collection(getFirebaseDb(), 'participants'), where('email', '==', user.email)))
    participantSnapshot.docs.forEach((record) => participantIds.add(record.id))
  }
  if (data.participantId && !participantIds.has(String(data.participantId))) {
    throw new Error('You do not have access to this assigned intervention.')
  }
  return {
    id: snapshot.id,
    companyCode: String(data.companyCode || user.companyCode || ''),
    participantId: String(data.participantId || user.uid),
    interventionId: String(data.interventionId || ''),
    interventionTitle: String(data.interventionTitle || 'Business plan'),
    businessName: String(data.beneficiaryName || data.businessName || user.displayName || ''),
    programId: data.programId ? String(data.programId) : undefined,
    programName: data.programName ? String(data.programName) : undefined,
    deliveryStrategy: data.deliveryStrategy ? String(data.deliveryStrategy) : undefined,
    agentId: 'business-plan',
    reviewRequired: data.reviewRequired === true,
    reviewerType: data.reviewerType ? String(data.reviewerType) : undefined,
  }
}

export const saveBusinessPlanAgentDraft = async (
  assignment: BusinessPlanAssignmentContext,
  profile: BusinessProfile,
  result: BusinessPlanDraftResult,
  user: FullIdentity,
) => {
  const db = getFirebaseDb()
  await Promise.all([
    setDoc(doc(db, 'agentWorkRuns', assignment.id), {
      assignmentId: assignment.id,
      companyCode: assignment.companyCode,
      participantId: assignment.participantId,
      interventionId: assignment.interventionId,
      interventionTitle: assignment.interventionTitle,
      programId: assignment.programId || null,
      programName: assignment.programName || null,
      agentId: assignment.agentId,
      agentName: 'Business Plan Agent',
      deliveryStrategy: assignment.deliveryStrategy || 'agent_only',
      reviewRequired: assignment.reviewRequired,
      reviewerType: assignment.reviewerType || null,
      status: 'draft_ready',
      profile,
      draft: result.draft,
      template: result.template,
      generationSource: result.source,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      updatedByEmail: user.email,
    }, { merge: true }),
    updateDoc(doc(db, 'assignedInterventions', assignment.id), {
      agentWorkStatus: 'draft_ready',
      agentRunId: assignment.id,
      progress: 70,
      status: 'in-progress',
      updatedAt: serverTimestamp(),
    }),
  ])
}

export const submitBusinessPlanAgentWork = async (
  assignment: BusinessPlanAssignmentContext,
  user: FullIdentity,
) => {
  const db = getFirebaseDb()
  const needsReview = assignment.reviewRequired
  await Promise.all([
    setDoc(doc(db, 'agentWorkRuns', assignment.id), {
      status: needsReview ? 'awaiting_review' : 'completed',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      updatedByEmail: user.email,
    }, { merge: true }),
    updateDoc(doc(db, 'assignedInterventions', assignment.id), {
      agentWorkStatus: needsReview ? 'awaiting_review' : 'completed',
      reviewStatus: needsReview ? 'pending' : null,
      progress: needsReview ? 90 : 100,
      assigneeCompletionStatus: needsReview ? 'pending_review' : 'done',
      status: 'awaiting_confirmation',
      updatedAt: serverTimestamp(),
    }),
  ])
}
