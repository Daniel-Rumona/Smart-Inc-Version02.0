import { Empty } from 'antd'
import { Helmet } from 'react-helmet'
import DashboardHeader from '@/components/shared/DashboardHeader'
import DashboardPage from '@/components/shared/DashboardPage'
import { MotionCard } from '@/components/shared/Header'

export default function ImpactAnalysisPage() {
  return (
    <DashboardPage className="operations-impact-analysis-page">
      <Helmet>
        <title>Impact Analysis | Smart Incubation</title>
      </Helmet>

      <DashboardHeader
        title="Impact Analysis"
        subtitle="Impact analysis will appear here once live intervention outcomes and SME metrics are available."
      />

      <MotionCard>
        <Empty description="No live impact data available yet." />
      </MotionCard>
    </DashboardPage>
  )
}
