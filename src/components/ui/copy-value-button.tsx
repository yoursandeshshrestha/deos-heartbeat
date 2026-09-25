import { useState } from 'react'
import {
  Check,
  Copy,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyValueButtonProps {
  value: string
  label: string
  className?: string
  iconClassName?: string
  copiedLabel?: string
  showLabel?: boolean
  successMessage?: string
}

export function CopyValueButton({
  value,
  label,
  className,
  iconClassName,
  copiedLabel = 'Copied',
  showLabel = false,
  successMessage,
}: CopyValueButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage ?? `${label} copied to clipboard`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1 rounded text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className={cn('size-3.5', iconClassName)} /> : <Copy className={cn('size-3.5', iconClassName)} />}
      {showLabel && <span>{copied ? copiedLabel : 'Copy'}</span>}
    </button>
  )
}
