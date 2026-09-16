export type LivePlanStatus = 'Completed' | 'In progress' | 'Awaiting action' | 'Not assigned'
export type LivePlanItem = { interventionId?: string, id?: string, title: string, areaOfSupport?: string, steps?: Array<{ id?: string, title?: string }>, status: LivePlanStatus, progress: number, totalSteps: number, completedSteps: number, remainingSteps: number, history: Array<{ id: string, title: string, status: string, progress: number }> }

const norm = (value: unknown) => String(value || '').trim().toLowerCase()
const key = (value: unknown) => norm(value).replace(/[^a-z0-9]+/g, '-')
const timeValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}
const assignmentProgress = (row: Record<string, unknown>) => {
  const explicit = Number(row.progress || 0)
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit))
  return 0
}
const assignmentCompleted = (row: Record<string, unknown>) => ['completed', 'done', 'confirmed'].includes(norm(row.status))
  || norm(row.participantCompletionStatus) === 'confirmed' || norm(row.completionStatus) === 'confirmed'

export const buildLivePlanItems = <T extends { interventionId?: string, id?: string, title: string, areaOfSupport?: string, steps?: Array<{ id?: string, title?: string }> }>(items: T[], assignments: Array<Record<string, unknown>>) => items.map(item => {
  const definitionId = String(item.interventionId || item.id || '')
  const matches = assignments.filter(row => String(row.interventionId || '') === definitionId)
  const assignmentDeclaredSteps = matches.reduce((maximum, row) => Math.max(maximum, Number(row.stepCount || 0), Number(row.stepIndex ?? -1) + 1, Number(row.stepNumber || 0)), 0)
  const hasMultiStepAssignments = matches.some(row => norm(row.executionMode) === 'multi_step')
  const totalSteps = Math.max(1, item.steps?.length || 0, assignmentDeclaredSteps, hasMultiStepAssignments ? matches.length : 0)
  if (!matches.length) return { ...item, status: 'Not assigned' as const, progress: 0, totalSteps, completedSteps: 0, remainingSteps: totalSteps, history: [] }
  const progress = Math.round(matches.reduce((sum, row) => sum + assignmentProgress(row), 0) / Math.max(totalSteps, matches.length))
  const completed = matches.every(assignmentCompleted)
  const completedSteps = Math.min(totalSteps, matches.filter(assignmentCompleted).length)
  const awaiting = matches.some(row => assignmentProgress(row) >= 100 || ['awaiting_confirmation', 'awaiting confirmation'].includes(norm(row.status)) || norm(row.assigneeCompletionStatus) === 'done')
  const active = matches.some(row => assignmentProgress(row) > 0 || ['in-progress', 'active', 'started'].includes(norm(row.status)) || norm(row.participantStatus) === 'accepted')
  const allStepsComplete = completedSteps >= totalSteps
  const ordered = matches.map((row, originalIndex) => {
    const explicitIndex = Number.isFinite(Number(row.stepIndex)) ? Number(row.stepIndex) : Number.isFinite(Number(row.stepNumber)) ? Number(row.stepNumber) - 1 : -1
    const catalogueIndex = explicitIndex >= 0 ? explicitIndex : item.steps?.findIndex(step => key(step.id) === key(row.assignedStepId) || key(step.title) === key(row.assignedStepTitle || row.stepTitle)) ?? -1
    return { row, originalIndex, catalogueIndex }
  }).sort((a, b) => {
    if (a.catalogueIndex >= 0 && b.catalogueIndex >= 0) return a.catalogueIndex - b.catalogueIndex
    if (a.catalogueIndex >= 0) return -1
    if (b.catalogueIndex >= 0) return 1
    return timeValue(a.row.createdAt || a.row.assignedAt || a.row.updatedAt) - timeValue(b.row.createdAt || b.row.assignedAt || b.row.updatedAt) || a.originalIndex - b.originalIndex
  })
  return { ...item, status: allStepsComplete && completed ? 'Completed' as const : awaiting ? 'Awaiting action' as const : active ? 'In progress' as const : 'Awaiting action' as const, progress: allStepsComplete ? 100 : progress, totalSteps, completedSteps, remainingSteps: Math.max(0, totalSteps - completedSteps), history: ordered.map(({ row, catalogueIndex }, index) => { const resolvedIndex = catalogueIndex >= 0 ? catalogueIndex : index; return { id: String(row.id || `assignment-${index}`), title: String(row.assignedStepTitle || row.stepTitle || item.steps?.[resolvedIndex]?.title || `Step ${resolvedIndex + 1}`), status: assignmentCompleted(row) ? 'Completed' : String(row.status || 'Assigned'), progress: assignmentProgress(row) } }) }
})

export const livePlanProgress = (items: LivePlanItem[]) => items.length ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length) : 0
