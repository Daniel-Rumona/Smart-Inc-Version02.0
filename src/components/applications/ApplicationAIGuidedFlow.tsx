import { useState } from 'react'
import { Avatar, Button, Card, DatePicker, Input, Select, Space, Tag, Typography, Upload, message } from 'antd'
import {
    CalendarOutlined,
    CheckCircleOutlined,
    FileDoneOutlined,
    RobotOutlined,
    SendOutlined,
    UploadOutlined,
    UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type {
    ApplicationAIResponse,
    ApplicationConversationMessage,
    ApplicationFormValues,
    ProgramDocumentRequirement,
    ProgramIntervention,
    ProgramInterventionGroup,
    ProgramQuestion,
} from '@/types/application'
import { useLanguage } from '@/providers/LanguageProvider'

const { Text, Paragraph } = Typography

const AGENT_API_BASE_URL = String(import.meta.env.VITE_AGENT_API_BASE_URL || '').replace(/\/$/, '')
const AGENT_SHARED_SECRET = String(import.meta.env.VITE_AGENT_SHARED_SECRET || '').trim()

type Props = {
    values: ApplicationFormValues
    onValuesChange: (patch: Partial<ApplicationFormValues>) => void
    programQuestions: ProgramQuestion[]
    documents: ProgramDocumentRequirement[]
    onDocumentsChange: (documents: ProgramDocumentRequirement[]) => void
    programId?: string | null
    programName?: string | null
    complianceScore: number
    isForcedInterventionProgram: boolean
    forcedInterventions: ProgramIntervention[]
    interventionGroups: ProgramInterventionGroup[]
    interventionSelections: Record<string, string[]>
    onInterventionSelectionsChange: (value: Record<string, string[]>) => void
}

function parsePossibleJson(value: unknown): ApplicationAIResponse | null {
    if (!value || typeof value !== 'string') return null
    const trimmed = value.trim()
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null

    try {
        return JSON.parse(trimmed.slice(start, end + 1)) as ApplicationAIResponse
    } catch {
        return null
    }
}

function normalizeAIResponse(payload: unknown): ApplicationAIResponse {
    const raw = payload as ApplicationAIResponse & {
        reply?: string
        result?: ApplicationAIResponse
        data?: ApplicationAIResponse
        insights?: ApplicationAIResponse
    }

    if (raw?.result) return normalizeAIResponse(raw.result)
    if (raw?.data) return normalizeAIResponse(raw.data)
    if (raw?.insights) return normalizeAIResponse(raw.insights)

    const parsedMessage = parsePossibleJson(raw?.assistantMessage)
    if (parsedMessage) return normalizeAIResponse(parsedMessage)

    const parsedReply = parsePossibleJson(raw?.reply)
    if (parsedReply) return normalizeAIResponse(parsedReply)

    return {
        ok: raw?.ok ?? true,
        assistantMessage:
            raw?.assistantMessage && !String(raw.assistantMessage).trim().startsWith('{')
                ? raw.assistantMessage
                : raw?.reply && !String(raw.reply).trim().startsWith('{')
                    ? raw.reply
                    : 'I updated what I could. Let us continue with the next missing item.',
        flatFields: raw?.flatFields || {},
        programAnswers: raw?.programAnswers || {},
        missingFields: Array.isArray(raw?.missingFields) ? raw.missingFields : [],
        followUpQuestions: Array.isArray(raw?.followUpQuestions) ? raw.followUpQuestions : [],
        documentPrompt: raw?.documentPrompt || null,
        completedSections: Array.isArray(raw?.completedSections) ? raw.completedSections : [],
        confidence: typeof raw?.confidence === 'number' ? raw.confidence : undefined,
        model: raw?.model,
    }
}

function cleanPatch(values?: Partial<ApplicationFormValues>) {
    if (!values) return {}
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ''),
    ) as Partial<ApplicationFormValues>
}

function formatFieldLabel(field?: string) {
    if (!field) return 'Question'
    const labels: Record<string, string> = {
        motivation: 'Motivation',
        challenges: 'Challenges',
        beneficiaryName: 'Business name',
        participantName: 'Owner name',
        natureOfBusiness: 'Nature of business',
        businessAddress: 'Business address',
        dateOfRegistration: 'Date of registration',
        registrationNumber: 'Registration number',
        yearsOfTrading: 'Years of trading',
    }
    return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
}

