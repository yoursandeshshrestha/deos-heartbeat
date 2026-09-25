import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Need VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error

  for (const user of data.users) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError
    console.log(`deleted ${user.email ?? user.id}`)
  }

  const { error: profilesError } = await admin.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (profilesError) {
    console.warn(`profiles clear skipped: ${profilesError.message}`)
  }

  console.log('clean done')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
