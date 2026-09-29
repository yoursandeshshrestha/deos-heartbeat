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
          "relative overflow-hidden border border-(--kumo-button-emphasis-ring) bg-(--kumo-button-emphasis-bg) text-white focus-visible:ring-(--kumo-button-emphasis-ring)/40",
        outline:
          "relative overflow-hidden border border-border-subtle bg-(--kumo-button-emphasis-bg) text-foreground hover:text-foreground focus-visible:ring-0 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "relative overflow-hidden border border-border-subtle bg-(--kumo-button-emphasis-bg) text-secondary-foreground focus-visible:ring-0 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "relative overflow-hidden border border-(--kumo-button-emphasis-ring) bg-(--kumo-button-emphasis-bg) text-white focus-visible:ring-(--kumo-button-emphasis-ring)/40",
        link: "border border-transparent text-primary underline-offset-4 hover:underline",
        oauth:
          "relative overflow-hidden border border-(--kumo-button-emphasis-ring) bg-(--kumo-button-emphasis-bg) text-oauth-primary-foreground focus-visible:ring-(--kumo-button-emphasis-ring)/40",
        auth:
          "relative overflow-hidden border border-(--kumo-button-emphasis-ring) bg-(--kumo-button-emphasis-bg) text-white focus-visible:ring-(--kumo-button-emphasis-ring)/40",
        surface:
          "relative overflow-hidden border border-(--kumo-button-emphasis-ring) bg-(--kumo-button-emphasis-bg) text-secondary-foreground focus-visible:ring-(--kumo-button-emphasis-ring)/40",
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

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

type EmphasisKind = "brand" | "danger" | "soft" | "oauth" | "surface"

function getEmphasisKind(
  variant: ButtonVariant | null | undefined,
): EmphasisKind | undefined {
  if (variant === "default" || variant === "auth") return "brand"
  if (variant === "destructive") return "danger"
  if (variant === "outline" || variant === "secondary") return "soft"
  if (variant === "oauth") return "oauth"
  if (variant === "surface") return "surface"
  return undefined
}

function getEmphasisStyle(
  variant: ButtonVariant | null | undefined,
): React.CSSProperties | undefined {
  const kind = getEmphasisKind(variant)
  if (!kind) return undefined

  if (kind === "soft") {
    return {
      "--kumo-button-emphasis-ring": "var(--border-subtle)",
      "--kumo-button-emphasis-bg": "var(--surface)",
      "--kumo-button-emphasis-gradient-start": "var(--surface)",
      "--kumo-button-emphasis-gradient-end": "var(--surface-hover)",
    } as React.CSSProperties
  }

  if (kind === "brand") {
    const token = "#16163F"
    return {
      "--kumo-button-emphasis-ring": token,
      "--kumo-button-emphasis-bg": token,
      "--kumo-button-emphasis-gradient-start": `color-mix(in oklch, ${token}, white 8%)`,
      "--kumo-button-emphasis-gradient-end": token,
    } as React.CSSProperties
  }

  const token =
    kind === "danger"
      ? "var(--destructive)"
      : kind === "oauth"
        ? "var(--oauth-primary)"
        : "var(--secondary-800)"

  return {
    "--kumo-button-emphasis-ring": `color-mix(in oklch, ${token}, black 10%)`,
    "--kumo-button-emphasis-bg": `color-mix(in oklch, ${token}, white 30%)`,
    "--kumo-button-emphasis-gradient-start": `color-mix(in oklch, ${token}, white 15%)`,
    "--kumo-button-emphasis-gradient-end": token,
  } as React.CSSProperties
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disableActiveShift = false,
  children,
  disabled,
  style,
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
  const emphasisStyle = getEmphasisStyle(variant)
  const mergedStyle = emphasisStyle ? { ...emphasisStyle, ...style } : style

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size }), activeShiftClassName, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        style={mergedStyle}
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
      style={mergedStyle}
      {...props}
    >
      {emphasisStyle ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-linear-to-b from-(--kumo-button-emphasis-gradient-start) to-(--kumo-button-emphasis-gradient-end) shadow-[inset_0_1px_0_0_var(--kumo-button-emphasis-bg)] group-hover/button:from-(--kumo-button-emphasis-bg)"
        />
      ) : null}
      <span
        className={cn(
          "inline-flex h-full w-full min-w-0 max-w-full items-center justify-center gap-[inherit]",
          emphasisStyle && "relative z-10",
        )}
      >
        {loading ? <Spinner size="xs" /> : null}
        {children}
      </span>
    </Comp>
  )
}

export { Button, buttonVariants }
