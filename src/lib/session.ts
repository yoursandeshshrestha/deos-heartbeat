const SESSION_STARTED_KEY = 'deos.session.startedAt'
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000

export function markSessionStarted(at = Date.now()) {
  try {
    localStorage.setItem(SESSION_STARTED_KEY, String(at))
  } catch {
    // ignore quota / private mode
  }
}

export function clearSessionStarted() {
  try {
    localStorage.removeItem(SESSION_STARTED_KEY)
  } catch {
    // ignore
  }
}

export function getSessionStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(SESSION_STARTED_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** Absolute 12h window from first mark (sign-in). */
export function isSessionExpired(now = Date.now()): boolean {
  const started = getSessionStartedAt()
  if (started == null) return false
  return now - started >= SESSION_MAX_MS
}
