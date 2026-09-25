"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  variant?: "default" | "thin"
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )
  const thin = variant === "thin"

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full select-none data-horizontal:w-full data-vertical:h-full",
          thin
            ? "bg-status-active/20 data-horizontal:h-1 data-vertical:w-1"
            : "rounded-xl bg-muted data-horizontal:h-3 data-vertical:w-3",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute select-none data-horizontal:h-full data-vertical:w-full",
            thin ? "bg-status-active" : "bg-primary",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block shrink-0 rounded-full bg-card shadow-sm transition-colors select-none focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            thin
              ? "size-3 border border-status-active hover:ring-4 hover:ring-status-active/20 focus-visible:ring-4 focus-visible:ring-status-active/20"
              : "size-4 border border-primary hover:ring-4 hover:ring-ring/20 focus-visible:ring-4 focus-visible:ring-ring/20",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
