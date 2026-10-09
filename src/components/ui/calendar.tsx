"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DateRange,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  CaretLeft as ChevronLeftIcon,
  CaretRight as ChevronRightIcon,
  CaretDown as ChevronDownIcon,
} from '@phosphor-icons/react'

type RangeHandle = "start" | "end"

type RangeDragContextValue = {
  dragging: RangeHandle | null
  beginDrag: (handle: RangeHandle) => void
}

const RangeDragContext = React.createContext<RangeDragContextValue>({
  dragging: null,
  beginDrag: () => {},
})

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function disabledAfterFromProp(disabled: unknown): Date | undefined {
  if (!disabled || typeof disabled !== "object" || Array.isArray(disabled)) return undefined
  if ("after" in disabled && disabled.after instanceof Date) return startOfLocalDay(disabled.after)
  return undefined
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()
  const [dragging, setDragging] = React.useState<RangeHandle | null>(null)
  const dragRef = React.useRef<{
    handle: RangeHandle
    otherEnd: Date
    onSelect?: (range: DateRange | undefined) => void
    disabledAfter?: Date
  } | null>(null)

  const selectedRange = props.mode === "range" ? (props.selected as DateRange | undefined) : undefined
  const onSelectRange =
    props.mode === "range"
      ? (props.onSelect as ((range: DateRange | undefined) => void) | undefined)
      : undefined
  const disabledAfter = disabledAfterFromProp(props.disabled)

  const stopListening = React.useRef<(() => void) | null>(null)

  const endDrag = React.useCallback(() => {
    stopListening.current?.()
    stopListening.current = null
    dragRef.current = null
    setDragging(null)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  const beginDrag = React.useCallback(
    (handle: RangeHandle) => {
      const from = selectedRange?.from
      if (!from) return
      endDrag()
      const to = selectedRange?.to ?? from
      const applyDate = (date: Date) => {
        const drag = dragRef.current
        if (!drag) return
        const next = startOfLocalDay(date)
        if (drag.disabledAfter && next > drag.disabledAfter) return
        const other = startOfLocalDay(drag.otherEnd)
        drag.onSelect?.(
          next <= other ? { from: next, to: other } : { from: other, to: next },
        )
      }
      const onMove = (event: { clientX: number; clientY: number }) => {
        const target = document.elementFromPoint(event.clientX, event.clientY)
        const dayEl = target?.closest("[data-calendar-day]") as HTMLElement | null
        const key = dayEl?.dataset.calendarDay
        if (!key) return
        const date = fromDateKey(key)
        if (date) applyDate(date)
      }
      const onUp = (event: PointerEvent | MouseEvent) => {
        onMove(event)
        endDrag()
      }
      stopListening.current = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("mouseup", onUp)
      }
      dragRef.current = {
        handle,
        otherEnd: handle === "start" ? to : from,
        onSelect: onSelectRange,
        disabledAfter,
      }
      document.body.style.cursor = "grabbing"
      document.body.style.userSelect = "none"
      window.addEventListener("pointermove", onMove)
      window.addEventListener("mousemove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("mouseup", onUp)
      setDragging(handle)
    },
    [disabledAfter, endDrag, onSelectRange, selectedRange],
  )

  React.useEffect(() => {
    return () => {
      endDrag()
    }
  }, [endDrag])

  return (
    <RangeDragContext.Provider value={{ dragging, beginDrag }}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          "group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:2rem] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
          dragging && "cursor-grabbing",
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className
        )}
        captionLayout={captionLayout}
        locale={locale}
        formatters={{
          formatMonthDropdown: (date) =>
            date.toLocaleString(locale?.code, { month: "short" }),
          ...formatters,
        }}
        classNames={{
          root: cn("w-fit", defaultClassNames.root),
          months: cn(
            "relative flex flex-row gap-4",
            defaultClassNames.months
          ),
          month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
          nav: cn(
            "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
            defaultClassNames.nav
          ),
          button_previous: cn(
            buttonVariants({ variant: buttonVariant }),
            "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
            defaultClassNames.button_previous
          ),
          button_next: cn(
            buttonVariants({ variant: buttonVariant }),
            "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
            defaultClassNames.button_next
          ),
          month_caption: cn(
            "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
            defaultClassNames.month_caption
          ),
          dropdowns: cn(
            "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
            defaultClassNames.dropdowns
          ),
          dropdown_root: cn(
            "relative rounded-(--cell-radius)",
            defaultClassNames.dropdown_root
          ),
          dropdown: cn(
            "absolute inset-0 bg-popover opacity-0",
            defaultClassNames.dropdown
          ),
          caption_label: cn(
            "font-medium select-none",
            captionLayout === "label"
              ? "text-sm"
              : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
            defaultClassNames.caption_label
          ),
          table: "w-full border-collapse",
          week: cn("mt-2 flex w-full", defaultClassNames.week),
          weekdays: cn("flex w-full", defaultClassNames.weekdays),
          weekday: cn(
            "flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none",
            defaultClassNames.weekday
          ),
          week_number_header: cn(
            "w-(--cell-size) select-none",
            defaultClassNames.week_number_header
          ),
          week_number: cn(
            "text-[0.8rem] text-muted-foreground select-none",
            defaultClassNames.week_number
          ),
          day: cn(
            "group/day relative aspect-square h-full w-full p-0 text-center select-none outline-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
            defaultClassNames.day
          ),
          range_start: cn(
            "rounded-l-md bg-primary/15",
            defaultClassNames.range_start
          ),
          range_middle: cn("rounded-none bg-primary/15", defaultClassNames.range_middle),
          range_end: cn(
            "rounded-r-md bg-primary/15",
            defaultClassNames.range_end
          ),
          today: cn(
            "rounded-md bg-muted text-foreground data-[selected=true]:rounded-none",
            defaultClassNames.today
          ),
          outside: cn(
            "text-muted-foreground aria-selected:text-muted-foreground",
            defaultClassNames.outside
          ),
          disabled: cn(
            "text-muted-foreground opacity-50",
            defaultClassNames.disabled
          ),
          hidden: cn("invisible", defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: ({ className, rootRef, ...rootProps }) => {
            return (
              <div
                data-slot="calendar"
                ref={rootRef}
                className={cn(className)}
                {...rootProps}
              />
            )
          },
          Chevron: ({ className, orientation, ...chevronProps }) => {
            if (orientation === "left") {
              return (
                <ChevronLeftIcon className={cn("size-4", className)} {...chevronProps} />
              )
            }

            if (orientation === "right") {
              return (
                <ChevronRightIcon className={cn("size-4", className)} {...chevronProps} />
              )
            }

            return (
              <ChevronDownIcon className={cn("size-4", className)} {...chevronProps} />
            )
          },
          DayButton: ({ ...dayProps }) => (
            <CalendarDayButton locale={locale} {...dayProps} />
          ),
          WeekNumber: ({ children, ...weekNumberProps }) => {
            return (
              <td {...weekNumberProps}>
                <div className="flex size-(--cell-size) items-center justify-center text-center">
                  {children}
                </div>
              </td>
            )
          },
          ...components,
        }}
        {...props}
      />
    </RangeDragContext.Provider>
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()
  const { dragging, beginDrag } = React.useContext(RangeDragContext)
  const isRangeHandle = Boolean(modifiers.range_start || modifiers.range_end)

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-calendar-day={toDateKey(day.date)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 p-0 font-normal leading-none",
        "border-0 shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-start=true]:rounded-md data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:rounded-md data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-foreground",
        "dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        isRangeHandle && "cursor-grab touch-none",
        dragging && "cursor-grabbing",
        defaultClassNames.day_button,
        className
      )}
      {...props}
      onPointerDown={(event) => {
        if (isRangeHandle && event.button === 0) {
          event.preventDefault()
          event.stopPropagation()
          beginDrag(modifiers.range_end && !modifiers.range_start ? "end" : "start")
          return
        }
        props.onPointerDown?.(event)
      }}
      onClick={(event) => {
        if (isRangeHandle || dragging) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        props.onClick?.(event)
      }}
    />
  )
}

export { Calendar, CalendarDayButton }
