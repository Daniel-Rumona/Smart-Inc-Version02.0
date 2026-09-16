import { useEffect, useState } from 'react'

export const ALL_COMPANIES = 'all'
export const ACTIVE_COMPANY_STORAGE_KEY = 'smartv2.activeCompanyCode'
export const ACTIVE_COMPANY_CHANGE_EVENT = 'smartv2.activeCompanyChanged'

const getStoredActiveCompanyCode = () => localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY) || ALL_COMPANIES

export const setActiveCompanyCode = (activeCompanyCode: string) => {
  localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, activeCompanyCode)
  window.dispatchEvent(new CustomEvent(ACTIVE_COMPANY_CHANGE_EVENT, { detail: activeCompanyCode }))
}

export const useActiveCompanyCode = () => {
  const [activeCompanyCode, setCompanyCode] = useState(getStoredActiveCompanyCode)

  useEffect(() => {
    const syncActiveCompany = () => setCompanyCode(getStoredActiveCompanyCode())

    window.addEventListener('storage', syncActiveCompany)
    window.addEventListener(ACTIVE_COMPANY_CHANGE_EVENT, syncActiveCompany)

    return () => {
      window.removeEventListener('storage', syncActiveCompany)
      window.removeEventListener(ACTIVE_COMPANY_CHANGE_EVENT, syncActiveCompany)
    }
  }, [])

  return {
    activeCompanyCode,
    isAllCompanies: activeCompanyCode === ALL_COMPANIES,
  }
}
