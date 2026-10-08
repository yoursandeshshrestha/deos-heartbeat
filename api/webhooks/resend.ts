import type { VercelRequest, VercelResponse } from '@vercel/node'
import { markDeliveryOpened, verifyResendSignature } from '../_lib/addons/resendWebhook.js'
import { readRawBody } from '../_lib/addons/freshdesk.js'
import { json, methodNotAllowed, refuseVercelFunction } from '../_lib/http.js'

export const config = { regions: ['lhr1'], maxDuration: 15 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const raw = readRawBody(req)
  if (!verifyResendSignature(raw, req.headers)) {
    return json(res, 401, { error: 'Invalid signature' })
  }

  let body: { type?: string; data?: { email_id?: string; created_at?: string } }
  try {
    body = JSON.parse(raw) as typeof body
  } catch {
    return json(res, 400, { error: 'Invalid JSON' })
  }

  if (body.type === 'email.opened' && body.data?.email_id) {
    try {
      await markDeliveryOpened(body.data.email_id, body.data.created_at ?? new Date().toISOString())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not record open'
      return json(res, 500, { error: message })
    }
  }

  return json(res, 200, { ok: true })
}
