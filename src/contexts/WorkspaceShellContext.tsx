import { createContext, useContext } from 'react'

type WorkspaceShellNavigation = (path: string) => void

const WorkspaceShellContext = createContext<WorkspaceShellNavigation | null>(null)

export const WorkspaceShellProvider = WorkspaceShellContext.Provider

export const useOpenWorkspace = () => {
    const openWorkspace = useContext(WorkspaceShellContext)
    if (!openWorkspace) throw new Error('useOpenWorkspace must be used inside WorkspaceShellProvider')
    return openWorkspace
}
