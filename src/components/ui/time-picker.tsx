'use client'

import { useState } from 'react'
import {
  Clock,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { triggerFieldButtonClassName } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import {
  formatTimeLabel,
  formatTimeValue,
  parseTimeValue,
  TIME_MINUTE_OPTIONS,
} from '@/lib/dateTime'

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

const HOUR_12_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

function toHour12(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, period }
}

function toHour24(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12
  }
  return hour12 === 12 ? 12 : hour12 + 12
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Pick a time',
  disabled,
  className,
  id,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const { hour, minute } = parseTimeValue(value)
  const { hour12, period } = toHour12(hour)

  const updateTime = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    onChange(formatTimeValue(toHour24(nextHour12, nextPeriod), nextMinute))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            triggerFieldButtonClassName,
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className="size-4 shrink-0 opacity-70" />
          <span className="truncate">{value ? formatTimeLabel(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Select time</p>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hour</Label>
              <Select
                value={String(hour12)}
                onValueChange={(next) =>
                  updateTime(Number.parseInt(next, 10), minute, period)
                }
              >
                <SelectTrigger className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_12_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="pb-2 text-lg text-muted-foreground">:</span>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Minute</Label>
              <Select
                value={String(minute)}
                onValueChange={(next) =>
                  updateTime(hour12, Number.parseInt(next, 10), period)
                }
              >
                <SelectTrigger className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_MINUTE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {String(option).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Select
                value={period}
                onValueChange={(next) =>
                  updateTime(hour12, minute, next as 'AM' | 'PM')
                }
              >
                <SelectTrigger className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
