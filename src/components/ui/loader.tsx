import { cn } from '@/lib/utils'

interface LoaderProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Loader({ className, size = 'md' }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-8',
    md: 'w-12',
    lg: 'w-16',
  }

  return (
    <div
      className={cn('loader', sizeClasses[size], className)}
      style={{
        aspectRatio: '2',
        background: `
          radial-gradient(farthest-side, currentColor 90%, transparent) 0 50% / 25% 50%,
          radial-gradient(farthest-side at bottom, currentColor 90%, transparent) 50% calc(50% - 4px) / 25% 25%,
          radial-gradient(farthest-side at top, currentColor 90%, transparent) 50% calc(50% + 4px) / 25% 25%,
          radial-gradient(farthest-side at bottom, currentColor 90%, transparent) 100% calc(50% - 4px) / 25% 25%,
          radial-gradient(farthest-side at top, currentColor 90%, transparent) 100% calc(50% + 4px) / 25% 25%
        `,
        backgroundRepeat: 'no-repeat',
        animation: 'loader-wave 1s infinite',
      }}
    />
  )
}
