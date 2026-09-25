/**
 * Canonical Thrumble in-product announcement modal.
 *
 * Use FramedAnnouncementModal for feature launches, onboarding prompts, and
 * "what's new" messaging. CarouselAnnouncementModal extends this frame for
 * multi-step flows. CompactAnnouncementModal is a legacy alternative.
 */
import type { ReactNode } from 'react'
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
  ArrowRight as ArrowRightIcon,
  X as XIcon,
} from '@phosphor-icons/react'

export interface FramedAnnouncementContent {
  imageSrc: string
  imageAlt?: string
  title: string
  description: string
}

interface FramedAnnouncementModalFrameProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc?: string
  imageAlt?: string
  hero?: ReactNode
  title: string
  description: string
  footer: ReactNode
  className?: string
}

export function FramedAnnouncementModalFrame({
  open,
  onOpenChange,
  imageSrc,
  imageAlt = '',
  hero,
  title,
  description,
  footer,
  className,
}: FramedAnnouncementModalFrameProps) {
  const hasHero = Boolean(hero || imageSrc)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex w-[calc(100vw-32px)] max-w-[420px] flex-col gap-0 overflow-hidden bg-popover p-0 shadow-2xl sm:max-w-[420px]',
          hasHero ? 'min-h-[440px]' : 'min-h-0',
          className,
        )}
      >
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-[15px] right-[15px] flex size-4 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-full" />
          </button>
        </DialogClose>

        {hasHero ? (
          <div className="px-2 pt-2">
            <div className="flex aspect-464/261 w-full items-center justify-center overflow-hidden rounded-lg bg-black/8 dark:bg-white/8">
              {hero ?? (
                imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={imageAlt}
                    className="size-full object-cover"
                  />
                ) : null
              )}
            </div>
          </div>
        ) : null}

        <div className={cn('flex-1 px-6', hasHero ? 'pt-3' : 'pt-5')}>
          <DialogTitle className="text-left text-base leading-snug font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-left text-sm leading-relaxed text-foreground">
            {description}
          </DialogDescription>
        </div>

        {footer}
      </DialogContent>
    </Dialog>
  )
}

export interface FramedAnnouncementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  imageAlt?: string
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
  showArrow?: boolean
  className?: string
}

export function FramedAnnouncementModal({
  open,
  onOpenChange,
  imageSrc,
  imageAlt,
  title,
  description,
  actionLabel,
  onAction,
  showArrow = true,
  className,
}: FramedAnnouncementModalProps) {
  const handleAction = () => {
    onAction?.()
    onOpenChange(false)
  }

  return (
    <FramedAnnouncementModalFrame
      open={open}
      onOpenChange={onOpenChange}
      imageSrc={imageSrc}
      imageAlt={imageAlt}
      title={title}
      description={description}
      className={className}
      footer={
        <div className="flex items-center justify-end px-6 pt-5 pb-6">
          <Button className="min-w-[80px] gap-1" onClick={handleAction}>
            {actionLabel}
            {showArrow ? <ArrowRightIcon className="size-[18px]" /> : null}
          </Button>
        </div>
      }
    />
  )
}
