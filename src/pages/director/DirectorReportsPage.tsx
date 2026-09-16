import { useEffect, useMemo, useState } from 'react'
import { App, Card, Col, Empty, Grid, Progress, Row, Segmented, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BankOutlined, ProjectOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons'
import type Highcharts from 'highcharts'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { CHART_COLORS } from '@/config/chartPalette'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useLanguage } from '@/providers/LanguageProvider'
import { buildSectorRollups, listDirectorPortfolio } from '@/services/directorPortfolioService'
import { listDirectorProgramPerformance } from '@/services/directorProgramsService'
import { useRegisterAgentPageContext } from '@/shared/hooks/useRegisterAgentPageContext'
import type { DirectorPortfolioSme, DirectorProgramPerformance, SectorRollup } from '@/types/director'
import '@/styles/dashboard.css'
import '@/styles/director.css'

type DirectorReportView = 'overview' | 'programs' | 'portfolio' | 'risk'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0, notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard' }).format(value || 0)

const percent = (numerator: number, denominator: number) =>
  denominator ? Math.round((numerator / denominator) * 100) : 0

const riskColor = (risk: string) => {
  if (risk === 'High') return 'red'
  if (risk === 'Medium') return 'orange'
  return 'green'
}

const completionRate = (row: DirectorProgramPerformance) =>
  percent(row.completedAssignments, row.assignments)

