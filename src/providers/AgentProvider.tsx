import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { AgentPageContext } from '@/types/agent'

type AgentContextValue = {
    pageContexts: Record<string, AgentPageContext>
    activePageKey?: string
    registerPageContext: (context: AgentPageContext) => void
    setActivePageKey: (pageKey: string) => void
    getActivePageContext: () => AgentPageContext | undefined
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined)

export const AgentProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [pageContexts, setPageContexts] = useState<Record<string, AgentPageContext>>({})
    const [activePageKey, setActivePageKey] = useState<string>()

    const registerPageContext = useCallback((context: AgentPageContext) => {
        setPageContexts((current) => {
            const existing = current[context.pageKey]
            if (existing && JSON.stringify({ ...existing, updatedAt: undefined }) === JSON.stringify({ ...context, updatedAt: undefined })) {
                return current
            }

            return {
                ...current,
                [context.pageKey]: context,
            }
        })

        setActivePageKey((current) => current === context.pageKey ? current : context.pageKey)
    }, [])

    const getActivePageContext = useCallback(() => {
        if (!activePageKey) return undefined
        return pageContexts[activePageKey]
    }, [activePageKey, pageContexts])

    const value = useMemo<AgentContextValue>(() => {
        return {
            pageContexts,
            activePageKey,
            registerPageContext,
            setActivePageKey,
            getActivePageContext,
        }
    }, [pageContexts, activePageKey, registerPageContext, getActivePageContext])

    return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

// Provider and hook intentionally share a module while the recovery structure settles.
// eslint-disable-next-line react-refresh/only-export-components
export const useAgent = () => {
    const context = useContext(AgentContext)

    if (!context) {
        throw new Error('useAgent must be used inside AgentProvider')
    }

    return context
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOptionalAgent = () => useContext(AgentContext)
