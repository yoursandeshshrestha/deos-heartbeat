import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import {
  ROLE_ACCESS,
  ROLE_OPTIONS,
  roleBadgeClass,
  roleLabel,
  type Role,
} from '@/lib/roles'
import { cn } from '@/lib/utils'
import { serverFetch } from '@/lib/serverApi'
import { supabase } from '@/lib/supabase'

type ProfileUser = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  created_at: string
  updated_at: string
}

const overviewCardClass =
  'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export function UsersPage() {
  const { role, userId } = useAuth()
  const canWrite = role === 'admin'
  const [users, setUsers] = useState<ProfileUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const response = await serverFetch('/api/users', { headers })
      const payload = (await response.json()) as {
        error?: string
        users?: ProfileUser[]
      }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load users')
      }
      setUsers(payload.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!canWrite) {
    return (
      <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
        <PageEmptyState
          title="Admins only"
          description="Ask an admin if you need an account or a different role."
        />
      </div>
    )
  }

  if (loading) return <PageLoading />

  if (error) {
    return (
      <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
        <PageEmptyState title="Could not load users" description={error} />
      </div>
    )
  }

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add people and choose what they can do on Heartbeat.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      <div className="content-section__content space-y-6 pt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const access = ROLE_ACCESS[option.value]
            return (
              <section key={option.value} className={overviewCardClass}>
                <div className={overviewHeaderClass}>
                  <span className="text-foreground">{access.label}</span>
                  <Badge className={cn('border-0', roleBadgeClass(option.value))}>
                    {option.value}
                  </Badge>
                </div>
                <div className="space-y-3 px-4 py-4 text-sm">
                  <p className="text-muted-foreground">{access.summary}</p>
                  <ul className="space-y-1.5 text-foreground">
                    {access.can.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    {access.cannot.map((item) => (
                      <li key={item} className="flex gap-2 text-muted-foreground">
                        <span>—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )
          })}
        </div>

        <section className={overviewCardClass}>
          <div className={overviewHeaderClass}>
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              People
            </span>
            <span className="text-sm tabular-nums">{users.length}</span>
          </div>
          {!users.length ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No users yet. Add someone to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === userId}
                  onReload={reload}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={reload} />
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  onReload,
}: {
  user: ProfileUser
  isSelf: boolean
  onReload: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function updateRole(nextRole: string) {
    if (nextRole === user.role) return
    setSaving(true)
    try {
      const headers = await authHeaders()
      const response = await serverFetch('/api/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: user.id, role: nextRole }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error ?? 'Could not update role')
        return
      }
      toast.success(`Role updated to ${roleLabel(nextRole as Role)}`)
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {user.full_name || 'Unnamed'}
          {isSelf ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>
          ) : null}
        </div>
        <div className="truncate text-sm text-muted-foreground">{user.email}</div>
      </div>
      <div className="w-40">
        <Combobox
          data={ROLE_OPTIONS}
          type="role"
          value={user.role}
          onValueChange={(value) => {
            void updateRole(value)
          }}
        >
          <ComboboxTrigger className="w-full" disabled={saving} />
          <ComboboxContent>
            <ComboboxInput />
            <ComboboxList>
              <ComboboxEmpty>No role found</ComboboxEmpty>
              <ComboboxGroup>
                {ROLE_OPTIONS.map((option) => (
                  <ComboboxItem key={option.value} value={option.value}>
                    {option.label}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const headers = await authHeaders()
      const response = await serverFetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error ?? 'Could not create user')
        return
      }
      toast.success('User created')
      onOpenChange(false)
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('viewer')
      await onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates a login and assigns a role. Share the password securely —
              they can change it later via support if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Access</Label>
              <Combobox
                data={ROLE_OPTIONS}
                type="role"
                value={role}
                onValueChange={(value) => setRole(value as Role)}
              >
                <ComboboxTrigger className="w-full" />
                <ComboboxContent>
                  <ComboboxInput />
                  <ComboboxList>
                    <ComboboxEmpty>No role found</ComboboxEmpty>
                    <ComboboxGroup>
                      {ROLE_OPTIONS.map((option) => (
                        <ComboboxItem key={option.value} value={option.value}>
                          {option.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className="text-xs text-muted-foreground">
                {ROLE_ACCESS[role].summary}
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} data-dialog-primary-action>
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
