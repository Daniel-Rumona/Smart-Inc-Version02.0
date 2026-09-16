import { useEffect, useMemo, useState } from 'react'
import { App, Card, Col, DatePicker, Empty, Row, Segmented } from 'antd'
import {
    AppstoreOutlined,
    AuditOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    FileProtectOutlined,
    TeamOutlined,
} from '@ant-design/icons'
import type Highcharts from 'highcharts'
import dayjs, { type Dayjs } from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { CHART_COLORS } from '@/config/chartPalette'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import {
    filterProjectAdminDataByRange,
    isComplianceAttentionStatus,
    isCompletedInterventionStatus,
    isOpenApplicationStatus,
    isOverdueIntervention,
    loadProjectAdminWorkspace,
    type ProjectAdminWorkspaceData,
} from '@/services/projectAdminWorkspaceService'
import '@/styles/dashboard.css'
import '@/styles/operations-reports.css'

dayjs.extend(quarterOfYear)

const { RangePicker } = DatePicker

type PeriodPreset = 'week' | 'month' | 'quarter' | 'year' | 'custom'
type ReportView = 'overview' | 'applications' | 'programmes' | 'interventions' | 'compliance'
type TimeBucket = { key: string, label: string }

type ProgrammeRow = {
    key: string
    programme: string
    applications: number
    participants: number
    interventions: number
    completed: number
    overdue: number
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
        return CHART_COLORS.success
    }
    if (['rejected', 'declined', 'failed', 'overdue', 'expired', 'invalid', 'cancelled', 'changes_requested', 'inactive'].includes(status)) {
        return CHART_COLORS.danger
    }
    if (status.includes('pending') || status.includes('awaiting') || ['submitted', 'under_review', 'queried', 'missing'].includes(status)) {
        return CHART_COLORS.amber
    }
    if (['in_progress', 'open', 'assigned'].includes(status)) return CHART_COLORS.primary
    return CHART_COLORS.slate
}

const getPresetRange = (preset: PeriodPreset): [Dayjs, Dayjs] | null => {
    const now = dayjs()
    if (preset === 'week') return [now.startOf('week'), now.endOf('week')]
    if (preset === 'month') return [now.startOf('month'), now.endOf('month')]
    if (preset === 'quarter') return [now.startOf('quarter'), now.endOf('quarter')]
    if (preset === 'year') return [now.startOf('year'), now.endOf('year')]
    return null
}

const countBy = <T,>(rows: T[], readKey: (row: T) => string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
        const rawKey = readKey(row).trim()
        const key = rawKey ? labelize(rawKey) : 'Not Recorded'
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {})

const toStatusSeries = (counts: Record<string, number>) =>
    Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .map(([name, y]) => ({ name: statusLabel(name), y, color: statusColor(name) }))

const categoryColors = [
    CHART_COLORS.violet,
    CHART_COLORS.cyan,
    CHART_COLORS.success,
    CHART_COLORS.amber,
    CHART_COLORS.pink,
    CHART_COLORS.primary,
    CHART_COLORS.teal,
    CHART_COLORS.danger,
]

const distributionChart = (
    counts: Record<string, number>,
    type: 'bar' | 'column' | 'pie' = 'column',
): Highcharts.Options => {
    const data = Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 12)
        .map(([name, y], index) => ({ name, y, color: categoryColors[index % categoryColors.length] }))
    const isPie = type === 'pie'
    return {
        chart: { type, height: type === 'bar' ? Math.max(320, data.length * 38) : 320 },
        title: { text: undefined },
        xAxis: isPie ? undefined : { type: 'category' },
        yAxis: isPie ? undefined : { title: { text: 'Applicants' }, allowDecimals: false },
        legend: { enabled: isPie },
        plotOptions: isPie
            ? { pie: { innerSize: '52%', dataLabels: { enabled: true, format: '{point.name}: {point.y}' } } }
            : { series: { dataLabels: { enabled: true, format: '{point.y}' } } },
        series: [{ type, name: 'Applicants', data } as Highcharts.SeriesOptionsType],
    }
}

