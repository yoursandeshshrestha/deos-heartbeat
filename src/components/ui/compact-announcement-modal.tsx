import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  X as XIcon,
} from '@phosphor-icons/react'

export interface CompactAnnouncementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  imageAlt?: string
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
  className?: string
}

export function CompactAnnouncementModal({
  open,
  onOpenChange,
  imageSrc,
  imageAlt = '',
  title,
  description,
  actionLabel,
  onAction,
  className,
}: CompactAnnouncementModalProps) {
  const handleAction = () => {
    onAction?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-w-[480px] gap-0 overflow-hidden p-0 sm:max-w-[480px]',
          className,
        )}
      >
        <div className="relative">
          <img
            src={imageSrc}
            alt={imageAlt}
            className="block w-full max-w-[480px]"
          />
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Close"
            >
              <XIcon />
            </Button>
          </DialogClose>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-5 pb-6 text-center">
          <DialogTitle className="text-base leading-snug font-medium text-balance">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-balance">
            {description}
          </DialogDescription>
          <Button size="lg" className="w-full" onClick={handleAction}>
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
