import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import { COMPLIANCE_DOCUMENT_TYPES } from '@/services/complianceService'
import type { FullIdentity } from '@/types/identity'
import type { IncubateeFormAssignment, IncubateeIntervention, IncubateeInterventionAppointment, IncubateeInterventionRequest, IncubateeNotification, IncubateeRequiredIntervention, IncubateeResource, IncubateeWorkspace } from '@/types/incubatee'
import type { FirestoreDate } from '@/types/interventions'

type LooseDocument = Record<string, unknown> & { id: string }
const norm = (value: unknown) => String(value || '').trim().toLowerCase()
const cleanKey = (value: unknown) => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const progressValue = (row: Record<string, unknown>) => typeof row.progress === 'number' ? row.progress : Number((row.progress as Record<string, unknown> | undefined)?.percentage || 0)
const getAssigneeStatus = (row: Record<string, unknown>) => norm(row.assigneeStatus)
const getParticipantStatus = (row: Record<string, unknown>) => norm(row.participantStatus)
const getCompletionStatus = (row: Record<string, unknown>) => norm(row.completionStatus || row.participantCompletionStatus)
const getAssigneeCompletionStatus = (row: Record<string, unknown>) => norm(row.assigneeCompletionStatus)
const timestampValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export const canAcceptIncubateeIntervention = (row: IncubateeIntervention) => row.status === 'Awaiting Your Acceptance'
export const canConfirmIncubateeIntervention = (row: IncubateeIntervention) => row.status === 'Awaiting Confirmation'

const displayStatus = (row: Record<string, unknown>): IncubateeIntervention['status'] => {
  if (String(row.id || '').startsWith('unassigned-')) return 'Pending Assignment'
  if (getAssigneeStatus(row) === 'declined' || getParticipantStatus(row) === 'declined') return 'Declined'
  if (getCompletionStatus(row) === 'rejected') return 'Rejected'
  if (getCompletionStatus(row) === 'confirmed' || row.completionConfirmedAt) return 'Completed'
  if (getAssigneeCompletionStatus(row) === 'done' || progressValue(row) >= 100 || ['submitted', 'awaiting_confirmation'].includes(getCompletionStatus(row))) return 'Awaiting Confirmation'
  if (getAssigneeStatus(row) === 'accepted' && (!getParticipantStatus(row) || getParticipantStatus(row) === 'pending')) return 'Awaiting Your Acceptance'
  if (getAssigneeStatus(row) === 'accepted' && getParticipantStatus(row) === 'accepted') return 'In Progress'
  if (getAssigneeStatus(row) && getAssigneeStatus(row) !== 'accepted') return 'Awaiting Facilitator'
  return 'Pending Assignment'
}

export const findParticipant = async (user: FullIdentity) => {
  const db = getFirebaseDb()
  const direct = await getDoc(doc(db, 'participants', user.uid))
  if (direct.exists()) return { id: direct.id, ...direct.data() } as LooseDocument
  const snapshot = await getDocs(query(collection(db, 'participants'), where('email', '==', user.email)))
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LooseDocument
}

export const listIncubateeOutstandingComplianceDocuments = async (user: FullIdentity) => {
  const participant = await findParticipant(user)
  const participantId = String(participant?.id || user.uid)
  const snapshot = await getDocs(query(
    collection(getFirebaseDb(), 'complianceDocuments'),
    where('participantId', '==', participantId),
  ))
  const documents = snapshot.docs.map((row) => ({ id: row.id, ...row.data() } as LooseDocument))

  return COMPLIANCE_DOCUMENT_TYPES.flatMap((title) => {
    const key = cleanKey(title)
    const document = documents.find((item) => cleanKey(item.key || item.type) === key)
    const status = norm(document?.currentStatus || document?.status || 'missing')
    if (['valid', 'approved'].includes(status)) return []

    return [{
      id: String(document?.id || key),
      title,
      status: status === 'missing' ? 'Missing' : status.replace(/[_-]+/g, ' '),
      fileName: String(document?.fileName || ''),
      issueDate: String(document?.issueDate || ''),
      expiryDate: String(document?.expiryDate || ''),
    }]
  })
}

