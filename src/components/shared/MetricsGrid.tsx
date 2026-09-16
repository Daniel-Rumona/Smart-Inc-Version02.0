import type { ReactNode } from 'react'

import '@/styles/dashboard.css'

type MetricsGridProps = {
    children: ReactNode
    className?: string
}

/**
 * Lays out DashboardMetricCards so they stay inline, shrinking to fit until
 * there are enough of them (~6+) to force a wrap. On mobile it always keeps
 * a 2-column grid instead of stacking every card full-width.
 */
export default function MetricsGrid({ children, className = '' }: MetricsGridProps) {
    const gridClassName = ['metrics-grid', className].filter(Boolean).join(' ')

    return (
        <div className={gridClassName}>
            {children}
        </div>
    )
}
