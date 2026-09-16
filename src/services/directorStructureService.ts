import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'
import type { DirectorOrgUnit, DirectorOrgUnitStatus, DirectorOrgUnitType } from '@/types/director'

type AnyDoc = Record<string, unknown>

const collectionForType = (type: DirectorOrgUnitType) => type === 'department' ? 'departments' : 'branches'

const toDate = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate() as Date
  return undefined
}

const mapUnit = (type: DirectorOrgUnitType, id: string, data: AnyDoc): DirectorOrgUnit => ({
  id,
  type,
  companyCode: String(data.companyCode || ''),
  name: String(data.name || ''),
  code: String(data.code || ''),
  managerName: String(data.managerName || ''),
  managerEmail: String(data.managerEmail || ''),
  status: (String(data.status || 'active') as DirectorOrgUnitStatus),
  notes: String(data.notes || ''),
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
})

export const listDirectorOrgUnits = async (user: FullIdentity, type: DirectorOrgUnitType) => {
  if (!user.companyCode) return []
  const snapshot = await getDocs(query(collection(getFirebaseDb(), collectionForType(type)), where('companyCode', '==', user.companyCode)))
  return snapshot.docs.map(record => mapUnit(type, record.id, record.data())).sort((a, b) => a.name.localeCompare(b.name))
}

export const saveDirectorOrgUnit = async (
  user: FullIdentity,
  type: DirectorOrgUnitType,
  payload: Pick<DirectorOrgUnit, 'name' | 'code' | 'managerName' | 'managerEmail' | 'status' | 'notes'>,
  id?: string,
) => {
  if (!user.companyCode) throw new Error('missing-company')
  const data = {
    companyCode: user.companyCode,
    name: payload.name.trim(),
    code: payload.code?.trim() || '',
    managerName: payload.managerName?.trim() || '',
    managerEmail: payload.managerEmail?.trim() || '',
    status: payload.status || 'active',
    notes: payload.notes?.trim() || '',
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
    updatedByEmail: user.email,
  }

  if (id) {
    await updateDoc(doc(getFirebaseDb(), collectionForType(type), id), data)
    return id
  }

  const created = await addDoc(collection(getFirebaseDb(), collectionForType(type)), {
    ...data,
    createdAt: serverTimestamp(),
    createdByUid: user.uid,
    createdByEmail: user.email,
  })
  return created.id
}
