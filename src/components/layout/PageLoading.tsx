import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type PageLoadingVariant = 'content' | 'compact' | 'full'

interface PageLoadingProps {
  className?: string
  variant?: PageLoadingVariant
}

export function PageLoading({ className, variant = 'content' }: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        variant === 'content' && 'min-h-[320px]',
        variant === 'compact' && 'py-12',
        variant === 'full' && 'h-dvh',
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <Spinner size={variant === 'compact' ? 'sm' : 'md'} className="text-muted-foreground" />
    </div>
  )
}
