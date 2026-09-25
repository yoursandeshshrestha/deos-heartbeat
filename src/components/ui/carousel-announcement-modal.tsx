import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  FramedAnnouncementModalFrame,
  type FramedAnnouncementContent,
} from '@/components/ui/framed-announcement-modal'
import {
  ArrowRight as ArrowRightIcon,
} from '@phosphor-icons/react'

export type CarouselAnnouncementStep = FramedAnnouncementContent

export interface CarouselAnnouncementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: CarouselAnnouncementStep[]
  nextLabel?: string
  finishLabel?: string
  onFinish?: () => void
  className?: string
}

export function CarouselAnnouncementModal({
  open,
  onOpenChange,
  steps,
  nextLabel = 'Next',
  finishLabel = 'Get started',
  onFinish,
  className,
}: CarouselAnnouncementModalProps) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
    }
  }, [open])

  if (steps.length === 0) {
    return null
  }

  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onFinish?.()
      onOpenChange(false)
      return
    }

    setStepIndex((current) => current + 1)
  }

  return (
    <FramedAnnouncementModalFrame
      open={open}
      onOpenChange={onOpenChange}
      imageSrc={step.imageSrc}
      imageAlt={step.imageAlt}
      title={step.title}
      description={step.description}
      className={className}
      footer={
        <div className="flex items-center justify-between px-6 pt-5 pb-6">
          <span className="text-sm text-muted-foreground">
            {stepIndex + 1} / {steps.length}
          </span>
          <Button className="min-w-[80px] gap-1" onClick={handleNext}>
            {isLastStep ? finishLabel : nextLabel}
            {!isLastStep ? <ArrowRightIcon className="size-[18px]" /> : null}
          </Button>
        </div>
      }
    />
  )
}
