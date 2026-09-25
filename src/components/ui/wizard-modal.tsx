import type { ReactNode } from 'react'
import {
  Check as CheckIcon,
  X as XIcon,
} from '@phosphor-icons/react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface WizardStepItem {
  id: number
  label: string
}

interface WizardStepNavProps {
  steps: WizardStepItem[]
  currentStep: number
  className?: string
}

function WizardStepIndicator({
  stepNumber,
  isComplete,
  isCurrent,
}: {
  stepNumber: number
  isComplete: boolean
  isCurrent: boolean
}) {
  return (
    <div
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium leading-none',
        isComplete
          ? 'bg-status-active text-status-active-foreground'
          : isCurrent
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground',
      )}
      aria-hidden
    >
      {isComplete ? <CheckIcon className="size-2.5 stroke-3" /> : stepNumber}
    </div>
  )
}

export function WizardStepNav({ steps, currentStep, className }: WizardStepNavProps) {
  return (
    <nav className={cn('px-2', className)} aria-label="Wizard steps">
      {steps.map((item, index) => {
        const isComplete = item.id < currentStep
        const isCurrent = item.id === currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={item.id}>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                isCurrent
                  ? 'bg-sidebar-accent font-medium text-primary'
                  : isComplete
                    ? 'text-sidebar-foreground'
                    : 'text-muted-foreground',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <WizardStepIndicator
                stepNumber={item.id}
                isComplete={isComplete}
                isCurrent={isCurrent}
              />
              <span className="truncate text-[13px] tracking-[-0.01em]">{item.label}</span>
            </div>
            {!isLast ? (
              <div className="flex px-2">
                <div className="flex w-4 justify-center">
                  <div
                    className={cn(
                      'h-3.5 w-px',
                      isComplete
                        ? 'bg-status-active dark:bg-status-active/45'
                        : 'bg-border-subtle dark:bg-white/10',
                    )}
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

interface WizardModalFrameProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  sidebarTitle?: string
  sidebarDescription?: string
  steps?: WizardStepItem[]
  currentStep?: number
  sidebarContent?: ReactNode
  footer: ReactNode
  children: ReactNode
  className?: string
  /** When true, children expand to fill remaining vertical space (e.g. full-height textarea). */
  fillContent?: boolean
  showCloseButton?: boolean
  dismissible?: boolean
}

export function WizardModalFrame({
  open,
  onOpenChange,
  title,
  description,
  sidebarTitle = 'Create agent',
  sidebarDescription,
  steps = [],
  currentStep = 1,
  sidebarContent,
  footer,
  children,
  className,
  fillContent = false,
  showCloseButton = true,
  dismissible = true,
}: WizardModalFrameProps) {
  const resolvedSidebarDescription =
    sidebarDescription ??
    (steps.length > 0 ? `Step ${currentStep} of ${steps.length}` : undefined)

  function handleOpenChange(next: boolean) {
    if (!next && !dismissible) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => {
          if (!dismissible) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault()
        }}
        className={cn(
          'flex h-[min(580px,85vh)] max-h-[85vh] w-[min(920px,calc(100%-2rem))] max-w-[min(920px,calc(100%-2rem))]! flex-col gap-0 overflow-hidden rounded-2xl p-0! sm:max-w-[min(920px,calc(100%-2rem))]!',
          className,
        )}
      >
        {showCloseButton ? (
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-4 right-4 z-10 flex size-4 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-full" />
            </button>
          </DialogClose>
        ) : null}

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <aside className="flex min-h-0 min-w-0 shrink-0 flex-col border-b border-border-table bg-sidebar pb-3 sm:w-[250px] sm:border-r sm:border-b-0 sm:pb-0">
            <div className="shrink-0 p-3">
              <h2 className="text-sm font-medium text-foreground">{sidebarTitle}</h2>
              {resolvedSidebarDescription ? (
                <p className="text-sm text-muted-foreground">
                  {resolvedSidebarDescription}
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              {sidebarContent ?? (
                <WizardStepNav steps={steps} currentStep={currentStep} />
              )}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col px-6 py-5',
                fillContent ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
              )}
            >
              <div className="shrink-0 space-y-1">
                <DialogTitle className="text-left text-base leading-snug font-semibold">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="text-left text-sm leading-snug text-muted-foreground">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>

              <div className={cn('mt-4', fillContent && 'min-h-0 flex-1 overflow-hidden')}>
                {children}
              </div>
            </div>

            <div className="mt-auto shrink-0 border-t border-border-table px-6 py-4">{footer}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
