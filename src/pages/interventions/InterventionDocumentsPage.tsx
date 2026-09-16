import { useEffect, useMemo, useState } from 'react'
import { App, Button, Card, Col, Input, Row, Select, Space, Tag, Typography, type TableProps } from 'antd'
import { DownloadOutlined, FileDoneOutlined, FolderOpenOutlined, SafetyCertificateOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import DashboardPage from '@/components/shared/DashboardPage'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import { FilterBar } from '@/components/shared/FilterBar'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { listInterventionDocuments, verifyInterventionDocument, type DocumentVerificationResult, type InterventionDocument } from '@/services/interventionDocumentsService'

const dateValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate() as Date
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function InterventionDocumentsPage() {
  const { message } = App.useApp()
  const { user } = useFullIdentity()
  const [rows, setRows] = useState<InterventionDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [intervention, setIntervention] = useState('all')
  const [verifyingId, setVerifyingId] = useState('')
  const [verification, setVerification] = useState<Record<string, DocumentVerificationResult>>({})
  const operational = user?.role === 'operations' || user?.role === 'projectadmin'

  useEffect(() => {
    if (!user) return
    setLoading(true)
    void listInterventionDocuments(user)
      .then(setRows)
      .catch(error => {
        console.error('[INTERVENTION DOCUMENTS] Load failed:', error)
        message.error('The intervention document library could not be loaded.')
      })
      .finally(() => setLoading(false))
  }, [message, user])

  const interventionOptions = useMemo(() => [
    { value: 'all', label: 'All interventions' },
    ...Array.from(new Set(rows.map(row => row.interventionTitle))).sort().map(value => ({ value, label: value })),
  ], [rows])
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(row => (intervention === 'all' || row.interventionTitle === intervention)
      && (!needle || `${row.fileName} ${row.interventionTitle} ${row.participantName} ${row.programName || ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => (dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0))
  }, [intervention, rows, search])

  const verify = async (row: InterventionDocument) => {
    setVerifyingId(row.id)
    try {
      const result = await verifyInterventionDocument(row)
      setVerification(current => ({ ...current, [row.id]: result }))
      if (result.status === 'verified') message.success(result.message)
      else if (result.status === 'altered') message.error(result.message)
      else message.warning(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'The document could not be verified.')
    } finally {
      setVerifyingId('')
    }
  }

  const provenanceTag = (row: InterventionDocument) => {
    const result = verification[row.id]
    if (result?.status === 'verified') return <Tag color="green" icon={<SafetyCertificateOutlined />}>Verified</Tag>
    if (result?.status === 'altered') return <Tag color="red">Invalid</Tag>
    if (result?.status === 'unsigned' || !row.signature) return <Tag>Legacy / unsigned</Tag>
    return <Tag color="blue" icon={<SafetyCertificateOutlined />}>Signed</Tag>
  }

  const columns: TableProps<InterventionDocument>['columns'] = [
    { title: 'Document', render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{row.fileName}</Typography.Text><Typography.Text type="secondary">{row.interventionTitle}</Typography.Text></Space> },
    ...(operational ? [{ title: 'SME', dataIndex: 'participantName' } as NonNullable<TableProps<InterventionDocument>['columns']>[number]] : []),
    { title: 'Programme', dataIndex: 'programName', render: value => value || 'Unassigned' },
    { title: 'Produced by', dataIndex: 'agentName', render: value => <Tag>{value || 'Intervention workspace'}</Tag> },
    { title: 'Provenance', render: (_, row) => provenanceTag(row) },
    { title: 'Created', render: (_, row) => dateValue(row.createdAt)?.toLocaleDateString() || 'Recently' },
    { title: 'Action', width: 210, render: (_, row) => <Space><Button icon={<SafetyCertificateOutlined />} loading={verifyingId === row.id} onClick={() => void verify(row)}>Verify</Button><Button type="primary" icon={<DownloadOutlined />} href={row.fileUrl} target="_blank" rel="noreferrer">Open</Button></Space> },
  ]

  return <DashboardPage className="intervention-documents-page">
    <Row gutter={[12, 12]} className="dashboard-metrics-row">
      <Col xs={12} lg={8}><DashboardMetricCard loading={loading} icon={<FileDoneOutlined />} label="Documents" value={rows.length} /></Col>
      <Col xs={12} lg={8}><DashboardMetricCard loading={loading} icon={<FolderOpenOutlined />} label="Interventions" value={new Set(rows.map(row => row.interventionId || row.interventionTitle)).size} /></Col>
      <Col xs={12} lg={8}><DashboardMetricCard loading={loading} icon={<TeamOutlined />} label={operational ? 'SMEs' : 'Programmes'} value={operational ? new Set(rows.map(row => row.participantId)).size : new Set(rows.map(row => row.programId).filter(Boolean)).size} /></Col>
    </Row>
    <FilterBar title={operational ? 'SME intervention documents' : 'My intervention documents'} primary={<><Input prefix={<SearchOutlined />} placeholder="Search documents, interventions, SMEs..." value={search} onChange={event => setSearch(event.target.value)} allowClear /><Select value={intervention} onChange={setIntervention} options={interventionOptions} /></>} />
    <Card loading={loading} className="dashboard-section-card" bordered={false}>
      <ResponsiveDataView rowKey="id" rows={filtered} columns={columns} emptyText="No documents have been produced for these interventions yet." renderCard={row => <Space direction="vertical" size={8}><Typography.Text strong>{row.fileName}</Typography.Text><Typography.Text type="secondary">{row.interventionTitle}{operational ? ` · ${row.participantName}` : ''}</Typography.Text><Space wrap><Tag>{row.programName || 'Unassigned'}</Tag><Tag>{row.agentName || 'Intervention workspace'}</Tag>{provenanceTag(row)}</Space><Space><Button icon={<SafetyCertificateOutlined />} loading={verifyingId === row.id} onClick={() => void verify(row)}>Verify</Button><Button type="primary" icon={<DownloadOutlined />} href={row.fileUrl} target="_blank">Open document</Button></Space></Space>} />
    </Card>
  </DashboardPage>
}
