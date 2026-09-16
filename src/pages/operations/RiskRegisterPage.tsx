import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Input, Row, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClockCircleOutlined, ExclamationCircleOutlined, FileDoneOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { collection, getDocs, query, where, type QueryConstraint } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

import DashboardPage from '@/components/shared/DashboardPage'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import { FilterBar } from '@/components/shared/FilterBar'
import { db } from '@/firebase/config'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { listComplianceRows } from '@/services/complianceService'
import { matchesActiveProgram } from '@/services/workspaceProgramsService'

type Severity = 'critical' | 'high' | 'medium' | 'low'
type Status = 'missing' | 'uploaded' | 'pending' | 'valid' | 'rejected' | 'invalid' | 'expired' | 'queried'
type Filter = 'all' | Severity
type EntityFilter = 'all' | RiskRow['entityType']

type RiskRow = {
    key: string
    category: string
    entityType: 'SME' | 'Intervention' | 'Consultant'
    entityName: string
    owner: string
    issue: string
    severity: Severity
    dueDate: Dayjs | null
    action: string
    actionRoute: string
}

type ParticipantRow = {
    participantId: string
    businessName: string
    required: Array<{ key: string, title: string, hasExpiry?: boolean }>
    documents: Array<{
        key?: string
        type?: string
        currentStatus?: Status
        currentFile?: { expiryDate?: string | null }
    }>
}

type InterventionRow = {
    id: string
    programId?: string | null
    participantId?: string | null
    smmeId?: string | null
    smeId?: string | null
    participantName?: string | null
    beneficiaryName?: string | null
    businessName?: string | null
    smmeName?: string | null
    companyName?: string | null
    interventionTitle?: string | null
    title?: string | null
    assigneeName?: string | null
    status?: string | null
    assigneeCompletionStatus?: string | null
    participantCompletionStatus?: string | null
    participantStatus?: string | null
    dueDate?: unknown
    completedAt?: unknown
    completionConfirmedAt?: unknown
}

const cleanKey = (value?: string) =>
    String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const toDayjs = (value: unknown) => {
    if (!value) return dayjs('')
    if (value instanceof Date) return dayjs(value)
    if (typeof value === 'string') return dayjs(value)
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return dayjs(value.toDate())
    if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return dayjs(value.seconds * 1000)
    return dayjs('')
}

const isCompleted = (row: InterventionRow) => {
    const status = String(row.status || '').toLowerCase()
    const assignee = String(row.assigneeCompletionStatus || '').toLowerCase()
    const participant = String(row.participantCompletionStatus || '').toLowerCase()

    return status === 'completed' || Boolean(row.completedAt) || Boolean(row.completionConfirmedAt) || (assignee === 'done' && participant === 'confirmed')
}

const includesAny = (value: unknown, terms: string[]) => {
    const normalized = String(value || '').toLowerCase()
    return terms.some(term => normalized.includes(term))
}

const getSeverityTag = (severity: Severity) => {
    if (severity === 'critical') return <Tag color="red">Critical</Tag>
    if (severity === 'high') return <Tag color="volcano">High</Tag>
    if (severity === 'medium') return <Tag color="orange">Medium</Tag>
    return <Tag color="blue">Low</Tag>
}

