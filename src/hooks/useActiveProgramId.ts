import { useEffect, useState } from 'react'

export const ALL_PROGRAMS = 'all'
export const ACTIVE_PROGRAM_STORAGE_KEY = 'smartv2.activeProgramId'
export const ACTIVE_PROGRAM_CHANGE_EVENT = 'smartv2.activeProgramChanged'

const getStoredActiveProgramId = () => localStorage.getItem(ACTIVE_PROGRAM_STORAGE_KEY) || ALL_PROGRAMS

export const setActiveProgramId = (activeProgramId: string) => {
  localStorage.setItem(ACTIVE_PROGRAM_STORAGE_KEY, activeProgramId)
  window.dispatchEvent(new CustomEvent(ACTIVE_PROGRAM_CHANGE_EVENT, { detail: activeProgramId }))
}

export const useActiveProgramId = () => {
  const [activeProgramId, setProgramId] = useState(getStoredActiveProgramId)

  useEffect(() => {
    const syncActiveProgram = () => setProgramId(getStoredActiveProgramId())

    window.addEventListener('storage', syncActiveProgram)
    window.addEventListener(ACTIVE_PROGRAM_CHANGE_EVENT, syncActiveProgram)

    return () => {
      window.removeEventListener('storage', syncActiveProgram)
      window.removeEventListener(ACTIVE_PROGRAM_CHANGE_EVENT, syncActiveProgram)
    }
  }, [])

  return {
    activeProgramId,
    isAllPrograms: activeProgramId === ALL_PROGRAMS,
  }
}
