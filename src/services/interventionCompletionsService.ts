import { listCollection } from '@/services/firestoreList'
import type { InterventionCompletionRecord } from '@/types/interventions'

export const listInterventionCompletionRecords = () =>
  listCollection<InterventionCompletionRecord>('interventionCompletions')
