import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageEmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function PageEmptyState({ title, description, action, className }: PageEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle px-6 py-16 text-center',
        className,
      )}
    >
      <img src="/empty.png" alt="" className="mb-4 size-12 rounded-xl object-cover" />
      <h3 className="text-lg font-medium">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
