/** Shared field surface — radius matches buttons (`rounded-md`) */
export const fieldSurfaceClassName =
  'rounded-md border border-border-subtle bg-surface text-foreground outline-none focus-visible:ring-0'

/** Modal / dialog backdrop — lighter blur (matches account settings modal) */
export const modalOverlayClassName =
  'bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm dark:bg-black/30'

/** Dropdown / popover / command panel surface */
export const menuContentClassName =
  'rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5'

/** Segmented control container (tabs list, toggle group) */
export const segmentedControlClassName = 'rounded-xl'

/** Full-width trigger buttons (combobox, date/time pickers) */
export const triggerFieldButtonClassName =
  'h-9 w-full justify-start gap-2 px-3 font-normal'

export const inputFieldClassName = [
  'h-9 w-full min-w-0 px-3 py-1 text-base md:text-sm',
  'placeholder:text-muted-foreground',
  'transition-colors',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  fieldSurfaceClassName,
].join(' ')

export const selectTriggerFieldClassName = [
  'flex w-fit items-center justify-between gap-1.5 px-3 py-2 text-sm whitespace-nowrap',
  'transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'data-placeholder:text-muted-foreground',
  'data-[size=default]:h-9 data-[size=sm]:h-8',
  'aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  fieldSurfaceClassName,
].join(' ')

export const textareaFieldClassName = [
  'flex field-sizing-content min-h-16 w-full resize-none px-3 py-3 text-base md:text-sm',
  'placeholder:text-muted-foreground',
  'transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  fieldSurfaceClassName,
].join(' ')

/** For textareas inside flex/grid shells — avoids content-driven width overflow. */
export const textareaConstrainedClassName = [
  'block field-sizing-fixed min-h-0 w-full min-w-0 max-w-full resize-none overflow-x-hidden overflow-y-auto px-3 py-3 text-base md:text-sm',
  'placeholder:text-muted-foreground',
  'transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  fieldSurfaceClassName,
].join(' ')

export const inputGroupFieldClassName = [
  'group/input-group relative flex h-9 w-full min-w-0 items-center',
  'transition-colors',
  'in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0',
  'has-data-[align=block-end]:rounded-md has-data-[align=block-start]:rounded-md',
  'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-[3px] has-[[data-slot][aria-invalid=true]]:ring-destructive/20',
  'has-[textarea]:rounded-md',
  'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col',
  'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col',
  'has-[>textarea]:h-auto',
  'dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
  'has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3',
  'has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
  fieldSurfaceClassName,
].join(' ')
