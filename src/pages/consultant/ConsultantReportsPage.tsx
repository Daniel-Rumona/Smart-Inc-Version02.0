import { Button, Card, Col, DatePicker, Empty, Progress, Row, Segmented, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, DownloadOutlined, FileTextOutlined, PieChartOutlined, StarOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { useMemo, useState } from 'react'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { useAssignedInterventions, type AssignedIntervention } from '@/contexts/AssignedInterventionsContext'
import { useLanguage } from '@/providers/LanguageProvider'
import {
    assignmentParticipant,
    assignmentProgram,
    assignmentTitle,
    deriveConsultantStatus,
    downloadCsv,
    getFeedback,
    isOverdueAssignment,
    progressForAssignment,
    statusColor,
    toDate,
} from './ConsultantWorkspaceUtils'
import '@/styles/consultant.css'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

type Period = 'month' | 'quarter' | 'year' | 'custom'

type ReportRow = {
    id: string
    title: string
    participant: string
    program: string
    status: ReturnType<typeof deriveConsultantStatus>
    progress: number
    dueDate: Date | null
    completedAt: Date | null
    rating?: number
    raw: AssignedIntervention
}

const { RangePicker } = DatePicker
const { Text, Title } = Typography

const deliveryHealthColors = {
    pending: '#F59E0B',
    inProgress: '#2563EB',
    completed: '#16A34A',
    overdue: '#DC2626',
    rejected: '#9333EA',
    workload: '#6D5DFB',
}

const rangeFor = (period: Period): [Dayjs, Dayjs] => {
    const now = dayjs()
    if (period === 'month') return [now.startOf('month'), now.endOf('month')]
    if (period === 'quarter') return [now.startOf('quarter'), now.endOf('quarter')]
    return [now.startOf('year'), now.endOf('year')]
}

const dateInRange = (date: Date | null, start: Dayjs, end: Dayjs) => {
    if (!date) return false
    return dayjs(date).isSameOrAfter(start, 'day') && dayjs(date).isSameOrBefore(end, 'day')
}

const statusLabel = (status: string) => {
    if (status === 'Pending') return 'Pending'
    if (status === 'In progress') return 'In progress'
    if (status === 'Completed') return 'Completed'
    if (status === 'Rejected') return 'Rejected'
    if (status === 'Overdue') return 'Overdue'
    return status
}

export const ConsultantReportsPage = () => {
    const { t } = useLanguage()
    const { assignments, loading, isMine } = useAssignedInterventions()
    const [period, setPeriod] = useState<Period>('year')
    const [[start, end], setRange] = useState<[Dayjs, Dayjs]>(rangeFor('year'))

    const liveRows = useMemo<ReportRow[]>(() => assignments.filter(isMine).map((assignment) => {
        const status = deriveConsultantStatus(assignment)
        return {
            id: assignment.id,
            title: assignmentTitle(assignment),
            participant: assignmentParticipant(assignment),
            program: assignmentProgram(assignment),
            status,
            progress: progressForAssignment(assignment, status),
            dueDate: toDate(assignment.dueDate),
            completedAt: toDate(assignment.completedAt) || toDate(assignment.updatedAt),
            rating: getFeedback(assignment).rating,
            raw: assignment,
        }
    }), [assignments, isMine])

    const allRows = liveRows

    const scopedRows = allRows.filter((row) => {
        const date = row.completedAt || row.dueDate || toDate(row.raw.createdAt)
        return dateInRange(date, start, end)
    })

    const completed = scopedRows.filter((row) => row.status === 'Completed')
    const active = scopedRows.filter((row) => row.status === 'In progress')
    const overdue = scopedRows.filter((row) => isOverdueAssignment(row.raw))
    const pending = scopedRows.filter((row) => row.status === 'Pending' && !isOverdueAssignment(row.raw))
    const rejected = scopedRows.filter((row) => row.status === 'Rejected')
    const rated = scopedRows.filter((row) => row.rating != null)
    const avgRating = rated.length ? rated.reduce((sum, row) => sum + (row.rating || 0), 0) / rated.length : 0
    const completionRate = scopedRows.length ? Math.round((completed.length / scopedRows.length) * 100) : 0

    const statusChartData = [
        { name: t('consultant.status.pending', 'Pending'), y: pending.length, color: deliveryHealthColors.pending },
        { name: t('consultant.status.inProgress', 'In progress'), y: active.filter((row) => !isOverdueAssignment(row.raw)).length, color: deliveryHealthColors.inProgress },
        { name: t('consultant.status.completed', 'Completed'), y: completed.length, color: deliveryHealthColors.completed },
        { name: t('consultant.status.overdue', 'Overdue'), y: overdue.length, color: deliveryHealthColors.overdue },
        { name: t('consultant.status.rejected', 'Rejected'), y: rejected.length, color: deliveryHealthColors.rejected },
    ].filter((item) => item.y > 0)

    const statusChart: Highcharts.Options = {
        chart: { type: 'pie', height: 300 },
        title: { text: undefined },
        colors: statusChartData.map((item) => item.color),
        tooltip: { pointFormat: `<b>{point.y}</b> ${t('consultant.common.assignments')}` },
        plotOptions: {
            pie: {
                innerSize: '58%',
                dataLabels: {
                    enabled: true,
                    format: '{point.name}: {point.y}',
                    style: { textOutline: 'none', fontWeight: '600' },
                },
            },
        },
        series: [{ type: 'pie', name: t('consultant.common.assignments'), data: statusChartData }],
    }

    const programmeWorkloadData = Array.from(scopedRows.reduce((map, row) => {
        const name = row.program || t('common.unassigned', 'Unassigned')
        return map.set(name, (map.get(name) || 0) + 1)
    }, new Map<string, number>()).entries()).map(([name, y]) => ({ name, y, color: deliveryHealthColors.workload }))

    const programChart: Highcharts.Options = {
        chart: { type: 'bar', height: 300 },
        title: { text: undefined },
        xAxis: { type: 'category' },
        yAxis: { min: 0, allowDecimals: false, title: { text: t('consultant.common.assignments') } },
        plotOptions: {
            bar: {
                dataLabels: { enabled: true, style: { textOutline: 'none', fontWeight: '600' } },
            },
        },
        series: [{
            type: 'bar',
            name: t('consultant.common.assignments'),
            color: deliveryHealthColors.workload,
            data: programmeWorkloadData,
        }],
    }

    const columns: ColumnsType<ReportRow> = [
        { title: t('consultant.common.sme'), dataIndex: 'participant', key: 'participant', ellipsis: true },
        { title: t('consultant.common.intervention'), dataIndex: 'title', key: 'title', ellipsis: true },
        {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (value: ReportRow['status'], row) => {
                const isOverdue = isOverdueAssignment(row.raw)
                const label = isOverdue && value !== 'Completed' ? t('consultant.status.overdue', 'Overdue') : t(`consultant.status.${String(value).replace(/\s+/g, '').toLowerCase()}`, statusLabel(value))
                const color = isOverdue && value !== 'Completed' ? 'red' : statusColor(value)
                return <Tag color={color}>{label}</Tag>
            },
        },
        { title: t('consultant.common.progress'), dataIndex: 'progress', key: 'progress', width: 150, render: (value) => <Progress percent={value} size="small" /> },
        { title: t('consultant.feedback.rating'), dataIndex: 'rating', key: 'rating', width: 100, render: (value?: number) => value ? `${value}/5` : '-' },
    ]

    const updatePeriod = (value: Period) => {
        setPeriod(value)
        if (value !== 'custom') setRange(rangeFor(value))
    }

    const exportReport = () => {
        downloadCsv(`consultant-report-${start.format('YYYYMMDD')}-${end.format('YYYYMMDD')}.csv`, scopedRows.map((row) => ({
            [t('consultant.common.sme')]: row.participant,
            [t('consultant.common.program')]: row.program,
            [t('consultant.common.intervention')]: row.title,
            [t('common.status')]: isOverdueAssignment(row.raw) && row.status !== 'Completed' ? 'Overdue' : row.status,
            [t('consultant.common.progress')]: row.progress,
            DueDate: row.dueDate ? dayjs(row.dueDate).format('YYYY-MM-DD') : '',
            CompletedAt: row.completedAt ? dayjs(row.completedAt).format('YYYY-MM-DD') : '',
            [t('consultant.feedback.rating')]: row.rating ?? '',
        })))
    }

    return (
        <DashboardPage className="consultant-page">
            <Row gutter={[16, 16]} className="dashboard-metrics-row">
                <Col xs={12} lg={6}>
                    <DashboardMetricCard
                        loading={loading}
                        icon={<PieChartOutlined />}
                        label={t('consultant.common.assignments')}
                        value={scopedRows.length}
                        hint={`${start.format('DD MMM')} to ${end.format('DD MMM YYYY')}`}
                    />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard
                        loading={loading}
                        icon={<CheckCircleOutlined />}
                        iconClassName="is-success"
                        label={t('consultant.metrics.completed')}
                        value={completed.length}
                        hint={t('consultant.dashboard.completionHint', '{rate}% completion rate').replace('{rate}', String(completionRate))}
                    />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard
                        loading={loading}
                        icon={<WarningOutlined />}
                        iconClassName="is-risk"
                        label={t('consultant.status.overdue')}
                        value={overdue.length}
                        hint={t('consultant.reports.activeHint', '{count} in progress').replace('{count}', String(active.length))}
                    />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard
                        loading={loading}
                        icon={<StarOutlined />}
                        label={t('consultant.reports.avgRating')}
                        value={avgRating ? avgRating.toFixed(2) : '-'}
                        hint={t('consultant.reports.ratedHint', '{count} rated').replace('{count}', String(rated.length))}
                    />
                </Col>
            </Row>

            <FilterBar
                primary={
                    <>
                        <Segmented<Period>
                            value={period}
                            onChange={updatePeriod}
                            options={[
                                { label: t('consultant.reports.thisMonth'), value: 'month' },
                                { label: t('consultant.reports.thisQuarter'), value: 'quarter' },
                                { label: t('consultant.reports.thisYear'), value: 'year' },
                                { label: t('consultant.reports.custom'), value: 'custom' },
                            ]}
                        />
                        {period === 'custom' && (
                            <RangePicker
                                value={[start, end]}
                                allowClear={false}
                                onChange={(value) => {
                                    if (value?.[0] && value?.[1]) setRange([value[0], value[1]])
                                }}
                            />
                        )}
                    </>
                }
                actions={
                    <Space wrap>
                        <Button type="primary" icon={<DownloadOutlined />} disabled={!scopedRows.length} onClick={exportReport}>
                            {t('consultant.reports.downloadCsv')}
                        </Button>
                    </Space>
                }
            />

            <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title={t('consultant.reports.statusMix')}>
                        {scopedRows.length ? <ThemedHighcharts options={statusChart} /> : <Empty description={t('consultant.reports.empty')} />}
                    </Card>
                </Col>
                <Col xs={24} xl={12}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title={t('consultant.reports.programmeWorkload')}>
                        {scopedRows.length ? <ThemedHighcharts options={programChart} /> : <Empty description={t('consultant.reports.noProgrammeData')} />}
                    </Card>
                </Col>
            </Row>

            <Card loading={loading} className="dashboard-section-card motion-card" title={<Space><FileTextOutlined /> {t('consultant.reports.detail')}</Space>} style={{ marginTop: 16 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div className="consultant-report-summary">
                        <div>
                            <Text type="secondary">{t('consultant.reports.narrative')}</Text>
                            <Title level={5}>
                                {t('consultant.reports.summary', 'Completed {completed} of {total} assigned interventions, with {overdue} items needing attention.')
                                    .replace('{completed}', String(completed.length))
                                    .replace('{total}', String(scopedRows.length))
                                    .replace('{overdue}', String(overdue.length))}
                            </Title>
                        </div>
                        <Text type="secondary">{t('consultant.reports.templateNote')}</Text>
                    </div>
                    <Table
                        columns={columns}
                        dataSource={scopedRows}
                        rowKey="id"
                        pagination={{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }}
                        scroll={{ x: 780 }}
                    />
                </Space>
            </Card>
        </DashboardPage>
    )
}

export default ConsultantReportsPage
