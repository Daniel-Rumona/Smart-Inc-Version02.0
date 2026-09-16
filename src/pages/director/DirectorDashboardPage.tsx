/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Col,
    DatePicker,
    Row,
    Space,
    Tag,
    Typography,
    message,
    Grid,
    Empty,
    Button,
    Modal,
    List
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'

import HighchartsMore from 'highcharts/highcharts-more'
import VariablePie from 'highcharts/modules/variable-pie'
import Drilldown from 'highcharts/modules/drilldown'

import { db } from '@/firebase'
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    where,
    Timestamp
} from 'firebase/firestore'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import DashboardHeader from '@/components/shared/DashboardHeader'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { useNavigate } from 'react-router-dom'
import {
    TeamOutlined,
    ShopOutlined,
    SolutionOutlined,
    CheckCircleOutlined,
    ReloadOutlined,
    WarningOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    ArrowRightOutlined
} from '@ant-design/icons'
import '@/styles/director.css'

const registerHighchartsModule = (module: unknown) => {
    const fn = typeof module === 'function'
        ? module
        : typeof (module as { default?: unknown })?.default === 'function'
            ? (module as { default: unknown }).default
            : null

    if (fn) {
        ;(fn as (highcharts: typeof Highcharts) => void)(Highcharts)
    }
}

registerHighchartsModule(HighchartsMore)
registerHighchartsModule(VariablePie)
registerHighchartsModule(Drilldown)

const { Text } = Typography
const { RangePicker } = DatePicker
const { useBreakpoint } = Grid

type AssignmentModel = 'ops_assign_consultant' | 'consultant_self_assign'
type SmeDivisionModel =
    | 'system_equal_random'
    | 'ops_assign_smes_to_consultants'
    | 'consultants_register_their_smes'

type SystemSettingsDoc = {
    companyCode: string
    companyName?: string
    hasDepartments: boolean
    hasBranches: boolean
    assignmentModel: AssignmentModel
    smeDivisionModel?: SmeDivisionModel
    branchScopedManagement?: boolean
    locked: true
    createdAt: Timestamp
    createdByUid: string
    createdByEmail?: string
}

type ProgramDoc = {
    companyCode?: string
    startDate?: any
    createdAt?: any
    status?: string
    isActive?: boolean
    [k: string]: any
}

type InterventionMeta = {
    id: string
    areaOfSupport?: string
    department?: string
    companyCode?: string
    [k: string]: any
}

type RequiredInterventionRef = {
    interventionId?: string
    id?: string
    areaOfSupport?: string
    department?: string
    [k: string]: any
}

type AnyAssignedIntervention = {
    id: string
    companyCode?: string
    interventionId?: string

    // sometimes stored directly; we override using interventions map
    department?: string
    areaOfSupport?: string

    // SME identity (varies across your docs)
    enterpriseName?: string
    beneficiaryName?: string
    participantName?: string
    smmEName?: string
    smeName?: string
    companyName?: string
    participantId?: string
    smeId?: string
    email?: string

    dueDate?: any
    createdAt?: any

    assigneeStatus?: string
    participantStatus?: string
    assigneeCompletionStatus?: string
    participantCompletionStatus?: string

    [k: string]: any
}

type BottleneckKey =
    | 'pending_consultant'
    | 'pending_sme_acceptance'
    | 'pending'
    | 'awaiting_sme_completion'

const norm = (v?: any) => String(v ?? '').trim().toLowerCase()

const tsToDayjs = (v: any): Dayjs | null => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return dayjs(v.toDate())
    if (typeof v === 'string') {
        const d = dayjs(v)
        return d.isValid() ? d : null
    }
    if (v instanceof Date) return dayjs(v)
    return null
}

const getDocDate = (docData: any, field: 'dueDate' | 'createdAt' | 'startDate' | 'createdAtOrAccepted') => {
    if (field === 'createdAtOrAccepted') {
        return (
            tsToDayjs(docData?.dateAccepted) ||
            tsToDayjs(docData?.acceptedAt) ||
            tsToDayjs(docData?.createdAt) ||
            tsToDayjs(docData?.submittedAt) ||
            null
        )
    }
    return tsToDayjs(docData?.[field])
}

