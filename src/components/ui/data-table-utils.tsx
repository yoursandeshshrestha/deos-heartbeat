import { toast } from 'sonner'

export const dataTableHeadClass = 'px-6 py-2 text-left align-middle font-medium'
export const dataTableCellClass = 'px-6 py-2 text-left align-middle'

export function truncateTableId(value: string, length = 8) {
  if (value.length <= length) return value
  return `${value.slice(0, length)}…`
}

async function copyTableValue(value: string, label: string, event: React.MouseEvent) {
  event.stopPropagation()

  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

export function CopyableTableId({
  value,
  label,
  display,
}: {
  value: string
  label: string
  display?: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => copyTableValue(value, label, event)}
      className="cursor-pointer text-left font-mono text-foreground transition-colors hover:text-muted-foreground"
    >
      {display ?? value}
    </button>
  )
}
