import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  DollarOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import DashboardPage from '@/components/shared/DashboardPage'
import { DashboardHeaderCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import {
  listWorkspaceCompanies,
  type WorkspaceCompany,
} from '@/services/companiesService'
import {
  getCompanyAgentSettings,
  saveCompanyAgentSettings,
} from '@/services/agentOrchestrationService'
import { subscribeAgents } from '@/services/agentRegistryService'
import type {
  AgentDefinition,
  AgentId,
} from '@/types/agentOrchestration'
import { useRegisterAgentPageContext } from '@/shared/hooks/useRegisterAgentPageContext'
import '@/styles/agent-availability.css'

const AgentAvailabilityPage = () => {
  const { message } = App.useApp()
  const { user } = useFullIdentity()
  const [companies, setCompanies] = useState<WorkspaceCompany[]>([])
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [companyCode, setCompanyCode] = useState<string>()
  const [enabled, setEnabled] = useState<AgentId[]>([])
  const [savedEnabled, setSavedEnabled] = useState<AgentId[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingCatalogue, setLoadingCatalogue] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedCompany = useMemo(
    () => companies.find((company) => company.code === companyCode),
    [companies, companyCode],
  )

  const activeAgents = useMemo(
    () => agents.filter((agent) => agent.status === 'active'),
    [agents],
  )

  const hasChanges = useMemo(
    () =>
      [...enabled].sort().join('|') !==
      [...savedEnabled].sort().join('|'),
    [enabled, savedEnabled],
  )

  const enabledPercent = activeAgents.length
    ? Math.round((enabled.length / activeAgents.length) * 100)
    : 0

  useRegisterAgentPageContext({
    pageKey: 'admin-agent-availability',
    pageName: 'Agent availability',
    purpose: 'Controls which centrally registered agents each company may use.',
    currentFilters: { companyCode },
    metrics: {
      registeredAgents: activeAgents.length,
      enabledAgents: enabled.length,
    },
  })

  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        const rows = await listWorkspaceCompanies(user)
        setCompanies(rows)
        setCompanyCode((current) => current || rows[0]?.code)
      } catch {
        message.error('Companies could not be loaded.')
      } finally {
        setLoadingCompanies(false)
      }
    }

    void load()
  }, [message, user])

  useEffect(() => {
    const unsubscribe = subscribeAgents(
      (rows) => {
        setAgents(rows)
        setLoadingCatalogue(false)
      },
      () => {
        message.error('Agent catalogue could not be loaded.')
        setLoadingCatalogue(false)
      },
    )

    return unsubscribe
  }, [message])

  useEffect(() => {
    if (!companyCode || loadingCatalogue) return

    let active = true
    void Promise.resolve().then(() => setLoadingSettings(true))

    void getCompanyAgentSettings(companyCode, activeAgents)
      .then((settings) => {
        if (!active) return
        setEnabled(settings.enabledAgentIds)
        setSavedEnabled(settings.enabledAgentIds)
      })
      .catch(() => {
        if (active) message.error('Agent availability could not be loaded.')
      })
      .finally(() => {
        if (active) setLoadingSettings(false)
      })

    return () => {
      active = false
    }
  }, [activeAgents, companyCode, loadingCatalogue, message])

  const save = async () => {
    if (!user || !companyCode) return

    setSaving(true)
    try {
      await saveCompanyAgentSettings(companyCode, enabled, user)
      setSavedEnabled(enabled)
      message.success(
        `Agent availability saved for ${selectedCompany?.name || companyCode}.`,
      )
    } catch {
      message.error('Agent availability could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingCompanies || loadingCatalogue) {
    return <LoadingOverlay tip="Loading agent catalogue" />
  }

  return (
    <DashboardPage className="agent-availability-page">
      <DashboardHeaderCard
        title="Agent availability"
        subtitle="Control which approved AI agents each company can use for intervention delivery."
        extraRight={
          <Tag icon={<SafetyCertificateOutlined />} color="purple">
            System administration
          </Tag>
        }
      />

      <section className="agent-company-panel">
        <div className="agent-company-icon">
          <ApartmentOutlined />
        </div>

        <div className="agent-company-picker">
          <Typography.Text className="agent-admin-eyebrow">
            ACTIVE COMPANY
          </Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            value={companyCode}
            loading={loadingSettings}
            placeholder="Select a company"
            options={companies.map((company) => ({
              value: company.code,
              label: `${company.name} (${company.code})`,
            }))}
            onChange={setCompanyCode}
          />
          <Typography.Text type="secondary">
            Changes apply only to the selected company.
          </Typography.Text>
        </div>

        <div className="agent-company-summary">
          <div>
            <strong>{enabled.length}</strong>
            <span>Enabled</span>
          </div>
          <div>
            <strong>{Math.max(activeAgents.length - enabled.length, 0)}</strong>
            <span>Unavailable</span>
          </div>
          <div>
            <strong>{enabledPercent}%</strong>
            <span>Coverage</span>
          </div>
        </div>
      </section>

      {!companyCode ? (
        <Empty description="Select a company to configure its agents." />
      ) : !activeAgents.length ? (
        <Empty description="No active agents are registered. Add agents in the Agent Registry first." />
      ) : (
        <div className={`agent-catalogue ${loadingSettings ? 'is-loading' : ''}`}>
          <div className="agent-catalogue-heading">
            <div>
              <Typography.Title level={4}>
                Available agent catalogue
              </Typography.Title>
              <Typography.Text type="secondary">
                Enable only the agents this company is approved to offer its participants.
              </Typography.Text>
            </div>
            <Tag>{activeAgents.length} registered agents</Tag>
          </div>

          <Row gutter={[18, 18]}>
            {activeAgents.map((agent) => {
              const isEnabled = enabled.includes(agent.id)

              return (
                <Col xs={24} lg={12} key={agent.id}>
                  <Card
                    className={`motion-card agent-catalogue-card ${
                      isEnabled ? 'is-enabled' : ''
                    }`}
                  >
                    <div className="agent-card-topline">
                      <div className="agent-card-identity">
                        <div className="agent-card-icon">
                          <RobotOutlined />
                        </div>
                        <div>
                          <Typography.Title level={5}>
                            {agent.name}
                          </Typography.Title>
                          <span
                            className={`agent-status-label ${
                              isEnabled ? 'is-enabled' : ''
                            }`}
                          >
                            {isEnabled && <CheckCircleFilled />}
                            {isEnabled
                              ? ' Available to company'
                              : ' Not available'}
                          </span>
                        </div>
                      </div>

                      <Switch
                        aria-label={`Toggle ${agent.name}`}
                        checked={isEnabled}
                        checkedChildren="On"
                        unCheckedChildren="Off"
                        onChange={(checked) =>
                          setEnabled((current) =>
                            checked
                              ? [...new Set([...current, agent.id])]
                              : current.filter((id) => id !== agent.id),
                          )
                        }
                      />
                    </div>

                    <div className="agent-provider-row">
                      <Tag color={agent.executionMode === 'external_api' ? 'blue' : 'default'}>
                        {agent.executionMode === 'external_api'
                          ? 'External provider'
                          : 'Platform agent'}
                      </Tag>
                      {agent.billable && (
                        <Tag color="gold" icon={<DollarOutlined />}>
                          Usage-based credits
                        </Tag>
                      )}
                    </div>

                    <Typography.Paragraph>
                      {agent.description}
                    </Typography.Paragraph>

                    <div className="agent-capability-label">
                      <ThunderboltOutlined /> CAPABILITIES
                    </div>
                    <div className="agent-capability-list">
                      {agent.capabilities.map((capability) => (
                        <Tag key={capability}>{capability}</Tag>
                      ))}
                    </div>

                    <div className="agent-card-footer">
                      <CloudServerOutlined />
                      <span>
                        {!isEnabled
                          ? 'Hidden from intervention delivery setup.'
                          : agent.executionMode === 'external_api'
                            ? 'Operations can assign this agent. Sessions use an approved external provider.'
                            : 'Operations can assign this agent to interventions.'}
                      </span>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>

          <div className={`agent-save-bar ${hasChanges ? 'has-changes' : ''}`}>
            <div>
              <span className="agent-save-state">
                {hasChanges ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <Typography.Text type="secondary">
                {selectedCompany?.name || companyCode} · {enabled.length} of{' '}
                {activeAgents.length} agents enabled
              </Typography.Text>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!hasChanges || loadingSettings}
              onClick={() => void save()}
            >
              Save availability
            </Button>
          </div>
        </div>
      )}
    </DashboardPage>
  )
}

export default AgentAvailabilityPage
