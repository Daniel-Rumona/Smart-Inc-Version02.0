import { Card, Progress, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import DashboardHeader from '@/components/shared/DashboardHeader'
import DashboardPage from '@/components/shared/DashboardPage'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useAssignedInterventions } from '@/contexts/AssignedInterventionsContext'
import {
  assignmentParticipant,
  assignmentProgram,
  deriveConsultantStatus,
  progressForAssignment,
} from './ConsultantWorkspaceUtils'
import '@/styles/consultant.css'

const { Text } = Typography

type SmeRow = {
  key: string
  name: string
  programs: string[]
  assignments: number
  active: number
  averageProgress: number
}

export default function ConsultantSmesPage() {
  const { assignments, isMine, loading } = useAssignedInterventions()
  const rows = Array.from(
    assignments.filter(isMine).reduce((groups, assignment) => {
      const name = assignmentParticipant(assignment)
      const key = name.trim().toLowerCase()
      const current = groups.get(key) || { key, name, programs: new Set<string>(), assignments: 0, active: 0, progress: 0 }
      const program = assignmentProgram(assignment)
      if (program) current.programs.add(program)
      current.assignments += 1
      current.progress += progressForAssignment(assignment)
      if (deriveConsultantStatus(assignment) === 'In progress') current.active += 1
      groups.set(key, current)
      return groups
    }, new Map<string, { key: string, name: string, programs: Set<string>, assignments: number, active: number, progress: number }>())
      .values(),
  ).map<SmeRow>((row) => ({
    ...row,
    programs: [...row.programs],
    averageProgress: Math.round(row.progress / row.assignments),
  }))

  const columns: ColumnsType<SmeRow> = [
    {
      title: 'SME',
      dataIndex: 'name',
      key: 'name',
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'Programme',
      dataIndex: 'programs',
      key: 'programs',
      render: (values: string[]) => <Space wrap>{values.length ? values.map((value) => <Tag key={value}>{value}</Tag>) : <Text type="secondary">Not specified</Text>}</Space>,
    },
    { title: 'Engagements', dataIndex: 'assignments', key: 'assignments', width: 120 },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (value) => <Tag color={value ? 'blue' : 'default'}>{value}</Tag>,
    },
    {
      title: 'Overall progress',
      dataIndex: 'averageProgress',
      key: 'averageProgress',
      width: 190,
      render: (value) => <Progress percent={value} size="small" />,
    },
    {
      title: '',
      key: 'action',
      width: 130,
      render: () => <Link to="/consultant/interventions">View work</Link>,
    },
  ]

  return (
    <DashboardPage className="consultant-page">
      {loading && <LoadingOverlay tip="Loading your SMEs" />}
      <DashboardHeader title="My SMEs" subtitle="A relationship view of the businesses currently linked to your consulting work." />
      <Card className="dashboard-section-card">
        <Table columns={columns} dataSource={rows} rowKey="key" scroll={{ x: 760 }} locale={{ emptyText: 'SMEs will appear here once work is assigned to you.' }} />
      </Card>
    </DashboardPage>
  )
}
