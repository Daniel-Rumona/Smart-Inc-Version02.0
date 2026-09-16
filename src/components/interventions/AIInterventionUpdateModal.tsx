import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Progress, Row, Segmented, Space, Tag, Typography } from 'antd'
import { BulbOutlined, CheckCircleOutlined, FileTextOutlined, RobotOutlined, SaveOutlined, WarningOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { analyseInterventionUpdate } from '@/services/interventionAiService'
import type { AiReview, InterventionRow, ProgressUpdateForm, UpdateMode } from '@/types/interventions'

const { Text, Paragraph } = Typography

type AIInterventionUpdateModalProps = {
  open: boolean
  row?: InterventionRow
  mode: UpdateMode
  saving?: boolean
  onCancel: () => void
  onApply: (values: ProgressUpdateForm, source: UpdateMode) => Promise<void> | void
}

const readinessTag = (review: AiReview) => {
  if (review.completionReadiness === 'ready') return <Tag color="green" icon={<CheckCircleOutlined />}>Ready for completion review</Tag>
  if (review.completionReadiness === 'close') return <Tag color="gold" icon={<BulbOutlined />}>Close to completion</Tag>
  return <Tag icon={<WarningOutlined />}>Needs more work</Tag>
}

export const AIInterventionUpdateModal = ({ open, row, mode, saving, onCancel, onApply }: AIInterventionUpdateModalProps) => {
  const [form] = Form.useForm<ProgressUpdateForm & { sourceText?: string }>()
  const [activeMode, setActiveMode] = useState<UpdateMode>(mode)
  const [review, setReview] = useState<AiReview>()
  const [analysing, setAnalysing] = useState(false)

  const title = useMemo(() => {
    if (!row) return 'Update intervention'
    return activeMode === 'ai' ? `AI update: ${row.title}` : `Manual update: ${row.title}`
  }, [activeMode, row])

  const resetAndClose = () => {
    setReview(undefined)
    setAnalysing(false)
    form.resetFields()
    onCancel()
  }

  const prepareDefaults = () => {
    if (!row) return
    form.setFieldsValue({
      hoursAdded: undefined,
      unitsAdded: undefined,
      progressAfter: row.progress,
      notes: String(row.raw.notes || ''),
      sourceText: '',
    })
    setReview(undefined)
    setActiveMode(mode)
  }

  const runAiReview = async () => {
    if (!row) return
    const sourceText = String(form.getFieldValue('sourceText') || '').trim()
    if (!sourceText) return

    try {
      setAnalysing(true)
      const nextReview = await analyseInterventionUpdate({ sourceText, intervention: row.raw })
      setReview(nextReview)
      form.setFieldsValue({
        hoursAdded: nextReview.suggestedHours,
        unitsAdded: nextReview.suggestedUnits,
        progressAfter: nextReview.suggestedProgress,
        notes: nextReview.polishedNotes,
      })
    } finally {
      setAnalysing(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onCancel={resetAndClose}
      footer={null}
      width={900}
      destroyOnClose
      afterOpenChange={(isOpen) => {
        if (isOpen) prepareDefaults()
      }}
    >
      {row && (
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => onApply(values, activeMode)}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={10}>
                  <Space direction="vertical" size={0}>
                    <Text strong>{row.beneficiaryName}</Text>
                    <Text type="secondary">{row.programmeName || 'Assigned programme'}</Text>
                  </Space>
                </Col>
                <Col xs={24} md={10}>
                  <Progress percent={row.progress} size="small" />
                </Col>
                <Col xs={24} md={4}>
                  <Segmented
                    block
                    value={activeMode}
                    onChange={(value) => {
                      setActiveMode(value as UpdateMode)
                      setReview(undefined)
                    }}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'ai', label: 'AI' },
                    ]}
                  />
                </Col>
              </Row>
            </Card>

            {activeMode === 'ai' && (
              <Card size="small" title={<Space><RobotOutlined /> AI progress assistant</Space>}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Describe the work completed in plain language. The assistant will extract hours, deliverables, progress, blockers, next steps, and evidence suggestions."
                  />

                  <Form.Item
                    name="sourceText"
                    label="Work update"
                    rules={[{ required: true, message: 'Describe what was completed before running AI review.' }]}
                  >
                    <Input.TextArea
                      rows={5}
                      placeholder="Example: Completed 3 hours with the SME, reviewed bookkeeping records, identified missing invoices, and prepared the next action list."
                    />
                  </Form.Item>

                  <Button icon={<RobotOutlined />} onClick={() => void runAiReview()} loading={analysing}>
                    Analyse update
                  </Button>

                  {review && (
                    <Card className="ai-review-card" size="small">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space wrap>
                          <Tag color="blue">Confidence {Math.round(review.confidence || 0)}%</Tag>
                          {review.suggestedProgress != null && <Tag color="green">Suggested progress {review.suggestedProgress}%</Tag>}
                          {readinessTag(review)}
                        </Space>

                        <div>
                          <Text strong>AI summary</Text>
                          <Paragraph style={{ marginBottom: 0 }}>{review.summary}</Paragraph>
                        </div>

                        {review.blockers.length > 0 && (
                          <Alert type="warning" showIcon message="Detected blockers" description={review.blockers.join(' ')} />
                        )}

                        {review.nextSteps.length > 0 && (
                          <div>
                            <Text strong>Recommended next steps</Text>
                            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                              {review.nextSteps.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        )}

                        {review.proofSuggestions.length > 0 && (
                          <div>
                            <Text strong>Suggested evidence</Text>
                            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                              {review.proofSuggestions.map((proof) => (
                                <Col xs={24} md={12} key={proof.id}>
                                  <Card size="small" type="inner">
                                    <Space align="start">
                                      <FileTextOutlined />
                                      <Space direction="vertical" size={0}>
                                        <Text strong>{proof.label}</Text>
                                        <Text type="secondary">{proof.reason}</Text>
                                        {proof.required && <Tag color="red">Required before completion</Tag>}
                                      </Space>
                                    </Space>
                                  </Card>
                                </Col>
                              ))}
                            </Row>
                          </div>
                        )}
                      </Space>
                    </Card>
                  )}
                </Space>
              </Card>
            )}

            <Card size="small" title={activeMode === 'ai' ? 'Review and apply AI output' : 'Manual progress capture'}>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="hoursAdded" label="Hours worked">
                    <InputNumber min={0} step={0.25} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="unitsAdded" label="Units completed">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="progressAfter" label="Progress after" rules={[{ required: true, message: 'Progress is required.' }]}> 
                    <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="notes" label="Final progress notes">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Card>

            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={resetAndClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving || analysing}>
                Apply update
              </Button>
            </Space>
          </Space>
        </Form>
      )}
    </Modal>
  )
}

export default AIInterventionUpdateModal
