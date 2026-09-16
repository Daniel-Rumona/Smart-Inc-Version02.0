import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Progress, Tag, Typography } from 'antd'
import { CaretRightOutlined, PauseOutlined, ReloadOutlined } from '@ant-design/icons'
import '@/styles/plan-projection.css'

type ProjectionItem = { interventionId?: string, id?: string, title: string, areaOfSupport?: string, status?: string, progress?: number }

const STEP_MS = 1900

const statusTone = (status?: string) => status === 'Completed' ? 'green' : status === 'In progress' ? 'blue' : 'orange'

export const PlanProjectionPreview = ({ interventions }: { interventions: ProjectionItem[] }) => {
    const [open, setOpen] = useState(false)
    const [index, setIndex] = useState(0)
    const [playing, setPlaying] = useState(true)

    const projectedFinish = useMemo(() => {
        const date = new Date()
        date.setDate(date.getDate() + Math.max(1, interventions.length) * 28)
        return date
    }, [interventions.length])

    // One intervention holds the frame at a time; the next fades in as the previous fades out.
    useEffect(() => {
        if (!open || !playing || interventions.length < 2) return
        const timer = window.setTimeout(() => {
            setIndex((current) => {
                if (current + 1 >= interventions.length) {
                    setPlaying(false)
                    return current
                }
                return current + 1
            })
        }, STEP_MS)
        return () => window.clearTimeout(timer)
    }, [open, playing, index, interventions.length])

    const start = () => {
        setIndex(0)
        setPlaying(true)
        setOpen(true)
    }

    const current = interventions[index]
    const reachedEnd = index >= interventions.length - 1 && !playing
    const journeyPercent = interventions.length ? Math.round(((index + 1) / interventions.length) * 100) : 0

    return <>
        <Button size="small" icon={<CaretRightOutlined />} disabled={!interventions.length} onClick={start}>Preview journey</Button>

        <Modal
            open={open}
            onCancel={() => setOpen(false)}
            footer={null}
            width={460}
            title="Projected journey"
            className="plan-projection-modal"
        >
            <p className="plan-projection-summary">
                {interventions.length} intervention{interventions.length === 1 ? '' : 's'} · projected finish {projectedFinish.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </p>

            {current && (
                /* Keying on the index restarts the fade, so each stage arrives on its own. */
                <div className="plan-projection-stage" key={index}>
                    <span className="plan-projection-step">{index + 1}</span>

                    <strong className="plan-projection-title">{current.title}</strong>

                    <span className="plan-projection-area">{current.areaOfSupport || 'General support'}</span>

                    <Tag color={statusTone(current.status)} className="plan-projection-tag">
                        {current.status || 'Awaiting action'}
                    </Tag>

                    <Progress percent={current.progress || 0} size="small" className="plan-projection-item-progress" />
                </div>
            )}

            <div className="plan-projection-track" role="tablist" aria-label="Journey stages">
                {interventions.map((item, dotIndex) => (
                    <button
                        type="button"
                        key={item.id || item.interventionId || item.title}
                        className={`plan-projection-dot${dotIndex === index ? ' is-active' : ''}${dotIndex < index ? ' is-passed' : ''}`}
                        aria-label={`Stage ${dotIndex + 1}: ${item.title}`}
                        aria-selected={dotIndex === index}
                        role="tab"
                        onClick={() => { setPlaying(false); setIndex(dotIndex) }}
                    />
                ))}
            </div>

            <div className="plan-projection-controls">
                <Typography.Text type="secondary">Stage {index + 1} of {interventions.length} · {journeyPercent}%</Typography.Text>

                <Button
                    type="text"
                    size="small"
                    icon={reachedEnd ? <ReloadOutlined /> : playing ? <PauseOutlined /> : <CaretRightOutlined />}
                    onClick={() => {
                        if (reachedEnd) { setIndex(0); setPlaying(true); return }
                        setPlaying((value) => !value)
                    }}
                >
                    {reachedEnd ? 'Replay' : playing ? 'Pause' : 'Play'}
                </Button>
            </div>

            <p className="plan-projection-note">
                An estimate: roughly four weeks per intervention, adjusting as real dates and progress are captured.
            </p>
        </Modal>
    </>
}
