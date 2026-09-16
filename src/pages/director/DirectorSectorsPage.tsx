import { useEffect, useMemo, useState } from 'react'
import { App, Avatar, Card, Col, Empty, Input, Progress, Row, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApartmentOutlined, DollarOutlined, SearchOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { CHART_COLORS } from '@/config/chartPalette'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { buildSectorRollups, listDirectorPortfolio } from '@/services/directorPortfolioService'
import { useRegisterAgentPageContext } from '@/shared/hooks/useRegisterAgentPageContext'
import type { DirectorPortfolioSme, SectorRollup } from '@/types/director'
import '@/styles/dashboard.css'
import '@/styles/director.css'

const { Text } = Typography

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0, notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard' }).format(value || 0)

const riskColor = (risk: string) => risk === 'High' ? 'red' : risk === 'Medium' ? 'orange' : 'green'
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

export const DirectorSectorsPage = () => {
  const { message } = App.useApp()
  const { user } = useFullIdentity()
  const { activeProgramId } = useActiveProgramId()
  const [rows, setRows] = useState<DirectorPortfolioSme[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('All')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const data = await listDirectorPortfolio(user, activeProgramId)
        if (mounted) setRows(data)
      } catch (error) {
        console.error(error)
        message.error('Sector data could not be loaded.')
        if (mounted) setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [activeProgramId, message, user])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(row => (!term || [row.name, row.sector].some(value => value.toLowerCase().includes(term))) && (sector === 'All' || row.sector === sector))
  }, [rows, search, sector])

  const rollups = useMemo(() => buildSectorRollups(filteredRows), [filteredRows])
  const metrics = useMemo(() => ({
    sectors: rollups.length,
    smes: filteredRows.length,
    revenue: filteredRows.reduce((sum, row) => sum + row.metrics.revenue, 0),
    highRisk: filteredRows.filter(row => row.risk === 'High').length,
  }), [filteredRows, rollups.length])

  useRegisterAgentPageContext({
    pageKey: 'director-sectors',
    pageName: 'Director Sectors',
    purpose: 'Shows sector-level performance, revenue concentration and risk distribution.',
    currentFilters: { search, sector },
    metrics,
    dataSummary: { sectors: rollups.length, visibleSmes: filteredRows.length },
  })

  const revenueOptions = useMemo(() => ({
    colors: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.danger, CHART_COLORS.pink, CHART_COLORS.cyan],
    chart: { type: 'bar', height: 340 },
    title: { text: 'Sector Revenue' },
    xAxis: { categories: rollups.map(row => row.sector) },
    yAxis: { title: { text: 'Revenue' }, min: 0 },
    plotOptions: { series: { colorByPoint: true, dataLabels: { enabled: true } } },
    series: [{ type: 'bar' as const, name: 'Revenue', data: rollups.map(row => row.totalRevenue) }],
  }), [rollups])

  const progressOptions = useMemo(() => ({
    colors: [CHART_COLORS.success, CHART_COLORS.danger],
    chart: { type: 'column', height: 340 },
    title: { text: 'Progress and Risk' },
    xAxis: { categories: rollups.map(row => row.sector) },
    yAxis: { title: { text: 'Count / Percent' }, min: 0 },
    tooltip: { shared: true },
    series: [
      { type: 'column' as const, name: 'Avg progress', data: rollups.map(row => row.avgProgress) },
      { type: 'spline' as const, name: 'High risk SMEs', data: rollups.map(row => row.highRisk) },
    ],
  }), [rollups])

  const columns: ColumnsType<SectorRollup> = [
    { title: 'Sector', dataIndex: 'sector', render: value => <Text strong>{value}</Text> },
    { title: 'SMEs', dataIndex: 'companies', align: 'right' },
    { title: 'Avg progress', dataIndex: 'avgProgress', render: value => <Progress percent={Number(value)} size="small" /> },
    { title: 'Revenue', dataIndex: 'totalRevenue', align: 'right', render: value => formatCurrency(Number(value)) },
    { title: 'Risk', key: 'risk', render: (_, row) => <Space wrap><Tag color="red">High {row.highRisk}</Tag><Tag color="orange">Medium {row.mediumRisk}</Tag><Tag color="green">Low {row.lowRisk}</Tag></Space> },
  ]

  return (
    <DashboardPage>
      <Row gutter={[12, 12]} className="dashboard-metrics-row">
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<ApartmentOutlined />} label="Sectors" value={metrics.sectors} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<TeamOutlined />} label="SMEs" value={metrics.smes} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<DollarOutlined />} label="Revenue" value={formatCurrency(metrics.revenue)} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<WarningOutlined />} label="High Risk" value={metrics.highRisk} /></Col>
      </Row>

      <FilterBar
        title="Sector filters"
        primary={
          <>
            <Input prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search sector or SME" allowClear />
            <Select value={sector} onChange={setSector} options={[{ value: 'All', label: 'All sectors' }, ...Array.from(new Set(rows.map(row => row.sector))).sort().map(value => ({ value, label: value }))]} />
          </>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}><Card loading={loading} className="dashboard-section-card motion-card">{rollups.length ? <ThemedHighcharts options={revenueOptions} /> : <Empty description="No sector revenue found." />}</Card></Col>
        <Col xs={24} xl={10}><Card loading={loading} className="dashboard-section-card motion-card">{rollups.length ? <ThemedHighcharts options={progressOptions} /> : <Empty description="No sector risk found." />}</Card></Col>
      </Row>

      <Card loading={loading} className="dashboard-section-card motion-card" title={<Space><ApartmentOutlined /> Sector Summary</Space>} style={{ marginTop: 16 }}>
        <ResponsiveDataView
          rowKey="sector"
          columns={columns}
          rows={rollups}
          emptyText="No sectors match the current filters."
          renderCard={row => (
            <Space direction="vertical" className="dashboard-mobile-record">
              <Text strong>{row.sector}</Text>
              <Text>{row.companies} SMEs</Text>
              <Progress percent={row.avgProgress} size="small" />
              <Text>{formatCurrency(row.totalRevenue)}</Text>
              <Space wrap><Tag color="red">High {row.highRisk}</Tag><Tag color="orange">Medium {row.mediumRisk}</Tag><Tag color="green">Low {row.lowRisk}</Tag></Space>
            </Space>
          )}
        />
      </Card>

      <Card loading={loading} className="dashboard-section-card motion-card" title="Risk Watchlist" style={{ marginTop: 16 }}>
        {filteredRows.filter(row => row.risk !== 'Low').length ? (
          <ResponsiveDataView
            rowKey="id"
            rows={filteredRows.filter(row => row.risk !== 'Low').sort((a, b) => a.risk === b.risk ? a.name.localeCompare(b.name) : a.risk === 'High' ? -1 : 1)}
            emptyText="No high or medium risk SMEs found."
            columns={[
              { title: 'SME', dataIndex: 'name' },
              { title: 'Sector', dataIndex: 'sector' },
              { title: 'Risk', dataIndex: 'risk', render: value => <Tag color={riskColor(String(value))}>{String(value)}</Tag> },
              { title: 'Progress', dataIndex: 'progress', render: value => <Progress percent={Number(value)} size="small" /> },
            ]}
            renderCard={row => (
              <Space direction="vertical" className="dashboard-mobile-record">
                <Space><Avatar>{initials(row.name)}</Avatar><Text strong>{row.name}</Text></Space>
                <Text type="secondary">{row.sector}</Text>
                <Tag color={riskColor(row.risk)}>{row.risk}</Tag>
                <Progress percent={row.progress} size="small" />
              </Space>
            )}
          />
        ) : <Empty description="No high or medium risk SMEs found." />}
      </Card>
    </DashboardPage>
  )
}

export default DirectorSectorsPage
