import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Empty, Grid, Input, Modal, Row, Segmented, Select, Space, Tag, Typography, type TableProps } from 'antd'
import { AppstoreOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, DownloadOutlined, FileOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { useEffect, useMemo, useState } from 'react'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'
import { useRegisterAgentPageContext } from '@/context/AgentPageContext'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useLanguage } from '@/providers/LanguageProvider'
import { listOperationsApplications, updateOperationsApplicationStatus } from '@/services/operationsApplicationsService'
import type { OperationsApplication } from '@/types/operations'
import '@/styles/applications-review.css'

const { RangePicker } = DatePicker
dayjs.extend(isBetween)
type DetailSection = 'overview' | 'ai' | 'documents'
const STATUSES = ['Pending', 'Accepted', 'Rejected']
const normalizeStatus = (value?: string) => STATUSES.find((status) => status.toLowerCase() === value?.toLowerCase()) || 'Pending'
const statusColor = (status: string) => status === 'Accepted' ? 'green' : status === 'Rejected' ? 'red' : 'gold'
const toDate = (value: unknown) => {
    if (!value) return null
    if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') return dayjs(value.toDate())
    if (typeof value === 'object' && value && 'seconds' in value && typeof value.seconds === 'number') return dayjs(value.seconds * 1000)
    const date = dayjs(value as string | number | Date)
    return date.isValid() ? date : null
}

const uniqueOptions = (rows: OperationsApplication[], key: 'province' | 'beeLevel' | 'gender') =>
    [...new Set(rows.map((row) => row[key]).filter((value): value is string => !!value))].sort().map((value) => ({ value, label: value }))