const buildRows = (participants: ParticipantRow[], interventions: InterventionRow[]): RiskRow[] => {
    const rows: RiskRow[] = []
    const participantNames = new Map(participants.map(row => [row.participantId, row.businessName]))
    const interventionParticipantIds = new Set(interventions.map(row => row.participantId || row.smmeId || row.smeId).filter(Boolean))

    participants.forEach(participant => {
        const statuses = participant.required.map(req => {
            const doc = participant.documents.find(item => cleanKey(item.key || item.type) === req.key)
            const expiry = doc?.currentFile?.expiryDate ? dayjs(doc.currentFile.expiryDate) : null
            if (!doc) return 'missing'
            if (req.hasExpiry && expiry?.isValid() && expiry.isBefore(dayjs(), 'day')) return 'expired'
            return doc.currentStatus || 'pending'
        })
        const blockers = statuses.filter(status => ['missing', 'expired', 'invalid', 'rejected'].includes(status)).length
        const pending = statuses.filter(status => ['pending', 'uploaded', 'queried'].includes(status)).length

        if (blockers || pending) {
            rows.push({
                key: `compliance-${participant.participantId}`,
                category: 'Compliance readiness',
                entityType: 'SME',
                entityName: participant.businessName,
                owner: 'Operations',
                issue: `${blockers} blocking document items, ${pending} pending/query`,
                severity: blockers >= 3 ? 'critical' : blockers > 0 ? 'high' : 'medium',
                dueDate: null,
                action: blockers ? 'Clear required document blockers' : 'Review pending/queried documents',
                actionRoute: '/operations/participants/compliance',
            })
        }

        if (!interventionParticipantIds.has(participant.participantId)) {
            rows.push({
                key: `non-serviced-${participant.participantId}`,
                category: 'Interventions: non-serviced',
                entityType: 'SME',
                entityName: participant.businessName,
                owner: 'Operations',
                issue: 'No assigned intervention recorded for this SME',
                severity: 'high',
                dueDate: null,
                action: 'Assign first intervention or confirm support plan',
                actionRoute: '/operations/interventions',
            })
        }
    })

    interventions.forEach(row => {
        const dueDate = toDayjs(row.dueDate)
        const overdue = dueDate.isValid() && dueDate.isBefore(dayjs(), 'day') && !isCompleted(row)
        const participantId = row.participantId || row.smmeId || row.smeId || ''
        const participantName = row.beneficiaryName || row.participantName || row.businessName || row.smmeName || row.companyName || participantNames.get(participantId) || 'Unknown SME'
        const title = row.interventionTitle || 'Untitled intervention'
        const owner = row.assigneeName || 'Operations'

        if (overdue) {
            const daysLate = dayjs().diff(dueDate, 'day')
            rows.push({
                key: `overdue-${row.id}`,
                category: 'Interventions: overdue',
                entityType: 'Intervention',
                entityName: title,
                owner,
                issue: `${participantName} is ${daysLate} day${daysLate === 1 ? '' : 's'} overdue`,
                severity: daysLate >= 14 ? 'critical' : 'high',
                dueDate,
                action: 'Escalate overdue intervention',
                actionRoute: '/operations/interventions',
            })
        }

        const participantStatus = String((row as InterventionRow & { participantStatus?: string }).participantStatus || '').toLowerCase()
        const waitingOnParticipant = participantStatus !== 'accepted'
            && participantStatus !== 'declined'
            && [row.status, row.participantCompletionStatus, participantStatus].some(value => includesAny(value, ['participant', 'beneficiary', 'sme', 'smme', 'acceptance', 'confirmation', 'response']))
        if (!isCompleted(row) && waitingOnParticipant) {
            rows.push({ key: `sme-${row.id}`, category: 'SME non-responsive', entityType: 'SME', entityName: participantName, owner: 'Operations', issue: `Waiting on SME for ${title}`, severity: overdue ? 'high' : 'medium', dueDate: dueDate.isValid() ? dueDate : null, action: 'Contact SME and record outcome', actionRoute: '/operations/interventions' })
        }

        if (!isCompleted(row) && [row.status, row.assigneeCompletionStatus].some(value => includesAny(value, ['assignee', 'consultant', 'coordinator', 'provider', 'delivery']))) {
            rows.push({ key: `consultant-${row.id}`, category: 'Consultant follow-up', entityType: 'Consultant', entityName: owner, owner: 'Operations', issue: `${title} needs consultant/coordinator action`, severity: overdue ? 'high' : 'medium', dueDate: dueDate.isValid() ? dueDate : null, action: 'Follow up with delivery owner', actionRoute: '/operations/interventions' })
        }
    })

    return rows.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] - { critical: 0, high: 1, medium: 2, low: 3 }[b.severity]))
}