export const DirectorReportsPage = () => {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const { t } = useLanguage()
  const { user } = useFullIdentity()
  const { activeProgramId, isAllPrograms } = useActiveProgramId()
  const [view, setView] = useState<DirectorReportView>('overview')
  const [portfolio, setPortfolio] = useState<DirectorPortfolioSme[]>([])
  const [programs, setPrograms] = useState<DirectorProgramPerformance[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const [portfolioRows, programRows] = await Promise.all([
          listDirectorPortfolio(user, activeProgramId),
          listDirectorProgramPerformance(user, activeProgramId),
        ])
        if (!mounted) return
        setPortfolio(portfolioRows)
        setPrograms(programRows)
      } catch (error) {
        console.error(error)
        message.error(t('director.reports.loadError', 'Director report data could not be loaded.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [activeProgramId, message, t, user])

  const sectors = useMemo(() => buildSectorRollups(portfolio), [portfolio])
  const metrics = useMemo(() => {
    const revenue = portfolio.reduce((sum, sme) => sum + sme.metrics.revenue, 0)
    const avgProgress = portfolio.length ? Math.round(portfolio.reduce((sum, sme) => sum + sme.progress, 0) / portfolio.length) : 0
    const highRisk = portfolio.filter((sme) => sme.risk === 'High').length
    const completed = programs.reduce((sum, program) => sum + program.completedAssignments, 0)
    const assignments = programs.reduce((sum, program) => sum + program.assignments, 0)
    return {
      programs: programs.length,
      smes: portfolio.length,
      revenue,
      avgProgress,
      highRisk,
      completionRate: percent(completed, assignments),
    }
  }, [portfolio, programs])

  useRegisterAgentPageContext({
    pageKey: 'director-reports',
    pageName: t('director.reports.title', 'Director Reports'),
    purpose: 'Executive reporting across programs, portfolio performance, sector exposure, and strategic risks.',
    currentFilters: { activeProgramId, view },
    metrics,
    dataSummary: { scope: isAllPrograms ? 'all programs' : 'selected program', programs: programs.length, smes: portfolio.length, sectors: sectors.length },
  })

  const programOptions = useMemo<Highcharts.Options>(() => ({
    colors: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.danger],
    chart: { type: 'column', height: 330 },
    title: { text: t('director.reports.programHealth', 'Program Health') },
    xAxis: { categories: programs.map((program) => program.name) },
    yAxis: { min: 0, max: 100, labels: { format: '{value}%' }, title: { text: t('common.progress', 'Progress') } },
    tooltip: { shared: true },
    plotOptions: { column: { borderRadius: 4, dataLabels: { enabled: true, format: '{point.y}%' } } },
    series: [
      { type: 'column', name: t('director.programs.avgProgress', 'Avg progress'), data: programs.map((program) => program.avgProgress) },
      { type: 'spline', name: t('director.programs.completion', 'Completion'), data: programs.map(completionRate) },
      { type: 'spline', name: t('director.risk.high', 'High risk'), data: programs.map((program) => percent(program.highRisk, program.smes)) },
    ],
  }), [programs, t])

  const sectorOptions = useMemo<Highcharts.Options>(() => ({
    colors: [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.danger],
    chart: { type: 'bar', height: Math.max(300, sectors.length * 42) },
    title: { text: t('director.reports.sectorExposure', 'Sector Exposure') },
    xAxis: { categories: sectors.map((sector) => sector.sector) },
    yAxis: { min: 0, title: { text: t('director.programs.revenue', 'Revenue') } },
    tooltip: { pointFormatter() { return `<span style="color:${this.color}">\u25cf</span> ${this.series.name}: <b>${formatCurrency(Number(this.y))}</b><br/>` } },
    plotOptions: { bar: { borderRadius: 4 } },
    series: [{ type: 'bar', name: t('director.programs.revenue', 'Revenue'), data: sectors.map((sector) => sector.totalRevenue) }],
  }), [sectors, t])

  const riskOptions = useMemo<Highcharts.Options>(() => ({
    colors: [CHART_COLORS.success, CHART_COLORS.amber, CHART_COLORS.danger],
    chart: { type: 'pie', height: 310 },
    title: { text: t('director.reports.riskDistribution', 'Portfolio Risk Distribution') },
    tooltip: { pointFormat: '<b>{point.y}</b> SMEs ({point.percentage:.0f}%)' },
    series: [{
      type: 'pie',
      name: t('director.reports.smes', 'SMEs'),
      data: ['Low', 'Medium', 'High'].map((risk) => ({
        name: t(`director.risk.${risk.toLowerCase()}`, risk),
        y: portfolio.filter((sme) => sme.risk === risk).length,
      })),
    }],
  }), [portfolio, t])

  const programColumns: ColumnsType<DirectorProgramPerformance> = [
    { title: t('director.programs.program', 'Program'), dataIndex: 'name', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.name}</strong><span className="director-muted">{row.status}</span></Space> },
    { title: t('director.programs.smes', 'SMEs'), dataIndex: 'smes', key: 'smes', width: 90, align: 'right' },
    { title: t('common.progress', 'Progress'), dataIndex: 'avgProgress', key: 'avgProgress', width: 170, render: (value) => <Progress percent={Number(value)} size="small" /> },
    { title: t('director.programs.completion', 'Completion'), key: 'completion', width: 160, render: (_, row) => <Progress percent={completionRate(row)} size="small" status={row.overdueAssignments ? 'active' : 'success'} /> },
    { title: t('director.programs.revenue', 'Revenue'), dataIndex: 'totalRevenue', key: 'totalRevenue', width: 130, align: 'right', render: (value) => formatCurrency(Number(value)) },
    { title: t('director.risk.high', 'High risk'), dataIndex: 'highRisk', key: 'highRisk', width: 110, align: 'right', render: (value) => <Tag color={Number(value) ? 'red' : 'green'}>{Number(value)}</Tag> },
  ]

  const portfolioColumns: ColumnsType<DirectorPortfolioSme> = [
    { title: t('director.reports.sme', 'SME'), dataIndex: 'name', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.name}</strong><span className="director-muted">{row.programName}</span></Space> },
    { title: t('common.sector', 'Sector'), dataIndex: 'sector', key: 'sector', width: 150 },
    { title: t('common.progress', 'Progress'), dataIndex: 'progress', key: 'progress', width: 160, render: (value) => <Progress percent={Number(value)} size="small" /> },
    { title: t('director.reports.growth', 'Growth'), key: 'growth', width: 110, align: 'right', render: (_, row) => `${row.metrics.growthRate}%` },
    { title: t('director.programs.revenue', 'Revenue'), key: 'revenue', width: 130, align: 'right', render: (_, row) => formatCurrency(row.metrics.revenue) },
    { title: t('director.risk.high', 'Risk'), dataIndex: 'risk', key: 'risk', width: 100, render: (value) => <Tag color={riskColor(String(value))}>{String(value).toUpperCase()}</Tag> },
  ]

  const sectorColumns: ColumnsType<SectorRollup> = [
    { title: t('common.sector', 'Sector'), dataIndex: 'sector', key: 'sector', render: (value) => <strong>{String(value)}</strong> },
    { title: t('director.programs.smes', 'SMEs'), dataIndex: 'companies', key: 'companies', width: 90, align: 'right' },
    { title: t('director.programs.revenue', 'Revenue'), dataIndex: 'totalRevenue', key: 'totalRevenue', width: 130, align: 'right', render: (value) => formatCurrency(Number(value)) },
    { title: t('common.progress', 'Progress'), dataIndex: 'avgProgress', key: 'avgProgress', width: 160, render: (value) => <Progress percent={Number(value)} size="small" /> },
    { title: t('director.risk.high', 'High risk'), dataIndex: 'highRisk', key: 'highRisk', width: 110, align: 'right', render: (value) => <Tag color={Number(value) ? 'red' : 'green'}>{Number(value)}</Tag> },
  ]

  return (
    <DashboardPage className="director-page director-reports-page">
      <Row gutter={[12, 12]} className="dashboard-metrics-row">
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<ProjectOutlined />} iconClassName="is-users" label={t('director.programs.programs', 'Programs')} value={metrics.programs} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<TeamOutlined />} iconClassName="is-participants" label={t('director.programs.smes', 'SMEs')} value={metrics.smes} /></Col>
        {!isMobile && <Col lg={6}><DashboardMetricCard loading={loading} icon={<RiseOutlined />} iconClassName="is-delivery" label={t('common.progress', 'Progress')} value={`${metrics.avgProgress}%`} hint={`${metrics.completionRate}% delivery`} /></Col>}
        {!isMobile && <Col lg={6}><DashboardMetricCard loading={loading} icon={<BankOutlined />} iconClassName="is-attention" label={t('director.programs.revenue', 'Revenue')} value={formatCurrency(metrics.revenue)} hint={`${metrics.highRisk} high risk`} /></Col>}
      </Row>

      <FilterBar
        title={t('director.reports.scope', 'Director report scope')}
        primary={
          <Segmented<DirectorReportView>
            block
            value={view}
            onChange={setView}
            options={[
              { label: t('common.overview', 'Overview'), value: 'overview' },
              { label: t('director.programs.programs', 'Programs'), value: 'programs' },
              { label: t('nav.portfolio', 'Portfolio'), value: 'portfolio' },
              { label: t('director.reports.risk', 'Risk'), value: 'risk' },
            ]}
          />
        }
      />

      {view === 'overview' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}><Card loading={loading} className="dashboard-section-card motion-card">{programs.length ? <ThemedHighcharts options={programOptions} /> : <Empty description={t('director.programs.empty', 'No programs match the current filters.')} />}</Card></Col>
          <Col xs={24} xl={10}><Card loading={loading} className="dashboard-section-card motion-card">{portfolio.length ? <ThemedHighcharts options={riskOptions} /> : <Empty description={t('director.reports.noPortfolio', 'No portfolio records found.')} />}</Card></Col>
          <Col xs={24}><Card loading={loading} className="dashboard-section-card motion-card">{sectors.length ? <ThemedHighcharts options={sectorOptions} /> : <Empty description={t('director.reports.noSectors', 'No sector exposure found.')} />}</Card></Col>
        </Row>
      )}

      {view === 'programs' && (
        <Card loading={loading} className="dashboard-section-card motion-card">
          <ResponsiveDataView
            rowKey="id"
            rows={programs}
            columns={programColumns}
            emptyText={t('director.programs.empty', 'No programs match the current filters.')}
            renderCard={(row) => (
              <Space direction="vertical" className="dashboard-mobile-record">
                <strong>{row.name}</strong>
                <span className="director-muted">{row.smes} {t('director.programs.smes', 'SMEs')}</span>
                <Progress percent={row.avgProgress} size="small" />
                <Space wrap><Tag>{formatCurrency(row.totalRevenue)}</Tag><Tag color="red">{row.highRisk} {t('director.risk.high', 'High')}</Tag></Space>
              </Space>
            )}
          />
        </Card>
      )}

      {view === 'portfolio' && (
        <Card loading={loading} className="dashboard-section-card motion-card">
          <ResponsiveDataView
            rowKey="id"
            rows={portfolio}
            columns={portfolioColumns}
            emptyText={t('director.reports.noPortfolio', 'No portfolio records found.')}
            renderCard={(row) => (
              <Space direction="vertical" className="dashboard-mobile-record">
                <Space style={{ justifyContent: 'space-between', width: '100%' }}><strong>{row.name}</strong><Tag color={riskColor(row.risk)}>{row.risk}</Tag></Space>
                <span className="director-muted">{row.programName} / {row.sector}</span>
                <Progress percent={row.progress} size="small" />
                <Space wrap><Tag>{formatCurrency(row.metrics.revenue)}</Tag><Tag color="blue">{row.metrics.growthRate}% growth</Tag></Space>
              </Space>
            )}
          />
        </Card>
      )}

      {view === 'risk' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}><Card loading={loading} className="dashboard-section-card motion-card">{portfolio.length ? <ThemedHighcharts options={riskOptions} /> : <Empty description={t('director.reports.noPortfolio', 'No portfolio records found.')} />}</Card></Col>
          <Col xs={24} lg={15}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              <ResponsiveDataView
                rowKey="sector"
                rows={sectors}
                columns={sectorColumns}
                emptyText={t('director.reports.noSectors', 'No sector exposure found.')}
                renderCard={(row) => (
                  <Space direction="vertical" className="dashboard-mobile-record">
                    <strong>{row.sector}</strong>
                    <span className="director-muted">{row.companies} {t('director.programs.smes', 'SMEs')}</span>
                    <Progress percent={row.avgProgress} size="small" />
                    <Space wrap><Tag>{formatCurrency(row.totalRevenue)}</Tag><Tag color="red">{row.highRisk} high risk</Tag></Space>
                  </Space>
                )}
              />
            </Card>
          </Col>
        </Row>
      )}
    </DashboardPage>
  )
}

export default DirectorReportsPage
