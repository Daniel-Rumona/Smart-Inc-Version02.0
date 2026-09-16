export const detectTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Harare'

const offsetMinutes = (timezone: string, at: Date = new Date()): number | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return (asUtc - at.getTime()) / 60000
  } catch {
    return null
  }
}

export type TimezoneComparison = {
  offsetDifferenceMinutes: number
  label: string
}

/** Compares two IANA timezones and describes how far apart their current local times are. */
export const compareTimezones = (a: string, b: string, at: Date = new Date()): TimezoneComparison | null => {
  if (!a || !b || a === b) return null
  const offsetA = offsetMinutes(a, at)
  const offsetB = offsetMinutes(b, at)
  if (offsetA === null || offsetB === null) return null
  const diff = offsetA - offsetB
  if (diff === 0) return { offsetDifferenceMinutes: 0, label: 'same local time' }

  const hours = Math.floor(Math.abs(diff) / 60)
  const minutes = Math.abs(diff) % 60
  const parts = [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ')
  const direction = diff > 0 ? 'ahead of' : 'behind'
  return { offsetDifferenceMinutes: diff, label: `${parts} ${direction}` }
}
