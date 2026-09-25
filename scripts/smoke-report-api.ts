/**
 * Smoke-test report-config / report-runs DB behaviour without Vercel.
 * Usage: bun --env-file=.env scripts/smoke-report-api.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Need Supabase URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: trusts, error } = await db
    .from('trusts')
    .select(
      `
      id, name, slug, daily_enabled, weekly_enabled,
      vans ( id, instance, display_name, daily_enabled, weekly_enabled, status ),
      recipients ( id, name, email, active )
    `,
    )
    .eq('active', true)

  if (error) throw error

  const filtered = (trusts ?? []).map((trust) => ({
    ...trust,
    vans: (trust.vans ?? []).filter((van: { status: string }) => van.status === 'active'),
    recipients: (trust.recipients ?? []).filter((r: { active: boolean }) => r.active),
  }))

  console.log('report-config trusts:', filtered.length)
  console.log(JSON.stringify(filtered, null, 2))

  const target = filtered[0]
  if (!target) {
    console.log('no active trusts — assign vans in Reports or create a trust first')
    return
  }

  const { data: run, error: runError } = await db
    .from('report_runs')
    .insert({
      trust_id: target.id,
      report_type: 'daily',
      status: 'success',
      error: null,
    })
    .select('id, trust_id, report_type, status, run_at')
    .single()

  if (runError) throw runError
  console.log(`report-run inserted for ${target.slug}:`, run)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
