import { Alert } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { compareTimezones, detectTimezone } from '@/utils/timezone'

type TimezoneMismatchNoticeProps = {
  /** IANA timezone the times being displayed are anchored to (e.g. a consultant's profile timezone). */
  subjectTimezone: string
  /** How to refer to the owner of subjectTimezone, e.g. "This consultant" or "You". */
  subjectLabel?: string
  /** Viewer's timezone; defaults to the browser-detected timezone. */
  viewerTimezone?: string
  /** Optional quick action rendered alongside the notice, e.g. a button to sync timezones. */
  action?: ReactNode
  className?: string
}

/**
 * Drop-in banner that flags when a viewer's local timezone differs from the timezone
 * that displayed times are anchored to (e.g. an SME viewing a consultant's availability).
 * Renders nothing when the two timezones share the same current local time.
 */
export default function TimezoneMismatchNotice({
  subjectTimezone,
  subjectLabel = 'These times',
  viewerTimezone,
  action,
  className,
}: TimezoneMismatchNoticeProps) {
  const viewer = viewerTimezone || detectTimezone()
  const comparison = compareTimezones(subjectTimezone, viewer)
  if (!comparison || comparison.offsetDifferenceMinutes === 0) return null

  return (
    <Alert
      className={className}
      type="info"
      showIcon
      icon={<GlobalOutlined />}
      message={`${subjectLabel} are shown in ${subjectTimezone}`}
      description={`Your device's timezone is ${viewer}, which is ${comparison.label}. Double-check times before booking.`}
      action={action}
    />
  )
}
