export type BusinessPlanTemplate = {
  id: string
  name: string
  description: string
  fileName: string
  previewUrl?: string | null
  sections: string[]
}

export type BusinessProfile = {
  companyName: string
  contactName: string
  contactEmail: string
  website: string
  industry: string
  location: string
  stage: string
  description: string
  productsServices: string
  targetCustomers: string
  revenueModel: string
  team: string
  goals: string
  fundingNeed: string
  additionalContext: string
  templateId?: string
}

export type BusinessPlanDraft = {
  templateId: string
  executiveSummary: string
  companyOverview: string
  marketOpportunity: string
  productsServices: string[]
  leadership: Array<{ name: string; role: string }>
  operationalPlan: string[]
  marketingSalesStrategy: string[]
  competitiveAdvantage: string
  financialProjections: Array<{ year: string; revenue: string; assumptions: string }>
  fundingUses: Array<{ amount: string; purpose: string }>
  risks: Array<{ risk: string; mitigation: string }>
  exitStrategy: string[]
  milestones: Array<{ period: string; goal: string }>
  nextSteps: string
}

export type BusinessPlanDraftResult = {
  draft: BusinessPlanDraft
  template: BusinessPlanTemplate
  source: 'gemini' | 'fallback'
  generatedAt: string
}
