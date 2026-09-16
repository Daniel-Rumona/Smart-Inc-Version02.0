import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AuditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  RiseOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type Highcharts from 'highcharts'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import { collection, getDocs, query, where } from 'firebase/firestore'
import DashboardHeader from '@/components/shared/DashboardHeader'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { CHART_COLORS } from '@/config/chartPalette'
import { db } from '@/firebase/config'
import { useActiveProgramId } from '@/hooks/useActiveProgramId'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useLanguage } from '@/providers/LanguageProvider'
import {
  generateOperationsReportInsights,
  OPERATIONS_REPORT_TEMPLATE_PATH,
} from '@/services/operationsReportsService'
import { matchesActiveProgram } from '@/services/workspaceProgramsService'
import '@/styles/dashboard.css'
import '@/styles/operations-reports.css'

dayjs.extend(isoWeek)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(quarterOfYear)

const { RangePicker } = DatePicker
const { Text, Title } = Typography

type PeriodPreset = 'week' | 'month' | 'quarter' | 'year' | 'custom'
type ReportView = 'overview' | 'applications' | 'interventions' | 'participants'

type FirestoreDate =
  | Date
  | string
  | number
  | {
      toDate?: () => Date
      seconds?: number
      nanoseconds?: number
    }
  | null
  | undefined

type ApplicationDoc = {
  id: string
  participantId?: string | null
  programId?: string | null
  programName?: string | null
  beneficiaryName?: string | null
  businessName?: string | null
  companyName?: string | null
  companyCode?: string | null
  applicationStatus?: string | null
  status?: string | null
  stage?: string | null
  createdAt?: FirestoreDate
  submittedAt?: FirestoreDate
  updatedAt?: FirestoreDate
  acceptedAt?: FirestoreDate
  approvedAt?: FirestoreDate
  interventions?: {
    required?: Array<{ id?: string | null; title?: string | null; area?: string | null; areaOfSupport?: string | null }>
    completed?: Array<{ id?: string | null; title?: string | null }>
  }
  complianceDocuments?: Array<{
    docType?: string | null
    status?: string | null
    updatedAt?: FirestoreDate
    expiryDate?: FirestoreDate
  }>
}

type ParticipantDoc = {
  id: string
  participantId?: string | null
  programId?: string | null
  programName?: string | null
  beneficiaryName?: string | null
  businessName?: string | null
  companyName?: string | null
  sector?: string | null
  stage?: string | null
  province?: string | null
  hub?: string | null
  gender?: string | null
  beeLevel?: string | null
  femaleOwnedPercent?: number | string | null
  youthOwnedPercent?: number | string | null
  blackOwnedPercent?: number | string | null
  createdAt?: FirestoreDate
  acceptedAt?: FirestoreDate
  onboardedAt?: FirestoreDate
}

type AssignmentDoc = {
  id: string
  participantId?: string | null
  smmeId?: string | null
  smeId?: string | null
  programId?: string | null
  programName?: string | null
  beneficiaryName?: string | null
  businessName?: string | null
  participantName?: string | null
  interventionId?: string | null
  interventionTitle?: string | null
  title?: string | null
  areaOfSupport?: string | null
  area?: string | null
  consultantId?: string | null
  assigneeName?: string | null
  status?: string | null
  completionStatus?: string | null
  progress?: number | string | null
  assignedAt?: FirestoreDate
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
  dueDate?: FirestoreDate
  completedAt?: FirestoreDate
  completionConfirmedAt?: FirestoreDate
}

type AppointmentDoc = {
  id: string
  companyCode?: string | null
  assignedInterventionId?: string | null
  interventionTitle?: string | null
  participantId?: string | null
  participantName?: string | null
  participantEmail?: string | null
  programId?: string | null
  programName?: string | null
  assigneeId?: string | null
  assigneeEmail?: string | null
  meetingType?: string | null
  startTime?: FirestoreDate
  endTime?: FirestoreDate
  status?: string | null
  attendance?: Record<string, 'present' | 'absent' | string>
  discussionSummary?: string | null
}

type SupportDemandRow = {
  key: string
  title: string
  requested: number
  assigned: number
  completed: number
  gap: number
  completionRate: number
}

type AttentionRow = {
  key: string
  intervention: string
  participant: string
  owner: string
  issue: string
  dueDate: string
  severity: 'high' | 'medium'
}

type AttendanceRow = {
  key: string
  appointment: string
  participant: string
  program: string
  date: string
  meetingType: string
  status: string
  attendance: 'Present' | 'Absent' | 'Not captured'
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()

const toDate = (value: FirestoreDate): Date | null => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(+value) ? null : value
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6))
  }
  if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000)
  const parsed = new Date(String(value))
  return Number.isNaN(+parsed) ? null : parsed
}

const primaryApplicationDate = (application: ApplicationDoc) =>
  toDate(application.submittedAt) || toDate(application.createdAt) || toDate(application.updatedAt)

const assignmentDate = (assignment: AssignmentDoc) =>
  toDate(assignment.assignedAt) || toDate(assignment.createdAt) || toDate(assignment.updatedAt) || toDate(assignment.dueDate)

const getRangeFromPreset = (preset: PeriodPreset): [Dayjs, Dayjs] => {
  const now = dayjs()
  if (preset === 'week') return [now.startOf('isoWeek'), now.endOf('isoWeek')]
  if (preset === 'month') return [now.startOf('month'), now.endOf('month')]
  if (preset === 'quarter') return [now.startOf('quarter'), now.endOf('quarter')]
  return [now.startOf('year'), now.endOf('year')]
}

const inRange = (date: Date | null, start: Dayjs, end: Dayjs) => {
  if (!date) return false
  const value = dayjs(date)
  return value.isSameOrAfter(start, 'day') && value.isSameOrBefore(end, 'day')
}

