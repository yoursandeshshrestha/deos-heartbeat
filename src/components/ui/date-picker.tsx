'use client'

import { useState } from 'react'
import {
  Calendar as CalendarIcon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { triggerFieldButtonClassName } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import { formatDateLabel, parseDateValue } from '@/lib/dateTime'

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
  id?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  minDate,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(value)

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
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          <span className="truncate">{value ? formatDateLabel(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onChange(
              `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            )
            setOpen(false)
          }}
          disabled={minDate ? { before: minDate } : undefined}
          defaultMonth={selected ?? minDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
