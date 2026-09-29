import type { VercelRequest, VercelResponse } from '@vercel/node'
import { optionalEnv } from './_lib/env.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'

export const config = {
  regions: ['lhr1'],
}

/**
 * Called by Vercel Cron every 5 minutes.
 * If /api/health is unhealthy and UPTIME_WEBHOOK_URL is set, posts to Thrumble channel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const authHeader = req.headers.authorization
  const cronSecret = optionalEnv('CRON_SECRET')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const healthUrl = `${proto}://${host}/api/health`

  let healthy = false
  let body: unknown = null
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(8_000) })
    body = await response.json()
    healthy = response.ok && Boolean((body as { ok?: boolean }).ok)
  } catch (error) {
    body = {
      error: error instanceof Error ? error.message : 'health fetch failed',
    }
  }

  if (healthy) {
    return json(res, 200, { ok: true, alerted: false, health: body })
  }

  const webhook = optionalEnv('UPTIME_WEBHOOK_URL')
  let alerted = false
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Deos Heartbeat uptime check failed: ${healthUrl}`,
        health: body,
      }),
    })
    alerted = true
  }

  return json(res, 503, { ok: false, alerted, health: body })
}
