import type { ReactNode } from 'react'
import type { UserRole } from '@/config/roles'
import type { WorkspaceAudience } from '@/types/identity'
import type { IdentityPermission } from '@/types/identity'

export type AppRoute = {
  path: string
  labelKey: string
  icon?: ReactNode
  element?: ReactNode
  allowedRoles: UserRole[]
  requiredPermission?: IdentityPermission
  audiences?: WorkspaceAudience[]
  /** Only reachable inside the platform owner's (QTX) workspace: its own staff, and the SMEs that fall back to it. */
  platformOwnerOnly?: boolean
  showInNav?: boolean
  showInNavWhenAnySetting?: string[]
  groupKey?: string
  agentEnabled?: boolean
  agentActions?: string[]
  children?: AppRoute[]
}
