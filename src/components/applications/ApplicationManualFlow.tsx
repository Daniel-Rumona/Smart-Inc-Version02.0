import { Alert, Button, Card, Checkbox, Col, Collapse, DatePicker, Form, Input, Row, Select, Space, Tag, Typography, Upload } from 'antd'
import {
    BulbOutlined,
    FileDoneOutlined,
    LinkOutlined,
    ProfileOutlined,
    ToolOutlined,
    UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type {
    ApplicationFormValues,
    ProgramDocumentRequirement,
    ProgramInterventionGroup,
    ProgramQuestion,
} from '@/types/application'

const { Text, Paragraph } = Typography

type ApplicationManualFlowProps = {
    form: ReturnType<typeof Form.useForm<ApplicationFormValues>>[0]
    values?: ApplicationFormValues
    onValuesChange?: (patch: Partial<ApplicationFormValues>) => void
    programQuestions: ProgramQuestion[]
    documents: ProgramDocumentRequirement[]
    onDocumentsChange: (documents: ProgramDocumentRequirement[]) => void
    interventionGroups: ProgramInterventionGroup[]
    interventionSelections: Record<string, string[]>
    onInterventionSelectionsChange: (value: Record<string, string[]>) => void
    showInterventions: boolean
    loadingQuestions?: boolean
    loadingDocuments?: boolean
}

const DEFAULT_ALLOWED_FORMATS = ['pdf', 'jpg', 'jpeg', 'png']

function normalizeQuestionOptions(question: ProgramQuestion) {
    if (Array.isArray(question.options)) return question.options

    if (typeof question.options === 'string') {
        return question.options
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
    }

    return []
}

function renderProgramQuestion(question: ProgramQuestion) {
    const options = normalizeQuestionOptions(question)
    const name = ['profile', question.id]

    const label = question.label || question.question || 'Programme question'
    const required = question.required !== false

    if (question.type === 'multi_select') {
        const maxSelections = Number(question.maxSelections || 0)
        return (
            <Col xs={24} md={12} key={question.id}>
                <Form.Item
                    name={name}
                    label={label}
                    rules={[
                        ...(required ? [{ required: true, message: `Please answer: ${label}` }] : []),
                        ...(maxSelections ? [{ validator: (_: unknown, value?: string[]) => !value || value.length <= maxSelections ? Promise.resolve() : Promise.reject(new Error(`Choose no more than ${maxSelections} answers.`)) }] : []),
                    ]}
                >
                    <Select mode="multiple" allowClear maxCount={maxSelections || undefined} placeholder="Select one or more answers" options={options.map((item) => ({ label: item, value: item }))} />
                </Form.Item>
            </Col>
        )
    }

    if (question.type === 'dropdown' || question.type === 'select' || question.type === 'single_select') {
        return (
            <Col xs={24} md={12} key={question.id}>
                <Form.Item
                    name={name}
                    label={label}
                    rules={required ? [{ required: true, message: `Please answer: ${label}` }] : []}
                >
                    <Select
                        allowClear
                        placeholder="Select an answer"
                        options={options.map((item) => ({ label: item, value: item }))}
                    />
                </Form.Item>
            </Col>
        )
    }

    if (question.type === 'textarea' || question.type === 'longText' || question.type === 'long_text') {
        return (
            <Col xs={24} key={question.id}>
                <Form.Item
                    name={name}
                    label={label}
                    rules={required ? [{ required: true, message: `Please answer: ${label}` }] : []}
                >
                    <Input.TextArea rows={4} placeholder="Type your answer" />
                </Form.Item>
            </Col>
        )
    }

    return (
        <Col xs={24} md={12} key={question.id}>
            <Form.Item
                name={name}
                label={label}
                rules={required ? [{ required: true, message: `Please answer: ${label}` }] : []}
            >
                <Input placeholder="Type your answer" />
            </Form.Item>
        </Col>
    )
}

export default function ApplicationManualFlow({
    form,
    onValuesChange,
    programQuestions,
    documents,
    onDocumentsChange,
    interventionGroups,
    interventionSelections,
    onInterventionSelectionsChange,
    showInterventions,
    loadingQuestions = false,
    loadingDocuments = false,
}: ApplicationManualFlowProps) {
    const updateDocument = (requirementId: string, patch: Partial<ProgramDocumentRequirement>) => {
        onDocumentsChange(
            documents.map((item) =>
                item.requirementId === requirementId
                    ? {
                        ...item,
                        ...patch,
                    }
                    : item,
            ),
        )
    }

    return (
        <Form
            form={form}
            layout="vertical"
        requiredMark
        preserve
        className="program-application-manual-form"
        onValuesChange={(_, allValues) => onValuesChange?.(allValues)}
        >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                    type="info"
                    showIcon
                    message="Your applicant profile is already linked"
                    description="This application uses your saved profile and business details. Only programme-specific information is needed here."
                />

                <Card
                    bordered={false}
                    className="program-application-section-card"
                    title={
                        <Space>
                            <BulbOutlined />
                            Application motivation
                        </Space>
                    }
                >
                    <Row gutter={[14, 14]}>
                        <Col xs={24}>
                            <Form.Item
                                name="motivation"
                                label="Why do you want to join this programme?"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Please provide your motivation',
                                    },
                                    {
                                        min: 80,
                                        message: 'Please give enough detail for the review team to understand your motivation',
                                    },
                                ]}
                            >
                                <Input.TextArea
                                    rows={5}
                                    placeholder="Explain what support your business needs, what you hope to improve, and how the programme can help."
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item
                                name="challenges"
                                label="What are your main business challenges?"
                                rules={[{ required: true, message: 'Please describe your main business challenges' }]}
                            >
                                <Input.TextArea
                                    rows={4}
                                    placeholder="For example: equipment, funding, compliance, market access, bookkeeping, staffing, operations..."
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card
                    bordered={false}
                    className="program-application-section-card"
                    title={
                        <Space>
                            <LinkOutlined />
                            Online presence
                        </Space>
                    }
                >
                    <Row gutter={[14, 14]}>
                        <Col xs={24} md={8}>
                            <Form.Item name="facebook" label="Facebook">
                                <Select
                                    allowClear
                                    placeholder="Do you use Facebook?"
                                    options={[
                                        { label: 'Yes', value: 'Yes' },
                                        { label: 'No', value: 'No' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item name="instagram" label="Instagram">
                                <Select
                                    allowClear
                                    placeholder="Do you use Instagram?"
                                    options={[
                                        { label: 'Yes', value: 'Yes' },
                                        { label: 'No', value: 'No' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item name="linkedIn" label="LinkedIn">
                                <Select
                                    allowClear
                                    placeholder="Do you use LinkedIn?"
                                    options={[
                                        { label: 'Yes', value: 'Yes' },
                                        { label: 'No', value: 'No' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {loadingQuestions || programQuestions.length > 0 ? (
                    <Card
                        bordered={false}
                        loading={loadingQuestions}
                        className="program-application-section-card"
                        title={
                            <Space>
                                <ProfileOutlined />
                                Programme questions
                            </Space>
                        }
                    >
                        {programQuestions.length ? (
                            <Row gutter={[14, 14]}>
                                {programQuestions.map((question) => renderProgramQuestion(question))}
                            </Row>
                        ) : (
                            <Text type="secondary">No programme questions are required.</Text>
                        )}
                    </Card>
                ) : null}

                {loadingDocuments || documents.length > 0 ? (
                    <Card
                        bordered={false}
                        loading={loadingDocuments}
                        className="program-application-section-card"
                        title={
                            <Space>
                                <FileDoneOutlined />
                                Required documents
                            </Space>
                        }
                    >
                        {documents.length ? (
                            <Row gutter={[12, 12]}>
                                {documents.map((document) => {
                                    const allowedFormats = document.allowedFormats?.length
                                        ? document.allowedFormats
                                        : DEFAULT_ALLOWED_FORMATS

                                    return (
                                        <Col xs={24} key={document.requirementId}>
                                            <Card size="small" className="program-application-document-card">
                                                <Row gutter={[12, 12]} align="middle">
                                                    <Col xs={24} lg={10}>
                                                        <Space direction="vertical" size={4}>
                                                            <Space wrap>
                                                                <Text strong>{document.type}</Text>
                                                                {document.isRequired !== false ? (
                                                                    <Tag color="red">Required</Tag>
                                                                ) : (
                                                                    <Tag color="blue">Optional</Tag>
                                                                )}
                                                                {document.requiresExpiry ? <Tag color="orange">Expiry needed</Tag> : null}
                                                            </Space>

                                                            {document.description ? (
                                                                <Paragraph type="secondary" style={{ margin: 0 }}>
                                                                    {document.description}
                                                                </Paragraph>
                                                            ) : null}

                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                {allowedFormats.join(', ').toUpperCase()} · Max {document.maxSizeMB || 10} MB
                                                            </Text>
                                                        </Space>
                                                    </Col>

                                                    <Col xs={24} lg={8}>
                                                        <Upload
                                                            beforeUpload={(file) => {
                                                                updateDocument(document.requirementId, {
                                                                    file,
                                                                    status: 'ready',
                                                                })
                                                                return false
                                                            }}
                                                            fileList={
                                                                document.file
                                                                    ? [
                                                                        {
                                                                            uid: document.requirementId,
                                                                            name: document.file.name,
                                                                            status: 'done',
                                                                        },
                                                                    ]
                                                                    : []
                                                            }
                                                            onRemove={() => {
                                                                updateDocument(document.requirementId, {
                                                                    file: null,
                                                                    status: 'missing',
                                                                })
                                                            }}
                                                            maxCount={1}
                                                        >
                                                            <Button block icon={<UploadOutlined />}>
                                                                Upload document
                                                            </Button>
                                                        </Upload>
                                                    </Col>

                                                    <Col xs={24} lg={6}>
                                                        {document.requiresExpiry ? (
                                                            <DatePicker
                                                                style={{ width: '100%' }}
                                                                placeholder="Expiry date"
                                                                value={document.expiryDate ? dayjs(document.expiryDate) : null}
                                                                onChange={(date) => {
                                                                    updateDocument(document.requirementId, {
                                                                        expiryDate: date ? date.format('YYYY-MM-DD') : null,
                                                                    })
                                                                }}
                                                            />
                                                        ) : (
                                                            <Text type="secondary">No expiry date required</Text>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Card>
                                        </Col>
                                    )
                                })}
                            </Row>
                        ) : (
                            <Text type="secondary">No document requirements are configured for this programme.</Text>
                        )}
                    </Card>
                ) : null}

                {showInterventions ? (
                    <Card
                        bordered={false}
                        className="program-application-section-card"
                        title={
                            <Space>
                                <ToolOutlined />
                                Support interventions
                            </Space>
                        }
                    >
                        <Paragraph type="secondary">
                            Select the support areas that best match what your business needs. You can choose up to 8.
                        </Paragraph>

                        {interventionGroups.length ? (
                            <Collapse>
                                {interventionGroups.map((group) => (
                                    <Collapse.Panel header={group.area} key={group.area}>
                                        <Checkbox.Group
                                            value={interventionSelections[group.area] || []}
                                            onChange={(nextValue) => {
                                                const currentSelection = nextValue as string[]

                                                const totalSelected = Object.entries(interventionSelections).reduce(
                                                    (total, [area, selections]) => {
                                                        if (area === group.area) return total
                                                        return total + selections.length
                                                    },
                                                    currentSelection.length,
                                                )

                                                if (totalSelected > 8) return

                                                onInterventionSelectionsChange({
                                                    ...interventionSelections,
                                                    [group.area]: currentSelection,
                                                })
                                            }}
                                        >
                                            <Space direction="vertical">
                                                {group.interventions.map((intervention) => (
                                                    <Checkbox key={intervention.id} value={intervention.id}>
                                                        {intervention.title}
                                                    </Checkbox>
                                                ))}
                                            </Space>
                                        </Checkbox.Group>
                                    </Collapse.Panel>
                                ))}
                            </Collapse>
                        ) : (
                            <Text type="secondary">No optional interventions are available for selection.</Text>
                        )}
                    </Card>
                ) : null}
            </Space>
        </Form>
    )
}
