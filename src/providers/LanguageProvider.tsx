import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { type LanguageCode, translations } from '@/config/languages'

type LanguageContextValue = {
    language: LanguageCode
    setLanguage: (language: LanguageCode) => void
    t: (key: string, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [language, setLanguageState] = useState<LanguageCode>(() => {
        return localStorage.getItem('smartv2.language') === 'zu' ? 'zu' : 'en'
    })

    const setLanguage = useCallback((nextLanguage: LanguageCode) => {
        localStorage.setItem('smartv2.language', nextLanguage)
        setLanguageState(nextLanguage)
    }, [])

    const value = useMemo<LanguageContextValue>(() => {
        return {
            language,
            setLanguage,
            t: (key, fallback) => translations[language]?.[key] || fallback || key,
        }
    }, [language, setLanguage])

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// Provider and hook intentionally share a module while the recovery structure settles.
// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
    const context = useContext(LanguageContext)

    if (!context) {
        throw new Error('useLanguage must be used inside LanguageProvider')
    }

    return context
}
