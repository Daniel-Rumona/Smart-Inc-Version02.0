import dayjs from 'dayjs'
import type { FirestoreDate } from '@/types/interventions'

export type ItemTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success'

export const TAG_COLOR: Record<ItemTone, string> = {
    neutral: 'default',
    info: 'blue',
    warning: 'gold',
    danger: 'red',
    success: 'green',
}

/**
 * Statuses reach the dashboard in whatever casing the source collection stored them
 * ('in progress', 'AWAITING_CONFIRMATION', 'submitted'), so every label is normalised
 * to one house form before it is shown.
 */
export const formatStatus = (status: string) => String(status || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

export const statusTone = (status: string): ItemTone => {
    const value = String(status || '').replace(/[_-]+/g, ' ').trim().toLowerCase()
    if (['missing', 'expired', 'overdue', 'rejected', 'declined', 'not uploaded'].includes(value)) return 'danger'
    if (['completed', 'complete', 'submitted', 'valid', 'approved', 'confirmed', 'done'].includes(value)) return 'success'
    if (['in progress', 'active', 'started'].includes(value)) return 'info'
    if (value.startsWith('awaiting') || ['pending', 'assigned', 'pending assignment', 'sent'].includes(value)) return 'warning'
    return 'neutral'
}

export const toDate = (value: FirestoreDate) => {
    if (!value) return null
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return dayjs(value.toDate())
    const parsed = dayjs(value as string | number | Date)
    return parsed.isValid() ? parsed : null
}

/** Due dates only earn their space when they say something: overdue, today, or the date itself. */
export const describeDue = (value: FirestoreDate) => {
    const date = toDate(value)
    if (!date) return ''
    const days = date.startOf('day').diff(dayjs().startOf('day'), 'day')
    if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `Due ${date.format('DD MMM')}`
}
