import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Enter activates the dialog's primary action (confirm / delete / submit)
 * instead of whichever Cancel button currently has focus.
 */
export function handleDialogEnterConfirm(
  event: ReactKeyboardEvent<HTMLElement>
): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
    return
  }
  if (event.defaultPrevented) return

  const target = event.target as HTMLElement | null
  if (!target) return

  // Multi-line editors keep newline behavior.
  if (target.closest('textarea, [contenteditable="true"]')) return

  // Let open menus / listboxes handle their own Enter.
  if (
    target.closest(
      '[role="listbox"], [role="menu"], [data-radix-menu-content], [data-radix-select-content]'
    )
  ) {
    return
  }

  const content = event.currentTarget

  const action = findDialogPrimaryAction(content)
  if (action) {
    if (action === target || action.contains(target)) return
    event.preventDefault()
    action.click()
    return
  }

  // Single-line inputs already submit their form on Enter.
  if (target.tagName === 'INPUT' && target.closest('form')) return

  const submit = content.querySelector<HTMLButtonElement>(
    'form button[type="submit"]:not(:disabled)'
  )
  if (!submit || isDisabledControl(submit)) return
  if (submit === target || submit.contains(target)) return

  event.preventDefault()
  submit.click()
}

function findDialogPrimaryAction(content: HTMLElement): HTMLElement | null {
  const explicit = content.querySelector<HTMLElement>('[data-dialog-primary-action]')
  if (explicit && !isDisabledControl(explicit)) return explicit

  const alertAction = content.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]')
  if (alertAction && !isDisabledControl(alertAction)) return alertAction

  const footer = content.querySelector(
    '[data-slot="dialog-footer"], [data-slot="alert-dialog-footer"]'
  )
  if (footer) {
    const destructive = footer.querySelector<HTMLElement>('button[data-variant="destructive"]')
    if (destructive && !isDisabledControl(destructive)) return destructive

    const submit = footer.querySelector<HTMLElement>('button[type="submit"]')
    if (submit && !isDisabledControl(submit)) return submit

    const buttons = [...footer.querySelectorAll<HTMLElement>('button[data-slot="button"]')].filter(
      (button) => !isDisabledControl(button)
    )

    const nonSecondary = buttons.find((button) => {
      const variant = button.getAttribute('data-variant')
      return variant !== 'outline' && variant !== 'ghost' && variant !== 'link'
    })
    if (nonSecondary) return nonSecondary

    if (buttons.length > 0) return buttons[buttons.length - 1] ?? null
  }

  return null
}

function isDisabledControl(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return true
  if (el.getAttribute('aria-disabled') === 'true') return true
  if (el instanceof HTMLButtonElement && el.disabled) return true
  return false
}
