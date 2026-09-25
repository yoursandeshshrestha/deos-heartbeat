import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckCircle as CircleCheckIcon,
  Info as InfoIcon,
  Warning as TriangleAlertIcon,
  WarningOctagon as OctagonXIcon,
} from '@phosphor-icons/react'
import { Loader } from "./loader"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader size="sm" className="h-4" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--foreground)",
          "--success-bg": "oklch(0.96 0.05 145)",
          "--success-border": "oklch(0.62 0.17 145)",
          "--success-text": "oklch(0.25 0.09 145)",
          "--error-bg": "oklch(0.97 0.035 25)",
          "--error-border": "var(--destructive)",
          "--error-text": "oklch(0.34 0.14 25)",
          "--warning-bg": "oklch(0.97 0.05 85)",
          "--warning-border": "var(--warning)",
          "--warning-text": "oklch(0.34 0.09 75)",
          "--info-bg": "oklch(0.96 0.035 250)",
          "--info-border": "oklch(0.58 0.15 250)",
          "--info-text": "oklch(0.28 0.09 250)",
          "--border-radius": "0.5rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-current/75",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