export const loadIncubateeWorkspace = async (user: FullIdentity): Promise<IncubateeWorkspace | null> => {
  const db = getFirebaseDb()
  const participant = await findParticipant(user)
  const participantId = String(participant?.id || user.uid)
  const participantIds = [...new Set([participantId, user.uid].filter(Boolean))]
  const [applicationSnapshots, assignments, timeline, requests, forms, assessments, notifications] = await Promise.all([
    Promise.all([
      getDocs(query(collection(db, 'applications'), where('participantId', 'in', participantIds))),
      getDocs(query(collection(db, 'applications'), where('uid', '==', user.uid))),
      getDocs(query(collection(db, 'applications'), where('userId', '==', user.uid))),
    ]),
    getDocs(query(collection(db, 'assignedInterventions'), where('participantId', 'in', participantIds))),
    getDocs(query(collection(db, 'complianceDocuments'), where('participantId', '==', participantId))),
    getDocs(query(collection(db, 'interventionRequests'), where('participantId', '==', participantId))),
    getDocs(query(collection(db, 'formAssignments'), where('participantId', '==', participantId))),
    getDocs(query(collection(db, 'formRequests'), where('participantId', '==', participantId))),
    getDocs(query(collection(db, 'notifications'), where('participantId', '==', participantId))),
  ])
  const applicationRows = new Map<string, LooseDocument>()
  applicationSnapshots.forEach((snapshot) => snapshot.docs.forEach((row) => applicationRows.set(row.id, { id: row.id, ...row.data() } as LooseDocument)))
  const accepted = [...applicationRows.values()].find((row) => norm(row.applicationStatus) === 'accepted')
  if (!accepted) return null
  const diagnosticPlan = await getDoc(doc(db, 'diagnosticPlans', accepted.id))
  const planData = (diagnosticPlan.data() || {}) as Record<string, unknown>
  const applicationInterventions = (accepted.interventions || {}) as Record<string, unknown>
  const confirmedBy = (planData.confirmedBy || applicationInterventions.confirmedBy || {}) as Record<string, unknown>
  const confirmedMeta = (planData.confirmedMeta || {}) as Record<string, unknown>
  const operationsConfirmation = confirmedBy.operations || confirmedMeta.operations
  const participantConfirmation = confirmedBy.participant || confirmedBy.incubatee || confirmedMeta.participant || confirmedMeta.incubatee
  const growthPlanAvailable = diagnosticPlan.exists() && (operationsConfirmation === true || typeof operationsConfirmation === 'object' || norm(planData.status) === 'confirmed')
  const programId = typeof accepted.programId === 'string' ? accepted.programId : undefined
  const required = growthPlanAvailable && Array.isArray(planData.interventions) ? planData.interventions : []
  const definitionIds = [...new Set(required.map(item => String((item as Record<string, unknown>).interventionId || '')).filter(Boolean))]
  const definitionSnapshots = await Promise.all(definitionIds.map(id => getDoc(doc(db, 'interventions', id))))
  const definitionsById = new Map(definitionSnapshots.filter(snapshot => snapshot.exists()).map(snapshot => [snapshot.id, snapshot.data()]))
  const supportAreaByIntervention = new Map<string, string>()
  definitionsById.forEach((row, id) => {
    const area = String(row.areaOfSupport || row.department || row.departmentName || '').trim()
    if (!area) return
    supportAreaByIntervention.set(cleanKey(id), area)
  })
  required.forEach((item) => {
    const row = item as Record<string, unknown>
    const area = String(row.areaOfSupport || row.department || '').trim()
    if (!area) return
    ;[row.interventionId, row.id, row.title].map(cleanKey).filter(Boolean).forEach(key => supportAreaByIntervention.set(key, area))
  })
  const mappedAssignments = assignments.docs.map((document) => {
    const row = { id: document.id, ...document.data() } as LooseDocument
    const snapshot = (row.snapshot || {}) as Record<string, unknown>
    return {
      id: row.id,
      interventionId: String(row.interventionId || row.id),
      participantId,
      programId: typeof row.programId === 'string' ? row.programId : undefined,
      title: String(row.interventionTitle || row.title || snapshot.interventionTitle || snapshot.title || 'Untitled intervention'),
      description: String(row.description || ''),
      areaOfSupport: String(row.areaOfSupport || snapshot.areaOfSupport || snapshot.departmentName || supportAreaByIntervention.get(cleanKey(row.interventionId)) || supportAreaByIntervention.get(cleanKey(row.interventionTitle || row.title)) || ''),
      assigneeName: String(row.assigneeName || snapshot.assigneeName || ''),
      assigneeEmail: String(row.assigneeEmail || ''),
      deliveryActorType: row.deliveryActorType === 'agent' ? 'agent' : 'human',
      deliveryStrategy: row.deliveryStrategy as IncubateeIntervention['deliveryStrategy'],
      agentId: typeof row.agentId === 'string' ? row.agentId : undefined,
      agentName: typeof row.agentName === 'string' ? row.agentName : undefined,
      reviewRequired: row.reviewRequired === true,
      reviewerType: row.reviewerType === 'operations' || row.reviewerType === 'consultant' ? row.reviewerType : undefined,
      reviewStatus: typeof row.reviewStatus === 'string' ? row.reviewStatus : undefined,
      agentWorkStatus: typeof row.agentWorkStatus === 'string' ? row.agentWorkStatus : undefined,
      dueDate: row.dueDate as FirestoreDate,
      progress: progressValue(row),
      status: displayStatus(row),
      resources: Array.isArray(row.resources) ? row.resources as IncubateeResource[] : [],
      feedback: row.feedback as IncubateeIntervention['feedback'],
      raw: row,
    } satisfies IncubateeIntervention
  })
  // Keep every assignment. Multi-step interventions intentionally have several
  // records and collapsing by title hid the SME's completed-step history.
  const assignedInterventions = mappedAssignments.sort((a, b) => timestampValue(b.raw.updatedAt || b.raw.createdAt) - timestampValue(a.raw.updatedAt || a.raw.createdAt))
  const assignedKeys = new Set(assignedInterventions.flatMap((row) => [cleanKey(row.interventionId), cleanKey(row.title)].filter(Boolean)))
  const requiredInterventions = required.map((row: Record<string, unknown>) => {
    const catalogue = definitionsById.get(String(row.interventionId || row.id || '')) || {}
    return {
      id: String(row.interventionId || row.id || cleanKey(row.title)),
      title: String(row.title || 'Untitled intervention'),
      areaOfSupport: String(row.areaOfSupport || catalogue.areaOfSupport || ''),
      executionMode: (row.executionMode || catalogue.executionMode) === 'multi_step' ? 'multi_step' : 'single_session',
      steps: Array.isArray(row.steps) ? row.steps as IncubateeRequiredIntervention['steps'] : Array.isArray(catalogue.steps) ? catalogue.steps as IncubateeRequiredIntervention['steps'] : [],
    } satisfies IncubateeRequiredIntervention
  })
  const outstandingDocuments = Math.max(0, COMPLIANCE_DOCUMENT_TYPES.length - timeline.docs.filter((row) => ['valid', 'approved'].includes(norm(row.data().currentStatus))).length)
  const formRows: IncubateeFormAssignment[] = [
    ...forms.docs.map((row) => ({ id: row.id, kind: 'survey' as const, title: String(row.data().templateTitle || row.data().title || 'Survey'), status: String(row.data().status || 'pending'), updatedAt: row.data().updatedAt || row.data().createdAt })),
    ...assessments.docs.map((row) => ({ id: row.id, kind: 'assessment' as const, title: String(row.data().formTitle || row.data().title || 'Assessment'), status: String(row.data().status || 'pending'), dueAt: row.data().dueAt, updatedAt: row.data().updatedAt || row.data().sentAt })),
  ]
  return {
    participantId,
    applicationId: accepted.id,
    programId,
    programName: typeof accepted.programName === 'string' ? accepted.programName : undefined,
    businessName: String(accepted.businessName || participant?.businessName || user.displayName),
    growthPlanAvailable,
    growthPlanConfirmed: participantConfirmation === true || typeof participantConfirmation === 'object',
    operationsPlanConfirmation: typeof operationsConfirmation === 'object' ? operationsConfirmation as IncubateeWorkspace['operationsPlanConfirmation'] : undefined,
    participantPlanConfirmation: typeof participantConfirmation === 'object' ? participantConfirmation as IncubateeWorkspace['participantPlanConfirmation'] : undefined,
    outstandingDocuments,
    requiredInterventions,
    assignedInterventions: [...assignedInterventions, ...requiredInterventions.filter((row: IncubateeRequiredIntervention) => !assignedKeys.has(cleanKey(row.id)) && !assignedKeys.has(cleanKey(row.title))).map((row: IncubateeRequiredIntervention) => ({ id: `unassigned-${row.id}`, interventionId: row.id, participantId, programId, title: row.title, areaOfSupport: row.areaOfSupport, progress: 0, status: 'Pending Assignment' as const, resources: [], raw: {} }))],
    requests: requests.docs.map((row) => ({ id: row.id, ...row.data() })) as IncubateeInterventionRequest[],
    forms: formRows,
    notifications: notifications.docs
      .filter((row) => {
        const recipientRoles = row.data().recipientRoles
        return Array.isArray(recipientRoles) && recipientRoles.includes('incubatee')
      })
      .map((row) => ({ id: row.id, type: row.data().type, title: String(typeof row.data().message === 'object' && row.data().message !== null ? (row.data().message as Record<string, unknown>).incubatee || row.data().title || 'Notification' : row.data().title || row.data().message || 'Notification'), createdAt: row.data().createdAt, read: row.data().readBy?.incubatee === true } satisfies IncubateeNotification)),
  }
}

