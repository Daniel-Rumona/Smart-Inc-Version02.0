export type ConnectionRequestTargetType = 'consultant' | 'agent'
export type ConnectionRequestStatus = 'pending' | 'contacted' | 'matched' | 'declined'
export type ConnectionRequestDeliveryMode = 'online' | 'in_person' | 'hybrid' | 'no_preference'
export type ConnectionRequestUrgency = 'low' | 'normal' | 'high'

export type ConnectionRequest = {
  id: string
  smeUid: string
  smeName: string
  smeEmail: string
  targetType: ConnectionRequestTargetType
  targetId: string
  targetName: string
  /** The SME's workspace - the platform owner (QTX) for independently registered SMEs. */
  companyCode: string
  areaOfSupport?: string
  deliveryMode?: ConnectionRequestDeliveryMode
  preferredStartDate?: string
  engagementDays?: number
  urgency?: ConnectionRequestUrgency
  budget?: number
  currency?: string
  note?: string
  status: ConnectionRequestStatus
  reviewerNote?: string
  createdAt?: unknown
  updatedAt?: unknown
}
