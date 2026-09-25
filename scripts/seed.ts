import { createClient } from '@supabase/supabase-js'
import { ACCOUNTS } from '../src/lib/accounts'

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_ADMIN_PASSWORD || 'sandesh@1409'

if (!url || !serviceRoleKey) {
  console.error('Need VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureUser(account: (typeof ACCOUNTS)[number]) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) throw listError

  const existing = listed.users.find(
    (user) => user.email?.toLowerCase() === account.email.toLowerCase(),
  )

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { role: account.role },
      user_metadata: { full_name: account.fullName },
    })
    if (error) throw error
    await upsertProfile(existing.id, account)
    console.log(`updated ${account.email}`)
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    app_metadata: { role: account.role },
    user_metadata: { full_name: account.fullName },
  })
  if (error) throw error
  if (!data.user) throw new Error(`No user returned for ${account.email}`)
  await upsertProfile(data.user.id, account)
  console.log(`created ${account.email}`)
}

async function upsertProfile(userId: string, account: (typeof ACCOUNTS)[number]) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
    },
    { onConflict: 'id' },
  )
  if (error) {
    // Profiles table may not exist yet — auth + app_metadata is enough to sign in.
    console.warn(`profiles upsert skipped for ${account.email}: ${error.message}`)
  }
}

async function ensureDemoTrust() {
  const { data: existing, error: existingError } = await admin
    .from('trusts')
    .select('id')
    .eq('slug', 'demo')
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    console.log('demo trust already present')
    return existing.id as string
  }

  const { data: trust, error: trustError } = await admin
    .from('trusts')
    .insert({
      name: 'Demo Trust',
      slug: 'demo',
      daily_enabled: true,
      weekly_enabled: true,
      active: true,
    })
    .select('id')
    .single()
  if (trustError) throw trustError

  const { error: vanError } = await admin.from('vans').insert([
    {
      trust_id: trust.id,
      instance: 'demo.van1-example',
      display_name: 'Demo Van 1',
      modality_target: 'demo.van1-example:104',
      daily_enabled: true,
      weekly_enabled: true,
      status: 'active',
    },
    {
      trust_id: trust.id,
      instance: 'demo.van2-paused',
      display_name: 'Demo Van 2 (paused)',
      daily_enabled: false,
      weekly_enabled: false,
      status: 'paused',
    },
  ])
  if (vanError) throw vanError

  const { error: recipientError } = await admin.from('recipients').insert({
    trust_id: trust.id,
    name: 'Demo Recipient',
    email: 'reports@ukdeos.com',
    active: true,
  })
  if (recipientError) throw recipientError

  console.log(`created demo trust ${trust.id}`)
  return trust.id as string
}

async function main() {
  for (const account of ACCOUNTS) {
    await ensureUser(account)
  }
  await ensureDemoTrust()
  console.log('seed done')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
