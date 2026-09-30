const LONDON = 'Europe/London'

export type LondonDay = {
  /** YYYY-MM-DD in Europe/London */
  date: string
  /** Short weekday, e.g. Mon */
  weekday: string
  /** e.g. 21 Sep 2026 */
  label: string
  startSec: number
  endSec: number
}

function londonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

/** UTC instant when the Europe/London clock reads 00:00 on that calendar day. */
export function londonMidnightUtc(year: number, month: number, day: number) {
  for (const hour of [0, -1, 1]) {
    const instant = Date.UTC(year, month - 1, day, hour, 0, 0)
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(instant))
    const dayText = String(day).padStart(2, '0')
    const monthText = String(month).padStart(2, '0')
    if (formatted.startsWith(`${dayText}/${monthText}/${year}`) && formatted.includes('00:00')) {
      return instant
    }
  }
  return Date.UTC(year, month - 1, day, 0, 0, 0)
}

function dayWindow(year: number, month: number, day: number): LondonDay {
  const startMs = londonMidnightUtc(year, month, day)
  const next = new Date(startMs + 36 * 60 * 60 * 1000)
  const nextParts = londonDateParts(next)
  const endMs = londonMidnightUtc(nextParts.year, nextParts.month, nextParts.day)
  const noon = new Date(startMs + 12 * 60 * 60 * 1000)
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    weekday: 'short',
  }).format(noon)
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(noon)
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    weekday,
    label,
    startSec: Math.floor(startMs / 1000),
    endSec: Math.floor(endMs / 1000),
  }
}

function addCalendarDays(year: number, month: number, day: number, delta: number) {
  const utc = Date.UTC(year, month - 1, day + delta)
  const date = new Date(utc)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

export function londonToday(now = new Date()): LondonDay {
  const parts = londonDateParts(now)
  return dayWindow(parts.year, parts.month, parts.day)
}

/** `count` London days ending yesterday (the completed week when the Monday cron runs). */
export function londonDaysEndingYesterday(count: number, now = new Date()): LondonDay[] {
  const today = londonDateParts(now)
  const days: LondonDay[] = []
  for (let offset = count; offset >= 1; offset -= 1) {
    const parts = addCalendarDays(today.year, today.month, today.day, -offset)
    days.push(dayWindow(parts.year, parts.month, parts.day))
  }
  return days
}

/** Minute of a Prometheus sample, in UTC. */
export function formatUtcTime(epochSec: number) {
  const date = new Date(epochSec * 1000)
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

/** Clock time in GMT+01:00. Fixed offset, including through UK winter. */
export function formatGmtPlus1Time(epochSec: number) {
  const shifted = new Date(epochSec * 1000 + 60 * 60 * 1000)
  const hour = String(shifted.getUTCHours()).padStart(2, '0')
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

/** `18:20 (6:20 PM)` from a GMT+01:00 24-hour `HH:mm` string. */
export function dualClock(time24: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time24)
  if (!match) return time24
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${time24} (${hour12}:${minute} ${suffix})`
}
