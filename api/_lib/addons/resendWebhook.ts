import { createHmac, timingSafeEqual } from 'node:crypto'
import { optionalEnv } from '../env.js'
import { getServiceClient } from '../supabase.js'

function header(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name.toLowerCase()] ?? headers[name]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/** Resend signs webhooks with Svix. Secret is `whsec_` + base64 key. */
export function verifyResendSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
) {
  const secret = optionalEnv('RESEND_WEBHOOK_SECRET')
  if (!secret) return false
  const id = header(headers, 'svix-id')
  const timestamp = header(headers, 'svix-timestamp')
  const signature = header(headers, 'svix-signature')
  if (!id || !timestamp || !signature) return false
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 5 * 60) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64')
  return signature.split(' ').some((part) => {
    const value = part.split(',')[1]
    if (!value) return false
    const left = Buffer.from(value)
    const right = Buffer.from(expected)
    return left.length === right.length && timingSafeEqual(left, right)
  })
}

export async function markDeliveryOpened(resendId: string, openedAt: string) {
  const db = getServiceClient()
  const { error } = await db
    .from('report_deliveries')
    .update({ opened_at: openedAt })
    .eq('resend_id', resendId)
    .is('opened_at', null)
  if (error) throw new Error(error.message)
}
