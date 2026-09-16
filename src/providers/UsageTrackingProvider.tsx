import { useEffect, useRef, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import {
  createUsageId,
  saveUsagePageView,
  saveUsageSession,
} from '@/services/usageTrackingService'

const HEARTBEAT_INTERVAL_MS = 30_000

type ActivePage = {
  id: string
  path: string
  startedAt: Date
}

export const UsageTrackingProvider = ({ children }: PropsWithChildren) => {
  const location = useLocation()
  const { user } = useFullIdentity()
  const sessionIdRef = useRef<string | undefined>(undefined)
  const sessionStartedAtRef = useRef<Date | undefined>(undefined)
  const activePageRef = useRef<ActivePage | undefined>(undefined)
  const userRef = useRef(user)
  const path = `${location.pathname}${location.search}`

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    if (!user) return

    const sessionId = createUsageId('session')
    const startedAt = new Date()

    sessionIdRef.current = sessionId
    sessionStartedAtRef.current = startedAt
    void saveUsageSession({
      sessionId,
      user,
      startedAt,
      currentPath: `${window.location.pathname}${window.location.search}`,
      active: true,
    })

    const heartbeat = window.setInterval(() => {
      const currentUser = userRef.current
      const currentPage = activePageRef.current

      if (!currentUser || !currentPage) return

      const now = new Date()
      void saveUsageSession({
        sessionId,
        user: currentUser,
        startedAt,
        currentPath: currentPage.path,
        active: true,
        endedAt: now,
      })
      void saveUsagePageView({
        pageViewId: currentPage.id,
        sessionId,
        user: currentUser,
        path: currentPage.path,
        startedAt: currentPage.startedAt,
        endedAt: now,
      })
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      window.clearInterval(heartbeat)
      const currentUser = userRef.current

      if (currentUser) {
        void saveUsageSession({
          sessionId,
          user: currentUser,
          startedAt,
          currentPath: activePageRef.current?.path || '/',
          active: false,
        })
      }

      sessionIdRef.current = undefined
      sessionStartedAtRef.current = undefined
    }
  }, [user])

  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!user || !sessionId) return

    const previousPage = activePageRef.current
    const now = new Date()

    if (previousPage) {
      void saveUsagePageView({
        pageViewId: previousPage.id,
        sessionId,
        user,
        path: previousPage.path,
        startedAt: previousPage.startedAt,
        endedAt: now,
      })
    }

    activePageRef.current = {
      id: createUsageId('page'),
      path,
      startedAt: now,
    }

    const sessionStartedAt = sessionStartedAtRef.current
    if (sessionStartedAt) {
      void saveUsageSession({
        sessionId,
        user,
        startedAt: sessionStartedAt,
        currentPath: path,
        active: true,
        endedAt: now,
      })
    }
  }, [path, user])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return

      const currentUser = userRef.current
      const sessionId = sessionIdRef.current
      const sessionStartedAt = sessionStartedAtRef.current
      const currentPage = activePageRef.current
      const now = new Date()

      if (!currentUser || !sessionId || !sessionStartedAt || !currentPage) return

      void saveUsageSession({
        sessionId,
        user: currentUser,
        startedAt: sessionStartedAt,
        currentPath: currentPage.path,
        active: false,
        endedAt: now,
      })
      void saveUsagePageView({
        pageViewId: currentPage.id,
        sessionId,
        user: currentUser,
        path: currentPage.path,
        startedAt: currentPage.startedAt,
        endedAt: now,
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return children
}
