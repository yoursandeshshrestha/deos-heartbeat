/** probe_success style: 1 means the check succeeded. */
export function checkLabel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value === 1 ? 'Working' : 'Not working'
}

/** deos status gauges: 0 means ok, anything else is a problem. */
export function serviceLabel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value === 0 ? 'Working' : 'Not working'
}
