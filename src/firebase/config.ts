import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/config/firebase'

export const db = getFirebaseDb()
export const auth = getFirebaseAuth()
export const storage = getFirebaseStorage()
