import { getServiceClient } from '../supabase.js'

export type Role = 'admin' | 'viewer'

export type ProfileUser = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  created_at: string
  updated_at: string
}

export function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'viewer'
}

export async function listUsers(): Promise<ProfileUser[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProfileUser[]
}

export async function createUser(input: {
  email: string
  fullName: string
  password: string
  role: Role
}): Promise<ProfileUser> {
  const db = getServiceClient()
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()

  if (!email.includes('@')) throw new Error('Valid email is required')
  if (!fullName) throw new Error('full_name is required')
  if (!input.password || input.password.length < 8) {
    throw new Error('password must be at least 8 characters')
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: fullName },
  })
  if (createError) throw new Error(createError.message)
  if (!created.user) throw new Error('User create returned no user')

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .upsert(
      {
        id: created.user.id,
        email,
        full_name: fullName,
        role: input.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id, email, full_name, role, created_at, updated_at')
    .single()

  if (profileError) throw new Error(profileError.message)
  return profile as ProfileUser
}

export async function updateUser(input: {
  id: string
  role?: Role
  fullName?: string
}): Promise<ProfileUser> {
  const db = getServiceClient()
  const { data: existing, error: existingError } = await db
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', input.id)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('user not found')

  const nextRole = input.role ?? (existing.role as Role)
  if (!isRole(nextRole)) throw new Error("role must be 'admin' or 'viewer'")

  const nextName =
    input.fullName !== undefined ? input.fullName.trim() : existing.full_name

  if (existing.role === 'admin' && nextRole !== 'admin') {
    const { count, error: countError } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if (countError) throw new Error(countError.message)
    if ((count ?? 0) <= 1) {
      throw new Error('Cannot demote the last admin')
    }
  }

  const { error: authError } = await db.auth.admin.updateUserById(input.id, {
    app_metadata: { role: nextRole },
    user_metadata: { full_name: nextName },
  })
  if (authError) throw new Error(authError.message)

  const { data: updated, error: updateError } = await db
    .from('profiles')
    .update({
      role: nextRole,
      full_name: nextName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('id, email, full_name, role, created_at, updated_at')
    .single()

  if (updateError) throw new Error(updateError.message)
  return updated as ProfileUser
}
