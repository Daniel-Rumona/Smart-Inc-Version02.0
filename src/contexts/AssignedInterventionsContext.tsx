import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import type { AssignedIntervention as BaseAssignedIntervention } from '@/types/interventions'

export type AssigneeType = 'consultant' | 'operations' | 'projectadmin' | 'provider' | 'agent'

export type AssignedIntervention = BaseAssignedIntervention & {
  assigneeId?: string
  assigneeEmail?: string
  assigneeName?: string
  assigneeType?: AssigneeType
  interventionTitle?: string
  type?: string
  groupId?: string
}

type AssignedInterventionsContextValue = {
  assignments: AssignedIntervention[]
  loading: boolean
  refresh: () => Promise<void>
  isMine: (assignment: AssignedIntervention) => boolean
}

const AssignedInterventionsContext = createContext<AssignedInterventionsContextValue | undefined>(undefined)

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()

export const AssignedInterventionsProvider = ({ children }: PropsWithChildren) => {
  const { user } = useFullIdentity()
  const [assignments, setAssignments] = useState<AssignedIntervention[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.companyCode) {
      setAssignments([])
      return
    }

    setLoading(true)
    try {
      const snapshot = await getDocs(query(collection(db, 'assignedInterventions'), where('companyCode', '==', user.companyCode)))
      setAssignments(snapshot.docs.map((document) => ({
        ...(document.data() as AssignedIntervention),
        id: document.id,
      })))
    } finally {
      setLoading(false)
    }
  }, [user?.companyCode])

  useEffect(() => {
    void load()
  }, [load])

  const isMine = useCallback((assignment: AssignedIntervention) => {
    const uid = normalize(user?.uid)
    const email = normalize(user?.email)
    const ids = [
      assignment.assigneeId,
    ].map(normalize)
    const emails = [
      assignment.assigneeEmail,
    ].map(normalize)

    return (!!uid && ids.includes(uid)) || (!!email && emails.includes(email))
  }, [user?.email, user?.uid])

  const value = useMemo(() => ({ assignments, loading, refresh: load, isMine }), [assignments, isMine, load, loading])

  return <AssignedInterventionsContext.Provider value={value}>{children}</AssignedInterventionsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAssignedInterventions = () => {
  const context = useContext(AssignedInterventionsContext)
  if (!context) throw new Error('useAssignedInterventions must be used inside AssignedInterventionsProvider')
  return context
}
