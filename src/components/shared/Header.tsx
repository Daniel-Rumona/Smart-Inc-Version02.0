import { Card, Typography } from 'antd'
import type { ReactNode } from 'react'

import '@/styles/dashboard.css'

export { MotionCard } from '@/components/shared/MotionCard'

type DashboardHeaderCardProps = {
    title: string
    subtitle?: string
    extraRight?: ReactNode
}

export const DashboardHeaderCard = ({
    title,
    subtitle,
    extraRight,
}: DashboardHeaderCardProps) => {
    return (
        <Card
            className="dashboard-header-card motion-card"
            bordered
        >
            <div className="dashboard-header-card-content">
                <div className="dashboard-header-card-copy">
                    <div className="dashboard-header-card-title-row">
                        <Typography.Title
                            level={3}
                            className="dashboard-header-card-title"
                        >
                            {title}
                        </Typography.Title>

                        {extraRight && (
                            <div className="dashboard-header-card-extra">
                                {extraRight}
                            </div>
                        )}
                    </div>

                    {subtitle && (
                        <Typography.Text
                            type="secondary"
                            className="dashboard-header-card-subtitle"
                        >
                            {subtitle}
                        </Typography.Text>
                    )}
                </div>
            </div>
        </Card>
    )
}
