import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import { matchesActiveProgram } from '@/services/workspaceProgramsService'
import type { FullIdentity } from '@/types/identity'

type ListComplianceRowsOptions = {
  activeProgramId?: string | null
  departmentId?: string | null
  user?: FullIdentity | null
}

type TimelineRow = {
  id: string
  participantId?: string
  programId?: string | null
  departmentId?: string | null
  key?: string
  type?: string
  currentStatus?: string
  issueDate?: string
  expiryDate?: string
  fileName?: string
  url?: string
  updatedAt?: unknown
  createdAt?: unknown
}

export const COMPLIANCE_DOCUMENT_TYPES = [
  'CIPC registration',
  'Tax clearance',
  'B-BBEE certificate',
  'Bank confirmation',
  'Proof of address',
  'ID document',
]

const cleanKey = (value?: string) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const listComplianceRows = async ({
  activeProgramId,
  departmentId,
  user,
}: ListComplianceRowsOptions = {}) => {
  const [applications, timeline] = await Promise.all([
    getDocs(collection(getFirebaseDb(), 'participants')),
    getDocs(collection(getFirebaseDb(), 'complianceDocuments')),
  ])
  const timelineRows = timeline.docs.map((row) => ({ id: row.id, ...row.data() })) as TimelineRow[]

  return {
    rows: applications.docs.flatMap((row) => {
      const participant = row.data()
      const participantId = row.id
      if (user?.companyCode && participant.companyCode && participant.companyCode !== user.companyCode) return []
      if (!matchesActiveProgram(user, activeProgramId, participant.programId)) return []
      if (departmentId && participant.departmentId !== departmentId) return []
      const documents = timelineRows
        .filter((document) => document.participantId === participantId && (!participant.programId || document.programId === participant.programId))
        .map((document) => ({
          ...document,
          key: document.key || cleanKey(document.type),
          type: document.type || document.key || 'Document',
          currentStatus: document.currentStatus || 'pending',
          currentFile: {
            fileName: document.fileName || null,
            url: document.url || null,
            issueDate: document.issueDate || null,
            expiryDate: document.expiryDate || null,
          },
        }))
      return [{
        id: row.id,
        ...participant,
        participantId,
        documents,
        required: COMPLIANCE_DOCUMENT_TYPES.map((type) => ({
          id: cleanKey(type),
          key: cleanKey(type),
          title: type,
          type: 'upload',
          requiredAt: 'program',
          hasExpiry: false,
        })),
      }]
    }),
  }
}
