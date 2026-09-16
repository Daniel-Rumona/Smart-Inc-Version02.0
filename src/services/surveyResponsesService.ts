import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseDb } from '@/config/firebase'
import { storage } from '@/firebase'
import { findParticipant } from '@/services/incubateeWorkspaceService'
import { toFieldsArray, type SurveyField, type SurveyTemplate } from '@/services/surveyTemplatesService'
import type { FullIdentity } from '@/types/identity'

const participantDisplayName = (data: Record<string, unknown> | undefined) =>
    String(data?.participantName || data?.businessName || data?.smmeName || data?.companyName || 'Unnamed SME')

export type SurveyAnswers = Record<string, unknown>

export type SurveyResponseStatus = 'not started' | 'in progress' | 'submitted'

export type SurveyToAnswer = {
    /** The response row's id where one exists, so a draft can be resumed. */
    responseId?: string
    /** Set when this came from an operations assignment rather than an open programme survey. */
    assignmentId?: string
    templateId: string
    title: string
    description: string
    category: string
    questionCount: number
    status: SurveyResponseStatus
    updatedAt?: string
    submittedAt?: string
}

export type SurveyResponse = {
    id?: string
    templateId: string
    assignmentId?: string
    participantId: string
    programId?: string
    answers: SurveyAnswers
    status: 'draft' | 'submitted'
    updatedAt: string
    submittedAt?: string
    respondentUid?: string
}

const TEMPLATES = 'formTemplates'
const ASSIGNMENTS = 'formAssignments'
const RESPONSES = 'formResponses'

const asString = (value: unknown) => String(value ?? '').trim()

const templateIdOf = (row: Record<string, unknown>) =>
    asString(row.templateId) || asString(row.formId) || asString(row.templateID) || asString(row.surveyId)

/** Answers are stored per question id; files become the URLs they were uploaded to. */
export const uploadResponseFiles = async (
    participantId: string,
    templateId: string,
    fieldId: string,
    files: File[],
) => {
    const urls: string[] = []

    for (const file of files) {
        const path = `surveyResponses/${participantId}/${templateId}/${fieldId}/${Date.now()}-${file.name}`
        const stored = ref(storage, path)
        await uploadBytes(stored, file)
        urls.push(await getDownloadURL(stored))
    }

    return urls
}

/**
 * What this SME can answer: the surveys operations assigned to them, plus any
 * published template for their programme that has not been assigned directly.
 * Assignments win where both exist, so nothing is listed twice.
 */
export const listSurveysForParticipant = async (user: FullIdentity, programId?: string): Promise<SurveyToAnswer[]> => {
    const db = getFirebaseDb()
    const participant = await findParticipant(user)
    const participantId = asString(participant?.id) || user.uid

    const [assignments, responses, templates] = await Promise.all([
        getDocs(query(collection(db, ASSIGNMENTS), where('participantId', '==', participantId))),
        getDocs(query(collection(db, RESPONSES), where('participantId', '==', participantId))),
        programId
            ? getDocs(query(collection(db, TEMPLATES), where('programId', '==', programId)))
            : getDocs(collection(db, TEMPLATES)),
    ])

    const templateById = new Map(templates.docs.map((row) => {
        const data = row.data() as SurveyTemplate
        return [row.id, { ...data, id: row.id, fields: toFieldsArray(data.fields) }]
    }))

    const responseByTemplate = new Map(responses.docs.map((row) => {
        const data = row.data() as SurveyResponse
        return [data.templateId, { ...data, id: row.id }]
    }))

    const statusOf = (templateId: string): SurveyResponseStatus => {
        const response = responseByTemplate.get(templateId)
        if (!response) return 'not started'
        return response.status === 'submitted' ? 'submitted' : 'in progress'
    }

    const rows: SurveyToAnswer[] = []
    const seen = new Set<string>()

    assignments.docs.forEach((row) => {
        const data = row.data() as Record<string, unknown>
        const templateId = templateIdOf(data)
        if (!templateId) return

        const template = templateById.get(templateId)
        const response = responseByTemplate.get(templateId)
        seen.add(templateId)

        rows.push({
            responseId: response?.id,
            assignmentId: row.id,
            templateId,
            title: template?.title || asString(data.templateTitle) || asString(data.title) || 'Survey',
            description: template?.description || '',
            category: template?.category || 'Survey',
            questionCount: template?.fields.filter((field) => field.type !== 'heading').length || 0,
            status: statusOf(templateId),
            updatedAt: response?.updatedAt,
            submittedAt: response?.submittedAt,
        })
    })

    templateById.forEach((template, templateId) => {
        if (seen.has(templateId) || template.status !== 'published') return
        const response = responseByTemplate.get(templateId)

        rows.push({
            responseId: response?.id,
            templateId,
            title: template.title || 'Survey',
            description: template.description || '',
            category: template.category || 'Survey',
            questionCount: template.fields.filter((field) => field.type !== 'heading').length,
            status: statusOf(templateId),
            updatedAt: response?.updatedAt,
            submittedAt: response?.submittedAt,
        })
    })

    return rows.sort((left, right) => {
        const order = { 'not started': 0, 'in progress': 1, submitted: 2 } as const
        if (order[left.status] !== order[right.status]) return order[left.status] - order[right.status]
        return left.title.localeCompare(right.title)
    })
}

