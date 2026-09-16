import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'

export const listCollection = async <T extends object>(collectionName: string): Promise<T[]> => {
  const snapshot = await getDocs(collection(getFirebaseDb(), collectionName))

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })) as T[]
}
