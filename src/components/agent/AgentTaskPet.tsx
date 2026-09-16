import { Button, Progress, Tooltip } from 'antd'
import {
    CheckCircleFilled,
    CloseOutlined,
    InboxOutlined,
    LoadingOutlined,
    WarningFilled,
} from '@ant-design/icons'
import {
    useBackgroundTasks,
    type BackgroundAgentTask,
} from '@/providers/BackgroundTasksProvider'
import { useLanguage } from '@/providers/LanguageProvider'
import { AgentRichText } from '@/components/agent/AgentRichText'
import '@/styles/agent-task-pet.css'

const statusIcon = (task: BackgroundAgentTask) => {
    if (task.status === 'running' || task.status === 'queued') {
        return <LoadingOutlined spin />
    }

    if (task.status === 'completed') {
        return <CheckCircleFilled />
    }

    return <WarningFilled />
}

const statusLabel: Record<BackgroundAgentTask['status'], string> = {
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
}

const taskPreview = (task: BackgroundAgentTask) =>
    task.result || task.error || task.statusMessage

export const AgentTaskPanel = () => {
    const { t } = useLanguage()
    const {
        tasks,
        clearFinished,
        dismissTask,
    } = useBackgroundTasks()

    const activeCount = tasks.filter((task) =>
        ['queued', 'running'].includes(task.status),
    ).length

    const completedCount = tasks.filter(
        (task) => task.status === 'completed',
    ).length

    const failedCount = tasks.filter(
        (task) => task.status === 'failed',
    ).length

    const hasFinished = completedCount > 0 || failedCount > 0

    return (
        <section className="agent-task-panel">
            <div className="agent-task-panel-header">
                <div>
                    <h3>
                        {t('agent.tasks.current', 'Background tasks')}
                    </h3>

                    <p>
                        {t(
                            'agent.tasks.description',
                            'Longer jobs continue here while you keep working.',
                        )}
                    </p>
                </div>

                {hasFinished && (
                    <Button
                        type="text"
                        size="small"
                        onClick={clearFinished}
                        className="agent-task-clear"
                    >
                        {t('agent.tasks.clearFinished', 'Clear finished')}
                    </Button>
                )}
            </div>

            <div className="agent-task-summary">
                <div className="agent-task-summary-item is-active">
                    <strong>{activeCount}</strong>
                    <span>{t('agent.tasks.active', 'Active')}</span>
                </div>

                <div className="agent-task-summary-item is-completed">
                    <strong>{completedCount}</strong>
                    <span>{t('agent.tasks.completed', 'Completed')}</span>
                </div>

                <div className="agent-task-summary-item is-failed">
                    <strong>{failedCount}</strong>
                    <span>{t('agent.tasks.failed', 'Failed')}</span>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="agent-task-empty">
                    <div className="agent-task-empty-icon">
                        <InboxOutlined />
                    </div>

                    <strong>
                        {t(
                            'agent.tasks.emptyTitle',
                            'No background tasks',
                        )}
                    </strong>

                    <p>
                        {t(
                            'agent.tasks.emptyDescription',
                            'When Thuso starts a longer job, you can continue working and track its progress here.',
                        )}
                    </p>
                </div>
            ) : (
                <div className="agent-task-list">
                    {tasks.map((task) => {
                        const canDismiss =
                            task.status === 'completed' ||
                            task.status === 'failed'

                        return (
                            <article
                                key={task.id}
                                className={`agent-task-row is-${task.status}`}
                            >
                                <div className="agent-task-row-top">
                                    <span className="agent-task-status-icon">
                                        {statusIcon(task)}
                                    </span>

                                    <div className="agent-task-copy">
                                        <div className="agent-task-title-row">
                                            <strong>{task.title}</strong>

                                            <span
                                                className={`agent-task-status is-${task.status}`}
                                            >
                                                {statusLabel[task.status]}
                                            </span>
                                        </div>

                                        <span className="agent-task-message">
                                            {task.statusMessage}
                                        </span>
                                    </div>

                                    {canDismiss && (
                                        <Tooltip
                                            title={t(
                                                'agent.tasks.dismiss',
                                                'Dismiss task',
                                            )}
                                        >
                                            <Button
                                                type="text"
                                                shape="circle"
                                                size="small"
                                                icon={<CloseOutlined />}
                                                className="agent-task-dismiss"
                                                onClick={() => dismissTask(task.id)}
                                            />
                                        </Tooltip>
                                    )}
                                </div>

                                <div className="agent-task-progress-row">
                                    <Progress
                                        percent={task.progress}
                                        showInfo={false}
                                        size="small"
                                        status={
                                            task.status === 'failed'
                                                ? 'exception'
                                                : task.status === 'completed'
                                                    ? 'success'
                                                    : 'active'
                                        }
                                    />

                                    <span>{Math.round(task.progress)}%</span>
                                </div>

                                {(task.result || task.error) && (
                                    <div
                                        className={`agent-task-result ${task.error ? 'is-error' : ''
                                            }`}
                                    >
                                        <AgentRichText content={taskPreview(task)} />
                                    </div>
                                )}
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

type FloatingAgentPetProps = {
    onOpen: () => void
    open?: boolean
}

export const FloatingAgentPet = ({
    onOpen,
    open = false,
}: FloatingAgentPetProps) => {
    const { t } = useLanguage()
    const { tasks } = useBackgroundTasks()

    const activeCount = tasks.filter((task) =>
        ['queued', 'running'].includes(task.status),
    ).length

    const failedCount = tasks.filter(
        (task) => task.status === 'failed',
    ).length

    const latest = tasks[0]

    const status =
        activeCount > 0
            ? `${activeCount} ${activeCount === 1
                ? t('agent.tasks.oneRunning', 'task running')
                : t('agent.tasks.manyRunning', 'tasks running')
            }`
            : failedCount > 0
                ? t(
                    'agent.tasks.needsAttention',
                    'Task needs attention',
                )
                : latest?.status === 'completed'
                    ? t('agent.tasks.ready', 'Task ready')
                    : t('agent.readyToHelp', 'Ready to help')

    return (
        <button
            type="button"
            className={`floating-agent-pet ${open ? 'is-open' : ''
                }`}
            onClick={onOpen}
            aria-label={t('agent.open', 'Open Thuso agent')}
            aria-expanded={open}
        >
            {activeCount > 0 && (
                <span className="floating-agent-pet-count">
                    {activeCount}
                </span>
            )}

            <span className="floating-agent-pet-speech">
                {status}
            </span>

            <svg
                viewBox="0 0 96 96"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient
                        id="pet-body"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                    >
                        <stop
                            offset="0"
                            stopColor="#8b7cff"
                        />
                        <stop
                            offset="1"
                            stopColor="#5b4bd9"
                        />
                    </linearGradient>
                </defs>

                <ellipse
                    cx="48"
                    cy="82"
                    rx="24"
                    ry="6"
                    fill="rgba(71, 57, 180, .18)"
                />

                <path
                    d="M27 55c-7-7-8-19 0-25 5-4 11-3 14 1m28 24c7-7 8-19 0-25-5-4-11-3-14 1"
                    fill="none"
                    stroke="#6d5dfb"
                    strokeWidth="5"
                    strokeLinecap="round"
                />

                <rect
                    x="19"
                    y="28"
                    width="58"
                    height="47"
                    rx="21"
                    fill="url(#pet-body)"
                />

                <rect
                    x="26"
                    y="35"
                    width="44"
                    height="28"
                    rx="14"
                    fill="#eef0ff"
                />

                <circle
                    cx="39"
                    cy="49"
                    r="4"
                    fill="#312e81"
                />

                <circle
                    cx="57"
                    cy="49"
                    r="4"
                    fill="#312e81"
                />

                <path
                    d="M40 57c5 4 11 4 16 0"
                    fill="none"
                    stroke="#312e81"
                    strokeWidth="3"
                    strokeLinecap="round"
                />

                <path
                    d="M48 19v8m-5-4h10"
                    stroke="#f8fafc"
                    strokeWidth="3"
                    strokeLinecap="round"
                />

                <circle
                    cx="48"
                    cy="18"
                    r="5"
                    fill="#fbbf24"
                />

                <path
                    d="M31 72l-8 10m42-10 8 10"
                    stroke="#6d5dfb"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
            </svg>
        </button>
    )
}
