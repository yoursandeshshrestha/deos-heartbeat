import { format, parse, startOfDay } from 'date-fns'

export function parseDateValue(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function formatDateValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatDateLabel(value: string | undefined): string {
  const date = parseDateValue(value)
  return date ? format(date, 'EEE, MMM d, yyyy') : 'Pick a date'
}

export function snapMinute(minute: number): number {
  const snapped = Math.round(minute / TIME_MINUTE_STEP) * TIME_MINUTE_STEP
  return snapped === 60 ? 0 : snapped
}

export function parseTimeValue(value: string | undefined): { hour: number; minute: number } {
  if (!value) return { hour: 9, minute: 0 }
  const [hourStr, minuteStr] = value.split(':')
  const hour = Number.parseInt(hourStr, 10)
  const minute = Number.parseInt(minuteStr, 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return { hour: 9, minute: 0 }
  return { hour, minute: snapMinute(minute) }
}

export function formatTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPart['type']): number {
  return Number(parts.find((part) => part.type === type)?.value ?? '0')
}

/** Convert a wall-clock date/time in an IANA timezone to a UTC ISO string. */
export function zonedDateTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = (time || '00:00').split(':').map(Number)
  if (!year || !month || !day) return new Date().toISOString()

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant))
    const asUtc = Date.UTC(
      partNumber(parts, 'year'),
      partNumber(parts, 'month') - 1,
      partNumber(parts, 'day'),
      partNumber(parts, 'hour') % 24,
      partNumber(parts, 'minute'),
      partNumber(parts, 'second')
    )
    return asUtc - instant
  }

  return new Date(utcGuess - offsetAt(utcGuess - offsetAt(utcGuess))).toISOString()
}

/** Split a UTC instant into yyyy-MM-dd and HH:mm in an IANA timezone. */
export function utcIsoToZonedParts(
  iso: string,
  timeZone: string
): { date: string; time: string } {
  const instant = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(Number.isNaN(instant.getTime()) ? new Date() : instant)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  const hour = String(Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24).padStart(2, '0')
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}

export function formatTimeLabel(value: string | undefined): string {
  const { hour, minute } = parseTimeValue(value)
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return format(date, 'h:mm a')
}

export function startOfToday(): Date {
  return startOfDay(new Date())
}

export const TIME_MINUTE_STEP = 5

export const TIME_MINUTE_OPTIONS = Array.from(
  { length: 60 / TIME_MINUTE_STEP },
  (_, index) => index * TIME_MINUTE_STEP
)

export const TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index)