export type SurveyResponseContext = {
    template: SurveyTemplate
    fields: SurveyField[]
    participant: Record<string, unknown> | null
    participantId: string
    response: SurveyResponse | null
    assignmentId?: string
}

/** Everything the response page needs: the survey, the SME's record for prefills, and any saved draft. */
export const loadSurveyForResponse = async (user: FullIdentity, templateId: string): Promise<SurveyResponseContext | null> => {
    const db = getFirebaseDb()
    const snapshot = await getDoc(doc(db, TEMPLATES, templateId))
    if (!snapshot.exists()) return null

    const template = { ...(snapshot.data() as SurveyTemplate), id: templateId }
    const fields = toFieldsArray(template.fields)

    const participant = await findParticipant(user)
    const participantId = asString(participant?.id) || user.uid

    const [responses, assignments] = await Promise.all([
        getDocs(query(collection(db, RESPONSES), where('participantId', '==', participantId), where('templateId', '==', templateId))),
        getDocs(query(collection(db, ASSIGNMENTS), where('participantId', '==', participantId))),
    ])

    const existing = responses.docs[0]
    const assignment = assignments.docs.find((row) => templateIdOf(row.data() as Record<string, unknown>) === templateId)

    return {
        template: { ...template, fields },
        fields,
        participant: (participant as Record<string, unknown> | null) ?? null,
        participantId,
        response: existing ? { ...(existing.data() as SurveyResponse), id: existing.id } : null,
        assignmentId: assignment?.id,
    }
}

export const saveSurveyResponse = async (params: {
    context: SurveyResponseContext
    answers: SurveyAnswers
    status: 'draft' | 'submitted'
    user: FullIdentity
}): Promise<string> => {
    const db = getFirebaseDb()
    const { context, answers, status, user } = params
    const now = new Date().toISOString()

    const payload: SurveyResponse = {
        templateId: context.template.id as string,
        assignmentId: context.assignmentId,
        participantId: context.participantId,
        programId: context.template.programId,
        answers,
        status,
        updatedAt: now,
        ...(status === 'submitted' ? { submittedAt: now } : {}),
        respondentUid: user.uid,
    }

    const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))

    let responseId = context.response?.id
    if (responseId) {
        await setDoc(doc(db, RESPONSES, responseId), clean, { merge: true })
    } else {
        responseId = (await addDoc(collection(db, RESPONSES), clean)).id
    }

    // The incubatee dashboard counts open forms from the assignment's status,
    // so a submission has to be reflected there too.
    if (context.assignmentId) {
        await updateDoc(doc(db, ASSIGNMENTS, context.assignmentId), {
            status: status === 'submitted' ? 'submitted' : 'in progress',
            updatedAt: now,
        }).catch(() => undefined)
    }

    return responseId
}

