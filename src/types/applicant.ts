export type ApplicantProfile = {
  id?: string
  uid: string
  participantName: string
  email: string
  phone?: string
  gender?: string
  idNumber?: string
  alternativePhone?: string
  maritalStatus?: string
  employmentStatus?: string
  educationLevel?: string
  disabilityStatus?: string
  province?: string
  city?: string
}

export type BusinessProfile = {
  id?: string
  ownerUid: string
  applicantProfileId: string
  businessName: string
  participantName?: string
  email?: string
  phone?: string
  sector?: string
  natureOfBusiness?: string
  beeLevel?: string
  registrationStatus?: string
  registrationNumber?: string
  dateOfRegistration?: unknown
  yearsOfTrading?: number
  youthOwnedPercent?: number
  femaleOwnedPercent?: number
  blackOwnedPercent?: number
  ownership?: {
    youthOwnedPercent?: number
    femaleOwnedPercent?: number
    blackOwnedPercent?: number
  }
  businessAddress?: string
  province?: string
  city?: string
  postalCode?: string
  hostCommunity?: string
  locationType?: string
}

export type ApplicantProfileBundle = {
  applicantProfile: ApplicantProfile
  businessProfile: BusinessProfile
}

export type ApplicantProfileInput = Partial<Omit<ApplicantProfile & BusinessProfile, 'id' | 'uid' | 'ownerUid' | 'applicantProfileId'>> & {
  participantName: string
  email: string
  businessName: string
}

export type ApplicantProgram = {
  id: string
  name?: string
  description?: string
  type?: string
  cohortYear?: string
  status?: string
  startDate?: unknown
  eligibilityCriteria?: Record<string, unknown>
  companyCode?: string
  openToExternalSmes?: boolean
}

export type ApplicantApplication = {
  id: string
  programId?: string
  programName?: string
  applicationStatus?: string
  complianceScore?: number
  submittedAt?: unknown
}
