import type { ComplianceDocument } from '@/types/compliance'

export type OperationsParticipant = {
  id: string
  applicationId: string
  businessName: string
  participantName?: string
  email?: string
  phone?: string
  programId?: string
  programName?: string
  sector?: string
  stage?: string
  province?: string
  beeLevel?: string
  applicationStatus: string
  documents: ComplianceDocument[]
  requiredInterventions: number
  completedInterventions: number
}