// ─────────────────────────────────────────────────────────────
// Operations-side response tracking
// ─────────────────────────────────────────────────────────────

export type SurveyResponseRow = {
    participantId: string
    participantName: string
    assignmentId?: string
    responseId?: string
    status: SurveyResponseStatus
    updatedAt?: string
    submittedAt?: string
    answers?: SurveyAnswers
}

const assignmentStatusOf = (row: Record<string, unknown>): SurveyResponseStatus => {
    const status = asString(row.status).toLowerCase()
    if (status === 'submitted') return 'submitted'
    if (status === 'in progress') return 'in progress'
    return 'not started'
}

/** Every participant a survey was ever assigned to, and where each one stands. */
export const listResponsesForTemplate = async (templateId: string): Promise<SurveyResponseRow[]> => {
    const db = getFirebaseDb()
    const [assignments, responses] = await Promise.all([
        getDocs(query(collection(db, ASSIGNMENTS), where('templateId', '==', templateId))),
        getDocs(query(collection(db, RESPONSES), where('templateId', '==', templateId))),
    ])

    const responseByParticipant = new Map(responses.docs.map((row) => {
        const data = row.data() as SurveyResponse
        return [data.participantId, { ...data, id: row.id }]
    }))

    const participantIds = [...new Set(assignments.docs.map((row) => asString((row.data() as Record<string, unknown>).participantId)).filter(Boolean))]
    const participants = await Promise.all(participantIds.map((participantId) => getDoc(doc(db, 'participants', participantId))))
    const participantById = new Map(participants.filter((row) => row.exists()).map((row) => [row.id, row.data() as Record<string, unknown>]))

    return assignments.docs.map((row) => {
        const data = row.data() as Record<string, unknown>
        const participantId = asString(data.participantId)
        const response = responseByParticipant.get(participantId)

        return {
            participantId,
            participantName: participantDisplayName(participantById.get(participantId)),
            assignmentId: row.id,
            responseId: response?.id,
            status: response ? (response.status === 'submitted' ? 'submitted' : 'in progress') : assignmentStatusOf(data),
            updatedAt: response?.updatedAt || asString(data.updatedAt) || undefined,
            submittedAt: response?.submittedAt,
            answers: response?.answers,
        }
    }).sort((left, right) => left.participantName.localeCompare(right.participantName))
}

export type SurveyResponseSummary = { assigned: number; completed: number }

/** One pass over every assignment, so the templates table can show completion without a query per row. */
export const listResponseSummaries = async (): Promise<Record<string, SurveyResponseSummary>> => {
    const snapshot = await getDocs(collection(getFirebaseDb(), ASSIGNMENTS))
    const summaries: Record<string, SurveyResponseSummary> = {}

    snapshot.docs.forEach((row) => {
        const data = row.data() as Record<string, unknown>
        const templateId = templateIdOf(data)
        if (!templateId) return

        const summary = summaries[templateId] || { assigned: 0, completed: 0 }
        summary.assigned += 1
        if (assignmentStatusOf(data) === 'submitted') summary.completed += 1
        summaries[templateId] = summary
    })

    return summaries
}

export type ParticipantOption = { id: string; name: string; programId?: string }

/** The audience a survey can be hand-sent to: everyone on the company, optionally narrowed to one programme. */
export const listSendableParticipants = async (companyCode: string, programId?: string): Promise<ParticipantOption[]> => {
    if (!companyCode) return []
    const snapshot = await getDocs(query(collection(getFirebaseDb(), 'participants'), where('companyCode', '==', companyCode)))

    return snapshot.docs
        .map((row) => {
            const data = row.data() as Record<string, unknown>
            return {
                id: row.id,
                name: participantDisplayName(data),
                programId: typeof data.programId === 'string' ? data.programId : undefined,
            }
        })
        .filter((row) => !programId || row.programId === programId)
        .sort((left, right) => left.name.localeCompare(right.name))
}
