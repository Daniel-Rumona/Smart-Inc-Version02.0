import { listCollection } from '@/services/firestoreList'
import type { Participant } from '@/types/participant.types'

export const getParticipants = () => listCollection<Participant>('participants')
