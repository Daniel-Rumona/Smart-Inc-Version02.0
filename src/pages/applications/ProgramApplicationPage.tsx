import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, FloatButton, Form, Grid, Progress, Segmented, Space, Spin, Tag, Typography } from 'antd'
import {
    ArrowLeftOutlined,
    CheckCircleOutlined,
    FormOutlined,
    RobotOutlined,
    SendOutlined,
} from '@ant-design/icons'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import ApplicationAIGuidedFlow from '@/components/applications/ApplicationAIGuidedFlow'
import ApplicationManualFlow from '@/components/applications/ApplicationManualFlow'
import ApplicationReviewPanel from '@/components/applications/ApplicationReviewPanel'
import ApplicationInterventionSelector from '@/components/applications/ApplicationInterventionSelector'
import { getApplicantProfileBundle } from '@/services/applicantService'
import {
    buildSelectedInterventions,
    calculateComplianceScore,
    createProgramApplication,
    getAgeFromIdNumber,
    getMissingDocuments,
    uploadApplicationDocuments,
    updateCurrentUserRoleToIncubatee,
} from '@/services/applicationService'
import {
    DEFAULT_INTERVENTION_POLICY,
    getProgramApplicationSetup,
    listProgramDocumentRequirements,
    listSelectableInterventionGroups,
} from '@/services/programApplicationService'
import type {
    ApplicationFormValues,
    ApplicationInputMode,
    ProgramDocumentRequirement,
    ProgramInterventionGroup,
    ProgramInterventionPolicy,
    ProgramQuestion,
} from '@/types/application'
import '@/styles/program-application.css'

const { Title } = Typography

type ParticipantSummary = {
    id: string
    data: Record<string, unknown>
}

