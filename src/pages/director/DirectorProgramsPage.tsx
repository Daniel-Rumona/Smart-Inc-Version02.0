import { useEffect, useMemo, useState } from 'react'
import { App, Card, Col, Empty, Grid, Input, Progress, Row, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, ExclamationCircleOutlined, ProjectOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
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
import { listDirectorProgramPerformance } from '@/services/directorProgramsService'
import { useRegisterAgentPageContext } from '@/shared/hooks/useRegisterAgentPageContext'
import type { DirectorProgramPerformance } from '@/types/director'
import '@/styles/dashboard.css'
import '@/styles/director.css'

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0, notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard' }).format(value || 0)

const statusColor = (status: string) => {
    const normalized = status.toLowerCase()
    if (normalized.includes('inactive') || normalized.includes('closed')) return 'default'
    if (normalized.includes('draft') || normalized.includes('pending')) return 'orange'
    return 'green'
}

const completionRate = (row: DirectorProgramPerformance) =>
    row.assignments ? Math.round((row.completedAssignments / row.assignments) * 100) : 0

export const DirectorProgramsPage = () => {
    const { message } = App.useApp()
    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md
    const { t } = useLanguage()
    const { user } = useFullIdentity()
    const { activeProgramId, isAllPrograms } = useActiveProgramId()
    const [rows, setRows] = useState<DirectorProgramPerformance[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')

    useEffect(() => {
        let mounted = true
        const load = async () => {
            if (!user) return
            setLoading(true)
            try {
                const data = await listDirectorProgramPerformance(user, activeProgramId)
                if (mounted) setRows(data)
            } catch (error) {
                console.error(error)
                message.error(t('director.programs.loadError', 'Program performance could not be loaded.'))
                if (mounted) setRows([])
            } finally {
                if (mounted) setLoading(false)
            }
        }
        void load()
        return () => { mounted = false }
    }, [activeProgramId, message, t, user])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        return rows.filter(row => {
            const matchText = !term || row.name.toLowerCase().includes(term) || row.status.toLowerCase().includes(term)
            const matchStatus = status === 'all' || row.status.toLowerCase() === status
            return matchText && matchStatus
        })
    }, [rows, search, status])

    const metrics = useMemo(() => {
        const smes = filtered.reduce((sum, row) => sum + row.smes, 0)
        const assignments = filtered.reduce((sum, row) => sum + row.assignments, 0)
        const completed = filtered.reduce((sum, row) => sum + row.completedAssignments, 0)
        return {
            programs: filtered.length,
            smes,
            avgProgress: smes ? Math.round(filtered.reduce((sum, row) => sum + row.avgProgress * row.smes, 0) / smes) : 0,
            completionRate: assignments ? Math.round((completed / assignments) * 100) : 0,
            overdue: filtered.reduce((sum, row) => sum + row.overdueAssignments, 0),
        }
    }, [filtered])

    useRegisterAgentPageContext({
        pageKey: 'director-programs',
        pageName: t('director.programs.title', 'Program Performance'),
        purpose: 'Shows director-level performance across the active program selection.',
        currentFilters: { search, status, activeProgramId },
        metrics,
        dataSummary: { visiblePrograms: filtered.length, scope: isAllPrograms ? 'all programs' : 'selected program' },
    })

    const progressOptions = useMemo<Highcharts.Options>(() => ({
        colors: [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.danger],
        chart: { type: 'column', height: 320 },
        title: { text: t('director.programs.progressChart', 'Program Progress') },
        xAxis: { categories: filtered.map(row => row.name) },
        yAxis: { min: 0, max: 100, labels: { format: '{value}%' }, title: { text: t('common.progress', 'Progress') } },
        tooltip: { shared: true },
        plotOptions: { column: { borderRadius: 4, dataLabels: { enabled: true, format: '{point.y}%' } } },
        series: [
            { type: 'column', name: t('director.programs.avgProgress', 'Avg progress'), data: filtered.map(row => row.avgProgress) },
            { type: 'spline', name: t('director.programs.completion', 'Completion'), data: filtered.map(row => completionRate(row)) },
            { type: 'spline', name: t('director.programs.highRisk', 'High risk'), data: filtered.map(row => row.smes ? Math.round((row.highRisk / row.smes) * 100) : 0) },
        ],
    }), [filtered, t])

    const riskOptions = useMemo<Highcharts.Options>(() => ({
        colors: [CHART_COLORS.success, CHART_COLORS.amber, CHART_COLORS.danger],
        chart: { type: 'bar', height: Math.max(300, filtered.length * 42) },
        title: { text: t('director.programs.riskChart', 'Risk Mix by Program') },
        xAxis: { categories: filtered.map(row => row.name) },
        yAxis: { min: 0, title: { text: t('director.programs.smes', 'SMEs') }, allowDecimals: false },
        plotOptions: { series: { stacking: 'normal', dataLabels: { enabled: true } } },
        series: [
            { type: 'bar', name: t('director.risk.low', 'Low'), data: filtered.map(row => row.lowRisk) },
            { type: 'bar', name: t('director.risk.medium', 'Medium'), data: filtered.map(row => row.mediumRisk) },
            { type: 'bar', name: t('director.risk.high', 'High'), data: filtered.map(row => row.highRisk) },
        ],
    }), [filtered, t])

    const columns: ColumnsType<DirectorProgramPerformance> = [
        { title: t('director.programs.program', 'Program'), dataIndex: 'name', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.name}</strong><span className="director-muted">{row.startDate || t('common.noDate', 'No date')}</span></Space> },
        { title: t('common.status', 'Status'), dataIndex: 'status', key: 'status', width: 120, render: value => <Tag color={statusColor(String(value))}>{String(value).toUpperCase()}</Tag> },
        { title: t('director.programs.smes', 'SMEs'), dataIndex: 'smes', key: 'smes', width: 90, align: 'right' },
        { title: t('common.progress', 'Progress'), dataIndex: 'avgProgress', key: 'avgProgress', width: 170, render: value => <Progress percent={Number(value)} size="small" /> },
        { title: t('director.programs.completion', 'Completion'), key: 'completion', width: 150, render: (_, row) => <Progress percent={completionRate(row)} size="small" status={row.overdueAssignments ? 'active' : 'success'} /> },
        { title: t('director.programs.revenue', 'Revenue'), dataIndex: 'totalRevenue', key: 'totalRevenue', width: 130, align: 'right', render: value => formatCurrency(Number(value)) },
        { title: t('director.risk.high', 'High risk'), dataIndex: 'highRisk', key: 'highRisk', width: 110, align: 'right', render: value => <Tag color={Number(value) ? 'red' : 'green'}>{Number(value)}</Tag> },
    ]

    return (
        <DashboardPage className="director-page director-programs-page">
            <Row gutter={[12, 12]} className="dashboard-metrics-row">
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<ProjectOutlined />} iconClassName="is-users" label={t('director.programs.programs', 'Programs')} value={metrics.programs} /></Col>
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<TeamOutlined />} iconClassName="is-participants" label={t('director.programs.smes', 'SMEs')} value={metrics.smes} /></Col>
                {!isMobile && <Col lg={6}><DashboardMetricCard loading={loading} icon={<CheckCircleOutlined />} iconClassName="is-delivery" label={t('common.progress', 'Progress')} value={`${metrics.avgProgress}%`} /></Col>}
                {!isMobile && <Col lg={6}><DashboardMetricCard loading={loading} icon={<ExclamationCircleOutlined />} iconClassName="is-attention" label={t('director.programs.overdue', 'Overdue')} value={metrics.overdue} /></Col>}
            </Row>
            <FilterBar title={t('director.programs.filters', 'Program filters')} primary={<><Input prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('director.programs.search', 'Search programs')} allowClear /><Select value={status} onChange={setStatus} options={[{ value: 'all', label: t('common.all', 'All') }, ...Array.from(new Set(rows.map(row => row.status.toLowerCase()))).map(value => ({ value, label: value.toUpperCase() }))]} /></>} />
            <Row gutter={[16, 16]}>
                <Col xs={24} xl={14}><Card loading={loading} className="dashboard-section-card motion-card">{filtered.length ? <ThemedHighcharts options={progressOptions} /> : <Empty description={t('director.programs.empty', 'No programs match the current filters.')} />}</Card></Col>
                <Col xs={24} xl={10}><Card loading={loading} className="dashboard-section-card motion-card">{filtered.length ? <ThemedHighcharts options={riskOptions} /> : <Empty description={t('director.programs.empty', 'No programs match the current filters.')} />}</Card></Col>
            </Row>
            <Card className="dashboard-section-card motion-card director-section-gap">
                <ResponsiveDataView rowKey="id" rows={filtered} columns={columns} emptyText={t('director.programs.empty', 'No programs match the current filters.')} renderCard={row => <Space direction="vertical" className="dashboard-mobile-record"><Space style={{ justifyContent: 'space-between', width: '100%' }}><strong>{row.name}</strong><Tag color={statusColor(row.status)}>{row.status.toUpperCase()}</Tag></Space><span className="director-muted">{row.smes} {t('director.programs.smes', 'SMEs')}</span><Progress percent={row.avgProgress} size="small" /><Space wrap><Tag color="green">{row.lowRisk} {t('director.risk.low', 'Low')}</Tag><Tag color="orange">{row.mediumRisk} {t('director.risk.medium', 'Medium')}</Tag><Tag color="red">{row.highRisk} {t('director.risk.high', 'High')}</Tag></Space></Space>} />
            </Card>
        </DashboardPage>
    )
}

export default DirectorProgramsPage
