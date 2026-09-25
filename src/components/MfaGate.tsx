import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const factors = await supabase.auth.mfa.listFactors()
    if (factors.error) {
      setSubmitting(false)
      setError(factors.error.message)
      return
    }

    const totpFactor = factors.data.totp.find((factor) => factor.status === 'verified')
    if (!totpFactor) {
      setSubmitting(false)
      setError('No verified authenticator found')
      return
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
    if (challenge.error) {
      setSubmitting(false)
      setError(challenge.error.message)
      return
    }

    const verify = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    })

    setSubmitting(false)
    if (verify.error) {
      setError(verify.error.message)
      return
    }

    onVerified()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="surface-card w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          UKDEOS
        </p>
        <h1 className="mt-2 text-xl font-medium tracking-tight">Authenticator code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
              required
              maxLength={10}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" loading={submitting}>
            Verify
          </Button>
        </form>
      </div>
    </div>
  )
}

export function MfaEnroll({
  onEnrolled,
  onSkip,
}: {
  onEnrolled: () => void
  onSkip?: () => void
}) {
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const { signOut } = useAuth()

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Deos Heartbeat',
      })
      if (!active) return
      if (enrollError) {
        setError(enrollError.message)
        setLoading(false)
        return
      }
      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const challenge = await supabase.auth.mfa.challenge({ factorId })
    if (challenge.error) {
      setSubmitting(false)
      setError(challenge.error.message)
      return
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    })
    setSubmitting(false)
    if (verify.error) {
      setError(verify.error.message)
      return
    }
    onEnrolled()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="surface-card w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          UKDEOS
        </p>
        <h1 className="mt-2 text-xl font-medium tracking-tight">Set up MFA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin accounts require an authenticator app before using Heartbeat.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Preparing QR code…</p>
        ) : factorId ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {qr ? (
              <img src={qr} alt="Authenticator QR code" className="mx-auto size-48 rounded-lg bg-white p-2" />
            ) : null}
            {secret ? (
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                {secret}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="enroll-code">Verification code</Label>
              <Input
                id="enroll-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.trim())}
                required
                maxLength={10}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" loading={submitting}>
              Enable MFA
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-destructive">
              {error ?? 'Could not start MFA enrollment.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Enable TOTP MFA in the Supabase Auth settings, then try again.
            </p>
            <div className="flex flex-col gap-2">
              {onSkip ? (
                <Button type="button" variant="outline" onClick={onSkip}>
                  Continue without MFA (temporary)
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
