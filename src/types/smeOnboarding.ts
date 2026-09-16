export type SmeOnboardingPath = 'company_program' | 'open_program' | 'marketplace'

export type SmeOnboardingAnswers = {
  hasCompany: boolean
  companyCode?: string
  companyName?: string
  selectedProgramId?: string
  consultingBudget?: number
  wantsSpecificProgram?: boolean
  path: SmeOnboardingPath
  completedAt?: unknown
}
