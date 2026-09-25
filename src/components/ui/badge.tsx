import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeGlassBase =
  "border-0 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"

const badgeVariants = cva(
  cn(
    "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-0 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:ring-destructive/40 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
    badgeGlassBase
  ),
  {
    variants: {
      variant: {
        default:
          "bg-foreground/6 text-foreground [a]:hover:bg-foreground/10 dark:bg-white/8 dark:text-foreground [a]:hover:dark:bg-white/12",
        secondary:
          "bg-foreground/5 text-muted-foreground [a]:hover:bg-foreground/8 dark:bg-white/6 dark:text-foreground/75 [a]:hover:dark:bg-white/10",
        success:
          "bg-emerald-600/10 text-emerald-800 [a]:hover:bg-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 [a]:hover:dark:bg-emerald-400/15",
        warning:
          "bg-orange-500/12 text-orange-800 [a]:hover:bg-orange-500/18 dark:bg-orange-400/12 dark:text-orange-300 [a]:hover:dark:bg-orange-400/18",
        supreme:
          "bg-rose-600/10 text-rose-800 [a]:hover:bg-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 [a]:hover:dark:bg-rose-400/15",
        event:
          "bg-foreground/5 text-muted-foreground [a]:hover:bg-foreground/8 dark:bg-white/6 dark:text-foreground/75 [a]:hover:dark:bg-white/10",
        destructive:
          "bg-destructive/12 text-red-600 [a]:hover:bg-destructive/18 dark:bg-destructive/20 dark:text-red-500 [a]:hover:dark:bg-destructive/28",
        outline:
          "bg-foreground/4 text-muted-foreground [a]:hover:bg-foreground/8 [a]:hover:text-foreground dark:bg-white/5 dark:text-foreground/70 [a]:hover:dark:bg-white/8 [a]:hover:dark:text-foreground",
        ghost:
          "bg-transparent shadow-none hover:bg-foreground/6 hover:text-muted-foreground dark:hover:bg-white/6 dark:hover:text-foreground/80",
        link: "bg-transparent shadow-none text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
