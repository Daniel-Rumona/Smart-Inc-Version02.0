import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch, type DocumentData } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase'
import { isUserRole, type UserRole } from '@/config/roles'
import { isApplicantWorkspaceUser } from '@/services/applicationsService'
import { requestBrandedPasswordReset, requestBrandedVerificationEmail } from '@/services/brandedEmailService'

export type UserProfile = {
  uid: string
  name: string
  email: string
  emailVerified: boolean
  role: UserRole
  isApplicant: boolean
  firstLoginComplete: boolean
  smeOnboardingComplete: boolean
}

type ResolvedProfileData = {
  data: DocumentData | undefined
  verificationRecovered: boolean
}

export const resolveAuthenticatedProfileData = async (uid: string, email: string): Promise<ResolvedProfileData> => {
  const db = getFirebaseDb()
  const canonicalSnapshot = await getDoc(doc(db, 'users', uid))
  const canonicalData = canonicalSnapshot.data()

  if (canonicalData?.emailVerified === true || !email.trim()) {
    return { data: canonicalData, verificationRecovered: false }
  }

  try {
    const emailCandidates = [...new Set([email.trim(), email.trim().toLowerCase()])]

    for (const candidate of emailCandidates) {
      const matchingProfiles = await getDocs(query(
        collection(db, 'users'),
        where('email', '==', candidate),
        limit(5),
      ))
      const verifiedProfile = matchingProfiles.docs.find((record) => record.data().emailVerified === true)

      if (verifiedProfile) {
        const verifiedData = verifiedProfile.data()
        return {
          data: {
            ...canonicalData,
            emailVerified: true,
            emailVerifiedAt: verifiedData.emailVerifiedAt,
          },
          verificationRecovered: verifiedProfile.id !== uid,
        }
      }
    }
  } catch {
    // Some deployments restrict collection queries. The canonical UID profile
    // remains authoritative when the compatibility lookup is unavailable.
  }

  return { data: canonicalData, verificationRecovered: false }
}

const toProfile = async (user: User): Promise<UserProfile> => {
  const { data, verificationRecovered } = await resolveAuthenticatedProfileData(user.uid, user.email ?? '')

  if (verificationRecovered) {
    await setDoc(doc(getFirebaseDb(), 'users', user.uid), {
      emailVerified: true,
      emailVerifiedAt: data?.emailVerifiedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => undefined)
  }

  const email = typeof data?.email === 'string' ? data.email : user.email ?? ''
  const role = isUserRole(data?.role) ? data.role : 'incubatee'
  const isApplicant = role === 'incubatee'
    ? await isApplicantWorkspaceUser({ uid: user.uid, email }, data?.isApplicant)
    : false

  return {
    uid: user.uid,
    name: typeof data?.name === 'string' ? data.name : user.displayName ?? '',
    email,
    emailVerified: user.emailVerified || data?.emailVerified === true,
    role,
    isApplicant,
    firstLoginComplete: data?.firstLoginComplete === true,
    smeOnboardingComplete: data?.smeOnboardingComplete !== false,
  }
}

const ensureProfile = async (user: User, requestedRole: 'incubatee' | 'consultant' = 'incubatee') => {
  const profileRef = doc(getFirebaseDb(), 'users', user.uid)
  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) {
    const batch = writeBatch(getFirebaseDb())
    batch.set(profileRef, {
      name: user.displayName ?? '',
        email: user.email ?? '',
        phone: '',
        alternativePhone: '',
        phoneIsWhatsApp: false,
        alternativePhoneIsWhatsApp: false,
        profileImageUrl: '',
        verificationStatus: 'unverified',
      role: requestedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (requestedRole === 'consultant') {
      batch.set(doc(getFirebaseDb(), 'consultantProfiles', user.uid), {
        uid: user.uid,
        name: user.displayName ?? '',
        email: (user.email ?? '').toLowerCase(),
        headline: '',
        bio: '',
        experienceYears: 0,
        specialties: [],
        country: '',
        province: '',
        physicalAddress: '',
        operatingLocation: '',
        serviceRadiusKm: 25,
        currency: 'USD',
        services: [],
        availability: [],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Harare',
        acceptingClients: true,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
  }

  return toProfile(user)
}

export const loginUser = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return { user: result.user, profile: await ensureProfile(result.user) }
}

export const registerUser = async (payload: {
  name: string
  email: string
  password: string
  role?: 'incubatee' | 'consultant'
}) => {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), payload.email, payload.password)
  const role = payload.role === 'consultant' ? 'consultant' : 'incubatee'
  const batch = writeBatch(getFirebaseDb())

  batch.set(doc(getFirebaseDb(), 'users', result.user.uid), {
    name: payload.name,
    email: payload.email,
    role,
    mustChangePassword: false,
    ...(role === 'incubatee' ? { smeOnboardingComplete: false } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (role === 'consultant') {
    batch.set(doc(getFirebaseDb(), 'consultantProfiles', result.user.uid), {
      uid: result.user.uid,
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: '',
      alternativePhone: '',
      phoneIsWhatsApp: false,
      alternativePhoneIsWhatsApp: false,
      profileImageUrl: '',
      verificationStatus: 'unverified',
      headline: '',
      bio: '',
      experienceYears: 0,
      specialties: [],
      country: '',
      province: '',
      physicalAddress: '',
      operatingLocation: '',
      serviceRadiusKm: 25,
      currency: 'USD',
      services: [],
      availability: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Harare',
      acceptingClients: true,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
  await requestBrandedVerificationEmail()

  return { user: result.user, profile: await toProfile(result.user) }
}

export const loginWithGoogle = async (requestedRole: 'incubatee' | 'consultant' = 'incubatee') => {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
  return { user: result.user, profile: await ensureProfile(result.user, requestedRole) }
}

export const loginWithFacebook = async (requestedRole: 'incubatee' | 'consultant' = 'incubatee') => {
  const result = await signInWithPopup(getFirebaseAuth(), new FacebookAuthProvider())
  return { user: result.user, profile: await ensureProfile(result.user, requestedRole) }
}

export const sendPasswordResetLink = requestBrandedPasswordReset

export const logoutUser = () => signOut(getFirebaseAuth())
