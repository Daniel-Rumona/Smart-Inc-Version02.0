import type { PropsWithChildren } from 'react'

type DashboardPageProps = PropsWithChildren<{ className?: string }>

export default function DashboardPage({ children, className = '' }: DashboardPageProps) {
  return <main className={`dashboard-page ${className}`.trim()}>{children}</main>
}
