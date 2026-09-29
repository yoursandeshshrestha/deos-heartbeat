import { optionalEnv } from '../env.js'
import { Resend } from 'resend'

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
  attachments?: Array<{
    filename: string
    content: string
  }>
}

function getResendClient() {
  const apiKey = optionalEnv('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }
  return new Resend(apiKey)
}

export function reportFromAddress() {
  const email =
    optionalEnv('REPORT_FROM_EMAIL') ?? 'no-reply@mail.thrumble.ai'
  const name = optionalEnv('REPORT_FROM_NAME') ?? 'Deos Heartbeat'
  return `${name} <${email}>`
}

/** Send a transactional email via Resend. */
export async function sendEmail(input: SendEmailInput) {
  const resend = getResendClient()
  const to = Array.isArray(input.to) ? input.to : [input.to]
  const { data, error } = await resend.emails.send({
    from: reportFromAddress(),
    to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  })
  if (error) {
    throw new Error(error.message || 'Resend send failed')
  }
  return { id: data?.id ?? null }
}
