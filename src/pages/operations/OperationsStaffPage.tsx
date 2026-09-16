import { App, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch, Tag, Typography, type TableProps } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { FeaturePermissionsField } from '@/components/shared/FeaturePermissionsField'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'
import { USER_ROLES, type UserRole } from '@/config/roles'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useLanguage } from '@/providers/LanguageProvider'
import { createOperationsStaff, deleteOperationsStaff, listOperationsStaff, updateOperationsStaff } from '@/services/operationsStaffService'
import type { ManagedUser } from '@/types/operations'
import { getRolePermissions } from '@/config/permissions'

type StaffForm = Omit<ManagedUser, 'id' | 'status' | 'companyCode'> & { active: boolean }

export const OperationsStaffPage = () => {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const { user } = useFullIdentity()
  const [form] = Form.useForm<StaffForm>()
  const [staff, setStaff] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ManagedUser>()
  const [modalOpen, setModalOpen] = useState(false)
  const roleOptions = useMemo(() => [
    { value: USER_ROLES.CONSULTANT, label: t('operations.staff.consultant') },
    { value: USER_ROLES.PROJECT_ADMIN, label: t('operations.staff.projectAdmin') },
  ], [t])
  const roleLabel = (role: UserRole) => roleOptions.find((option) => option.value === role)?.label || role

  const load = async () => {
    if (!user) return
    try {
      setLoading(true)
      setStaff(await listOperationsStaff(user))
    } catch {
      message.error(t('operations.staff.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return staff.filter((row) => `${row.name} ${row.email} ${row.role}`.toLowerCase().includes(query))
  }, [search, staff])

  const metrics = useMemo(() => ({
    staff: staff.length,
    active: staff.filter((row) => row.status === 'active').length,
    consultants: staff.filter((row) => row.role === USER_ROLES.CONSULTANT).length,
    projectAdmins: staff.filter((row) => row.role === USER_ROLES.PROJECT_ADMIN).length,
  }), [staff])

  const openModal = (record?: ManagedUser) => {
    setEditing(record)
    form.setFieldsValue(record
      ? { name: record.name, email: record.email, role: record.role, permissions: record.permissions || getRolePermissions(record.role), active: record.status === 'active' }
      : { name: '', email: '', role: USER_ROLES.CONSULTANT, permissions: getRolePermissions(USER_ROLES.CONSULTANT), active: true })
    setModalOpen(true)
  }

  const save = async (values: StaffForm) => {
    if (!user) return
    const payload = { ...values, status: values.active ? 'active' : 'inactive' } as Omit<ManagedUser, 'id'> & { active?: boolean }
    delete payload.active
    try {
      setLoading(true)
      if (editing) await updateOperationsStaff(user, editing.id, payload)
      else await createOperationsStaff(user, payload)
      message.success(t(editing ? 'operations.staff.updated' : 'operations.staff.added'))
      setModalOpen(false)
      form.resetFields()
      await load()
    } catch {
      message.error(t('operations.staff.saveError'))
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    if (!user) return
    try {
      await deleteOperationsStaff(user, id)
      message.success(t('operations.staff.removed'))
      await load()
    } catch {
      message.error(t('operations.staff.removeError'))
    }
  }

  const columns: TableProps<ManagedUser>['columns'] = [
    { title: t('common.name'), dataIndex: 'name' },
    { title: t('common.email'), dataIndex: 'email' },
    { title: t('common.role'), dataIndex: 'role', render: (value: UserRole) => <Tag color="purple">{roleLabel(value)}</Tag> },
    { title: t('common.status'), dataIndex: 'status', render: (value: string) => <Tag color={value === 'active' ? 'green' : 'red'}>{t(value === 'active' ? 'common.active' : 'common.inactive')}</Tag> },
    { title: t('common.actions'), render: (_, row) => <Space><Button icon={<EditOutlined />} onClick={() => openModal(row)}>{t('common.edit')}</Button><Popconfirm title={t('operations.staff.removeConfirm')} onConfirm={() => void remove(row.id)}><Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button></Popconfirm></Space> },
  ]

  return (
    <DashboardPage>
      <Row gutter={[16, 16]} className="dashboard-metrics-row">
        <Col xs={12} lg={6}><DashboardMetricCard icon={<TeamOutlined />} label={t('operations.staff.members')} value={metrics.staff} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard icon={<UserSwitchOutlined />} label={t('common.active')} value={metrics.active} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard icon={<TeamOutlined />} label={t('operations.staff.consultants')} value={metrics.consultants} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard icon={<UserSwitchOutlined />} label={t('operations.staff.projectAdmins')} value={metrics.projectAdmins} /></Col>
      </Row>
      <FilterBar title={t('operations.staff.directory')} primary={<Input prefix={<SearchOutlined />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('operations.staff.search')} allowClear />} actions={<Space><Button icon={<ReloadOutlined />} onClick={() => void load()}>{t('common.refresh')}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>{t('operations.staff.add')}</Button></Space>} />
      <Card>
        <ResponsiveDataView rowKey="id" rows={rows} columns={columns} loading={loading} emptyText={t('operations.staff.empty')} renderCard={(row) => <Space orientation="vertical"><Typography.Text strong>{row.name}</Typography.Text><Typography.Text type="secondary">{row.email}</Typography.Text><Space wrap><Tag color="purple">{roleLabel(row.role)}</Tag><Tag color={row.status === 'active' ? 'green' : 'red'}>{t(row.status === 'active' ? 'common.active' : 'common.inactive')}</Tag><Button icon={<EditOutlined />} onClick={() => openModal(row)}>{t('common.edit')}</Button><Popconfirm title={t('operations.staff.removeConfirm')} onConfirm={() => void remove(row.id)}><Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button></Popconfirm></Space></Space>} />
      </Card>
      <Modal open={modalOpen} title={t(editing ? 'operations.staff.edit' : 'operations.staff.add')} footer={null} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label={t('common.email')} rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="role" label={t('common.role')} rules={[{ required: true }]}><Select options={roleOptions} onChange={(role: UserRole) => form.setFieldValue('permissions', getRolePermissions(role))} /></Form.Item>
          <Form.Item name="permissions" label={t('permissions.featureAccess')}><FeaturePermissionsField /></Form.Item>
          <Form.Item name="active" label={t('common.active')} valuePropName="checked"><Switch /></Form.Item>
          <Button block type="primary" htmlType="submit">{t('operations.staff.save')}</Button>
        </Form>
      </Modal>
    </DashboardPage>
  )
}