export default function ProgramApplicationPage() {
    const { message } = App.useApp()
    const navigate = useNavigate()
    const screens = Grid.useBreakpoint()
    const { programId } = useParams<{ programId: string }>()
    const [form] = Form.useForm<ApplicationFormValues>()

    const [programName, setProgramName] = useState('')
    const [companyCode, setCompanyCode] = useState('')

    const [mode, setMode] = useState<ApplicationInputMode>('ai')
    const [reviewOpen, setReviewOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [values, setValues] = useState<ApplicationFormValues>({})
    const [participant, setParticipant] = useState<ParticipantSummary | null>(null)
    const [programQuestions, setProgramQuestions] = useState<ProgramQuestion[]>([])
    const [documents, setDocuments] = useState<ProgramDocumentRequirement[]>([])
    const [interventionGroups, setInterventionGroups] = useState<ProgramInterventionGroup[]>([])
    const [interventionSelections, setInterventionSelections] = useState<Record<string, string[]>>({})
    const [interventionPolicy, setInterventionPolicy] = useState<ProgramInterventionPolicy>(DEFAULT_INTERVENTION_POLICY)

    const isMobile = !screens.md

    const isForcedInterventionProgram = interventionPolicy?.mode === 'force_all' || interventionPolicy?.allowSmeSelection === false

    const forcedInterventions = useMemo(() => {
        return Array.isArray(interventionPolicy?.forcedInterventions) ? interventionPolicy.forcedInterventions : []
    }, [interventionPolicy])

    const selectedInterventions = useMemo(() => {
        return buildSelectedInterventions({
            forcedInterventions,
            isForcedInterventionProgram,
            interventionGroups,
            interventionSelections,
        })
    }, [forcedInterventions, interventionGroups, interventionSelections, isForcedInterventionProgram])

    const complianceScore = useMemo(() => calculateComplianceScore(documents), [documents])
    const missingDocuments = useMemo(() => getMissingDocuments(documents), [documents])

    const progressTasks = useMemo(() => {
        const tasks = [
            Boolean(values.motivation?.trim()),
            Boolean(values.challenges?.trim()),
            ...programQuestions.filter((question) => question.required !== false).map((question) => {
                const answer = values.profile?.[question.id]
                return Array.isArray(answer) ? answer.length > 0 : Boolean(String(answer || '').trim())
            }),
            ...documents.filter((document) => document.isRequired !== false).map((document) => Boolean(document.file || document.uploadedUrl)),
            ...(!isForcedInterventionProgram && interventionGroups.length ? [selectedInterventions.length > 0] : []),
        ]
        const complete = tasks.filter(Boolean).length
        return { complete, total: tasks.length, percent: tasks.length ? Math.round((complete / tasks.length) * 100) : 100 }
    }, [documents, interventionGroups.length, isForcedInterventionProgram, programQuestions, selectedInterventions.length, values.challenges, values.motivation, values.profile])

    const updateValues = (patch: Partial<ApplicationFormValues>) => {
        setValues((current) => {
            const next = {
                ...current,
                ...patch,
                profile: patch.profile ? { ...(current.profile || {}), ...patch.profile } : current.profile,
            }
            form.setFieldsValue(next)
            return next
        })
    }

    const resolveProgramContext = useCallback(async () => {
        if (!programId) {
            setProgramName('')
            setCompanyCode('')
            return {
                name: '',
                companyCode: '',
            }
        }

        const programSnap = await getDoc(doc(db, 'programs', programId))

        if (!programSnap.exists()) {
            console.log('Program not found:', programId)

            setProgramName('')
            setCompanyCode('')

            return {
                name: '',
                companyCode: '',
            }
        }

        const data = programSnap.data() as {
            name?: string
            companyCode?: string
        }

        const nextProgramName = String(data.name || '').trim()
        const nextCompanyCode = String(data.companyCode || '').trim()

        setProgramName(nextProgramName)
        setCompanyCode(nextCompanyCode)

        return {
            name: nextProgramName,
            companyCode: nextCompanyCode,
        }
    }, [programId])

    useEffect(() => {
        const loadApplicationContext = async () => {
            try {
                setLoading(true)

                const programContext = await resolveProgramContext()

                const [setup, documentRequirements] = await Promise.all([
                    getProgramApplicationSetup(programId),
                    listProgramDocumentRequirements(programId),
                ])

                setProgramQuestions(setup.programQuestions)
                setInterventionPolicy(setup.interventionPolicy || DEFAULT_INTERVENTION_POLICY)
                setDocuments(documentRequirements)

                const groups = await listSelectableInterventionGroups({
                    programId,
                    companyCode: programContext.companyCode,
                    interventionPolicy: setup.interventionPolicy,
                })
                setInterventionGroups(groups)

                const user = auth.currentUser
                if (user?.email) {
                    const profileBundle = await getApplicantProfileBundle(user.uid, user.email)
                    if (profileBundle) {
                        const participantData = {
                            ...profileBundle.applicantProfile,
                            ...profileBundle.businessProfile,
                        } as unknown as Record<string, unknown>
                        setParticipant({ id: profileBundle.businessProfile.id || user.uid, data: participantData })

                        const seedValues: ApplicationFormValues = {
                            participantName: String(participantData.participantName || user.displayName || ''),
                            email: String(participantData.email || user.email),
                            idNumber: String(participantData.idNumber || ''),
                            gender: String(participantData.gender || ''),
                            phone: String(participantData.phone || ''),
                            beneficiaryName: String(participantData.businessName || ''),
                            sector: String(participantData.sector || ''),
                            natureOfBusiness: String(participantData.natureOfBusiness || ''),
                            registrationNumber: String(participantData.registrationNumber || ''),
                            yearsOfTrading: Number(participantData.yearsOfTrading || 0),
                            businessAddress: String(participantData.businessAddress || ''),
                            province: String(participantData.province || ''),
                            city: String(participantData.city || ''),
                            hub: String(participantData.hub || ''),
                            postalCode: String(participantData.postalCode || ''),
                            location: String(participantData.location || ''),
                        }

                        const age = getAgeFromIdNumber(seedValues.idNumber)
                        if (age) seedValues.age = age

                        setValues(seedValues)
                        form.setFieldsValue(seedValues)
                    } else {
                        const seedValues: ApplicationFormValues = {
                            participantName: user.displayName || '',
                            email: user.email || '',
                        }
                        setValues(seedValues)
                        form.setFieldsValue(seedValues)
                    }
                }
            } catch (error) {
                console.error(error)
                message.error('Failed to load application setup')
            } finally {
                setLoading(false)
            }
        }

        void loadApplicationContext()
    }, [form, message, programId, resolveProgramContext])

    const validateBeforeSubmit = () => {
        if (!values.motivation?.trim() || !values.challenges?.trim()) {
            message.warning('Please complete the motivation and business challenges questions.')
            setReviewOpen(false)
            return false
        }

        const unansweredQuestion = programQuestions.find((question) => {
            if (question.required === false) return false
            const answer = values.profile?.[question.id]
            return Array.isArray(answer) ? !answer.length : !String(answer || '').trim()
        })
        if (unansweredQuestion) {
            message.warning(`Please answer: ${unansweredQuestion.label}`)
            setReviewOpen(false)
            return false
        }

        if (missingDocuments.length) {
            message.warning('Please upload all required programme documents before submitting.')
            return false
        }

        if (!isForcedInterventionProgram && interventionGroups.length && !selectedInterventions.length) {
            message.warning('Please select at least one programme intervention.')
            setReviewOpen(false)
            return false
        }

        return true
    }

    const handleSubmit = async () => {
        if (!validateBeforeSubmit()) return

        try {
            setSubmitting(true)
            const uploadedDocuments = await uploadApplicationDocuments({
                documents,
                companyCode,
                programId,
                participantId: participant?.id,
            })
            setDocuments(uploadedDocuments)

            const nextComplianceScore = calculateComplianceScore(uploadedDocuments)
            if (nextComplianceScore < 10) {
                message.error('Compliance must be 10% or higher before this application can be submitted.')
                return
            }

            await createProgramApplication({
                participantId: participant?.id,
                companyCode,
                programId,
                programName: programName || '',
                applicationStatus: 'pending',
                submittedAt: new Date().toISOString(),
                formValues: values,
                complianceScore: nextComplianceScore,
                complianceDocuments: uploadedDocuments,
                interventions: {
                    required: selectedInterventions,
                    assigned: [],
                    completed: [],
                    participationRate: 0,
                },
            })

            await updateCurrentUserRoleToIncubatee()
            message.success('Application submitted successfully')
            navigate('/applicant/application-tracker')
        } catch (error) {
            console.error(error)
            message.error('Failed to submit application')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="program-application-loading">
                <Spin tip="Loading application setup..." />
            </div>
        )
    }

    return (
        <div className="program-application-page">
            <Card className="program-application-header" bordered={false}>
                <div className="program-application-header-main">
                    <div className="program-application-heading">
                        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
                        <Title level={3} className="program-application-title">
                            {programName || 'Programme application'}
                        </Title>
                    </div>

                    <div className="program-application-header-actions">
                        {!reviewOpen && (
                            <Segmented
                                value={mode}
                                block={isMobile}
                                onChange={(value) => setMode(value as ApplicationInputMode)}
                                options={[
                                    { label: 'AI guided', value: 'ai', icon: <RobotOutlined /> },
                                    { label: 'Manual', value: 'manual', icon: <FormOutlined /> },
                                ]}
                            />
                        )}

                        {reviewOpen ? (
                            <Space.Compact block={isMobile} className="program-application-actions">
                                <Button onClick={() => setReviewOpen(false)}>Back to application</Button>
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    loading={submitting}
                                    onClick={handleSubmit}
                                >
                                    Submit application
                                </Button>
                            </Space.Compact>
                        ) : (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => setReviewOpen(true)}
                            >
                                Continue to review
                            </Button>
                        )}
                    </div>
                </div>

                <div className="program-application-header-progress">
                    <Space wrap>
                        <Typography.Text strong>Application progress</Typography.Text>
                        <Tag color="blue">{progressTasks.complete} of {progressTasks.total} required tasks</Tag>
                        <Tag color={missingDocuments.length ? 'orange' : 'green'}>{missingDocuments.length} required documents outstanding</Tag>
                    </Space>
                    <Progress percent={progressTasks.percent} showInfo={false} />
                </div>
            </Card>

            <div>
                {reviewOpen ? (
                    <ApplicationReviewPanel
                        values={values}
                        documents={documents}
                        complianceScore={complianceScore}
                        selectedInterventions={selectedInterventions}
                        programQuestions={programQuestions}
                    />
                ) : mode === 'ai' ? (
                    <ApplicationAIGuidedFlow
                        values={values}
                        onValuesChange={updateValues}
                        programQuestions={programQuestions}
                        documents={documents}
                        onDocumentsChange={setDocuments}
                        programId={programId}
                        programName={programName}
                        complianceScore={complianceScore}
                        isForcedInterventionProgram={isForcedInterventionProgram}
                        forcedInterventions={forcedInterventions}
                        interventionGroups={interventionGroups}
                        interventionSelections={interventionSelections}
                        onInterventionSelectionsChange={setInterventionSelections}
                    />
                ) : (
                    <ApplicationManualFlow
                        form={form}
                        values={values}
                        onValuesChange={updateValues}
                        programQuestions={programQuestions}
                        documents={documents}
                        onDocumentsChange={setDocuments}
                        interventionGroups={interventionGroups}
                        interventionSelections={interventionSelections}
                        onInterventionSelectionsChange={setInterventionSelections}
                        showInterventions={false}
                    />
                )}
                {!reviewOpen && mode === 'manual' && (
                    <ApplicationInterventionSelector
                        forced={isForcedInterventionProgram}
                        forcedInterventions={forcedInterventions}
                        groups={interventionGroups}
                        selections={interventionSelections}
                        onChange={setInterventionSelections}
                    />
                )}
            </div>

            <FloatButton.BackTop
                className="program-application-back-top"
                visibilityHeight={320}
                tooltip="Back to top"
            />
        </div>
    )
}