export const ApplicationsReviewPage = () => {
    const { message } = App.useApp()
    const { t } = useLanguage()
    const screens = Grid.useBreakpoint()
    const isCompact = !screens.xl
    const { user } = useFullIdentity()
    const [applications, setApplications] = useState<OperationsApplication[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<OperationsApplication>()
    const [detailOpen, setDetailOpen] = useState(false)
    const [section, setSection] = useState<DetailSection>('overview')
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('All')
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
    const [province, setProvince] = useState('All')
    const [beeLevel, setBeeLevel] = useState('All')
    const [gender, setGender] = useState('All')
    const [pendingUpdate, setPendingUpdate] = useState<{ row: OperationsApplication, status: string }>()

    const load = async () => {
        if (!user) return
        try {
            setLoading(true)
            const rows = await listOperationsApplications(user)
            setApplications(rows)
            setSelected((current) => rows.find((row) => row.id === current?.id) || rows[0])
        } catch {
            message.error(t('operations.applications.loadError'))
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 0)
        return () => window.clearTimeout(timeout)
    }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    const counts = useMemo(() => ({
        pending: applications.filter((row) => normalizeStatus(row.applicationStatus) === 'Pending').length,
        accepted: applications.filter((row) => normalizeStatus(row.applicationStatus) === 'Accepted').length,
        rejected: applications.filter((row) => normalizeStatus(row.applicationStatus) === 'Rejected').length,
    }), [applications])
    const rows = useMemo(() => applications.filter((row) => {
        const needle = search.trim().toLowerCase()
        const submittedAt = toDate(row.submittedAt)
        return (status === 'All' || normalizeStatus(row.applicationStatus) === status)
            && (!needle || `${row.businessName} ${row.email} ${row.programName || ''}`.toLowerCase().includes(needle))
            && (!dateRange || (!!submittedAt && submittedAt.isBetween(dateRange[0], dateRange[1], 'day', '[]')))
            && (province === 'All' || row.province === province)
            && (beeLevel === 'All' || row.beeLevel === beeLevel)
            && (gender === 'All' || row.gender === gender)
    }), [applications, beeLevel, dateRange, gender, province, search, status])

    useRegisterAgentPageContext({ pageKey: 'operations-applications', pageName: 'Applications', purpose: 'Review project applications and update decisions.', filters: { search, status, dateRange, province, beeLevel, gender }, metrics: { total: applications.length, ...counts }, tables: { visibleApplications: rows.length }, selectedRecord: selected?.businessName })

    const chooseApplication = (row: OperationsApplication) => {
        setSelected(row)
        setSection('overview')
        if (isCompact) setDetailOpen(true)
    }
    const confirmStatusChange = async () => {
        if (!user || !pendingUpdate) return
        try {
            setLoading(true)
            await updateOperationsApplicationStatus(user, pendingUpdate.row.id, pendingUpdate.status)
            message.success(t('operations.applications.updated'))
            setPendingUpdate(undefined)
            await load()
        } catch {
            message.error(t('operations.applications.updateError'))
            setLoading(false)
        }
    }

    const columns: TableProps<OperationsApplication>['columns'] = [
        { title: t('operations.participants.enterprise'), dataIndex: 'businessName', render: (value: string, row) => <Space orientation="vertical" size={0}><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.email}</Typography.Text></Space> },
        { title: t('operations.applications.applied'), dataIndex: 'submittedAt', render: (value: unknown) => toDate(value)?.format('DD MMM YYYY') || 'N/A' },
        { title: t('operations.applications.aiScore'), dataIndex: 'aiScore', render: (value?: string | number) => value ?? 'N/A' },
        { title: t('common.status'), dataIndex: 'applicationStatus', render: (value: string, row) => <Space wrap><Tag color={statusColor(normalizeStatus(value))}>{normalizeStatus(value)}</Tag>{row.supportFitStatus === 'await_review' ? <Tag color="orange">External review</Tag> : null}</Space> },
    ]

    const details = selected ? (
        <div className="applications-detail-body">
            <div className="applications-detail-heading">
                <div><Typography.Title level={4}>{selected.businessName}</Typography.Title><Typography.Text type="secondary">{selected.email}</Typography.Text></div>
                <Tag color={statusColor(normalizeStatus(selected.applicationStatus))}>{normalizeStatus(selected.applicationStatus)}</Tag>
            </div>
            <Segmented block value={section} onChange={(value) => setSection(value as DetailSection)} options={[{ label: t('common.overview'), value: 'overview' }, { label: t('operations.applications.aiReview'), value: 'ai' }, { label: t('operations.compliance.documents'), value: 'documents' }]} />
            {section === 'overview' && <Descriptions bordered size="small" column={1} items={[
                { key: 'program', label: t('operations.applications.program'), children: selected.programName || t('common.unassigned') },
                { key: 'date', label: t('operations.applications.applied'), children: toDate(selected.submittedAt)?.format('DD MMM YYYY') || 'N/A' },
                { key: 'province', label: t('common.province'), children: selected.province || 'N/A' },
                { key: 'bee', label: t('common.beeLevel'), children: selected.beeLevel || 'N/A' },
                { key: 'gender', label: t('common.gender'), children: selected.gender || 'N/A' },
                { key: 'motivation', label: t('operations.applications.motivation'), children: selected.motivation || 'N/A' },
                { key: 'challenges', label: t('operations.applications.challenges'), children: selected.challenges || 'N/A' },
            ]} />}
            {section === 'ai' && <Space orientation="vertical" size={16} className="applications-detail-stack">
                <div><Typography.Text strong>{t('operations.applications.decision')}</Typography.Text><Select value={normalizeStatus(selected.applicationStatus)} onChange={(value) => setPendingUpdate({ row: selected, status: value })} options={STATUSES.map((value) => ({ value, label: t(`operations.applications.${value.toLowerCase()}`) }))} /></div>
                <div><Typography.Text strong>{t('operations.applications.aiRecommendation')}</Typography.Text><Tag color={statusColor(normalizeStatus(selected.aiRecommendation))}>{selected.aiRecommendation || t('operations.applications.pending')}</Tag></div>
                {selected.supportFitStatus ? <div><Typography.Text strong>Support fit</Typography.Text><div><Tag color={selected.supportFitStatus === 'await_review' ? 'orange' : 'green'}>{selected.supportFitStatus.replace(/_/g, ' ')}</Tag></div></div> : null}
                {selected.externalInterventionSuggestions?.length ? <Alert type="warning" showIcon message="External intervention suggested" description={selected.externalInterventionSuggestions.map((item) => item.title || item.reason || 'External support need').join(', ')} /> : null}
                <div><Typography.Text strong>{t('operations.applications.aiScore')}</Typography.Text><Typography.Title level={3}>{selected.aiScore ?? 'N/A'}</Typography.Title></div>
                <div><Typography.Text strong>{t('operations.applications.justification')}</Typography.Text><Typography.Paragraph type="secondary">{selected.aiJustification || t('operations.applications.noJustification')}</Typography.Paragraph></div>
            </Space>}
            {section === 'documents' && <Space orientation="vertical" className="applications-detail-stack">
                {selected.documents.length || selected.growthPlanDocUrl ? <>
                    {selected.documents.map((document, index) => <Card size="small" key={`${document.type}-${index}`}><Space><FileOutlined /><Typography.Text>{document.type || `${t('common.document')} ${index + 1}`}</Typography.Text><Button icon={<DownloadOutlined />} href={document.url} target="_blank" disabled={!document.url}>{t('common.download')}</Button></Space></Card>)}
                    {selected.growthPlanDocUrl && <Card size="small"><Space><FileOutlined /><Typography.Text>{t('operations.applications.growthPlan')}</Typography.Text><Button icon={<DownloadOutlined />} href={selected.growthPlanDocUrl} target="_blank">{t('common.download')}</Button></Space></Card>}
                </> : <Empty description={t('operations.compliance.noDocuments')} />}
            </Space>}
        </div>
    ) : <Empty description={t('operations.applications.select')} />

    return <DashboardPage className="applications-review-page">
        <Row gutter={[12, 12]} className="applications-metrics">
            <Col xs={12} md={6}><DashboardMetricCard icon={<AppstoreOutlined />} label={t('nav.applications')} value={applications.length} /></Col>
            <Col xs={12} md={6}><DashboardMetricCard icon={<ClockCircleOutlined />} label={t('operations.applications.pending')} value={counts.pending} /></Col>
            <Col xs={12} md={6}><DashboardMetricCard icon={<CheckCircleOutlined />} label={t('operations.applications.accepted')} value={counts.accepted} /></Col>
            <Col xs={12} md={6}><DashboardMetricCard icon={<CloseCircleOutlined />} label={t('operations.applications.rejected')} value={counts.rejected} /></Col>
        </Row>
        <FilterBar title={t('operations.applications.review')} primary={<><Input prefix={<SearchOutlined />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('operations.applications.search')} allowClear /><Select value={status} onChange={setStatus} options={['All', ...STATUSES].map((value) => ({ value, label: t(`operations.applications.${value.toLowerCase()}`) }))} /><RangePicker value={dateRange} onChange={(value) => setDateRange(value as [Dayjs, Dayjs] | null)} /></>} advanced={<><Select value={province} onChange={setProvince} options={[{ value: 'All', label: t('operations.applications.allProvinces') }, ...uniqueOptions(applications, 'province')]} /><Select value={beeLevel} onChange={setBeeLevel} options={[{ value: 'All', label: t('operations.applications.allBeeLevels') }, ...uniqueOptions(applications, 'beeLevel')]} /><Select value={gender} onChange={setGender} options={[{ value: 'All', label: t('operations.applications.allGenders') }, ...uniqueOptions(applications, 'gender')]} /></>} />
        <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}><Card className="applications-panel"><ResponsiveDataView rowKey="id" loading={loading} columns={columns} rows={rows} emptyText={t('operations.applications.empty')} onRowClick={chooseApplication} rowClassName={(row) => `applications-row${row.id === selected?.id ? ' applications-selected-row' : ''}`} renderCard={(row) => <Space orientation="vertical" size={8} onClick={() => chooseApplication(row)}><Typography.Text strong>{row.businessName}</Typography.Text><Typography.Text type="secondary">{row.email}</Typography.Text><Space wrap><Tag color={statusColor(normalizeStatus(row.applicationStatus))}>{normalizeStatus(row.applicationStatus)}</Tag><Typography.Text type="secondary">{toDate(row.submittedAt)?.format('DD MMM YYYY') || 'N/A'}</Typography.Text></Space></Space>} /></Card></Col>
            {!isCompact && <Col xl={10}><Card className="applications-panel applications-detail-panel">{details}</Card></Col>}
        </Row>
        <Modal open={detailOpen} title={t('operations.applications.details')} footer={null} onCancel={() => setDetailOpen(false)} width={760}>{details}</Modal>
        <Modal open={!!pendingUpdate} title={t('operations.applications.confirmDecision')} onCancel={() => setPendingUpdate(undefined)} onOk={() => void confirmStatusChange()} okText={t('operations.applications.updateStatus')}>{t('operations.applications.change')} {pendingUpdate?.row.businessName} {t('operations.applications.to')} <strong>{pendingUpdate?.status}</strong>?</Modal>
    </DashboardPage>
}
