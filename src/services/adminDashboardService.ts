import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'

export type AdminDashboardError = {
  id: string
  source: string
  message: string
  createdAt?: Date
}

export type AdminDashboardSummary = {
  users: number
  activeUsers: number
  companies: number
  applications: number
  errors: number
  recentErrors: AdminDashboardError[]
  previous: Pick<AdminDashboardSummary, 'users' | 'activeUsers' | 'companies' | 'applications' | 'errors'>
}

const toDate = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate() as Date
  }
  return undefined
}

const inRange = (value: unknown, range?: [Date, Date]) => {
  if (!range) return true
  const date = toDate(value)
  return !!date && date >= range[0] && date <= range[1]
}
const beforeEnd = (value: unknown, end?: Date) => !end || !toDate(value) || toDate(value)! <= end

export const getAdminDashboardSummary = async (user: FullIdentity, range?: [Date, Date], previousRange?: [Date, Date]): Promise<AdminDashboardSummary> => {
  if (!['systemadmin', 'admin'].includes(user.role)) throw new Error('forbidden')
  const db = getFirebaseDb()
  const [users, applications, failedLogs] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'applications')),
    getDocs(collection(db, 'emailDeliveryLogs')),
  ])
  const companyCodes = new Set<string>()
  const previousCompanyCodes = new Set<string>()
  users.docs.filter((record) => beforeEnd(record.data().createdAt, range?.[1])).forEach((record) => {
    const code = String(record.data().companyCode || '').trim()
    if (code) companyCodes.add(code)
  })
  applications.docs.filter((record) => beforeEnd(record.data().createdAt || record.data().submittedAt, range?.[1])).forEach((record) => {
    const code = String(record.data().companyCode || '').trim()
    if (code) companyCodes.add(code)
  })
  users.docs.filter((record) => beforeEnd(record.data().createdAt, previousRange?.[1])).forEach((record) => {
    const code = String(record.data().companyCode || '').trim()
    if (code) previousCompanyCodes.add(code)
  })
  applications.docs.filter((record) => beforeEnd(record.data().createdAt || record.data().submittedAt, previousRange?.[1])).forEach((record) => {
    const code = String(record.data().companyCode || '').trim()
    if (code) previousCompanyCodes.add(code)
  })
  const currentUsers = users.docs.filter((record) => beforeEnd(record.data().createdAt, range?.[1]))
  const previousUsers = users.docs.filter((record) => beforeEnd(record.data().createdAt, previousRange?.[1]))
  const currentApplications = applications.docs.filter((record) => inRange(record.data().createdAt || record.data().submittedAt, range))
  const previousApplications = applications.docs.filter((record) => inRange(record.data().createdAt || record.data().submittedAt, previousRange))
  const currentErrors = failedLogs.docs.filter((record) => record.data().status === 'failed' && inRange(record.data().createdAt, range))
  const previousErrors = failedLogs.docs.filter((record) => record.data().status === 'failed' && inRange(record.data().createdAt, previousRange))
  const active = (record: (typeof users.docs)[number]) => record.data().status !== 'inactive' && record.data().status !== 'deleted' && record.data().active !== false

  return {
    users: currentUsers.length,
    activeUsers: currentUsers.filter(active).length,
    companies: companyCodes.size,
    applications: currentApplications.length,
    errors: currentErrors.length,
    previous: {
      users: previousUsers.length,
      activeUsers: previousUsers.filter(active).length,
      companies: previousCompanyCodes.size,
      applications: previousApplications.length,
      errors: previousErrors.length,
    },
    recentErrors: failedLogs.docs.filter((record) => record.data().status === 'failed').map((record) => ({
      id: record.id,
      source: String(record.data().source || 'email'),
      message: String(record.data().error || 'Unknown delivery error'),
      createdAt: toDate(record.data().createdAt),
    })).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, 20),
  }
}
