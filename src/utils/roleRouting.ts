import { isUserRole } from '@/config/roles'

export const getRoleHomePath = (role?: string, isApplicant = false, smeOnboardingComplete = true) => {
  if (!role || !isUserRole(role)) return '/dashboard'
  if (role === 'director') return '/director'
  if (role === 'projectadmin') return '/projectadmin'
  if (role === 'operations') return '/operations'
  if (role === 'consultant') return '/consultant'
  if (role === 'incubatee') {
    if (!isApplicant) return '/incubatee'
    return smeOnboardingComplete ? '/applicant/profile' : '/applicant/onboarding'
  }
  return '/dashboard'
}
