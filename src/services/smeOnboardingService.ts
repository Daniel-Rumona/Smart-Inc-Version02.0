import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import { getOrCreatePlatformOwnerCompany, PLATFORM_OWNER_CODE } from '@/services/companiesService'
import type { SmeOnboardingAnswers } from '@/types/smeOnboarding'

export const completeSmeOnboarding = async (uid: string, answers: SmeOnboardingAnswers) => {
  const companyCode = answers.hasCompany && answers.companyCode
    ? answers.companyCode
    : (await getOrCreatePlatformOwnerCompany()).code

  await setDoc(doc(getFirebaseDb(), 'users', uid), {
    companyCode,
    consultingBudget: answers.consultingBudget ?? null,
    ...(answers.selectedProgramId ? { assignedProgramIds: arrayUnion(answers.selectedProgramId) } : {}),
    smeOnboarding: {
      hasCompany: answers.hasCompany,
      companyCode,
      companyName: answers.companyName ?? null,
      selectedProgramId: answers.selectedProgramId ?? null,
      wantsSpecificProgram: answers.wantsSpecificProgram ?? null,
      path: answers.path,
      completedAt: serverTimestamp(),
    },
    smeOnboardingComplete: true,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/**
 * Skipping still has to leave the SME somewhere. Anyone who did not arrive through a company's
 * program link lands in the platform owner's bucket, which is what gives them the marketplace.
 */
export const skipSmeOnboarding = async (uid: string, currentCompanyCode?: string | null) => {
  await setDoc(doc(getFirebaseDb(), 'users', uid), {
    companyCode: String(currentCompanyCode || '').trim() || PLATFORM_OWNER_CODE,
    smeOnboardingComplete: true,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
