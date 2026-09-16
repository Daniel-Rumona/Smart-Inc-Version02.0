import { applyActionCode, reload } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase'

export const confirmEmailVerificationCode = async (code: string) => {
  if (!code) throw new Error('Verification link is missing its secure code.')

  await applyActionCode(getFirebaseAuth(), code)

  const user = getFirebaseAuth().currentUser
  if (user) {
    await reload(user)
    if (user.emailVerified) {
      await setDoc(doc(getFirebaseDb(), 'users', user.uid), {
        emailVerified: true,
        emailVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  }

  return true
}