const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isAccepted = (application: ApplicationDoc) => {
  const status = normalize(application.applicationStatus || application.status)
  return ['accepted', 'approved', 'onboarded', 'enrolled'].includes(status)
}

const isCompletedAssignment = (assignment: AssignmentDoc) => {
  const status = normalize(assignment.status)
  const completion = normalize(assignment.completionStatus)
  const progress = numberValue(assignment.progress)
  return status === 'completed' || status === 'done' || completion === 'confirmed' || progress >= 100
}

const isInProgressAssignment = (assignment: AssignmentDoc) => {
  const status = normalize(assignment.status)
  return ['in-progress', 'in progress', 'active', 'started'].includes(status) || numberValue(assignment.progress) > 0
}

const bucketLabel = (date: Date, preset: PeriodPreset) => {
  const value = dayjs(date)
  if (preset === 'week') return `W${value.isoWeek()} ${value.year()}`
  if (preset === 'quarter') return value.format('YYYY [Q]Q')
  if (preset === 'year') return value.format('MMM')
  return value.format('DD MMM')
}

const topEntries = (map: Map<string, number>, limit = 8) =>
  Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)

const complianceStatusLabel = (status: string) => {
  const value = normalize(status)
  if (['valid', 'verified', 'completed', 'accepted', 'approved'].includes(value)) return 'Valid'
  if (['invalid', 'expired', 'rejected', 'cancelled', 'declined', 'not-valid', 'not valid', 'missing'].includes(value)) return 'Not Valid'
  if (['missing', 'pending', 'queried', 'expiring', 'uploaded'].includes(value)) return 'Pending Review'
  return status
    ? String(status).replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Pending Review'
}

const complianceStatusColor = (status: string) => {
  const label = complianceStatusLabel(status)
  if (label === 'Valid') return 'success'
  if (label === 'Not Valid') return 'error'
  if (label === 'Pending Review') return 'warning'
  return 'default'
}