const getSmeLabel = (x: AnyAssignedIntervention) =>
    x.enterpriseName ||
    x.beneficiaryName ||
    x.participantName ||
    x.smmEName ||
    x.smeName ||
    x.companyName ||
    x.participantId ||
    x.smeId ||
    x.email ||
    '—'

const classifyBottleneck = (x: AnyAssignedIntervention): BottleneckKey => {
    const consultantAccepted = norm(x.assigneeStatus) === 'accepted'
    const smeAccepted = norm(x.participantStatus) === 'accepted'

    const consultantCompleted = norm(x.assigneeCompletionStatus) === 'done'
    const smeCompleted = norm(x.participantCompletionStatus) === 'confirmed'

    if (consultantCompleted && smeCompleted) return 'pending' // not used here, completion handled separately
    if (!consultantAccepted) return 'pending_consultant'
    if (consultantAccepted && !smeAccepted) return 'pending_sme_acceptance'
    if (consultantCompleted && !smeCompleted) return 'awaiting_sme_completion'
    return 'pending'
}

const prettyBottleneck = (k: BottleneckKey) => {
    switch (k) {
        case 'pending_consultant':
            return 'Pending Consultant'
        case 'pending_sme_acceptance':
            return 'Pending SME Acceptance'
        case 'awaiting_sme_completion':
            return 'Awaiting SME Completion'
        case 'pending':
            return 'Pending'
    }
}

const percent = (num: number, den: number) => (den <= 0 ? 0 : Math.round((num / den) * 100))