const buildTimeBuckets = (dates: Array<Date | null>, range: [Dayjs, Dayjs] | null): {
    buckets: TimeBucket[]
    unit: 'day' | 'month'
    keyFor: (date: Date) => string
} => {
    const validDates = dates.filter((date): date is Date => Boolean(date)).map(dayjs).sort((left, right) => left.valueOf() - right.valueOf())
    const start = (range?.[0] || validDates[0] || dayjs()).startOf('day')
    const end = (range?.[1] || validDates[validDates.length - 1] || start).endOf('day')
    const unit = end.diff(start, 'day') > 62 ? 'month' as const : 'day' as const
    const cursorStart = start.startOf(unit)
    const cursorEnd = end.startOf(unit)
    const buckets: TimeBucket[] = []
    let cursor = cursorStart
    while (cursor.isBefore(cursorEnd) || cursor.isSame(cursorEnd, unit)) {
        buckets.push({
            key: cursor.format(unit === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'),
            label: cursor.format(unit === 'day' ? 'DD MMM' : 'MMM YYYY'),
        })
        cursor = cursor.add(1, unit)
    }
    return {
        buckets,
        unit,
        keyFor: (date: Date) => dayjs(date).format(unit === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'),
    }
}

export default function ProjectAdminReportsPage() {
    const { message } = App.useApp()
    const { user, loading: identityLoading } = useFullIdentity()
    const { activeProgramId } = useActiveProgramId()
    const [loading, setLoading] = useState(true)
    const [preset, setPreset] = useState<PeriodPreset>('month')
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(getPresetRange('month'))
    const [view, setView] = useState<ReportView>('overview')
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
                console.error('[PROJECT ADMIN REPORTS] Failed loading report data:', error)
                if (!cancelled) {
                    setData(emptyWorkspace)
                    message.error('Failed to load project admin reports.')
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

    const periodData = useMemo(() => filterProjectAdminDataByRange(data, dateRange), [data, dateRange])

    const metrics = useMemo(() => {
        const openApplications = periodData.applications.filter((application) => isOpenApplicationStatus(application.status)).length
        const acceptedApplications = periodData.applications.filter((application) =>
            ['accepted', 'approved'].includes(normalize(application.status)),
        ).length
        const completedInterventions = periodData.interventions.filter((intervention) =>
            isCompletedInterventionStatus(intervention.status),
        ).length
        const overdueInterventions = periodData.interventions.filter((intervention) => isOverdueIntervention(intervention)).length
        const complianceAttention = periodData.complianceDocuments.filter((document) =>
            isComplianceAttentionStatus(document.status),
        ).length
        const completionRate = periodData.interventions.length
            ? Math.round((completedInterventions / periodData.interventions.length) * 100)
            : 0

        return {
            openApplications,
            acceptedApplications,
            participants: periodData.participants.length,
            completedInterventions,
            overdueInterventions,
            complianceAttention,
            completionRate,
        }
    }, [periodData])

    const programmeRows = useMemo<ProgrammeRow[]>(() => {
        const byProgramme = new Map<string, ProgrammeRow>()
        const ensure = (programme: string) => {
            const key = programme || 'Unassigned programme'
            if (!byProgramme.has(key)) {
                byProgramme.set(key, {
                    key,
                    programme: key,
                    applications: 0,
                    participants: 0,
                    interventions: 0,
                    completed: 0,
                    overdue: 0,
                })
            }
            return byProgramme.get(key) as ProgrammeRow
        }

        periodData.applications.forEach((application) => {
            ensure(application.programName).applications += 1
        })
        periodData.participants.forEach((participant) => {
            ensure(participant.programName).participants += 1
        })
        periodData.interventions.forEach((intervention) => {
            const row = ensure(intervention.programName)
            row.interventions += 1
            if (isCompletedInterventionStatus(intervention.status)) row.completed += 1
            if (isOverdueIntervention(intervention)) row.overdue += 1
        })

        return [...byProgramme.values()].sort((left, right) => right.participants - left.participants)
    }, [periodData])

    const applicationTimelineChart = useMemo<Highcharts.Options>(() => {
        const timeline = buildTimeBuckets(
            periodData.applications.map((application) => application.submittedAt || application.createdAt),
            dateRange,
        )
        const statuses = [...new Set(periodData.applications.map((application) => statusLabel(application.status)))]
        return {
            chart: { type: 'spline', height: 360 },
            title: { text: undefined },
            xAxis: { categories: timeline.buckets.map((bucket) => bucket.label) },
            yAxis: { min: 0, title: { text: 'Applications' }, allowDecimals: false },
            tooltip: { shared: true },
            plotOptions: {
                series: {
                    marker: { enabled: true, radius: 4 },
                    dataLabels: { enabled: true, format: '{point.y}', filter: { property: 'y', operator: '>', value: 0 } },
                },
            },
            series: statuses.map((status) => {
                const counts = new Map<string, number>()
                periodData.applications
                    .filter((application) => statusLabel(application.status) === status)
                    .forEach((application) => {
                        const date = application.submittedAt || application.createdAt
                        if (!date) return
                        const key = timeline.keyFor(date)
                        counts.set(key, (counts.get(key) || 0) + 1)
                    })
                return {
                    type: 'spline' as const,
                    name: status,
                    color: statusColor(status),
                    data: timeline.buckets.map((bucket) => counts.get(bucket.key) || 0),
                }
            }),
        }
    }, [dateRange, periodData.applications])

    const interventionTimelineChart = useMemo<Highcharts.Options>(() => {
        const timeline = buildTimeBuckets(
            periodData.interventions.flatMap((intervention) => [intervention.assignedAt, intervention.completedAt, intervention.dueDate]),
            dateRange,
        )
        const countDates = (readDate: (row: typeof periodData.interventions[number]) => Date | null) => {
            const counts = new Map<string, number>()
            periodData.interventions.forEach((intervention) => {
                const date = readDate(intervention)
                if (!date) return
                const key = timeline.keyFor(date)
                counts.set(key, (counts.get(key) || 0) + 1)
            })
            return timeline.buckets.map((bucket) => counts.get(bucket.key) || 0)
        }
        return {
            chart: { type: 'spline', height: 360 },
            title: { text: undefined },
            xAxis: { categories: timeline.buckets.map((bucket) => bucket.label) },
            yAxis: { min: 0, title: { text: 'Interventions' }, allowDecimals: false },
            tooltip: { shared: true },
            plotOptions: {
                series: {
                    marker: { enabled: true, radius: 4 },
                    dataLabels: { enabled: true, format: '{point.y}', filter: { property: 'y', operator: '>', value: 0 } },
                },
            },
            series: [
                { type: 'spline', name: 'Assigned', color: CHART_COLORS.primary, data: countDates((row) => row.assignedAt) },
                { type: 'spline', name: 'Completed', color: CHART_COLORS.success, data: countDates((row) => row.completedAt) },
                {
                    type: 'spline',
                    name: 'Overdue due dates',
                    color: CHART_COLORS.danger,
                    data: countDates((row) => isOverdueIntervention(row) ? row.dueDate : null),
                },
            ],
        }
    }, [dateRange, periodData.interventions])

    const applicantDemographicCharts = useMemo(() => {
        const applications = periodData.applications
        const definitions = [
            { key: 'gender', title: 'Gender', type: 'pie' as const, read: (row: typeof applications[number]) => row.gender },
            { key: 'age', title: 'Age Group', type: 'column' as const, read: (row: typeof applications[number]) => row.ageGroup },
            { key: 'province', title: 'Province', type: 'bar' as const, read: (row: typeof applications[number]) => row.province },
            { key: 'city', title: 'City', type: 'bar' as const, read: (row: typeof applications[number]) => row.city },
            { key: 'sector', title: 'Business Sector', type: 'bar' as const, read: (row: typeof applications[number]) => row.sector },
            { key: 'stage', title: 'Business Stage', type: 'column' as const, read: (row: typeof applications[number]) => row.stage },
            { key: 'bee', title: 'B-BBEE Level', type: 'column' as const, read: (row: typeof applications[number]) => row.beeLevel },
            { key: 'hub', title: 'Hub', type: 'bar' as const, read: (row: typeof applications[number]) => row.hub },
            { key: 'location', title: 'Location Type', type: 'pie' as const, read: (row: typeof applications[number]) => row.locationType },
            { key: 'disability', title: 'Disability Status', type: 'pie' as const, read: (row: typeof applications[number]) => row.disabilityStatus },
            { key: 'education', title: 'Education Level', type: 'bar' as const, read: (row: typeof applications[number]) => row.educationLevel },
            { key: 'employment', title: 'Employment Status', type: 'column' as const, read: (row: typeof applications[number]) => row.employmentStatus },
            { key: 'marital', title: 'Marital Status', type: 'pie' as const, read: (row: typeof applications[number]) => row.maritalStatus },
        ]
        return definitions
            .filter((definition) => applications.some((application) => Boolean(definition.read(application).trim())))
            .map((definition) => ({
                key: definition.key,
                title: definition.title,
                options: distributionChart(countBy(applications, definition.read), definition.type),
            }))
    }, [periodData.applications])

    const ownershipChart = useMemo<Highcharts.Options | null>(() => {
        const averages = [
            { name: 'Female-owned', values: periodData.applications.map((row) => row.femaleOwnedPercent).filter((value): value is number => value !== null), color: CHART_COLORS.pink },
            { name: 'Youth-owned', values: periodData.applications.map((row) => row.youthOwnedPercent).filter((value): value is number => value !== null), color: CHART_COLORS.amber },
            { name: 'Black-owned', values: periodData.applications.map((row) => row.blackOwnedPercent).filter((value): value is number => value !== null), color: CHART_COLORS.success },
        ].filter((row) => row.values.length)
        if (!averages.length) return null
        return {
            chart: { type: 'bar', height: 320 },
            title: { text: undefined },
            xAxis: { type: 'category' },
            yAxis: { min: 0, max: 100, title: { text: 'Average ownership (%)' } },
            legend: { enabled: false },
            plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y:.0f}%' } } },
            series: [{
                type: 'bar',
                name: 'Average ownership',
                data: averages.map((row) => ({
                    name: row.name,
                    y: row.values.reduce((sum, value) => sum + value, 0) / row.values.length,
                    color: row.color,
                })),
            }],
        }
    }, [periodData.applications])

    const sectorBubbleChart = useMemo<Highcharts.Options | null>(() => {
        const groups = new Map<string, { ages: number[], years: number[], count: number }>()
        periodData.applications.forEach((application) => {
            if (!application.sector || (application.age === null && application.yearsOfTrading === null)) return
            const group = groups.get(application.sector) || { ages: [], years: [], count: 0 }
            if (application.age !== null) group.ages.push(application.age)
            if (application.yearsOfTrading !== null) group.years.push(application.yearsOfTrading)
            group.count += 1
            groups.set(application.sector, group)
        })
        if (!groups.size) return null
        const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
        return {
            chart: { type: 'bubble', height: 380, plotBorderWidth: 1 },
            title: { text: undefined },
            xAxis: { title: { text: 'Average applicant age' } },
            yAxis: { title: { text: 'Average years trading' } },
            legend: { enabled: false },
            tooltip: { pointFormat: '<b>{point.name}</b><br/>Applicants: {point.z}<br/>Average age: {point.x:.1f}<br/>Average years trading: {point.y:.1f}' },
            plotOptions: { bubble: { minSize: 18, maxSize: 70, dataLabels: { enabled: true, format: '{point.name}: {point.z}' } } },
            series: [{
                type: 'bubble',
                name: 'Sectors',
                data: [...groups.entries()].map(([name, group], index) => ({
                    name,
                    x: average(group.ages),
                    y: average(group.years),
                    z: group.count,
                    color: categoryColors[index % categoryColors.length],
                })),
            }],
        }
    }, [periodData.applications])

    const programmeChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'column', height: 320 },
        title: { text: undefined },
        xAxis: { type: 'category' },
        yAxis: { title: { text: 'Records' }, allowDecimals: false },
        tooltip: { shared: true },
        plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}' } } },
        series: [
            { type: 'column', name: 'Applications', color: CHART_COLORS.violet, data: programmeRows.map((row) => [row.programme, row.applications]) },
            { type: 'column', name: 'Participants', color: CHART_COLORS.cyan, data: programmeRows.map((row) => [row.programme, row.participants]) },
            { type: 'column', name: 'Interventions', color: CHART_COLORS.primary, data: programmeRows.map((row) => [row.programme, row.interventions]) },
        ],
    }), [programmeRows])

    const programmeHealthChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'bar', height: 360 },
        title: { text: undefined },
        xAxis: { categories: programmeRows.map((row) => row.programme) },
        yAxis: { min: 0, title: { text: 'Interventions' }, allowDecimals: false },
        plotOptions: { series: { stacking: 'normal', dataLabels: { enabled: true, format: '{point.y}' } } },
        tooltip: { shared: true },
        series: [
            { type: 'bar', name: 'Completed', color: CHART_COLORS.success, data: programmeRows.map((row) => row.completed) },
            { type: 'bar', name: 'On track', color: CHART_COLORS.primary, data: programmeRows.map((row) => Math.max(0, row.interventions - row.completed - row.overdue)) },
            { type: 'bar', name: 'Overdue', color: CHART_COLORS.danger, data: programmeRows.map((row) => row.overdue) },
        ],
    }), [programmeRows])

    const applicationStatusChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'column', height: 320 },
        title: { text: undefined },
        xAxis: { type: 'category' },
        yAxis: { title: { text: 'Applications' }, allowDecimals: false },
        legend: { enabled: false },
        plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}' } } },
        series: [{
            type: 'column',
            name: 'Applications',
            data: toStatusSeries(countBy(periodData.applications, (application) => application.status)),
        }],
    }), [periodData.applications])

    const interventionChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'pie', height: 320 },
        title: { text: undefined },
        plotOptions: { pie: { innerSize: '58%', dataLabels: { enabled: true, format: '{point.name}: {point.y}' } } },
        series: [{
            type: 'pie',
            name: 'Interventions',
            data: toStatusSeries(countBy(periodData.interventions, (intervention) => intervention.status)),
        }],
    }), [periodData.interventions])

    const interventionProgressChart = useMemo<Highcharts.Options>(() => {
        const rows = [...periodData.interventions]
            .sort((left, right) => right.progress - left.progress)
            .slice(0, 12)
        return {
            chart: { type: 'bar', height: Math.max(360, rows.length * 42) },
            title: { text: undefined },
            xAxis: { categories: rows.map((row) => `${row.title} — ${row.participantName}`) },
            yAxis: { min: 0, max: 100, title: { text: 'Progress (%)' }, tickInterval: 25 },
            legend: { enabled: false },
            tooltip: { pointFormat: '<b>{point.y}%</b>' },
            plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}%' } } },
            series: [{
                type: 'bar',
                name: 'Progress',
                data: rows.map((row) => ({ y: row.progress, color: statusColor(row.status) })),
            }],
        }
    }, [periodData.interventions])

    const complianceStatusChart = useMemo<Highcharts.Options>(() => ({
        chart: { type: 'pie', height: 340 },
        title: { text: undefined },
        plotOptions: { pie: { innerSize: '58%', dataLabels: { enabled: true, format: '{point.name}: {point.y}' } } },
        series: [{
            type: 'pie',
            name: 'Documents',
            data: toStatusSeries(countBy(periodData.complianceDocuments, (document) => document.status)),
        }],
    }), [periodData.complianceDocuments])

    const complianceHealthChart = useMemo<Highcharts.Options>(() => {
        const attention = periodData.complianceDocuments.filter((document) => isComplianceAttentionStatus(document.status)).length
        const clear = Math.max(0, periodData.complianceDocuments.length - attention)
        return {
            chart: { type: 'column', height: 340 },
            title: { text: undefined },
            xAxis: { type: 'category' },
            yAxis: { title: { text: 'Documents' }, allowDecimals: false },
            legend: { enabled: false },
            plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}' } } },
            series: [{
                type: 'column',
                name: 'Documents',
                data: [
                    { name: 'Clear', y: clear, color: CHART_COLORS.success },
                    { name: 'Action required', y: attention, color: CHART_COLORS.danger },
                ],
            }],
        }
    }, [periodData.complianceDocuments])

    const handlePresetChange = (value: PeriodPreset) => {
        setPreset(value)
        if (value !== 'custom') setDateRange(getPresetRange(value))
    }

    return (
        <DashboardPage className="operations-reports-page project-admin-reports-page">
            <Row gutter={[12, 12]} className="dashboard-metrics-row operations-reports-metrics">
                <Col xs={12} lg={4}>
                    <DashboardMetricCard
                        loading={identityLoading || loading}
                        icon={<AuditOutlined />}
                        iconClassName="is-applications"
                        label="Open Applications"
                        value={metrics.openApplications}
                        hint={`${metrics.acceptedApplications} accepted`} />
                </Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<TeamOutlined />} iconClassName="is-participants" label="Participants" value={metrics.participants} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<CheckCircleOutlined />} iconClassName="is-delivery" label="Completed interventions" value={metrics.completedInterventions} hint={`${metrics.completionRate}% rate`} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<ExclamationCircleOutlined />} iconClassName="is-attention" label="Overdue interventions" value={metrics.overdueInterventions} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<FileProtectOutlined />} iconClassName="is-attention" label="Compliance alerts" value={metrics.complianceAttention} /></Col>
                <Col xs={12} lg={4}><DashboardMetricCard loading={identityLoading || loading} icon={<AppstoreOutlined />} iconClassName="is-users" label="Programmes" value={programmeRows.length} /></Col>
            </Row>

            <FilterBar
                title="Report filters"
                primary={(
                    <div className="project-admin-report-filter-grid">
                        <div className="project-admin-report-filter-control">
                            <span>Period</span>
                            <Segmented<PeriodPreset>
                                block
                                value={preset}
                                onChange={handlePresetChange}
                                options={[
                                    { label: 'Week', value: 'week' },
                                    { label: 'Month', value: 'month' },
                                    { label: 'Quarter', value: 'quarter' },
                                    { label: 'Year', value: 'year' },
                                    { label: 'Custom', value: 'custom' },
                                ]}
                            />
                        </div>
                        <div className="project-admin-report-filter-control">
                            <span>Date range</span>
                            <RangePicker
                                value={dateRange}
                                onChange={(range) => {
                                    setPreset('custom')
                                    setDateRange(range ? [range[0] as Dayjs, range[1] as Dayjs] : null)
                                }}
                            />
                        </div>
                        <div className="project-admin-report-filter-control">
                            <span>Analysis</span>
                            <Segmented<ReportView>
                                block
                                value={view}
                                onChange={setView}
                                options={[
                                    { label: 'Overview', value: 'overview' },
                                    { label: 'Applications', value: 'applications' },
                                    { label: 'Programmes', value: 'programmes' },
                                    { label: 'Interventions', value: 'interventions' },
                                    { label: 'Compliance', value: 'compliance' },
                                ]}
                            />
                        </div>
                    </div>
                )}
            />

            {view === 'overview' && (
                <>
                    <Row gutter={[20, 20]} className="project-admin-report-chart-grid">
                        <Col xs={24} xl={12}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Programme Activity">
                                {programmeRows.length ? <ThemedHighcharts options={programmeChart} /> : <Empty description="No programme report data for this period." />}
                            </Card>
                        </Col>
                        <Col xs={24} xl={12}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Application Status">
                                {periodData.applications.length ? <ThemedHighcharts options={applicationStatusChart} /> : <Empty description="No application data for this period." />}
                            </Card>
                        </Col>
                        <Col xs={24} xl={12}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Status">
                                {periodData.interventions.length ? <ThemedHighcharts options={interventionChart} /> : <Empty description="No intervention report data for this period." />}
                            </Card>
                        </Col>
                        <Col xs={24} xl={12}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Compliance Health">
                                {periodData.complianceDocuments.length ? <ThemedHighcharts options={complianceHealthChart} /> : <Empty description="No compliance data for this period." />}
                            </Card>
                        </Col>
                    </Row>
                </>
            )}

            {view === 'applications' && (
                <Row gutter={[20, 20]} className="project-admin-report-chart-grid">
                    <Col xs={24}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Applications And Statuses Over Time">
                            {periodData.applications.length ? <ThemedHighcharts options={applicationTimelineChart} /> : <Empty description="No applications found for this period." />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Application Status Mix">
                            {periodData.applications.length ? <ThemedHighcharts options={applicationStatusChart} /> : <Empty description="No application statuses found." />}
                        </Card>
                    </Col>
                    {ownershipChart && (
                        <Col xs={24} xl={12}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Ownership Profile">
                                <ThemedHighcharts options={ownershipChart} />
                            </Card>
                        </Col>
                    )}
                    {sectorBubbleChart && (
                        <Col xs={24}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Sector Profile: Applicant Age, Trading Experience And Volume">
                                <ThemedHighcharts options={sectorBubbleChart} />
                            </Card>
                        </Col>
                    )}
                    {applicantDemographicCharts.map((chart) => (
                        <Col xs={24} xl={12} key={chart.key}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title={chart.title}>
                                <ThemedHighcharts options={chart.options} />
                            </Card>
                        </Col>
                    ))}
                    {!applicantDemographicCharts.length && !ownershipChart && !sectorBubbleChart && (
                        <Col xs={24}>
                            <Card loading={identityLoading || loading} className="dashboard-section-card motion-card">
                                <Empty description="Applicant demographic fields have not been captured for this period." />
                            </Card>
                        </Col>
                    )}
                </Row>
            )}

            {view === 'programmes' && (
                <Row gutter={[20, 20]} className="project-admin-report-chart-grid">
                    <Col xs={24} xl={12}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Activity By Programme">
                            {programmeRows.length ? <ThemedHighcharts options={programmeChart} /> : <Empty description="No programme records found." />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Health By Programme">
                            {programmeRows.length ? <ThemedHighcharts options={programmeHealthChart} /> : <Empty description="No programme intervention data found." />}
                        </Card>
                    </Col>
                </Row>
            )}

            {view === 'interventions' && (
                <Row gutter={[20, 20]} className="project-admin-report-chart-grid">
                    <Col xs={24}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Activity Over Time">
                            {periodData.interventions.length ? <ThemedHighcharts options={interventionTimelineChart} /> : <Empty description="No intervention activity found." />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={9}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Status Mix">
                            {periodData.interventions.length ? <ThemedHighcharts options={interventionChart} /> : <Empty description="No interventions found." />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={15}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Intervention Progress By SME">
                            {periodData.interventions.length ? <ThemedHighcharts options={interventionProgressChart} /> : <Empty description="No intervention progress found." />}
                        </Card>
                    </Col>
                </Row>
            )}

            {view === 'compliance' && (
                <Row gutter={[20, 20]} className="project-admin-report-chart-grid">
                    <Col xs={24} xl={12}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Compliance Status Mix">
                            {periodData.complianceDocuments.length ? <ThemedHighcharts options={complianceStatusChart} /> : <Empty description="No compliance records found." />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card loading={identityLoading || loading} className="dashboard-section-card motion-card" title="Compliance Action Summary">
                            {periodData.complianceDocuments.length ? <ThemedHighcharts options={complianceHealthChart} /> : <Empty description="No compliance records found." />}
                        </Card>
                    </Col>
                </Row>
            )}
        </DashboardPage>
    )
}