async function callGuidedApplicationAI(input: {
    rawMessage: string
    values: ApplicationFormValues
    programQuestions: ProgramQuestion[]
    documents: ProgramDocumentRequirement[]
    complianceScore: number
    programId?: string | null
    programName?: string | null
    conversationHistory: ApplicationConversationMessage[]
    isForcedInterventionProgram: boolean
    forcedInterventions: ProgramIntervention[]
    interventionGroups: ProgramInterventionGroup[]
    interventionSelections: Record<string, string[]>
    uiLanguage: string
}) {
    if (!AGENT_API_BASE_URL) throw new Error('Agent API base URL is not configured')

    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (AGENT_SHARED_SECRET) headers.Authorization = `Bearer ${AGENT_SHARED_SECRET}`

    const response = await fetch(`${AGENT_API_BASE_URL}/api/applications/guided-dump`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            rawMessage: input.rawMessage,
            currentValues: input.values,
            programId: input.programId,
            programName: input.programName,
            uiLanguage: input.uiLanguage,
            languageInstruction:
                'Use the current UI language by default. If the user writes in another language or mixes languages, respond naturally using the same language mix. Do not switch to isiZulu unless the user used isiZulu or the UI language is isiZulu.',
            programQuestions: input.programQuestions,
            documentRequirements: input.documents.map((item) => ({
                requirementId: item.requirementId,
                type: item.type,
                description: item.description,
                isRequired: item.isRequired !== false,
                requiresExpiry: item.requiresExpiry,
                allowedFormats: item.allowedFormats || ['pdf', 'jpg', 'jpeg', 'png'],
                maxSizeMB: item.maxSizeMB || 10,
                hasFile: Boolean(item.file || item.uploadedUrl),
                expiryDate: item.expiryDate || null,
            })),
            complianceScore: input.complianceScore,
            conversationHistory: input.conversationHistory.slice(-12),
            flowRules: {
                profileAlreadyCaptured: true,
                doNotAskForProfileFieldsAgain: true,
                hasProgramQuestions: input.programQuestions.length > 0,
                hasDocuments: input.documents.length > 0,
                isForcedInterventionProgram: input.isForcedInterventionProgram,
                forcedInterventions: input.forcedInterventions.map((item) => ({
                    id: item.id,
                    title: item.title,
                    area: item.area,
                })),
                availableInterventions: input.interventionGroups.flatMap((group) => group.interventions.map((item) => ({ id: item.id, title: item.title, area: group.area }))),
                selectedInterventionIds: Object.values(input.interventionSelections).flat(),
                allowSmeInterventionSelection: !input.isForcedInterventionProgram,
            },
            allowSmeInterventionSelection: !input.isForcedInterventionProgram,
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'AI guided application failed')
    }

    return normalizeAIResponse(await response.json())
}

