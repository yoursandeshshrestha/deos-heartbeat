import { cn } from '@/lib/utils'

function Surface({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('surface-card', className)} {...props} />
}

export { Surface }
