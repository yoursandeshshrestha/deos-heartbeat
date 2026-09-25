import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { PageLoading } from '@/components/layout/PageLoading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'

export function LoginPage() {
  const { loading, userId, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <PageLoading variant="full" />
  }

  if (userId) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const message = await signIn(email, password)
    setSubmitting(false)
    if (message) setError(message)
  }

  async function signInAs(nextEmail: string) {
    setSubmitting(true)
    setError(null)
    const message = await signIn(nextEmail, __DEV_LOGIN_PASSWORD__)
    setSubmitting(false)
    if (message) setError(message)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="surface-card w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          UKDEOS
        </p>
        <h1 className="mt-2 text-xl font-medium tracking-tight">Deos Heartbeat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your admin account.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" loading={submitting} disabled={loading}>
            Sign in
          </Button>
        </form>
      </div>

      {__DEV_LOGIN_PASSWORD__ ? (
        <div className="absolute bottom-4 left-4 z-10 flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
          {__DEV_LOGINS__.filter((login) => login.email).map((login) => (
            <button
              key={login.email}
              type="button"
              className="cursor-pointer text-left text-xs text-muted-foreground hover:text-foreground"
              disabled={submitting || loading}
              onClick={() => {
                void signInAs(login.email)
              }}
            >
              {login.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