const DirectorDashboard: React.FC = () => {
    const screens = useBreakpoint()
    const isMobile = !screens.md
    const navigate = useNavigate()

    const { user } = useFullIdentity()
    const companyCode = String((user as any)?.companyCode || '').trim()

    const [systemSettings, setSystemSettings] = useState<SystemSettingsDoc | null>(null)

    // Program-driven default range
    const [defaultRange, setDefaultRange] = useState<[Dayjs, Dayjs] | null>(null)
    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs().endOf('day')])
    const defaultRangeRef = useRef<[Dayjs, Dayjs] | null>(null)

    // Counts
    const [usersCount, setUsersCount] = useState(0)
    const [smesCount, setSmesCount] = useState(0)

    // Intervention meta map
    const [interventionMetaById, setInterventionMetaById] = useState<Record<string, InterventionMeta>>({})
    const [totalRequiredFromAcceptedApps, setTotalRequiredFromAcceptedApps] = useState(0)

    // Accepted SME filters
    const [acceptedParticipantIds, setAcceptedParticipantIds] = useState<Set<string>>(new Set())
    const [acceptedEmails, setAcceptedEmails] = useState<Set<string>>(new Set())

    // Required vs Completed per scope
    const [requiredByScope, setRequiredByScope] = useState<Record<string, number>>({})
    const [completedByScope, setCompletedByScope] = useState<Record<string, number>>({})

    // Bottlenecks
    const [bottlenecks, setBottlenecks] = useState<Record<BottleneckKey, number>>({
        pending_consultant: 0,
        pending_sme_acceptance: 0,
        pending: 0,
        awaiting_sme_completion: 0
    })

    // Risk signals (instead of overdue table)
    const [riskCounts, setRiskCounts] = useState({
        overdue: 0,
        upcoming7: 0,
        upcoming14: 0,
        unresponsiveSMEs: 0
    })

    const [riskLists, setRiskLists] = useState<{
        overdue: any[]
        upcoming: any[]
        unresponsive: any[]
    }>({ overdue: [], upcoming: [], unresponsive: [] })

    const [riskModal, setRiskModal] = useState<{ open: boolean; title: string; items: any[] }>({
        open: false,
        title: '',
        items: []
    })

    // ----------- Load system settings -----------
    useEffect(() => {
        if (!companyCode) return
        getDoc(doc(db, 'companies', companyCode))
            .then(snap => setSystemSettings(snap.exists() ? (snap.data() as SystemSettingsDoc) : null))
            .catch(e => message.error(e?.message || 'Failed to load system settings'))
    }, [companyCode])

    const modeHasDepartments = !!systemSettings?.hasDepartments
    const scopeOf = (interventionId?: string, fallback?: { areaOfSupport?: string; department?: string }) => {
        const iid = String(interventionId || '').trim()
        const meta = iid ? interventionMetaById[iid] : undefined
        return modeHasDepartments
            ? String(meta?.department || fallback?.department || 'Unassigned Department')
            : String(meta?.areaOfSupport || fallback?.areaOfSupport || 'Unassigned Area')
    }

    // ----------- Default date range from programs -----------
    useEffect(() => {
        if (!companyCode) return

        const qPrograms = query(collection(db, 'programs'), where('companyCode', '==', companyCode))
        const unsub = onSnapshot(
            qPrograms,
            snap => {
                let earliest: Dayjs | null = null

                snap.forEach(d => {
                    const data = d.data() as ProgramDoc
                    const s = getDocDate(data, 'startDate') || getDocDate(data, 'createdAt')
                    if (!s) return
                    if (!earliest || s.isBefore(earliest)) earliest = s
                })

                const from = (earliest || dayjs().startOf('month')).startOf('day')
                const to = dayjs().endOf('day')
                const nextDefault: [Dayjs, Dayjs] = [from, to]

                setDefaultRange(nextDefault)
                defaultRangeRef.current = nextDefault

                setRange(prev => {
                    const looksLikeInitial =
                        prev?.[0]?.isSame(dayjs().startOf('month'), 'day') &&
                        prev?.[1]?.isSame(dayjs().endOf('day'), 'day')
                    return looksLikeInitial ? nextDefault : prev
                })
            },
            err => message.error(err?.message || 'Failed to load programs')
        )

        return () => unsub()
    }, [companyCode])

    const resetToDefault = () => {
        const def = defaultRangeRef.current
        if (!def) return
        setRange([def[0], def[1]])
        message.success('Range reset to program start → today')
    }

    const inRange = (d: Dayjs | null) => {
        if (!d) return true
        const [from, to] = range
        const start = from.startOf('day')
        const end = to.endOf('day')
        return (d.isAfter(start) || d.isSame(start)) && (d.isBefore(end) || d.isSame(end))
    }

    // ----------- Interventions meta -----------
    useEffect(() => {
        if (!companyCode) return

        const unsub = onSnapshot(
            query(collection(db, 'interventions'), where('companyCode', '==', companyCode)),
            snap => {
                const map: Record<string, InterventionMeta> = {}
                snap.forEach(d => {
                    map[d.id] = { id: d.id, ...(d.data() as any) }
                })
                setInterventionMetaById(map)
            },
            err => message.error(err?.message || 'Failed to load interventions')
        )

        return () => unsub()
    }, [companyCode])

    // ----------- Accepted apps (SMEs set + total required from accepted) -----------
    useEffect(() => {
        if (!companyCode) return

        const unsub = onSnapshot(
            query(
                collection(db, 'applications'),
                where('companyCode', '==', companyCode),
                where('applicationStatus', '==', 'accepted')
            ),
            snap => {
                // 1) SME count = accepted applications
                setSmesCount(snap.size)

                // 2) Accepted SME identity sets (to filter assignedInterventions)
                const pidSet = new Set<string>()
                const emailSet = new Set<string>()

                // 3) Total required (no date filter)
                let totalRequired = 0

                snap.forEach(d => {
                    const app: any = d.data()

                    if (app?.participantId) pidSet.add(String(app.participantId))
                    if (app?.email) emailSet.add(String(app.email).trim().toLowerCase())

                    const required =
                        app?.interventions?.required ||
                        app?.interventionsRequired ||
                        app?.requiredInterventions ||
                        []

                    if (Array.isArray(required)) totalRequired += required.length
                })

                setAcceptedParticipantIds(pidSet)
                setAcceptedEmails(emailSet)
                setTotalRequiredFromAcceptedApps(totalRequired)
            },
            err => message.error(err?.message || 'Failed to read accepted applications')
        )

        return () => unsub()
    }, [companyCode])




    // ----------- Users count -----------
    useEffect(() => {
        if (!companyCode) return
        const unsubUsers = onSnapshot(
            query(collection(db, 'users'), where('companyCode', '==', companyCode)),
            snap => setUsersCount(snap.size)
        )
        return () => unsubUsers()
    }, [companyCode])

    // ----------- REQUIRED BY SCOPE (ONLY accepted apps, and in range) -----------
    useEffect(() => {
        if (!companyCode) return

        const unsub = onSnapshot(
            query(
                collection(db, 'applications'),
                where('companyCode', '==', companyCode),
                where('applicationStatus', '==', 'accepted')
            ),
            snap => {
                const req: Record<string, number> = {}

                snap.forEach(d => {
                    const app: any = d.data()
                    // const appDate = getDocDate(app, 'createdAtOrAccepted')
                    // if (!inRange(appDate)) return

                    const required: RequiredInterventionRef[] =
                        app?.interventions?.required || app?.interventionsRequired || app?.requiredInterventions || []

                    if (!Array.isArray(required)) return

                    required.forEach(r => {
                        const iid = String(r?.interventionId || r?.id || '').trim()
                        const scope = scopeOf(iid, { areaOfSupport: r?.areaOfSupport, department: r?.department })
                        req[scope] = (req[scope] || 0) + 1
                    })
                })

                setRequiredByScope(req)
            },
            err => message.error(err?.message || 'Failed to load required interventions')
        )

        return () => unsub()
    }, [companyCode, interventionMetaById, modeHasDepartments, range])

    // ----------- COMPLETED + BOTTLENECKS + RISKS (accepted SMEs only) -----------
    useEffect(() => {
        if (!companyCode) return

        const qAssigned = query(collection(db, 'assignedInterventions'), where('companyCode', '==', companyCode))

        const unsub = onSnapshot(
            qAssigned,
            snap => {
                const completed: Record<string, number> = {}
                const counts: Record<BottleneckKey, number> = {
                    pending_consultant: 0,
                    pending_sme_acceptance: 0,
                    pending: 0,
                    awaiting_sme_completion: 0
                }

                // Risk derivations
                const now = dayjs()
                const overdue: any[] = []
                const upcoming: any[] = []
                const unresponsive: any[] = []

                let overdueCount = 0
                let upcoming7 = 0
                let upcoming14 = 0
                let unresponsiveCount = 0

                snap.forEach(d => {
                    const ai = { id: d.id, ...(d.data() as any) } as AnyAssignedIntervention

                    // Filter to accepted SMEs (strict)
                    const pid = ai.participantId ? String(ai.participantId) : ''
                    const em = ai.email ? String(ai.email).toLowerCase() : ''
                    const isAcceptedSme = (pid && acceptedParticipantIds.has(pid)) || (em && acceptedEmails.has(em))
                    if (!isAcceptedSme) return

                    // Date-range filter: use createdAt (best), otherwise dueDate
                    const aiDate = tsToDayjs(ai.createdAt) || tsToDayjs(ai.dueDate) || null
                    if (!inRange(aiDate)) return

                    const iid = String(ai.interventionId || '').trim()
                    const scope = scopeOf(iid, { areaOfSupport: ai.areaOfSupport, department: ai.department })
                    const meta = iid ? interventionMetaById[iid] : undefined

                    const consultantAccepted = norm(ai.assigneeStatus) === 'accepted'
                    const smeAccepted = norm(ai.participantStatus) === 'accepted'
                    const consultantCompleted = norm(ai.assigneeCompletionStatus) === 'done'
                    const smeCompleted = norm(ai.participantCompletionStatus) === 'confirmed'
                    const isCompleted = consultantCompleted && smeCompleted

                    if (isCompleted) {
                        completed[scope] = (completed[scope] || 0) + 1
                    } else {
                        const b = classifyBottleneck(ai)
                        counts[b] = (counts[b] || 0) + 1
                    }

                    // Risk signals
                    const due = tsToDayjs(ai.dueDate)
                    const created = tsToDayjs(ai.createdAt)

                    // Overdue
                    if (due && (due.isBefore(now, 'day') || due.isSame(now, 'day')) && !isCompleted) {
                        overdueCount++
                        overdue.push({
                            id: ai.id,
                            sme: getSmeLabel(ai),
                            scope,
                            area: String(meta?.areaOfSupport || ai.areaOfSupport || '—'),
                            dept: String(meta?.department || ai.department || '—'),
                            dueDate: due.format('YYYY-MM-DD'),
                            reason: prettyBottleneck(classifyBottleneck(ai))
                        })
                    }

                    // Upcoming deadlines (7 / 14 days)
                    if (due && !isCompleted) {
                        const diffDays = due.startOf('day').diff(now.startOf('day'), 'day')
                        if (diffDays >= 0 && diffDays <= 7) upcoming7++
                        if (diffDays >= 0 && diffDays <= 14) upcoming14++
                        if (diffDays >= 0 && diffDays <= 14) {
                            upcoming.push({
                                id: ai.id,
                                sme: getSmeLabel(ai),
                                scope,
                                dueDate: due.format('YYYY-MM-DD'),
                                reason: prettyBottleneck(classifyBottleneck(ai))
                            })
                        }
                    }

                    // Unresponsive SMEs = consultant accepted but SME not accepted after 7 days
                    if (consultantAccepted && !smeAccepted) {
                        const ageDays = created ? now.diff(created, 'day') : 0
                        if (ageDays >= 7) {
                            unresponsiveCount++
                            unresponsive.push({
                                id: ai.id,
                                sme: getSmeLabel(ai),
                                scope,
                                ageDays,
                                dueDate: due ? due.format('YYYY-MM-DD') : '—'
                            })
                        }
                    }
                })

                overdue.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
                upcoming.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
                unresponsive.sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0))

                setCompletedByScope(completed)
                setBottlenecks(counts)
                setRiskCounts({
                    overdue: overdueCount,
                    upcoming7,
                    upcoming14,
                    unresponsiveSMEs: unresponsiveCount
                })
                setRiskLists({
                    overdue: overdue.slice(0, 20),
                    upcoming: upcoming.slice(0, 20),
                    unresponsive: unresponsive.slice(0, 20)
                })
            },
            err => message.error(err?.message || 'Failed to load assigned interventions')
        )

        return () => unsub()
    }, [companyCode, acceptedParticipantIds, acceptedEmails, interventionMetaById, modeHasDepartments, range])

    // ----------- Totals -----------
    const totals = useMemo(() => {
        const totalRequiredInRange = Object.values(requiredByScope).reduce((a, b) => a + (b || 0), 0)
        const totalCompletedInRange = Object.values(completedByScope).reduce((a, b) => a + (b || 0), 0)
        const completionRateInRange = percent(totalCompletedInRange, totalRequiredInRange)
        return { totalRequiredInRange, totalCompletedInRange, completionRateInRange }
    }, [requiredByScope, completedByScope])

    // ----------- Donut (variable radius) with drilldown -----------
    const areaDonut = useMemo(() => {
        const rows = Object.keys({ ...requiredByScope, ...completedByScope }).map(name => {
            const required = requiredByScope[name] || 0
            const completed = completedByScope[name] || 0
            const remaining = Math.max(required - completed, 0)
            const rate = percent(completed, required) // 0..100
            return { name, required, completed, remaining, rate }
        })

        // Sort by efficiency (since angle is efficiency)
        rows.sort((a, b) => b.rate - a.rate)

        const TOP = 10
        const top = rows.slice(0, TOP)
        const rest = rows.slice(TOP)

        // Aggregate "Other" using WEIGHTED efficiency (by required), otherwise it lies.
        const other = rest.reduce(
            (acc, r) => {
                acc.required += r.required
                acc.completed += r.completed
                acc.remaining += r.remaining
                return acc
            },
            { required: 0, completed: 0, remaining: 0 }
        )
        const otherRate = percent(other.completed, other.required)

        const data: any[] = []
        const drill: any[] = []

        const pushPoint = (name: string, required: number, completed: number, remaining: number, rate: number) => {
            data.push({
                name,
                // ✅ slice angle = efficiency
                y: rate,
                // ✅ radius = workload size (pick required; or use completed if you prefer)
                z: Math.max(required, 1),
                drilldown: name,
                custom: { required, completed, remaining, rate }
            })

            drill.push({
                id: name,
                name,
                type: 'pie',
                data: [
                    ['Completed', completed],
                    ['Remaining', remaining]
                ]
            })
        }

        top.forEach(r => pushPoint(r.name, r.required, r.completed, r.remaining, r.rate))
        if (other.required > 0) pushPoint('Other', other.required, other.completed, other.remaining, otherRate)

        const title = modeHasDepartments ? 'Department Efficiency' : 'Area Efficiency'

        return {
            chart: { type: 'variablepie', height: 380 },
            title: { text: title },
            subtitle: { text: 'Angle = efficiency (%). Radius = workload size. Click to drill down.' },

            tooltip: {
                formatter: function () {
                    const p: any = (this as any).point
                    const c = p?.custom || {}
                    return `
                <b>${p.name}</b><br/>
                Efficiency: <b>${c.rate ?? p.y}%</b><br/>
                Required: <b>${c.required ?? 0}</b><br/>
                Completed: <b>${c.completed ?? 0}</b><br/>
                Remaining: <b>${c.remaining ?? 0}</b>
              `
                }
            },

            plotOptions: {
                variablepie: {
                    innerSize: '55%',
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            const p: any = (this as any).point
                            const rate = p?.custom?.rate ?? p.y ?? 0
                            return `${p.name}: ${rate}%`
                        }
                    }
                }
            },

            series: [{ name: 'Efficiency', data }],
            drilldown: { series: drill }
        } as unknown as Highcharts.Options
    }, [requiredByScope, completedByScope, modeHasDepartments])


    // ----------- Bottlenecks polar chart -----------
    const bottleneckChart = useMemo(() => {
        const order: BottleneckKey[] = ['pending_consultant', 'pending_sme_acceptance', 'pending', 'awaiting_sme_completion']
        const categories = order.map(prettyBottleneck)
        const data = order.map(k => Number(bottlenecks[k] || 0))
        const maxVal = Math.max(...data, 0)
        const yMax = maxVal === 0 ? 1 : maxVal < 5 ? 5 : Math.ceil(maxVal * 1.2)

        return {
            chart: { polar: true, type: 'area', height: 360, spacing: [10, 10, 10, 10] },
            title: { text: 'Intervention Bottlenecks' },
            pane: { size: '80%' },
            xAxis: {
                categories,
                tickmarkPlacement: 'on',
                lineWidth: 0,
                labels: { distance: 18, style: { fontSize: '12px' } }
            },
            yAxis: {
                min: 0,
                max: yMax,
                tickAmount: 4,
                gridLineInterpolation: 'polygon',
                lineWidth: 0,
                labels: { enabled: false },
                title: { text: null }
            },
            tooltip: { pointFormat: '<b>{point.y}</b> interventions' },
            plotOptions: {
                area: {
                    pointPlacement: 'on',
                    fillOpacity: 0.2,
                    lineWidth: 3,
                    marker: {
                        enabled: true,
                        radius: 4
                    }
                },
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter(this: { y?: number }) {
                            return (this.y ?? 0) > 0 ? String(this.y) : ''
                        }
                    }
                }
            },
            series: [{ name: 'Bottlenecks', type: 'area', data: data as any, pointPlacement: 'on' }]
        } as unknown as Highcharts.Options
    }, [bottlenecks])

    const openRiskModal = (title: string, items: any[]) => setRiskModal({ open: true, title, items })

    return (
        <DashboardPage className="director-dashboard-page">
            <div className={isMobile ? 'director-dashboard-inner director-dashboard-inner-mobile' : 'director-dashboard-inner'}>
                {isMobile ? (
                    <FilterBar
                        title='Director dashboard filters'
                        primary={
                            <Space style={{ width: '100%', justifyContent: 'center' }} wrap size='middle'>
                                <RangePicker
                                    value={range}
                                    onChange={v => {
                                        if (!v?.[0] || !v?.[1]) return
                                        setRange([v[0], v[1]])
                                    }}
                                    allowClear={false}
                                />

                                <Button icon={<ReloadOutlined />} onClick={resetToDefault} disabled={!defaultRange}>
                                    Reset
                                </Button>
                            </Space>
                        }
                    />
                ) : (
                    <DashboardHeader
                        title='Director Dashboard'
                        subtitle='Required vs completed, bottlenecks, and risk signals without digging.'
                        actions={
                            <Space style={{ width: '100%', justifyContent: 'center' }} wrap size='middle'>
                                <RangePicker
                                    value={range}
                                    onChange={v => {
                                        if (!v?.[0] || !v?.[1]) return
                                        setRange([v[0], v[1]])
                                    }}
                                    allowClear={false}
                                />

                                <Button icon={<ReloadOutlined />} onClick={resetToDefault} disabled={!defaultRange}>
                                    Reset
                                </Button>
                            </Space>
                        }
                    />
                )}

                {/* Metrics */}
                <Row gutter={[12, 12]} className="dashboard-metrics-row director-dashboard-metrics" style={{ marginTop: 12 }}>
                    <Col xs={12} md={6}>
                        <DashboardMetricCard icon={<TeamOutlined />} iconClassName="is-users" label="Users" value={usersCount} hint="Total users" />
                    </Col>

                    <Col xs={12} md={6}>
                        <DashboardMetricCard icon={<ShopOutlined />} iconClassName="is-participants" label="SMEs" value={smesCount} hint="Accepted SMEs" />
                    </Col>

                    <Col xs={12} md={6}>
                        <DashboardMetricCard icon={<SolutionOutlined />} iconClassName="is-delivery" label="Required" value={totalRequiredFromAcceptedApps} hint="All accepted SMEs" />
                    </Col>

                    <Col xs={12} md={6}>
                        <DashboardMetricCard icon={<CheckCircleOutlined />} iconClassName="is-attention" label="Completion" value={`${totals.completionRateInRange}%`} hint="In range" />
                    </Col>
                </Row>

                {/* Risk Assessment (replaces overdue table) */}
                <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                    <Col xs={24} lg={10}>
                        <Card style={{ borderRadius: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                    <Text strong style={{ fontSize: 16 }}>Risk Assessment</Text>
                                    <div style={{ marginTop: 4 }}>
                                        <Text type='secondary'>Fast signals: overdue, unresponsive SMEs, upcoming deadlines.</Text>
                                    </div>
                                </div>
                                <Button
                                    type='default'
                                    icon={<ArrowRightOutlined />}
                                    onClick={() => navigate('/director')}
                                >
                                    View
                                </Button>
                            </div>

                            <Row gutter={[10, 10]} style={{ marginTop: 14 }}>
                                <Col span={12}>
                                    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.18)' }}>
                                        <Space align="start">
                                            <WarningOutlined style={{ color: '#ff4d4f', marginTop: 2 }} />
                                            <div>
                                                <Text strong>Overdue</Text>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{riskCounts.overdue}</div>
                                                <Button
                                                    size='small'
                                                    type='link'
                                                    style={{ padding: 0 }}
                                                    onClick={() => openRiskModal('Overdue Interventions', riskLists.overdue)}
                                                >
                                                    View list
                                                </Button>
                                            </div>
                                        </Space>
                                    </div>
                                </Col>

                                <Col span={12}>
                                    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(250,173,20,0.10)', border: '1px solid rgba(250,173,20,0.22)' }}>
                                        <Space align="start">
                                            <ExclamationCircleOutlined style={{ color: '#faad14', marginTop: 2 }} />
                                            <div>
                                                <Text strong>Unresponsive SMEs</Text>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{riskCounts.unresponsiveSMEs}</div>
                                                <Button
                                                    size='small'
                                                    type='link'
                                                    style={{ padding: 0 }}
                                                    onClick={() => openRiskModal('Unresponsive SMEs (≥7 days pending acceptance)', riskLists.unresponsive)}
                                                >
                                                    View list
                                                </Button>
                                            </div>
                                        </Space>
                                    </div>
                                </Col>

                                <Col span={12}>
                                    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,144,255,0.08)', border: '1px solid rgba(24,144,255,0.18)' }}>
                                        <Space align="start">
                                            <ClockCircleOutlined style={{ color: '#1677ff', marginTop: 2 }} />
                                            <div>
                                                <Text strong>Due in 7 days</Text>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{riskCounts.upcoming7}</div>
                                                <Button
                                                    size='small'
                                                    type='link'
                                                    style={{ padding: 0 }}
                                                    onClick={() => openRiskModal('Upcoming Deadlines (≤14 days)', riskLists.upcoming)}
                                                >
                                                    View list
                                                </Button>
                                            </div>
                                        </Space>
                                    </div>
                                </Col>

                                <Col span={12}>
                                    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(82,196,26,0.10)', border: '1px solid rgba(82,196,26,0.18)' }}>
                                        <Space align="start">
                                            <ClockCircleOutlined style={{ color: '#52c41a', marginTop: 2 }} />
                                            <div>
                                                <Text strong>Due in 14 days</Text>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{riskCounts.upcoming14}</div>
                                                <div style={{ marginTop: 2 }}>
                                                    <Text type='secondary' style={{ fontSize: 12 }}>Includes 7-day count</Text>
                                                </div>
                                            </div>
                                        </Space>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} lg={14}>
                        <Card style={{ borderRadius: 16 }}>
                            {Object.keys(requiredByScope).length || Object.keys(completedByScope).length ? (
                                <ThemedHighcharts options={areaDonut} />
                            ) : (
                                <Empty description='No required/completed data found in this date range' />
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Bottlenecks */}
                <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                    <Col xs={24}>
                        <Card style={{ borderRadius: 16 }}>
                            <ThemedHighcharts options={bottleneckChart} />
                        </Card>
                    </Col>
                </Row>

                <Modal
                    open={riskModal.open}
                    title={riskModal.title}
                    onCancel={() => setRiskModal(s => ({ ...s, open: false }))}
                    footer={[
                        <Button danger shape='round' key="close" onClick={() => setRiskModal(s => ({ ...s, open: false }))}>
                            Close
                        </Button>
                    ]}
                >
                    <List
                        dataSource={riskModal.items}
                        locale={{ emptyText: 'Nothing to show 🎉' }}
                        renderItem={(item: any) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={<Text strong>{item.sme || item.name || '—'}</Text>}
                                    description={
                                        <Space wrap>
                                            {item.scope && <Tag>{item.scope}</Tag>}
                                            {item.dueDate && <Tag color="blue">Due: {item.dueDate}</Tag>}
                                            {typeof item.ageDays === 'number' && <Tag color="orange">{item.ageDays} days</Tag>}
                                            {item.reason && <Tag color="volcano">{item.reason}</Tag>}
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Modal>
            </div>
        </DashboardPage>
    )
}

export default DirectorDashboard
