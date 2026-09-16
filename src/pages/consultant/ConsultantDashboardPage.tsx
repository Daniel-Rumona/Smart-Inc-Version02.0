import { Card, Col, Empty, List, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, ClockCircleOutlined, FileSearchOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { useAssignedInterventions, type AssignedIntervention } from '@/contexts/AssignedInterventionsContext'
import { useLanguage } from '@/providers/LanguageProvider'
import {
    assignmentParticipant,
    assignmentProgram,
    assignmentTitle,
    deriveConsultantStatus,
    getFeedback,
    isOverdueAssignment,
    progressForAssignment,
    statusColor,
    toDate,
} from './ConsultantWorkspaceUtils'
import '@/styles/consultant.css'

type ConsultantStatus = ReturnType<typeof deriveConsultantStatus>

type DashboardFeedback = {
    rating?: number | null
    comments?: string
    createdAt?: Date | null
}

type DashboardRow = {
    id: string
    title: string
    participant: string
    program: string
    status: ConsultantStatus
    progress: number
    dueDate: Date | null
    raw: AssignedIntervention
    feedback: DashboardFeedback
    aiRiskLevel?: 'Low' | 'Medium' | 'High'
    aiNextAction?: string
}

const { Text, Paragraph } = Typography

const buildRow = (assignment: AssignedIntervention): DashboardRow => {
    const status = deriveConsultantStatus(assignment)
    const feedback = getFeedback(assignment)

    return {
        id: assignment.id,
        title: assignmentTitle(assignment),
        participant: assignmentParticipant(assignment),
        program: assignmentProgram(assignment),
        status,
        progress: progressForAssignment(assignment, status),
        dueDate: toDate(assignment.dueDate),
        raw: assignment,
        feedback: {
            rating: feedback.rating,
            comments: feedback.comments,
            createdAt: feedback.createdAt,
        },
    }
}

const isOverdueRow = (row: DashboardRow) => {
    if (row.status === 'Completed') return false
    if (row.dueDate && dayjs(row.dueDate).isBefore(dayjs(), 'day')) return true
    return isOverdueAssignment(row.raw)
}


const deliveryHealthColors = {
    pending: '#F59E0B',
    inProgress: '#2563EB',
    completed: '#16A34A',
    overdue: '#DC2626',
}

const getRiskColor = (risk?: DashboardRow['aiRiskLevel']) => {
    if (risk === 'High') return 'red'
    if (risk === 'Medium') return 'gold'
    if (risk === 'Low') return 'green'
    return 'blue'
}

export const ConsultantDashboardPage = () => {
    const { t } = useLanguage()
    const { assignments, loading, isMine } = useAssignedInterventions()

    const rows = useMemo(() => {
        return assignments.filter(isMine).map(buildRow)
    }, [assignments, isMine])

    const pending = rows.filter((row) => row.status === 'Pending')
    const active = rows.filter((row) => row.status === 'In progress')
    const completed = rows.filter((row) => row.status === 'Completed')
    const overdue = rows.filter(isOverdueRow)
    const feedbackRows = rows.filter((row) => row.feedback.comments || row.feedback.rating != null)

    const attentionRows = rows
        .filter((row) => isOverdueRow(row) || row.aiRiskLevel === 'High' || row.status === 'Pending')
        .slice(0, 4)

    const deliveryHealthData = [
        { name: t('consultant.status.pending', 'Pending'), y: pending.length, color: deliveryHealthColors.pending },
        { name: t('consultant.status.inprogress', 'In progress'), y: active.length, color: deliveryHealthColors.inProgress },
        { name: t('consultant.status.completed', 'Completed'), y: completed.length, color: deliveryHealthColors.completed },
        { name: t('consultant.status.overdue', 'Overdue'), y: overdue.length, color: deliveryHealthColors.overdue },
    ].filter((item) => item.y > 0)

    const statusOptions: Highcharts.Options = {
        chart: { type: 'pie', height: 260 },
        title: { text: undefined },
        colors: deliveryHealthData.map((item) => item.color),
        tooltip: {
            pointFormat: `<b>{point.y}</b> ${t('consultant.common.assignments', 'assignments')}`,
        },
        plotOptions: {
            pie: {
                innerSize: '55%',
                borderWidth: 0,
                dataLabels: {
                    enabled: true,
                    format: '{point.name}: {point.y}',
                    style: { textOutline: 'none', fontWeight: '600' },
                    connectorWidth: 1,
                    distance: 28,
                },
                states: {
                    hover: { enabled: true, brightness: 0.04 },
                },
            },
        },
        series: [{
            type: 'pie',
            name: t('consultant.common.assignments', 'Assignments'),
            data: deliveryHealthData.map((item) => ({
                name: item.name,
                y: item.y,
                color: item.color,
            })),
        }],
    }

    const columns: ColumnsType<DashboardRow> = [
        { title: t('consultant.common.intervention'), dataIndex: 'title', key: 'title', ellipsis: true },
        { title: t('consultant.common.sme'), dataIndex: 'participant', key: 'participant', ellipsis: true },
        {
            title: t('common.status', 'Status'),
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (value) => {
                const statusLabel = value === 'In progress'
                    ? t('consultant.status.inprogress', 'In progress')
                    : t(`consultant.status.${String(value).replace(/\s+/g, '').toLowerCase()}`, value)

                return <Tag color={statusColor(value)}>{statusLabel}</Tag>
            },
        },
        { title: t('consultant.common.progress'), dataIndex: 'progress', key: 'progress', width: 160, render: (value) => <Progress percent={value} size="small" /> },
        { title: t('consultant.common.due'), dataIndex: 'dueDate', key: 'dueDate', width: 130, render: (value: Date | null) => value ? dayjs(value).format('DD MMM YYYY') : t('consultant.common.noDueDate') },
    ]

    return (
        <DashboardPage className="consultant-page">
            <Row gutter={[16, 16]} className="dashboard-metrics-row consultant-metrics">
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<FileSearchOutlined />} label={t('consultant.metrics.assigned')} value={rows.length} hint={t('consultant.dashboard.assignedHint')} /></Col>
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<ClockCircleOutlined />} iconClassName="is-progress" label={t('consultant.metrics.inProgress')} value={active.length} hint={t('consultant.dashboard.pendingHint', `${pending.length} waiting for acceptance`).replace('{count}', String(pending.length))} /></Col>
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<CheckCircleOutlined />} iconClassName="is-success" label={t('consultant.metrics.completed')} value={completed.length} hint={t('consultant.dashboard.completionHint', '{rate}% completion rate').replace('{rate}', String(rows.length ? Math.round((completed.length / rows.length) * 100) : 0))} /></Col>
                <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<WarningOutlined />} iconClassName="is-risk" label={t('consultant.metrics.attention')} value={overdue.length} hint={t('consultant.dashboard.overdueHint')} /></Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col xs={24} xl={15}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title={t('consultant.dashboard.deliveryQueue')}>
                        <Table columns={columns} dataSource={[...pending, ...active, ...overdue].slice(0, 8)} rowKey="id" pagination={false} scroll={{ x: 760 }} locale={{ emptyText: t('consultant.dashboard.noActive') }} />
                    </Card>
                </Col>
                <Col xs={24} xl={9}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title={t('consultant.dashboard.deliveryHealth')}>
                        {rows.length ? <ThemedHighcharts options={statusOptions} /> : <Empty description={t('consultant.dashboard.noAssignments')} />}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={12}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title={t('consultant.dashboard.recentFeedback')}>
                        <List
                            dataSource={feedbackRows.slice(0, 5)}
                            locale={{ emptyText: t('consultant.dashboard.noFeedback') }}
                            renderItem={(row) => (
                                <List.Item>
                                    <List.Item.Meta
                                        title={<Space wrap><Text strong>{row.participant}</Text><Tag>{row.feedback.rating ?? t('consultant.feedback.unrated')}/5</Tag></Space>}
                                        description={row.feedback.comments || row.title}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card loading={loading} className="dashboard-section-card motion-card" title="AI delivery focus">
                        <List
                            dataSource={attentionRows}
                            locale={{ emptyText: t('consultant.dashboard.noActive') }}
                            renderItem={(row) => (
                                <List.Item>
                                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                        <Space wrap>
                                            <Text strong>{row.participant}</Text>
                                            <Tag color={getRiskColor(row.aiRiskLevel)}>{row.aiRiskLevel || (isOverdueRow(row) ? 'High' : 'Medium')} focus</Tag>
                                        </Space>
                                        <Text type="secondary">{row.title}</Text>
                                        <Progress percent={row.progress} size="small" />
                                        <Paragraph style={{ marginBottom: 0 }}>{row.aiNextAction || 'Review progress, confirm next milestone, and update delivery notes before the next reporting cycle.'}</Paragraph>
                                    </Space>
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
            </Row>
        </DashboardPage>
    )
}

export default ConsultantDashboardPage
