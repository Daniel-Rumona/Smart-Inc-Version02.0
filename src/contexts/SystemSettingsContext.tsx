import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'

type SystemSettings = Record<string, unknown>

type SystemSettingsContextValue = {
  settings: SystemSettings
  loading: boolean
  consultantLabel: string
  smeDivisionModel: string
  getSetting: <T,>(key: string, fallback: T) => T
  refresh: () => Promise<void>
}

const SystemSettingsContext = createContext<SystemSettingsContextValue | undefined>(undefined)

export const SystemSettingsProvider = ({ children }: PropsWithChildren) => {
  const { user } = useFullIdentity()
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const companyCode = String(user?.companyCode || '').trim()
      const [globalSnapshot, companySnapshot] = await Promise.all([
        getDoc(doc(db, 'systemSettings', 'global')),
        companyCode ? getDoc(doc(db, 'companies', companyCode)) : Promise.resolve(null),
      ])
      setSettings(Object.assign(
        {},
        globalSnapshot.exists() ? globalSnapshot.data() : {},
        companySnapshot?.exists() ? companySnapshot.data() : {},
      ))
    } finally {
      setLoading(false)
    }
  }, [user?.companyCode])

  useEffect(() => {
    void load()
  }, [load])

  const getSetting = useCallback(<T,>(key: string, fallback: T) => {
    return (settings[key] ?? fallback) as T
  }, [settings])

  const consultantLabel = getSetting('consultantLabel', 'Consultants')
  const smeDivisionModel = getSetting('smeDivisionModel', 'registered_consultant_only')
  const value = useMemo(() => ({ settings, loading, consultantLabel, smeDivisionModel, getSetting, refresh: load }), [consultantLabel, getSetting, load, loading, settings, smeDivisionModel])

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext)
  if (!context) throw new Error('useSystemSettings must be used inside SystemSettingsProvider')
  return context
}
