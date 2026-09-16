import { Card, Skeleton, Statistic, type CardProps } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import type { PropsWithChildren } from 'react'

// The .motion-card rules live with the dashboard styles, so any page using this card gets them.
import '@/styles/dashboard.css'

type MotionCardProps = PropsWithChildren<CardProps> & {
  skeletonRows?: number
}

type MotionCardComponent = ((props: MotionCardProps) => ReactNode) & {
  SunkenPanel: typeof SunkenPanel
  Metric: typeof Metric
}

const SunkenPanel = ({ children, className = '', style }: PropsWithChildren<{ className?: string; style?: CSSProperties }>) => (
  <div className={`sunken-panel ${className}`.trim()} style={style}>{children}</div>
)

const Metric = ({ label, title, value }: { label?: string; title?: string; value: ReactNode; icon?: ReactNode; iconBg?: string }) => (
  <Card size="small">
    <Statistic title={label || title} value={String(value)} />
  </Card>
)

export const MotionCard: MotionCardComponent = (({ children, className = '', loading = false, skeletonRows = 4, ...props }: MotionCardProps) => (
  <Card className={`motion-card ${loading ? 'is-loading' : ''} ${className}`.trim()} {...props}>
    {loading
      ? (
        <Skeleton
          active
          title={false}
          paragraph={{ rows: skeletonRows }}
          className="motion-card-skeleton"
        />
      )
      : children}
  </Card>
)) as MotionCardComponent

MotionCard.SunkenPanel = SunkenPanel
MotionCard.Metric = Metric

export { Metric, SunkenPanel }

