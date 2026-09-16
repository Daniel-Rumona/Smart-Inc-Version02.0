import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { DriveStep } from 'driver.js'

export type PageGuide = {
    id: string
    title: string
    description?: string
    kind: 'page' | 'task'
    order: number
    steps: DriveStep[]
}

export type PageGuideRegistration = {
    pageId: string
    pageTitle: string
    guides: PageGuide[]
}

type PageGuideContextValue = {
    registration?: PageGuideRegistration
    setRegistration: (registration?: PageGuideRegistration) => void
}

const PageGuideContext = createContext<PageGuideContextValue | undefined>(undefined)

export const guideTarget = (id: string) => `[data-guide-target="${id}"]`

export const PageGuideProvider = ({ children }: PropsWithChildren) => {
    const [registration, setRegistration] = useState<PageGuideRegistration>()
    const value = useMemo(() => ({ registration, setRegistration }), [registration])
    return <PageGuideContext.Provider value={value}>{children}</PageGuideContext.Provider>
}

export const useRegisterPageGuide = (registration?: PageGuideRegistration) => {
    const context = useContext(PageGuideContext)
    if (!context) throw new Error('useRegisterPageGuide must be used inside PageGuideProvider')
    const { setRegistration } = context

    useEffect(() => {
        setRegistration(registration)
        return () => setRegistration(undefined)
    }, [registration, setRegistration])
}

export const usePageGuide = () => {
    const context = useContext(PageGuideContext)
    if (!context) throw new Error('usePageGuide must be used inside PageGuideProvider')
    return context.registration
}
