/** Server-only env. Never expose these via VITE_*. */

function readEnv(name: string): string | undefined {
  const fromNode = typeof process !== 'undefined' ? process.env?.[name] : undefined
  if (fromNode) return fromNode
  const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno
  const fromDeno = deno?.env?.get?.(name)
  return fromDeno || undefined
}

export function requireEnv(name: string): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

export function optionalEnv(name: string): string | undefined {
  return readEnv(name)
}

export const grafana = {
  baseUrl: () =>
    optionalEnv('GRAFANA_BASE_URL') ?? 'https://mis.ukdeos.com/mon',
  token: () => optionalEnv('GRAFANA_TOKEN'),
  prometheusUid: () =>
    optionalEnv('GRAFANA_PROMETHEUS_UID') ?? 'cdmwy4dypbeo0e',
}

export const supabase = {
  url: () =>
    optionalEnv('SUPABASE_URL') ?? optionalEnv('VITE_SUPABASE_URL'),
  serviceRoleKey: () => optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  /** Publishable / anon — browser-safe; also useful for health checks. */
  publishableKey: () =>
    optionalEnv('SUPABASE_PUBLISHABLE_KEY') ??
    optionalEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
}

export const reportConfigKey = () => optionalEnv('REPORT_CONFIG_KEY')

export const reportEmail = {
  resendApiKey: () => optionalEnv('RESEND_API_KEY'),
  fromEmail: () =>
    optionalEnv('REPORT_FROM_EMAIL') ?? 'no-reply@mail.thrumble.ai',
  fromName: () => optionalEnv('REPORT_FROM_NAME') ?? 'Deos Heartbeat',
}