export const acceptIncubateeIntervention = async (_workspace: IncubateeWorkspace, intervention: IncubateeIntervention) => {
  await updateDoc(doc(getFirebaseDb(), 'assignedInterventions', intervention.id), { participantStatus: 'accepted', participantAcceptedAt: serverTimestamp(), status: 'in-progress', updatedAt: serverTimestamp() })
}

export const declineIncubateeIntervention = async (_workspace: IncubateeWorkspace, intervention: IncubateeIntervention, reason: string) => {
  await updateDoc(doc(getFirebaseDb(), 'assignedInterventions', intervention.id), { participantStatus: 'declined', declineReason: reason, status: 'declined', updatedAt: serverTimestamp() })
}

export const confirmIncubateeCompletion = async (workspace: IncubateeWorkspace, intervention: IncubateeIntervention, rating: number, comments: string) => {
  const db = getFirebaseDb()
  const feedback = { rating, comments }
  await Promise.all([
    updateDoc(doc(db, 'assignedInterventions', intervention.id), { participantCompletionStatus: 'confirmed', completionStatus: 'confirmed', completionConfirmedAt: serverTimestamp(), completedAt: serverTimestamp(), progress: 100, feedback, updatedAt: serverTimestamp() }),
    setDoc(doc(db, 'interventionCompletions', intervention.id), { assignedInterventionId: intervention.id, participantId: workspace.participantId, interventionId: intervention.interventionId, programId: workspace.programId || null, completedAt: serverTimestamp(), feedback, snapshot: { businessName: workspace.businessName, interventionTitle: intervention.title, departmentName: intervention.areaOfSupport || null, assigneeName: intervention.assigneeName || null } }, { merge: true }),
  ])
}

