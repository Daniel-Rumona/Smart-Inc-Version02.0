import { useEffect, useMemo, useState } from 'react'
import { App, Card, Col, Empty, Progress, Row, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    AuditOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    FileProtectOutlined,
    TeamOutlined,
} from '@ant-design/icons'
import type Highcharts from 'highcharts'
import dayjs from 'dayjs'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import {
    isComplianceAttentionStatus,
    isCompletedInterventionStatus,
    isOpenApplicationStatus,
    isOverdueIntervention,
    loadProjectAdminWorkspace,
    type ProjectAdminIntervention,
    type ProjectAdminWorkspaceData,
} from '@/services/projectAdminWorkspaceService'
import '@/styles/dashboard.css'

type AttentionRow = {
    key: string
    area: string
    item: string
    owner: string
    status: string
    dueDate: string
    severity: 'High' | 'Medium'
}

const emptyWorkspace: ProjectAdminWorkspaceData = {
    applications: [],
    participants: [],
    interventions: [],
    complianceDocuments: [],
    staff: [],
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()

const labelize = (value: string) =>
    value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ') || 'Unspecified'

const statusLabel = (value: string) => {
    const status = normalize(value)
    if (['awaiting_confirmation', 'awaiting confirmation'].includes(status)) return 'Awaiting SME Confirmation'
    if (['awaiting_sme_acceptance', 'awaiting sme acceptance'].includes(status)) return 'Awaiting SME Acceptance'
    if (['awaiting_assignee_acceptance', 'awaiting assignee acceptance'].includes(status)) return 'Awaiting Facilitator Acceptance'
    return labelize(value)
}

const statusColor = (value: string) => {
    const status = normalize(value).replace(/[\s-]+/g, '_')
    if (['accepted', 'approved', 'complete', 'completed', 'confirmed', 'done', 'valid', 'active', 'clear'].includes(status)) {
        return '#22C55E'
    }
    if (['rejected', 'declined', 'failed', 'overdue', 'expired', 'invalid', 'cancelled', 'changes_requested', 'inactive'].includes(status)) {
        return '#EF4444'
    }
    if (status.includes('pending') || status.includes('awaiting') || ['submitted', 'under_review', 'queried', 'missing'].includes(status)) {
        return '#F59E0B'
    }
    if (['in_progress', 'open', 'assigned'].includes(status)) return '#3B82F6'
    return '#64748B'
}

const programmeColors = ['#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5', '#0F766E', '#9333EA']

const countBy = <T,>(rows: T[], readKey: (row: T) => string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
        const key = labelize(readKey(row))
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {})

const mapCountSeries = (counts: Record<string, number>, colorForName?: (name: string, index: number) => string) =>
    Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .map(([name, y], index) => ({ name: statusLabel(name), y, color: colorForName?.(name, index) }))

const formatDate = (date: Date | null) => date ? dayjs(date).format('DD MMM YYYY') : 'No date'

export default function ProjectAdminDashboardPage() {
    const { message } = App.useApp()
    const { user, loading: identityLoading } = useFullIdentity()
    const { activeProgramId } = useActiveProgramId()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<ProjectAdminWorkspaceData>(emptyWorkspace)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            if (identityLoading || !user) return

            try {
                setLoading(true)
                const result = await loadProjectAdminWorkspace(user, activeProgramId)
                if (!cancelled) setData(result)
            } catch (error) {
                console.error('[PROJECT ADMIN DASHBOARD] Failed loading workspace:', error)
                if (!cancelled) {
                    setData(emptyWorkspace)
                    message.error('Failed to load project admin dashboard data.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [activeProgramId, identityLoading, message, user])

    const metrics = useMemo(() => {
        const activeParticipants = data.participants.filter((participant) =>
            !['inactive', 'exited', 'removed'].includes(normalize(participant.status)),
        ).length
        const openApplications = data.applications.filter((application) => isOpenApplicationStatus(application.status)).length
        const interventionsInProgress = data.interventions.filter((intervention) =>
            !isCompletedInterventionStatus(intervention.status),
        ).length
        const overdueInterventions = data.interventions.filter((intervention) => isOverdueIntervention(intervention)).length
        const complianceAttention = data.complianceDocuments.filter((document) =>
            isComplianceAttentionStatus(document.status),
        ).length
        const activeStaff = data.staff.filter((staff) => normalize(staff.status) !== 'inactive').length

        return {
            activeParticipants,
            openApplications,
            interventionsInProgress,
            overdueInterventions,
            complianceAttention,
            activeStaff,
        }
    }, [data])

    const applicationChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'column', height: 300 },
        title: { text: undefined },
        xAxis: { type: 'category' },
        yAxis: { title: { text: 'Applications' }, allowDecimals: false },
        legend: { enabled: false },
        tooltip: { pointFormat: '<b>{point.y}</b> applications' },
        series: [{
            type: 'column',
            name: 'Applications',
            data: mapCountSeries(countBy(data.applications, (application) => application.status), statusColor),
        }],
    }), [data.applications])

    const interventionChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'pie', height: 300 },
        title: { text: undefined },
        tooltip: { pointFormat: '<b>{point.y}</b> interventions' },
        series: [{
            type: 'pie',
            name: 'Interventions',
            data: mapCountSeries(countBy(data.interventions, (intervention) => intervention.status), statusColor),
        }],
    }), [data.interventions])

    const programChart = useMemo<Highcharts.Options>(() => {
        const counts = countBy(data.participants, (participant) => participant.programName || 'Unassigned program')
        return {
            chart: { type: 'bar', height: 320 },
            title: { text: undefined },
            xAxis: { type: 'category' },
            yAxis: { title: { text: 'Participants' }, allowDecimals: false },
            legend: { enabled: false },
            series: [{
                type: 'bar',
                name: 'Participants',
                data: mapCountSeries(counts, (_name, index) => programmeColors[index % programmeColors.length]).slice(0, 8),
            }],
        }
    }, [data.participants])

    const attentionRows = useMemo<AttentionRow[]>(() => {
        const overdueRows = data.interventions
            .filter((intervention) => isOverdueIntervention(intervention))
            .map((intervention) => ({
                key: `intervention-${intervention.id}`,
                area: 'Intervention',
                item: `${intervention.title} · ${intervention.participantName}`,
                owner: intervention.owner,
                status: statusLabel(intervention.status),
                dueDate: formatDate(intervention.dueDate),
                severity: 'High' as const,
            }))

        const complianceRows = data.complianceDocuments
            .filter((document) => isComplianceAttentionStatus(document.status))
            .slice(0, 8)
            .map((document) => ({
                key: `compliance-${document.id}`,
                area: 'Compliance',
                item: document.participantId || 'Participant document',
                owner: 'Project admin',
                status: labelize(document.status),
                dueDate: formatDate(document.expiryDate || document.updatedAt),
                severity: normalize(document.status) === 'expired' ? 'High' as const : 'Medium' as const,
            }))

        return [...overdueRows, ...complianceRows].slice(0, 10)
    }, [data.complianceDocuments, data.interventions])

    const interventionColumns: ColumnsType<ProjectAdminIntervention> = [
        { title: 'Intervention', dataIndex: 'title', key: 'title' },
        { title: 'SME', dataIndex: 'participantName', key: 'participantName' },
        { title: 'Owner', dataIndex: 'owner', key: 'owner' },
        {
            title: 'Progress',
            dataIndex: 'progress',
            key: 'progress',
            render: (progress: number, intervention) => (
                <Progress percent={progress} size="small" strokeColor={statusColor(intervention.status)} />
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>,
        },
        {
            title: 'Due',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: Date | null) => formatDate(date),
        },
    ]

    const attentionColumns: ColumnsType<AttentionRow> = [
        { title: 'Area', dataIndex: 'area', key: 'area' },
        { title: 'Item', dataIndex: 'item', key: 'item' },
        { title: 'Owner', dataIndex: 'owner', key: 'owner' },
        {
            title: 'Severity',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity: AttentionRow['severity']) => (
                <Tag color={severity === 'High' ? 'red' : 'gold'}>{severity}</Tag>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
        },
        { title: 'Due / Updated', dataIndex: 'dueDate', key: 'dueDate' },
    ]

    return (
        <DashboardPage className="dashboard-home-page project-admin-dashboard-page">

            <Row gutter={[16, 16]} className="dashboard-metrics-row">
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<TeamOutlined />} iconClassName="dashboard-icon-green" label="Active SMEs" value={metrics.activeParticipants} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<AuditOutlined />} iconClassName="dashboard-icon-orange" label="Open applications" value={metrics.openApplications} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<CheckCircleOutlined />} iconClassName="dashboard-icon-blue" label="Interventions in progress" value={metrics.interventionsInProgress} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<ExclamationCircleOutlined />} iconClassName="dashboard-icon-red" label="Overdue interventions" value={metrics.overdueInterventions} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<FileProtectOutlined />} iconClassName="dashboard-icon-red" label="Compliance alerts" value={metrics.complianceAttention} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<CalendarOutlined />} iconClassName="dashboard-icon-green" label="Active staff" value={metrics.activeStaff} /></Col>
            </Row>

            <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                <Col xs={24} xl={8}>
                    <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Application Pipeline">
                        {data.applications.length ? <ThemedHighcharts options={applicationChart} /> : <Empty description="No application data yet." />}
                    </Card>
                </Col>
                <Col xs={24} xl={8}>
                    <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Delivery">
                        {data.interventions.length ? <ThemedHighcharts options={interventionChart} /> : <Empty description="No intervention data yet." />}
                    </Card>
                </Col>
                <Col xs={24} xl={8}>
                    <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Participants By Programme">
                        {data.participants.length ? <ThemedHighcharts options={programChart} /> : <Empty description="No participants yet." />}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[20, 20]}>
                <Col xs={24} xl={14}>
                    <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Delivery Attention">
                        <Table
                            rowKey="key"
                            columns={attentionColumns}
                            dataSource={attentionRows}
                            pagination={false}
                            locale={{ emptyText: <Empty description="No overdue or compliance attention items." /> }}
                        />
                    </Card>
                </Col>
                <Col xs={24} xl={10}>
                    <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Current Interventions">
                        <Table
                            rowKey="id"
                            columns={interventionColumns}
                            dataSource={data.interventions.slice(0, 6)}
                            pagination={false}
                            locale={{ emptyText: <Empty description="No interventions assigned yet." /> }}
                        />
                    </Card>
                </Col>
            </Row>
        </DashboardPage>
    )
}