const appointmentStatusLabel = (status: string) => {
  const value = normalize(status)
  if (value === 'pending') return 'Scheduled'
  if (value === 'accepted') return 'Accepted'
  if (value === 'completed') return 'Completed'
  if (value === 'declined') return 'Declined'
  if (value === 'cancelled') return 'Cancelled'
  return String(status || 'Scheduled').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const appointmentStatusColor = (status: string) => {
  const value = normalize(status)
  if (value === 'completed') return 'success'
  if (value === 'accepted') return 'processing'
  if (value === 'declined' || value === 'cancelled') return 'error'
  return 'warning'
}

const attendanceStatusColor = (status: AttendanceRow['attendance']) => {
  if (status === 'Present') return 'success'
  if (status === 'Absent') return 'error'
  return 'warning'
}

const fileSafe = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'operations-report'

const multilineList = (items: string[] = []) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : 'No items returned.'

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const renderDocxTemplate = async (data: Record<string, unknown>) => {
  const response = await fetch(OPERATIONS_REPORT_TEMPLATE_PATH)
  if (!response.ok) throw new Error('report-template-not-found')

  const templateBuffer = await response.arrayBuffer()
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })

  doc.render(data)
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export const OperationsReportsPage = () => {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const { user } = useFullIdentity()
  const { activeProgramId, isAllPrograms } = useActiveProgramId()
  const [view, setView] = useState<ReportView>('overview')
  const [period, setPeriod] = useState<PeriodPreset>('year')
  const [[start, end], setRange] = useState<[Dayjs, Dayjs]>(getRangeFromPreset('year'))
  const [applications, setApplications] = useState<ApplicationDoc[]>([])
  const [participants, setParticipants] = useState<ParticipantDoc[]>([])
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([])
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(false)

  const changePeriod = (nextPeriod: PeriodPreset) => {
    setPeriod(nextPeriod)
    if (nextPeriod !== 'custom') setRange(getRangeFromPreset(nextPeriod))
  }

  useEffect(() => {
    let mounted = true

    const loadReports = async () => {
      setLoading(true)
      try {
        const appConstraints = user?.companyCode ? [where('companyCode', '==', user.companyCode)] : []
        const appointmentConstraints = user?.companyCode ? [where('companyCode', '==', user.companyCode)] : []
        const [applicationsSnap, participantsSnap, assignmentsSnap, appointmentsSnap] = await Promise.all([
          getDocs(query(collection(db, 'applications'), ...appConstraints)),
          getDocs(collection(db, 'participants')),
          getDocs(collection(db, 'assignedInterventions')),
          getDocs(query(collection(db, 'appointments'), ...appointmentConstraints)),
        ])

        if (!mounted) return

        setApplications(applicationsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ApplicationDoc, 'id'>) })))
        setParticipants(participantsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ParticipantDoc, 'id'>) })))
        setAssignments(assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AssignmentDoc, 'id'>) })))
        setAppointments(appointmentsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AppointmentDoc, 'id'>) })))
      } catch (error) {
        console.error(error)
        message.error('Failed to load report data')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadReports()
    return () => {
      mounted = false
    }
  }, [message, user?.companyCode])

  const reportData = useMemo(() => {
    const acceptedIds = new Set(applications.filter(isAccepted).map((application) => application.participantId).filter(Boolean))
    const scopedApplications = applications
      .filter((application) => matchesActiveProgram(user, activeProgramId, String(application.programId || '')))
      .filter((application) => inRange(primaryApplicationDate(application), start, end))
    const scopedAccepted = scopedApplications.filter(isAccepted)

    const scopedParticipants = participants.filter((participant) => {
      const knownAccepted = acceptedIds.has(participant.id) || acceptedIds.has(participant.participantId || '')
      const hasProgram = Boolean(String(participant.programId || '').trim())
      const programMatches = hasProgram && matchesActiveProgram(user, activeProgramId, String(participant.programId || ''))
      return knownAccepted || (!isAllPrograms && programMatches)
    })

    const participantIds = new Set([
      ...scopedParticipants.map((participant) => participant.id),
      ...scopedParticipants.map((participant) => participant.participantId || ''),
      ...scopedAccepted.map((application) => application.participantId || ''),
    ].filter(Boolean))

    const scopedAssignments = assignments
      .filter((assignment) => {
        const programMatches = matchesActiveProgram(user, activeProgramId, String(assignment.programId || ''))
        const assignmentParticipantId = assignment.participantId || assignment.smmeId || assignment.smeId || ''
        return programMatches && (participantIds.size === 0 || participantIds.has(assignmentParticipantId) || isAllPrograms)
      })
      .filter((assignment) => inRange(assignmentDate(assignment), start, end))

    const assignmentById = new Map(scopedAssignments.map((assignment) => [assignment.id, assignment]))
    const scopedAppointments = appointments
      .filter((appointment) => {
        const assignment = appointment.assignedInterventionId ? assignmentById.get(appointment.assignedInterventionId) : undefined
        const programId = String(appointment.programId || assignment?.programId || '')
        return matchesActiveProgram(user, activeProgramId, programId)
      })
      .filter((appointment) => inRange(toDate(appointment.startTime), start, end))

    const completedAssignments = scopedAssignments.filter(isCompletedAssignment)
    const inProgressAssignments = scopedAssignments.filter((assignment) => isInProgressAssignment(assignment) && !isCompletedAssignment(assignment))
    const overdueAssignments = scopedAssignments.filter((assignment) => {
      const dueDate = toDate(assignment.dueDate)
      return !!dueDate && dayjs(dueDate).isBefore(dayjs(), 'day') && !isCompletedAssignment(assignment)
    })

    const complianceDocuments = scopedAccepted.flatMap((application) => application.complianceDocuments || [])
    const complianceAttention = complianceDocuments.filter((document) => {
      const status = normalize(document.status)
      const expiryDate = toDate(document.expiryDate)
      return ['missing', 'expired', 'pending', 'queried', 'rejected'].includes(status) || (!!expiryDate && dayjs(expiryDate).isBefore(dayjs(), 'day'))
    })

    const requestedMap = new Map<string, number>()
    scopedApplications.forEach((application) => {
      ;(application.interventions?.required || []).forEach((intervention) => {
        const title = String(intervention.title || intervention.id || 'Unspecified intervention')
        requestedMap.set(title, (requestedMap.get(title) || 0) + 1)
      })
    })

    const assignedMap = new Map<string, number>()
    const completedMap = new Map<string, number>()
    const areaDemand = new Map<string, number>()
    const areaDelivery = new Map<string, number>()
    const consultantMap = new Map<string, { assigned: number; inProgress: number; completed: number; overdue: number }>()

    scopedApplications.forEach((application) => {
      ;(application.interventions?.required || []).forEach((intervention) => {
        const area = String(intervention.areaOfSupport || 'Unspecified')
        areaDemand.set(area, (areaDemand.get(area) || 0) + 1)
      })
    })

    scopedAssignments.forEach((assignment) => {
      const title = String(assignment.interventionTitle || 'Unspecified intervention')
      const area = String(assignment.areaOfSupport || 'Unspecified')
      const consultant = String(assignment.assigneeName || 'Unassigned')
      assignedMap.set(title, (assignedMap.get(title) || 0) + 1)
      areaDelivery.set(area, (areaDelivery.get(area) || 0) + 1)
      if (isCompletedAssignment(assignment)) completedMap.set(title, (completedMap.get(title) || 0) + 1)

      const current = consultantMap.get(consultant) || { assigned: 0, inProgress: 0, completed: 0, overdue: 0 }
      current.assigned += 1
      if (isCompletedAssignment(assignment)) current.completed += 1
      else if (isInProgressAssignment(assignment)) current.inProgress += 1
      if (overdueAssignments.some((item) => item.id === assignment.id)) current.overdue += 1
      consultantMap.set(consultant, current)
    })

    const supportRows: SupportDemandRow[] = Array.from(new Set([...requestedMap.keys(), ...assignedMap.keys()])).map((title) => {
      const requested = requestedMap.get(title) || 0
      const assigned = assignedMap.get(title) || 0
      const completed = completedMap.get(title) || 0
      return {
        key: title,
        title,
        requested,
        assigned,
        completed,
        gap: Math.max(requested - assigned, 0),
        completionRate: percent(completed, assigned),
      }
    }).sort((a, b) => b.gap - a.gap || b.requested - a.requested)

    const attentionRows: AttentionRow[] = scopedAssignments
      .filter((assignment) => !isCompletedAssignment(assignment))
      .map((assignment) => {
        const dueDate = toDate(assignment.dueDate)
        const progress = numberValue(assignment.progress)
        const overdue = !!dueDate && dayjs(dueDate).isBefore(dayjs(), 'day')
        const issue = overdue ? 'Overdue delivery' : progress === 0 ? 'Not started' : 'In progress'
        const severity: AttentionRow['severity'] = overdue || progress === 0 ? 'high' : 'medium'
        return {
          key: assignment.id,
          intervention: String(assignment.interventionTitle || 'Intervention'),
          participant: String(assignment.beneficiaryName || assignment.businessName || assignment.participantName || 'Participant'),
          owner: String(assignment.assigneeName || 'Unassigned'),
          issue,
          dueDate: dueDate ? dayjs(dueDate).format('DD MMM YYYY') : 'No due date',
          severity,
        }
      })
      .sort((a, b) => (a.severity === b.severity ? a.dueDate.localeCompare(b.dueDate) : a.severity === 'high' ? -1 : 1))
      .slice(0, 8)

    const attendanceRows: AttendanceRow[] = scopedAppointments
      .map((appointment) => {
        const attendanceValues = Object.values(appointment.attendance || {}).map((value) => normalize(value))
        const attendance: AttendanceRow['attendance'] = attendanceValues.includes('present')
          ? 'Present'
          : attendanceValues.includes('absent')
            ? 'Absent'
            : 'Not captured'
        const startDate = toDate(appointment.startTime)
        return {
          key: appointment.id,
          appointment: String(appointment.interventionTitle || 'Appointment'),
          participant: String(appointment.participantName || appointment.participantEmail || 'Participant'),
          program: String(appointment.programName || 'Unassigned'),
          date: startDate ? dayjs(startDate).format('DD MMM YYYY HH:mm') : 'Not scheduled',
          meetingType: String(appointment.meetingType || 'Unspecified').replace(/_/g, ' '),
          status: String(appointment.status || 'pending'),
          attendance,
        }
      })
      .sort((left, right) => right.date.localeCompare(left.date))

    const intakeBuckets = new Map<string, { submitted: number; accepted: number }>()
    scopedApplications.forEach((application) => {
      const date = primaryApplicationDate(application)
      if (!date) return
      const label = bucketLabel(date, period)
      const bucket = intakeBuckets.get(label) || { submitted: 0, accepted: 0 }
      bucket.submitted += 1
      if (isAccepted(application)) bucket.accepted += 1
      intakeBuckets.set(label, bucket)
    })

    return {
      scopedApplications,
      scopedAccepted,
      scopedParticipants,
      scopedAssignments,
      scopedAppointments,
      completedAssignments,
      inProgressAssignments,
      overdueAssignments,
      complianceDocuments,
      complianceAttention,
      requestedMap,
      assignedMap,
      completedMap,
      areaDemand,
      areaDelivery,
      consultantMap,
      supportRows,
      attentionRows,
      attendanceRows,
      intakeBuckets,
    }
  }, [activeProgramId, applications, appointments, assignments, end, isAllPrograms, participants, period, start, user])

  const summary = useMemo(() => {
    const submitted = reportData.scopedApplications.length
    const accepted = reportData.scopedAccepted.length
    const assigned = reportData.scopedAssignments.length
    const completed = reportData.completedAssignments.length
    const attended = reportData.attendanceRows.filter((row) => row.attendance === 'Present').length
    const absent = reportData.attendanceRows.filter((row) => row.attendance === 'Absent').length
    const notCaptured = reportData.attendanceRows.filter((row) => row.attendance === 'Not captured').length
    const topDemand = topEntries(reportData.requestedMap, 1)[0]
    const topGap = reportData.supportRows.find((row) => row.gap > 0)
    const busiestConsultant = Array.from(reportData.consultantMap.entries()).sort((a, b) => b[1].assigned - a[1].assigned)[0]

    return {
      submitted,
      accepted,
      participants: reportData.scopedParticipants.length || accepted,
      acceptanceRate: percent(accepted, submitted),
      assigned,
      completed,
      completionRate: percent(completed, assigned),
      overdue: reportData.overdueAssignments.length,
      complianceRisk: reportData.complianceAttention.length,
      appointments: reportData.scopedAppointments.length,
      attended,
      absent,
      notCaptured,
      attendanceRate: percent(attended, attended + absent),
      topDemand: topDemand ? `${topDemand[0]} (${topDemand[1]})` : 'No demand yet',
      topGap: topGap ? `${topGap.title} needs ${topGap.gap} more assignment${topGap.gap === 1 ? '' : 's'}` : 'Demand is covered',
      busiestConsultant: busiestConsultant ? `${busiestConsultant[0]} (${busiestConsultant[1].assigned})` : 'No workload yet',
    }
  }, [reportData])

  const overviewHighlights = useMemo(() => [
    {
      key: 'applications',
      label: 'Applications',
      value: `${summary.acceptanceRate}%`,
      meta: `${summary.accepted} of ${summary.submitted} accepted`,
      tone: summary.acceptanceRate >= 50 ? 'good' : 'watch',
    },
    {
      key: 'delivery',
      label: 'Delivery',
      value: `${summary.completionRate}%`,
      meta: `${summary.completed} of ${summary.assigned} completed`,
      tone: summary.completionRate >= 60 ? 'good' : 'watch',
    },
    {
      key: 'attendance',
      label: 'Attendance',
      value: `${summary.attendanceRate}%`,
      meta: `${summary.attended} present, ${summary.absent} absent`,
      tone: summary.attendanceRate >= 75 ? 'good' : 'watch',
    },
    {
      key: 'compliance',
      label: 'Compliance',
      value: String(summary.complianceRisk),
      meta: 'items need follow-up',
      tone: summary.complianceRisk > 0 ? 'risk' : 'good',
    },
  ], [summary])

  const overviewActions = useMemo(() => [
    {
      key: 'gap',
      title: 'Demand gap',
      body: summary.topGap,
      target: 'interventions' as ReportView,
      tone: summary.topGap === 'Demand is covered' ? 'good' : 'watch',
    },
    {
      key: 'overdue',
      title: 'Overdue work',
      body: summary.overdue ? `${summary.overdue} assignments need intervention.` : 'No overdue assignments in this period.',
      target: 'interventions' as ReportView,
      tone: summary.overdue ? 'risk' : 'good',
    },
    {
      key: 'attendance',
      title: 'Attendance capture',
      body: summary.notCaptured ? `${summary.notCaptured} appointments still need attendance captured.` : 'Attendance is captured for all period appointments.',
      target: 'interventions' as ReportView,
      tone: summary.notCaptured ? 'watch' : 'good',
    },
  ], [summary])

  const intakeOptions = useMemo<Highcharts.Options>(() => {
    const categories = Array.from(reportData.intakeBuckets.keys())
    return {
      colors: [CHART_COLORS.primary, CHART_COLORS.success],
      chart: { type: 'column', height: 310 },
      title: { text: 'Application Flow' },
      subtitle: { text: `${start.format('DD MMM YYYY')} to ${end.format('DD MMM YYYY')}` },
      xAxis: { categories },
      yAxis: { min: 0, title: { text: 'Applications' }, allowDecimals: false },
      tooltip: { shared: true },
      plotOptions: { column: { borderRadius: 4, dataLabels: { enabled: true } } },
      series: [
        { name: 'Submitted', type: 'column', data: categories.map((key) => reportData.intakeBuckets.get(key)?.submitted || 0) },
        { name: 'Accepted', type: 'column', data: categories.map((key) => reportData.intakeBuckets.get(key)?.accepted || 0) },
      ],
    }
  }, [end, reportData.intakeBuckets, start])

  const interventionHealthOptions = useMemo<Highcharts.Options>(() => ({
    colors: [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.danger, CHART_COLORS.amber],
    chart: { type: 'pie', height: 300 },
    title: { text: 'Intervention Health' },
    tooltip: { pointFormat: '<b>{point.y}</b> assignments' },
    plotOptions: {
      pie: {
        innerSize: '58%',
        dataLabels: { enabled: true, format: '{point.name}: {point.y}', style: { textOutline: 'none' } },
      },
    },
    series: [{
      type: 'pie',
      name: 'Assignments',
      data: [
        { name: 'Completed', y: reportData.completedAssignments.length },
        { name: 'In progress', y: reportData.inProgressAssignments.length },
        { name: 'Overdue', y: reportData.overdueAssignments.length },
        { name: 'Not started', y: Math.max(reportData.scopedAssignments.length - reportData.completedAssignments.length - reportData.inProgressAssignments.length, 0) },
      ].filter((point) => point.y > 0),
    }],
  }), [reportData])

  const areaOptions = useMemo<Highcharts.Options>(() => {
    const categories = Array.from(new Set([...reportData.areaDemand.keys(), ...reportData.areaDelivery.keys()])).sort()
    return {
      colors: [CHART_COLORS.violet, CHART_COLORS.cyan],
      chart: { type: 'bar', height: Math.max(300, categories.length * 36) },
      title: { text: 'Demand vs Delivery by Support Area' },
      xAxis: { categories },
      yAxis: { min: 0, title: { text: 'Count' }, allowDecimals: false },
      tooltip: { shared: true },
      plotOptions: { series: { dataLabels: { enabled: true } } },
      series: [
        { name: 'Requested', type: 'bar', data: categories.map((key) => reportData.areaDemand.get(key) || 0) },
        { name: 'Assigned', type: 'bar', data: categories.map((key) => reportData.areaDelivery.get(key) || 0) },
      ],
    }
  }, [reportData.areaDelivery, reportData.areaDemand])

  const consultantOptions = useMemo<Highcharts.Options>(() => {
    const rows = Array.from(reportData.consultantMap.entries())
      .sort((a, b) => b[1].assigned - a[1].assigned)
      .slice(0, 10)
    return {
      colors: [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.danger],
      chart: { type: 'column', height: 330 },
      title: { text: 'Consultant Workload' },
      xAxis: { categories: rows.map(([name]) => name) },
      yAxis: { min: 0, title: { text: 'Assignments' }, allowDecimals: false },
      tooltip: { shared: true },
      plotOptions: { column: { stacking: 'normal', borderRadius: 4, dataLabels: { enabled: true } } },
      series: [
        { name: 'Completed', type: 'column', data: rows.map(([, row]) => row.completed) },
        { name: 'In progress', type: 'column', data: rows.map(([, row]) => row.inProgress) },
        { name: 'Overdue', type: 'column', data: rows.map(([, row]) => row.overdue) },
      ],
    }
  }, [reportData.consultantMap])

  const participantOptions = useMemo<Highcharts.Options>(() => {
    const hubs = new Map<string, number>()
    reportData.scopedParticipants.forEach((participant) => {
      const key = String(participant.hub || participant.province || 'Unassigned')
      hubs.set(key, (hubs.get(key) || 0) + 1)
    })
    const rows = topEntries(hubs, 8)
    return {
      colors: [CHART_COLORS.cyan],
      chart: { type: 'bar', height: 300 },
      title: { text: 'Participant Spread' },
      xAxis: { categories: rows.map(([label]) => label) },
      yAxis: { min: 0, title: { text: 'Participants' }, allowDecimals: false },
      legend: { enabled: false },
      plotOptions: { series: { dataLabels: { enabled: true } } },
      series: [{ name: 'Participants', type: 'bar', data: rows.map(([, count]) => count) }],
    }
  }, [reportData.scopedParticipants])

  const genderOptions = useMemo<Highcharts.Options>(() => {
    const counts = new Map<string, number>()
    reportData.scopedParticipants.forEach((participant) => {
      const key = String(participant.gender || 'Unspecified')
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const rows = topEntries(counts, 8)
    return {
      chart: { type: 'pie', height: 280 },
      title: { text: 'Gender Distribution' },
      plotOptions: {
        pie: {
          innerSize: '55%',
          dataLabels: { enabled: true, format: '{point.name}: {point.y}' },
        },
      },
      series: [{ name: 'Participants', type: 'pie', data: rows.map(([name, y]) => ({ name, y })) }],
    }
  }, [reportData.scopedParticipants])

  const beeOptions = useMemo<Highcharts.Options>(() => {
    const counts = new Map<string, number>()
    reportData.scopedParticipants.forEach((participant) => {
      const key = String(participant.beeLevel || 'Unspecified')
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const rows = topEntries(counts, 8)
    return {
      chart: { type: 'column', height: 280 },
      title: { text: 'B-BBEE Levels' },
      xAxis: { categories: rows.map(([label]) => label) },
      yAxis: { min: 0, title: { text: 'Participants' }, allowDecimals: false },
      legend: { enabled: false },
      plotOptions: { column: { borderRadius: 4, colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ name: 'Participants', type: 'column', data: rows.map(([, count]) => count) }],
    }
  }, [reportData.scopedParticipants])

  const ownershipOptions = useMemo<Highcharts.Options>(() => {
    const participants = reportData.scopedParticipants
    const count = participants.length || 1
    const female = participants.reduce((sum, item) => sum + numberValue(item.femaleOwnedPercent), 0) / count
    const youth = participants.reduce((sum, item) => sum + numberValue(item.youthOwnedPercent), 0) / count
    const black = participants.reduce((sum, item) => sum + numberValue(item.blackOwnedPercent), 0) / count

    return {
      colors: [CHART_COLORS.pink, CHART_COLORS.amber, CHART_COLORS.success],
      chart: { type: 'bar', height: 260 },
      title: { text: 'Ownership Profile' },
      xAxis: { categories: ['Female-owned', 'Youth-owned', 'Black-owned'] },
      yAxis: { min: 0, max: 100, labels: { format: '{value}%' }, title: { text: 'Average ownership' } },
      legend: { enabled: false },
      tooltip: { pointFormat: '<b>{point.y:.0f}%</b>' },
      plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y:.0f}%' } } },
      series: [{ name: 'Average', type: 'bar', data: [female, youth, black] }],
    }
  }, [reportData.scopedParticipants])

  const demandColumns: ColumnsType<SupportDemandRow> = [
    { title: 'Intervention', dataIndex: 'title', key: 'title' },
    { title: 'Requested', dataIndex: 'requested', key: 'requested', width: 110, sorter: (a, b) => a.requested - b.requested },
    { title: 'Assigned', dataIndex: 'assigned', key: 'assigned', width: 100 },
    { title: 'Completed', dataIndex: 'completed', key: 'completed', width: 110 },
    {
      title: 'Coverage',
      key: 'coverage',
      width: 150,
      render: (_, row) => <Progress percent={percent(row.assigned, row.requested)} size="small" status={row.gap > 0 ? 'active' : 'success'} />,
    },
    { title: 'Gap', dataIndex: 'gap', key: 'gap', width: 80, render: (gap: number) => <Tag color={gap > 0 ? 'orange' : 'green'}>{gap}</Tag> },
  ]

  const attentionColumns: ColumnsType<AttentionRow> = [
    { title: 'Issue', dataIndex: 'issue', key: 'issue', width: 140, render: (issue: string, row) => <Tag color={row.severity === 'high' ? 'red' : 'orange'}>{issue}</Tag> },
    { title: 'Intervention', dataIndex: 'intervention', key: 'intervention' },
    { title: 'Participant', dataIndex: 'participant', key: 'participant' },
    { title: 'Owner', dataIndex: 'owner', key: 'owner', width: 170 },
    { title: 'Due', dataIndex: 'dueDate', key: 'dueDate', width: 130 },
  ]

  const attendanceColumns: ColumnsType<AttendanceRow> = [
    { title: 'Appointment', dataIndex: 'appointment', key: 'appointment' },
    { title: 'Participant', dataIndex: 'participant', key: 'participant' },
    ...(isAllPrograms ? [{ title: 'Programme', dataIndex: 'program', key: 'program', width: 170 }] as ColumnsType<AttendanceRow> : []),
    { title: 'Date', dataIndex: 'date', key: 'date', width: 150 },
    { title: 'Type', dataIndex: 'meetingType', key: 'meetingType', width: 120, render: (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase()) },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 130, render: (value: string) => <Tag color={appointmentStatusColor(value)}>{appointmentStatusLabel(value)}</Tag> },
    { title: 'Attendance', dataIndex: 'attendance', key: 'attendance', width: 140, render: (value: AttendanceRow['attendance']) => <Tag color={attendanceStatusColor(value)}>{value}</Tag> },
  ]

  const complianceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    reportData.complianceDocuments.forEach((document) => {
      const status = complianceStatusLabel(String(document.status || 'pending'))
      counts.set(status, (counts.get(status) || 0) + 1)
    })
    return topEntries(counts, 6)
  }, [reportData.complianceDocuments])

  const downloadReport = async () => {
    const periodLabel = `${start.format('DD MMM YYYY')} to ${end.format('DD MMM YYYY')}`
    const preparedFor = user?.companyCode || 'Operations'
    try {
      setDownloadingReport(true)
      const response = await generateOperationsReportInsights({
        reportTitle: 'Operations Report',
        periodLabel,
        companyName: preparedFor,
        audience: 'operations and project administrators',
        metrics: {
          submitted: summary.submitted,
          accepted: summary.accepted,
          acceptanceRate: summary.acceptanceRate,
          participants: summary.participants,
          assigned: summary.assigned,
          completed: summary.completed,
          completionRate: summary.completionRate,
          overdue: summary.overdue,
          complianceRisk: summary.complianceRisk,
          appointments: summary.appointments,
          attendanceRate: summary.attendanceRate,
          attended: summary.attended,
          absent: summary.absent,
          notCaptured: summary.notCaptured,
        },
        demandCoverage: reportData.supportRows.slice(0, 10),
        attentionItems: reportData.attentionRows,
        attendance: {
          appointments: summary.appointments,
          attended: summary.attended,
          absent: summary.absent,
          notCaptured: summary.notCaptured,
          attendanceRate: summary.attendanceRate,
          rows: reportData.attendanceRows.slice(0, 20),
        },
        compliance: {
          documents: reportData.complianceDocuments.length,
          exceptions: summary.complianceRisk,
          statusCounts: Object.fromEntries(complianceCounts),
        },
      })

      const reportBlob = await renderDocxTemplate({
        report_title: 'Operations Report',
        report_period: periodLabel,
        report_period_short: period === 'custom' ? 'Custom' : period === 'year' ? start.format('YYYY') : period === 'quarter' ? start.format('[Q]Q') : period === 'month' ? start.format('MMM') : `W${start.isoWeek()}`,
        prepared_for: preparedFor,
        prepared_by: user?.name || user?.displayName || user?.email || 'Operations',
        prepared_date: dayjs().format('DD MMM YYYY'),
        report_contact_line: [user?.email, preparedFor].filter(Boolean).join('    '),
        submitted_count: summary.submitted,
        accepted_count: summary.accepted,
        completed_count: summary.completed,
        attendance_rate: `${summary.attendanceRate}%`,
        executive_summary: response.insights.executiveSummary || 'No executive summary returned.',
        operational_highlights: multilineList(response.insights.operationalHighlights),
        demand_coverage_summary: summary.topGap,
        attendance_summary: response.insights.attendanceSummary || 'No attendance summary returned.',
        risks_and_mitigations: multilineList(response.insights.risks),
        action_plan: response.insights.actionPlan?.length
          ? response.insights.actionPlan.map((item) => `- ${item.action}`).join('\n')
          : 'No action plan items returned.',
        demandRows: reportData.supportRows.length
          ? reportData.supportRows.slice(0, 20).map((row) => ({
              demand_intervention: row.title,
              demand_requested: row.requested,
              demand_assigned: row.assigned,
              demand_completed: row.completed,
              demand_gap: row.gap,
            }))
          : [{
              demand_intervention: 'No demand coverage records',
              demand_requested: '-',
              demand_assigned: '-',
              demand_completed: '-',
              demand_gap: '-',
            }],
        attendanceRows: reportData.attendanceRows.length
          ? reportData.attendanceRows.map((row) => ({
              attendance_appointment: row.appointment,
              attendance_participant: row.participant,
              attendance_program: row.program,
              attendance_date: row.date,
              attendance_type: row.meetingType.replace(/\b\w/g, (letter) => letter.toUpperCase()),
              attendance_status: appointmentStatusLabel(row.status),
              attendance_result: row.attendance,
            }))
          : [{
              attendance_appointment: 'No appointments',
              attendance_participant: '-',
              attendance_program: '-',
              attendance_date: '-',
              attendance_type: '-',
              attendance_status: '-',
              attendance_result: '-',
            }],
        actionPlanRows: response.insights.actionPlan?.length
          ? response.insights.actionPlan.map((row) => ({
              action_item: row.action,
              action_owner: row.owner,
              action_priority: row.priority,
              action_due: row.due,
              action_success_measure: row.successMeasure,
            }))
          : [{
              action_item: 'No action plan items returned',
              action_owner: '-',
              action_priority: '-',
              action_due: '-',
              action_success_measure: '-',
            }],
      })
      downloadBlob(reportBlob, `${fileSafe(`operations-report-${periodLabel}`)}.docx`)
      message.success('Report downloaded.')
    } catch (error) {
      message.error(error instanceof Error && error.message === 'agent-api-not-configured'
        ? 'AI report endpoint is not configured.'
        : 'Report could not be generated.')
    } finally {
      setDownloadingReport(false)
    }
  }

  return (
    <DashboardPage className="operations-reports-page">
      <DashboardHeader
        title={t('nav.reports')}
        subtitle="A concise view of intake, delivery, compliance, and the work that needs attention."
        actions={
          <Space wrap>
            <Button type="primary" icon={<DownloadOutlined />} loading={downloadingReport} onClick={() => void downloadReport()}>
              Download report
            </Button>
          </Space>
        }
      />

      {view === 'overview' && (
        <Row gutter={[16, 16]} className="dashboard-metrics-row operations-reports-metrics">
          <Col xs={12} lg={6}>
            <DashboardMetricCard loading={loading} icon={<AuditOutlined />} iconClassName="is-applications" label="Submitted" value={summary.submitted} hint={`${summary.acceptanceRate}% accepted`} />
          </Col>
          <Col xs={12} lg={6}>
            <DashboardMetricCard loading={loading} icon={<TeamOutlined />} iconClassName="is-participants" label="Participants" value={summary.participants} hint="Accepted or active SMEs" />
          </Col>
          <Col xs={12} lg={6}>
            <DashboardMetricCard loading={loading} icon={<CheckCircleOutlined />} iconClassName="is-delivery" label="Completed" value={summary.completed} hint={`${summary.completionRate}% delivery rate`} />
          </Col>
          <Col xs={12} lg={6}>
            <DashboardMetricCard loading={loading} icon={<ExclamationCircleOutlined />} iconClassName="is-attention" label="Attention" value={summary.overdue + summary.complianceRisk} hint={`${summary.overdue} overdue, ${summary.complianceRisk} compliance`} />
          </Col>
        </Row>
      )}

      <FilterBar
        title="Report scope"
        primary={
          <>
            <Segmented<ReportView>
              value={view}
              onChange={(value) => setView(value)}
              options={[
                { label: 'Overview', value: 'overview' },
                { label: 'Applications', value: 'applications' },
                { label: 'Interventions', value: 'interventions' },
                { label: 'Participants', value: 'participants' },
              ]}
            />
            <Select<PeriodPreset>
              value={period}
              onChange={changePeriod}
              options={[
                { value: 'week', label: 'This week' },
                { value: 'month', label: 'This month' },
                { value: 'quarter', label: 'This quarter' },
                { value: 'year', label: 'This year' },
                { value: 'custom', label: 'Custom range' },
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
      />

      {view === 'overview' && (
        <>
          <Row gutter={[16, 16]} className="operations-overview-grid">
            <Col xs={24} xl={14}>
              <Card loading={loading} className="dashboard-section-card motion-card" title="Period Health">
                <div className="operations-health-grid">
                  {overviewHighlights.map((item) => (
                    <button
                      className={`operations-health-tile is-${item.tone}`}
                      key={item.key}
                      type="button"
                      onClick={() => setView(item.key === 'applications' ? 'applications' : item.key === 'compliance' ? 'participants' : 'interventions')}
                    >
                      <Text type="secondary">{item.label}</Text>
                      <strong>{item.value}</strong>
                      <span>{item.meta}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card loading={loading} className="dashboard-section-card motion-card" title="What Needs Attention">
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {overviewActions.map((item) => (
                    <div className={`operations-action-brief is-${item.tone}`} key={item.key}>
                      <div>
                        <Text strong>{item.title}</Text>
                        <Text type="secondary">{item.body}</Text>
                      </div>
                      <Button size="small" onClick={() => setView(item.target)}>Open detail</Button>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {view === 'applications' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={15}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              {reportData.intakeBuckets.size ? <ThemedHighcharts options={intakeOptions} /> : <Empty description="No applications in this period" />}
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card className="dashboard-section-card motion-card operations-insight-card">
              <Space direction="vertical" size={14}>
                <Title level={4}>Intake Signals</Title>
                <Alert type="info" showIcon message="Top requested support" description={summary.topDemand} />
                <Alert type={summary.acceptanceRate >= 50 ? 'success' : 'warning'} showIcon message="Conversion" description={`${summary.acceptanceRate}% of submitted applications were accepted in this scope.`} />
                <Alert type={summary.topGap === 'Demand is covered' ? 'success' : 'warning'} showIcon message="Demand gap" description={summary.topGap} />
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {view === 'interventions' && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={8}>
              <Card loading={loading} className="dashboard-section-card motion-card">
                {reportData.scopedAssignments.length ? <ThemedHighcharts options={interventionHealthOptions} /> : <Empty description="No assigned interventions" />}
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card loading={loading} className="dashboard-section-card motion-card">
                {reportData.areaDemand.size || reportData.areaDelivery.size ? <ThemedHighcharts options={areaOptions} /> : <Empty description="No support-area data" />}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={14}>
              <Card loading={loading} className="dashboard-section-card motion-card" title={<Space><RiseOutlined /> Demand Coverage</Space>}>
                <Table
                  size="middle"
                  rowKey="key"
                  columns={demandColumns}
                  dataSource={reportData.supportRows.slice(0, 10)}
                  pagination={false}
                  locale={{ emptyText: 'No intervention demand has been recorded for this period.' }}
                  scroll={{ x: 720 }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card loading={loading} className="dashboard-section-card motion-card" title={<Space><ClockCircleOutlined /> Needs Attention</Space>}>
                <Table
                  size="middle"
                  rowKey="key"
                  columns={attentionColumns}
                  dataSource={reportData.attentionRows}
                  pagination={false}
                  locale={{ emptyText: 'No overdue or stalled assignments in this period.' }}
                  scroll={{ x: 760 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {view === 'interventions' && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              className="dashboard-section-card motion-card"
              title={<Space><ClockCircleOutlined /> Appointment Attendance</Space>}
              extra={<Text type="secondary">{summary.attendanceRate}% attendance rate</Text>}
            >
              <Row gutter={[12, 12]} className="operations-attendance-summary">
                <Col xs={12} md={6}><Card size="small"><Text type="secondary">Appointments</Text><Title level={4}>{summary.appointments}</Title></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Text type="secondary">Present</Text><Title level={4}>{summary.attended}</Title></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Text type="secondary">Absent</Text><Title level={4}>{summary.absent}</Title></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Text type="secondary">Not captured</Text><Title level={4}>{summary.notCaptured}</Title></Card></Col>
              </Row>
              <Table
                size="middle"
                rowKey="key"
                columns={attendanceColumns}
                dataSource={reportData.attendanceRows}
                pagination={{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }}
                locale={{ emptyText: 'No appointments were scheduled in this report period.' }}
                scroll={{ x: 900 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {view === 'participants' && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              <ThemedHighcharts options={participantOptions} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              <ThemedHighcharts options={ownershipOptions} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              <ThemedHighcharts options={genderOptions} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card loading={loading} className="dashboard-section-card motion-card">
              <ThemedHighcharts options={beeOptions} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card className="dashboard-section-card motion-card operations-insight-card">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Title level={4}>Compliance Status</Title>
                {complianceCounts.length ? complianceCounts.map(([status, count]) => (
                  <div className="operations-status-row" key={status}>
                    <Space>
                      <FileProtectOutlined />
                      <Text>{status}</Text>
                    </Space>
                    <Tag color={complianceStatusColor(status)}>{count}</Tag>
                  </div>
                )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No compliance documents found" />}
                <Alert
                  type={summary.complianceRisk > 0 ? 'warning' : 'success'}
                  showIcon
                  message={summary.complianceRisk > 0 ? 'Compliance follow-up required' : 'No compliance exceptions'}
                  description={`${summary.complianceRisk} document${summary.complianceRisk === 1 ? '' : 's'} need attention in this report scope.`}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {view === 'interventions' && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card loading={loading} className="dashboard-section-card motion-card" title={<Space><BarChartOutlined /> Capacity Snapshot</Space>}>
              {reportData.consultantMap.size ? <ThemedHighcharts options={consultantOptions} /> : <Empty description="No consultant workload in this period" />}
              <Text type="secondary">Highest workload: {summary.busiestConsultant}</Text>
            </Card>
          </Col>
        </Row>
      )}
    </DashboardPage>
  )
}

export default OperationsReportsPage
