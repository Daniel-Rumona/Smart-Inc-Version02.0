import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  InboxOutlined,
  CloudServerOutlined,
  DollarOutlined,
  EditOutlined,
  FileWordOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import DashboardPage from '@/components/shared/DashboardPage'
import { DashboardHeaderCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useRegisterAgentPageContext } from '@/shared/hooks/useRegisterAgentPageContext'
import {
  AGENT_IMPLEMENTATIONS,
  getAgentImplementation,
} from '@/config/agentImplementations'
import {
  archiveAgent,
  createAgent,
  subscribeAgents,
  updateAgent,
} from '@/services/agentRegistryService'
import type {
  AgentDefinition,
  AgentImplementationKey,
  AgentRegistryInput,
  AgentStatus,
} from '@/types/agentOrchestration'
import '@/styles/agent-registry.css'

const { TextArea } = Input

const STATUS_OPTIONS: Array<{ value: AgentStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

type AgentFormValues = {
  id: string
  name: string
  description: string
  implementationKey: AgentImplementationKey
  capabilities: string[]
  status: AgentStatus
  supportsAssignment: boolean
}

const statusColour = (status: AgentStatus) => {
  if (status === 'active') return 'green'
  if (status === 'inactive') return 'orange'
  return 'default'
}

const AgentRegistryPage = () => {
  const { message, modal } = App.useApp()
  const { user } = useFullIdentity()
  const [form] = Form.useForm<AgentFormValues>()
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AgentDefinition | null>(null)

  const metrics = useMemo(() => {
    const active = agents.filter((agent) => agent.status === 'active').length
    const external = agents.filter(
      (agent) => agent.executionMode === 'external_api',
    ).length
    const billable = agents.filter((agent) => agent.billable).length
    return { total: agents.length, active, external, billable }
  }, [agents])

  useRegisterAgentPageContext({
    pageKey: 'system-agent-registry',
    pageName: 'Agent registry',
    purpose: 'Registers and maintains the AI agent implementations available to the platform.',
    metrics,
    allowedActions: [
      {
        key: 'create_agent',
        label: 'Add agent',
        description: 'Register a supported agent implementation.',
      },
      {
        key: 'update_agent',
        label: 'Update agent',
        description: 'Update agent metadata and availability status.',
      },
      {
        key: 'archive_agent',
        label: 'Archive agent',
        description: 'Prevent future assignment while retaining historical references.',
        requiresConfirmation: true,
      },
    ],
  })

  useEffect(() => {
    const unsubscribe = subscribeAgents(
      (rows) => {
        setAgents(rows)
        setLoading(false)
      },
      () => {
        message.error('The agent registry could not be loaded.')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [message])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'active',
      supportsAssignment: true,
    })
    setOpen(true)
  }

  const openEdit = (agent: AgentDefinition) => {
    setEditing(agent)
    form.setFieldsValue({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      implementationKey: agent.implementationKey,
      capabilities: agent.capabilities,
      status: agent.status === 'archived' ? 'inactive' : agent.status,
      supportsAssignment: agent.supportsAssignment,
    })
    setOpen(true)
  }

  const applyImplementationDefaults = (
    implementationKey: AgentImplementationKey,
  ) => {
    const implementation = getAgentImplementation(implementationKey)
    if (!implementation) return

    const currentCapabilities = form.getFieldValue('capabilities')
    if (!Array.isArray(currentCapabilities) || !currentCapabilities.length) {
      form.setFieldValue(
        'capabilities',
        implementation.defaultCapabilities,
      )
    }
  }

  const save = async (values: AgentFormValues) => {
    if (!user) {
      message.error('You must be signed in to manage agents.')
      return
    }

    const implementation = getAgentImplementation(values.implementationKey)
    if (!implementation) {
      message.error('The selected implementation is not supported.')
      return
    }

    const payload: AgentRegistryInput = {
      name: values.name,
      description: values.description,
      implementationKey: implementation.key,
      workspacePath: implementation.workspacePath,
      capabilities: values.capabilities,
      provider: implementation.provider,
      executionMode: implementation.executionMode,
      status: values.status,
      supportsAssignment: values.supportsAssignment,
      supportsVoice: implementation.supportsVoice,
      supportsDocuments: implementation.supportsDocuments,
      billable: implementation.billable,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateAgent(editing.id, payload, user)
        message.success(`${values.name} was updated.`)
      } else {
        await createAgent(values.id, payload, user)
        message.success(`${values.name} was registered.`)
      }

      setOpen(false)
      setEditing(null)
      form.resetFields()
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : 'The agent could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = (agent: AgentDefinition) => {
    if (!user) return

    modal.confirm({
      title: `Archive ${agent.name}?`,
      content:
        'The agent will no longer be assignable or available to companies. Historical assignments will retain their agent reference.',
      okText: 'Archive agent',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await archiveAgent(agent.id, user)
          message.success(`${agent.name} was archived.`)
        } catch {
          message.error('The agent could not be archived.')
        }
      },
    })
  }

  if (loading) return <LoadingOverlay tip="Loading agent registry" />

  return (
    <DashboardPage className="agent-registry-page">
      <DashboardHeaderCard
        title="Agent registry"
        subtitle="Register supported platform and outsourced agent implementations before enabling them for companies."
        extraRight={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add agent
          </Button>
        }
      />

      <section className="agent-registry-metrics">
        <div>
          <RobotOutlined />
          <strong>{metrics.total}</strong>
          <span>Registered</span>
        </div>
        <div>
          <SafetyCertificateOutlined />
          <strong>{metrics.active}</strong>
          <span>Active</span>
        </div>
        <div>
          <ApiOutlined />
          <strong>{metrics.external}</strong>
          <span>External</span>
        </div>
        <div>
          <DollarOutlined />
          <strong>{metrics.billable}</strong>
          <span>Billable</span>
        </div>
      </section>

      {!agents.length ? (
        <Empty
          description="No agents have been registered."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Register first agent
          </Button>
        </Empty>
      ) : (
        <Row gutter={[18, 18]}>
          {agents.map((agent) => (
            <Col xs={24} xl={12} key={agent.id}>
              <Card className={`agent-registry-card is-${agent.status}`}>
                <div className="agent-registry-card-head">
                  <div className="agent-registry-card-icon">
                    <RobotOutlined />
                  </div>
                  <div className="agent-registry-card-title">
                    <Typography.Title level={5}>{agent.name}</Typography.Title>
                    <Space size={[6, 6]} wrap>
                      <Tag color={statusColour(agent.status)}>
                        {agent.status}
                      </Tag>
                      <Tag color={agent.executionMode === 'external_api' ? 'blue' : 'default'}>
                        {agent.executionMode === 'external_api'
                          ? 'External API'
                          : 'Platform'}
                      </Tag>
                      <Tag>{agent.provider}</Tag>
                    </Space>
                  </div>
                </div>

                <Typography.Paragraph className="agent-registry-description">
                  {agent.description}
                </Typography.Paragraph>

                <div className="agent-registry-feature-row">
                  <Tag icon={<CloudServerOutlined />}>
                    {agent.implementationKey}
                  </Tag>
                  {agent.supportsDocuments && (
                    <Tag icon={<FileWordOutlined />}>Documents</Tag>
                  )}
                  {agent.supportsVoice && (
                    <Tag icon={<SoundOutlined />}>Voice</Tag>
                  )}
                  {agent.billable && (
                    <Tag color="gold" icon={<DollarOutlined />}>
                      Billable
                    </Tag>
                  )}
                </div>

                <div className="agent-registry-capabilities">
                  <div className="agent-registry-capability-label">
                    <ThunderboltOutlined /> Capabilities
                  </div>
                  <Space size={[6, 6]} wrap>
                    {agent.capabilities.map((capability) => (
                      <Tag key={capability}>{capability}</Tag>
                    ))}
                  </Space>
                </div>

                <div className="agent-registry-card-footer">
                  <Typography.Text type="secondary">
                    {agent.status === 'active' && agent.supportsAssignment
                      ? 'Available for company enablement and intervention assignment.'
                      : 'Not available for new company assignments.'}
                  </Typography.Text>
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEdit(agent)}>
                      Edit
                    </Button>
                    {agent.status !== 'archived' && (
                      <Button
                        danger
                        icon={<InboxOutlined />}
                        onClick={() => confirmArchive(agent)}
                      >
                        Archive
                      </Button>
                    )}
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={open}
        title={editing ? 'Update agent' : 'Register agent'}
        onCancel={() => {
          if (saving) return
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form<AgentFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={save}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="id"
                label="Agent key"
                tooltip="Stable key used by assignments and company settings. It cannot be changed after creation."
                rules={[
                  { required: true, message: 'Enter an agent key.' },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: 'Use lowercase letters, numbers, and hyphens only.',
                  },
                ]}
              >
                <Input
                  disabled={Boolean(editing)}
                  placeholder="pitch-coach"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="implementationKey"
                label="Implementation"
                rules={[{ required: true, message: 'Select an implementation.' }]}
              >
                <Select
                  disabled={Boolean(editing)}
                  placeholder="Select supported implementation"
                  options={AGENT_IMPLEMENTATIONS.map((implementation) => ({
                    value: implementation.key,
                    label: implementation.label,
                  }))}
                  onChange={applyImplementationDefaults}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="name"
                label="Agent name"
                rules={[{ required: true, message: 'Enter the agent name.' }]}
              >
                <Input placeholder="Pitch Preparation Agent" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="description"
                label="Description"
                rules={[{ required: true, message: 'Enter a description.' }]}
              >
                <TextArea
                  rows={4}
                  maxLength={700}
                  showCount
                  placeholder="Explain what the agent does for participants and operations."
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="capabilities"
                label="Capabilities"
                rules={[
                  {
                    required: true,
                    type: 'array',
                    min: 1,
                    message: 'Add at least one capability.',
                  },
                ]}
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',']}
                  placeholder="Type a capability and press Enter"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="status"
                label="Registry status"
                rules={[{ required: true }]}
              >
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="supportsAssignment"
                label="Allow intervention assignment"
                valuePropName="checked"
              >
                <Switch checkedChildren="Allowed" unCheckedChildren="Blocked" />
              </Form.Item>
            </Col>
          </Row>

          <div className="agent-registry-modal-footer">
            <Button
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editing ? 'Save changes' : 'Register agent'}
            </Button>
          </div>
        </Form>
      </Modal>
    </DashboardPage>
  )
}

export default AgentRegistryPage