export default function RiskRegisterPage() {
    const navigate = useNavigate()
    const { activeProgramId, isAllPrograms } = useActiveProgramId()
    const { user, loading: identityLoading } = useFullIdentity()
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<Filter>('all')
    const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState<RiskRow[]>([])

    const load = useCallback(async () => {
        if (identityLoading) return
        setLoading(true)
        try {
            const compliance = await listComplianceRows({ activeProgramId, departmentId: user?.departmentId || null, user })
            const constraints: QueryConstraint[] = []
            if (!isAllPrograms && activeProgramId) constraints.push(where('programId', '==', activeProgramId))
            const snap = await getDocs(query(collection(db, 'assignedInterventions'), ...constraints))
            setRows(buildRows(
                compliance.rows as unknown as ParticipantRow[],
                snap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }) as InterventionRow)
                    .filter(row => matchesActiveProgram(user, activeProgramId, row.programId)),
            ))
        } catch (error) {
            console.error('[RISK REGISTER] Failed loading risk register:', error)
            message.error('Risk register could not be loaded.')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [activeProgramId, identityLoading, isAllPrograms, user])

    useEffect(() => {
        void load()
    }, [load])

    const categories = useMemo(
        () => Array.from(new Set(rows.map(row => row.category))).sort(),
        [rows],
    )

    const categoryOptions = useMemo(
        () => [
            { label: `All categories (${rows.length})`, value: 'all' },
            ...categories.map(category => ({
                label: `${category} (${rows.filter(row => row.category === category).length})`,
                value: category,
            })),
        ],
        [categories, rows],
    )

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()

        return rows.filter(row => {
            if (filter !== 'all' && row.severity !== filter) return false
            if (entityFilter !== 'all' && row.entityType !== entityFilter) return false
            if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
            if (!query) return true

            return [
                row.category,
                row.entityType,
                row.entityName,
                row.owner,
                row.issue,
                row.action,
            ].some(value => value.toLowerCase().includes(query))
        })
    }, [categoryFilter, entityFilter, filter, rows, search])

    const metrics = useMemo(() => {
        const overdue = rows.filter(row => row.dueDate?.isValid() && row.dueDate.isBefore(dayjs(), 'day')).length
        return {
            total: rows.length,
            urgent: rows.filter(row => row.severity === 'critical' || row.severity === 'high').length,
            overdue,
            owners: new Set(rows.map(row => row.owner).filter(Boolean)).size,
        }
    }, [rows])

    const columns: ColumnsType<RiskRow> = [
        { title: 'Category', dataIndex: 'category', ellipsis: true },
        { title: 'At-risk record', render: (_, row) => <Space orientation="vertical" size={0}><Typography.Text strong>{row.entityName}</Typography.Text><Typography.Text type="secondary">{row.entityType}: {row.issue}</Typography.Text></Space> },
        { title: 'Owner', dataIndex: 'owner', ellipsis: true },
        { title: 'Severity', render: (_, row) => getSeverityTag(row.severity), width: 120 },
        { title: 'Due status', render: (_, row) => row.dueDate?.isValid() ? (row.dueDate.isBefore(dayjs(), 'day') ? <Tag color="red">{row.dueDate.format('DD MMM YYYY')}</Tag> : <Tag>{row.dueDate.format('DD MMM YYYY')}</Tag>) : <Tag>Operational follow-up</Tag>, width: 170 },
        {
            title: 'Action',
            render: (_, row) => (
                <Button
                    type="primary"
                    size="small"
                    onClick={() => navigate(row.actionRoute, { state: { riskAction: row } })}
                >
                    Take Action
                </Button>
            ),
            width: 130,
        },
    ]

    return (
        <DashboardPage className="operations-risk-register-page">
            <Row gutter={[12, 12]} className="dashboard-metrics-row">
                <Col xs={12} lg={6}>
                    <DashboardMetricCard loading={identityLoading || loading} icon={<ExclamationCircleOutlined />} iconClassName="dashboard-icon-red" label="Open Risks" value={metrics.total} />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard loading={identityLoading || loading} icon={<ClockCircleOutlined />} iconClassName="dashboard-icon-orange" label="Critical / High" value={metrics.urgent} />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard loading={identityLoading || loading} icon={<FileDoneOutlined />} iconClassName="dashboard-icon-blue" label="Overdue" value={metrics.overdue} />
                </Col>
                <Col xs={12} lg={6}>
                    <DashboardMetricCard loading={identityLoading || loading} icon={<TeamOutlined />} iconClassName="dashboard-icon-green" label="Owners" value={metrics.owners} />
                </Col>
            </Row>

            <FilterBar
                title="Risk register"
                primary={
                    <>
                        <Segmented value={filter} onChange={value => setFilter(value as Filter)} options={[{ label: 'All', value: 'all' }, { label: 'Critical', value: 'critical' }, { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }]} />
                        <Select value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
                        <Select value={entityFilter} onChange={value => setEntityFilter(value)} options={[{ label: 'All records', value: 'all' }, { label: 'SMEs', value: 'SME' }, { label: 'Interventions', value: 'Intervention' }, { label: 'Consultants', value: 'Consultant' }]} />
                        <Input prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search risk, owner, SME, intervention..." allowClear />
                    </>
                }
            />

            <Card loading={identityLoading || loading} className="dashboard-section-card" bordered={false}>
                <Table rowKey="key" columns={columns} dataSource={filteredRows} pagination={{ pageSize: 12, showSizeChanger: false, position: ['bottomCenter'] }} scroll={{ x: 960 }} locale={{ emptyText: <Empty description="No risk register entries match this filter." /> }} />
            </Card>
        </DashboardPage>
    )
}
