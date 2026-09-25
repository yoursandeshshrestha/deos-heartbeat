import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json } from './http.js'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function clientKey(req: VercelRequest, scope: string) {
  const forwarded = req.headers['x-forwarded-for']
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : req.socket?.remoteAddress
  return `${scope}:${ip || 'unknown'}`
}

/**
 * Simple in-memory rate limit (per serverless instance).
 * Good enough for report workflow; not a global edge limiter.
 */
export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  options: { scope: string; limit: number; windowMs: number },
): boolean {
  const key = clientKey(req, options.scope)
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return true
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    json(res, 429, { error: 'Too many requests' })
    return false
  }

  existing.count += 1
  return true
}
