'use client'

import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon } from '@phosphor-icons/react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateValue } from '@/lib/dateTime'
import { cn } from '@/lib/utils'

export type DateSpan = {
  from: string
  to: string
}

function londonToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function startOfWeek(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return shiftDate(iso, -((sunday0 + 6) % 7))
}

function monthBounds(iso: string) {
  const [year, month] = iso.split('-').map(Number)
  const from = `${iso.slice(0, 7)}-01`
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from, to: `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}` }
}

function previousMonth(iso: string) {
  const [year, month] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 2, 1))
  const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
  return monthBounds(value)
}

function isoFromDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatSpan(from: string, to: string) {
  const start = parseDateValue(from)
  const end = parseDateValue(to)
  if (!start || !end) return 'Pick dates'
  const format = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (from === to) return format.format(start)
  return `${format.format(start)} – ${format.format(end)}`
}

function presetsFor(today: string) {
  const weekStart = startOfWeek(today)
  const month = monthBounds(today)
  const lastWeekEnd = shiftDate(weekStart, -1)
  const lastMonth = previousMonth(today)
  return [
    { label: 'Today', from: today, to: today },
    { label: 'This week', from: weekStart, to: today },
    { label: 'Last week', from: startOfWeek(lastWeekEnd), to: lastWeekEnd },
    { label: 'This month', from: month.from, to: today },
    { label: 'Last month', from: lastMonth.from, to: lastMonth.to },
  ]
}

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (span: DateSpan) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const today = londonToday()
  const presets = useMemo(() => presetsFor(today), [today])
  const committed = {
    from: parseDateValue(from),
    to: parseDateValue(to),
  }
  const selected = draft?.from ? draft : committed
  const todayDate = parseDateValue(today)
  const currentMonthOnRight = todayDate
    ? new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1)
    : undefined
  const [month, setMonth] = useState<Date | undefined>(currentMonthOnRight)

  function apply(span: DateSpan) {
    const next = span.from <= span.to ? span : { from: span.to, to: span.from }
    setDraft(undefined)
    onChange(next)
    setOpen(false)
  }

  function onSelect(range: DateRange | undefined) {
    if (!range?.from) return
    if (!range.to) {
      setDraft(range)
      return
    }
    const start = isoFromDate(range.from)
    const end = isoFromDate(range.to)
    const next = start <= end ? { from: start, to: end } : { from: end, to: start }
    setDraft({ from: range.from, to: range.to })
    onChange(next)
  }

  return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setMonth(currentMonthOnRight)
          if (!next) setDraft(undefined)
        }}
      >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 justify-start gap-2 font-normal">
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          <span className="truncate">{formatSpan(from, to)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-border p-3">
            {presets.map((preset) => {
              const active = preset.from === from && preset.to === to
              return (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('justify-start font-normal', active && 'bg-muted')}
                  onClick={() => apply(preset)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            showOutsideDays={false}
            selected={selected}
            onSelect={onSelect}
            disabled={todayDate ? { after: todayDate } : undefined}
            month={month}
            onMonthChange={setMonth}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
