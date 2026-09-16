import type { ReactNode } from 'react'

type DashboardHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function DashboardHeader({ title, subtitle, actions }: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="dashboard-header-actions">{actions}</div>}
    </header>
  )
}
