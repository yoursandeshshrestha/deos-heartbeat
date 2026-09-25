import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#124046] text-white shadow-none hover:bg-[#0e3438] focus-visible:ring-[#124046]/30",
        outline:
          "border-[0.5px] border-border-subtle bg-surface text-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-0 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-surface-hover text-secondary-foreground hover:bg-secondary-200 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:bg-secondary-700 dark:text-foreground dark:hover:bg-secondary-600",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:border-transparent dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/85 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        oauth:
          "bg-oauth-primary text-oauth-primary-foreground hover:bg-oauth-primary-hover",
        auth:
          "border-transparent bg-black text-white shadow-none hover:bg-black/85 focus-visible:ring-0 dark:bg-secondary-100 dark:text-[#141414] dark:hover:bg-secondary-100/90",
        surface:
          "bg-secondary-800 text-secondary-foreground hover:bg-secondary-700",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        auth: "h-9 gap-2 px-4 rounded-md",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disableActiveShift = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    disableActiveShift?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const activeShiftClassName = disableActiveShift
    ? undefined
    : "active:not-aria-[haspopup]:translate-y-px"

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size }), activeShiftClassName, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        activeShiftClassName,
        loading && "disabled:opacity-100",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size="xs" /> : null}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
