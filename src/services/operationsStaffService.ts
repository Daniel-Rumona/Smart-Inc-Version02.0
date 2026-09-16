import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/config/firebase'
import { hasRolePermission } from '@/config/permissions'
import type { FullIdentity } from '@/types/identity'
import type { ManagedUser } from '@/types/operations'

const assertPermission = (user: FullIdentity, permission: 'view_staff' | 'manage_staff') => {
  if (!hasRolePermission(user.role, permission, user.permissions)) throw new Error('forbidden')
}

const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const functionsBaseUrl = String(
  import.meta.env.VITE_FUNCTIONS_BASE_URL
    || (projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : ''),
).replace(/\/$/, '')

const callStaffEndpoint = async <T>(path: string, body: Record<string, unknown>) => {
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) throw new Error('unauthenticated')
  const response = await fetch(`${functionsBaseUrl}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(result.error || 'request-failed')
  return result
}

export const listOperationsStaff = async (user: FullIdentity) => {
  assertPermission(user, 'view_staff')
  const source = collection(getFirebaseDb(), 'users')
  const snapshot = user.companyCode
    ? await getDocs(query(source, where('companyCode', '==', user.companyCode)))
    : await getDocs(source)

  return snapshot.docs.flatMap((record) => {
    const data = record.data()
    if (data.role !== 'consultant' && data.role !== 'projectadmin') return []
    return [{
      id: record.id,
      name: data.name || data.displayName || '',
      email: data.email || '',
      role: data.role,
      status: data.status === 'inactive' || data.active === false ? 'inactive' : 'active',
      companyCode: data.companyCode,
      permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
    } satisfies ManagedUser]
  })
}

export const createOperationsStaff = async (user: FullIdentity, values: Omit<ManagedUser, 'id'>) => {
  assertPermission(user, 'manage_staff')
  if (functionsBaseUrl) {
    await callStaffEndpoint('createPlatformUser', {
      ...values,
      companyCode: user.companyCode || values.companyCode || '',
      sendResetLink: true,
      sendEmail: true,
    })
    return
  }
  await addDoc(collection(getFirebaseDb(), 'users'), {
    ...values,
    companyCode: user.companyCode || values.companyCode || '',
    active: values.status === 'active',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  })
}

export const updateOperationsStaff = async (user: FullIdentity, id: string, values: Omit<ManagedUser, 'id'>) => {
  assertPermission(user, 'manage_staff')
  if (functionsBaseUrl) {
    await callStaffEndpoint('updatePlatformUser', {
      uid: id,
      ...values,
      companyCode: user.companyCode || values.companyCode || '',
    })
    return
  }
  await updateDoc(doc(getFirebaseDb(), 'users', id), {
    ...values,
    companyCode: user.companyCode || values.companyCode || '',
    active: values.status === 'active',
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  })
}

export const deleteOperationsStaff = async (user: FullIdentity, id: string) => {
  assertPermission(user, 'manage_staff')
  if (id === user.uid) throw new Error('self-delete')
  if (functionsBaseUrl) {
    await callStaffEndpoint('deleteUserAccount', { uid: id, reason: 'Removed from project staff' })
    return
  }
  await deleteDoc(doc(getFirebaseDb(), 'users', id))
}