export default function ApplicationAIGuidedFlow({
    values,
    onValuesChange,
    programQuestions,
    documents,
    onDocumentsChange,
    programId,
    programName,
    complianceScore,
    isForcedInterventionProgram,
    forcedInterventions,
    interventionGroups,
    interventionSelections,
    onInterventionSelectionsChange,
}: Props) {
    const { language } = useLanguage()
    const [loading, setLoading] = useState(false)
    const [draft, setDraft] = useState('')
    const [followUps, setFollowUps] = useState<ApplicationAIResponse['followUpQuestions']>([])
    const [documentPrompt, setDocumentPrompt] = useState<ApplicationAIResponse['documentPrompt']>(null)
    const [model, setModel] = useState<string>()
    const [conversation, setConversation] = useState<ApplicationConversationMessage[]>([
        {
            role: 'assistant',
            content: 'I have your saved business profile. Let’s complete this programme application together, one question at a time. Why would you like to join this programme?',
        },
    ])

    const applyResponse = (result: ApplicationAIResponse, answeredField?: string) => {
        const normalized = normalizeAIResponse(result)
        const fieldPatch = cleanPatch(normalized.flatFields)
        const programAnswers = normalized.programAnswers || {}

        onValuesChange({
            ...fieldPatch,
            profile: { ...(values.profile || {}), ...programAnswers },
        })

        setFollowUps(normalized.followUpQuestions || [])
        setDocumentPrompt(normalized.documentPrompt || null)
        if (normalized.model) setModel(normalized.model)

        const nextQuestion = normalized.followUpQuestions?.[0]?.question || normalized.documentPrompt?.question
        const content = normalized.assistantMessage || (answeredField
            ? nextQuestion
                ? `Got it. I updated ${formatFieldLabel(answeredField)}. Next: ${nextQuestion}`
                : `Got it. I updated ${formatFieldLabel(answeredField)}. Please review before submitting.`
            : 'I updated the application details. Let us continue with the next item.')

        setConversation((current) => [...current, { role: 'assistant', content }])
    }

    const sendToAI = async (
        messageText: string,
        answeredField?: string,
        answeredValue?: unknown,
        selectionOverride?: Record<string, string[]>,
    ) => {
        const cleanMessage = messageText.trim()
        if (!cleanMessage) return

        const nextConversation: ApplicationConversationMessage[] = [
            ...conversation,
            { role: 'user', content: cleanMessage, field: answeredField },
        ]

        setConversation(nextConversation)
        setDraft('')

        try {
            setLoading(true)
            let requestValues = values
            if (answeredField?.startsWith('profile.')) {
                const profileKey = answeredField.replace('profile.', '')
                requestValues = { ...values, profile: { ...(values.profile || {}), [profileKey]: answeredValue } }
            } else if (answeredField && answeredField !== 'selectedInterventionIds') {
                requestValues = { ...values, [answeredField]: answeredValue }
            }

            const result = await callGuidedApplicationAI({
                rawMessage: cleanMessage,
                values: requestValues,
                programQuestions,
                documents,
                complianceScore,
                programId,
                programName,
                conversationHistory: nextConversation,
                isForcedInterventionProgram,
                forcedInterventions,
                interventionGroups,
                interventionSelections: selectionOverride || interventionSelections,
                uiLanguage: language,
            })
            applyResponse(result, answeredField)
        } catch (error) {
            console.error(error)
            const text = error instanceof Error ? error.message : ''
            if (text.includes('503') || text.toLowerCase().includes('busy') || text.toLowerCase().includes('high demand')) {
                message.warning('The AI model is temporarily busy. Please try again in a moment.')
            } else {
                message.error('AI guided application failed. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    const activeQuestion = followUps?.[0]
    const activeDocument = documentPrompt
        ? documents.find((item) => item.requirementId === documentPrompt.requirementId)
        : undefined

    const answerActiveQuestion = (value: unknown) => {
        if (!activeQuestion) return

        const storedValue = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value : String(value || '')
        const conversationalValue = Array.isArray(storedValue) ? storedValue.join(', ') : storedValue
        if (!conversationalValue.trim()) return

        let nextInterventionSelections: Record<string, string[]> | undefined
        if (activeQuestion.field === 'selectedInterventionIds') {
            const selectedTitles = Array.isArray(storedValue) ? storedValue : [storedValue]
            const nextSelections: Record<string, string[]> = {}
            interventionGroups.forEach((group) => {
                nextSelections[group.area] = group.interventions.filter((item) => selectedTitles.includes(item.title)).map((item) => item.id)
            })
            onInterventionSelectionsChange(nextSelections)
            nextInterventionSelections = nextSelections
        } else if (activeQuestion.field.startsWith('profile.')) {
            const profileKey = activeQuestion.field.replace('profile.', '')
            onValuesChange({ profile: { ...(values.profile || {}), [profileKey]: storedValue } })
        } else {
            onValuesChange({ [activeQuestion.field]: storedValue } as Partial<ApplicationFormValues>)
        }

        setFollowUps((current) => current?.slice(1) || [])
        void sendToAI(conversationalValue, activeQuestion.field, storedValue, nextInterventionSelections)
    }

    const renderQuestionInput = () => {
        if (!activeQuestion) return null

        if (activeQuestion.inputType === 'select') {
            const profileKey = activeQuestion.field.replace('profile.', '')
            const configuredQuestion = programQuestions.find((question) => question.id === profileKey)
            const isInterventionSelection = activeQuestion.field === 'selectedInterventionIds'
            const isMultiSelect = isInterventionSelection || configuredQuestion?.type === 'multi_select'
            return (
                <Space.Compact style={{ width: '100%' }}>
                    <Select
                        mode={isMultiSelect ? 'multiple' : undefined}
                        maxCount={isMultiSelect ? configuredQuestion?.maxSelections : undefined}
                        style={{ flex: 1 }}
                        options={(activeQuestion.options || []).map((item) => ({ label: item, value: item }))}
                        placeholder="Select an answer"
                        onChange={answerActiveQuestion}
                    />
                </Space.Compact>
            )
        }

        if (activeQuestion.inputType === 'date') {
            return <DatePicker style={{ width: '100%' }} onChange={(date) => answerActiveQuestion(date ? date.format('YYYY-MM-DD') : '')} />
        }

        return (
            <Space.Compact style={{ width: '100%' }}>
                <Input.TextArea
                    autoSize={{ minRows: activeQuestion.inputType === 'textarea' ? 3 : 1, maxRows: 5 }}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onPressEnter={(event) => {
                        if (!event.shiftKey) {
                            event.preventDefault()
                            answerActiveQuestion(draft)
                        }
                    }}
                    placeholder="Type your answer"
                />
                <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => answerActiveQuestion(draft)}>
                    Send
                </Button>
            </Space.Compact>
        )
    }

    return (
        <div className="program-application-ai-single">
            <Card className="program-application-ai-card" bordered={false}>
                <div className="program-application-ai-head">
                    <Space>
                        <Avatar icon={<RobotOutlined />} />
                        <div>
                            <Text strong>AI guided application</Text>
                            <Paragraph type="secondary" style={{ margin: 0 }}>
                                Answer naturally. The assistant will guide the application one question at a time.
                            </Paragraph>
                        </div>
                    </Space>

                    <Space wrap>
                        {model ? <Tag>{model}</Tag> : null}
                        <Tag color="processing">AI engine</Tag>
                    </Space>
                </div>

                <div className="program-application-chat-list is-full">
                    {conversation.map((item, index) => (
                        <div key={`${item.role}-${index}`} className={`program-application-chat-row is-${item.role}`}>
                            <Avatar icon={item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />} />
                            <div className="program-application-chat-bubble">
                                <Text>{item.content}</Text>
                            </div>
                        </div>
                    ))}
                </div>

                {activeQuestion ? (
                    <Card size="small" className="program-application-next-card">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Tag>{formatFieldLabel(activeQuestion.field)}</Tag>
                            <Text>{activeQuestion.question}</Text>
                            {renderQuestionInput()}
                        </Space>
                    </Card>
                ) : null}

                {documentPrompt && !activeQuestion ? (
                    <Card size="small" className="program-application-next-card">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Tag icon={<FileDoneOutlined />} color="orange">
                                {documentPrompt.type}
                            </Tag>

                            <Text>{documentPrompt.question}</Text>

                            {activeDocument ? (
                                <>
                                    <Upload
                                        beforeUpload={(file) => {
                                            onDocumentsChange(
                                                documents.map((item) =>
                                                    item.requirementId === activeDocument.requirementId
                                                        ? { ...item, file, status: 'ready' }
                                                        : item,
                                                ),
                                            )
                                            return false
                                        }}
                                        maxCount={1}
                                    >
                                        <Button icon={<UploadOutlined />}>Upload {activeDocument.type}</Button>
                                    </Upload>

                                    {activeDocument.requiresExpiry ? (
                                        <DatePicker
                                            style={{ width: '100%' }}
                                            placeholder="Expiry date"
                                            suffixIcon={<CalendarOutlined />}
                                            value={activeDocument.expiryDate ? dayjs(activeDocument.expiryDate) : null}
                                            onChange={(date) => {
                                                onDocumentsChange(
                                                    documents.map((item) =>
                                                        item.requirementId === activeDocument.requirementId
                                                            ? { ...item, expiryDate: date ? date.format('YYYY-MM-DD') : null }
                                                            : item,
                                                    ),
                                                )
                                            }}
                                        />
                                    ) : null}

                                    <Button
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        onClick={() => {
                                            setDocumentPrompt(null)
                                            void sendToAI(
                                                `Uploaded ${activeDocument.type}${activeDocument.expiryDate ? ` with expiry date ${activeDocument.expiryDate}` : ''
                                                }`,
                                                `document.${activeDocument.requirementId}`,
                                            )
                                        }}
                                    >
                                        Confirm document added
                                    </Button>
                                </>
                            ) : null}
                        </Space>
                    </Card>
                ) : null}

                {!activeQuestion && !documentPrompt ? (
                    <div className="program-application-chat-composer">
                        <Input.TextArea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            autoSize={{ minRows: 2, maxRows: 5 }}
                            onPressEnter={(event) => {
                                if (!event.shiftKey) {
                                    event.preventDefault()
                                    void sendToAI(draft)
                                }
                            }}
                            placeholder="Type your answer or tell the assistant what you want to add..."
                        />

                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            loading={loading}
                            onClick={() => sendToAI(draft)}
                        >
                            Send
                        </Button>
                    </div>
                ) : null}

            </Card>
        </div>
    )
}