export const rejectIncubateeCompletion = async (_workspace: IncubateeWorkspace, intervention: IncubateeIntervention, reason: string) => {
  await updateDoc(doc(getFirebaseDb(), 'assignedInterventions', intervention.id), { participantCompletionStatus: 'rejected', completionStatus: 'rejected', completionRejectionReason: reason, updatedAt: serverTimestamp() })
}

export const requestIncubateeIntervention = async (workspace: IncubateeWorkspace, values: Omit<IncubateeInterventionRequest, 'id' | 'status'>) => {
  await addDoc(collection(getFirebaseDb(), 'interventionRequests'), { ...values, participantId: workspace.participantId, programId: workspace.programId || null, status: 'Pending', createdAt: serverTimestamp() })
}

export const confirmIncubateeGrowthPlan = async (workspace: IncubateeWorkspace, user: FullIdentity) => {
  if (!workspace.growthPlanAvailable) throw new Error('growth-plan-not-ready')
  if (!user.signatureURL) throw new Error('missing-signature')
  const confirmation = { uid: user.uid, name: user.displayName || user.name || user.email, email: user.email, signatureURL: user.signatureURL, confirmedAt: new Date().toISOString() }

  await setDoc(doc(getFirebaseDb(), 'diagnosticPlans', workspace.applicationId), {
    participantId: workspace.participantId,
    applicationId: workspace.applicationId,
    programId: workspace.programId || null,
    confirmedBy: { participant: confirmation, incubatee: confirmation },
    confirmedMeta: { participant: confirmation, incubatee: confirmation },
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

// Human-delivered interventions are scheduled as one-off `appointments` docs
// linked back by `assignedInterventionId` — agent-delivered work has no such
// records, so this is only ever called for non-agent interventions.
export const loadIncubateeInterventionAppointments = async (assignedInterventionId: string): Promise<IncubateeInterventionAppointment[]> => {
  const snapshot = await getDocs(query(collection(getFirebaseDb(), 'appointments'), where('assignedInterventionId', '==', assignedInterventionId)))
  return snapshot.docs.map((row) => {
    const data = row.data() as Record<string, unknown>
    return {
      id: row.id,
      startTime: data.startTime as FirestoreDate,
      endTime: data.endTime as FirestoreDate,
      status: String(data.status || 'pending'),
      meetingType: typeof data.meetingType === 'string' ? data.meetingType : undefined,
      location: typeof data.location === 'string' ? data.location : undefined,
      meetingLink: typeof data.meetingLink === 'string' ? data.meetingLink : undefined,
      discussionSummary: typeof data.discussionSummary === 'string' ? data.discussionSummary : undefined,
    } satisfies IncubateeInterventionAppointment
  })
}

export const markIncubateeNotification = async (id: string, read: boolean) => {
  await updateDoc(doc(getFirebaseDb(), 'notifications', id), { 'readBy.incubatee': read, updatedAt: serverTimestamp() })
}
