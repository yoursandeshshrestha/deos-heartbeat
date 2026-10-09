import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { MfaChallenge, MfaEnroll } from '@/components/MfaGate'
import { PageLoading } from '@/components/layout/PageLoading'
import { useAuth } from '@/lib/auth'
import { clearSessionStarted, isSessionExpired } from '@/lib/session'
import { supabase } from '@/lib/supabase'

type MfaStep = 'loading' | 'ok' | 'challenge' | 'enroll'

export function RequireAuth() {
  const { loading, userId, role, signOut } = useAuth()
  const [mfaStep, setMfaStep] = useState<MfaStep>('loading')

  useEffect(() => {
    if (loading) return
    if (!userId) {
      setMfaStep('ok')
      return
    }

    if (isSessionExpired()) {
      clearSessionStarted()
      void signOut()
      return
    }

    let active = true

    async function resolveMfa() {
      if (__BYPASS_AUTHENTICATOR__) {
        setMfaStep('ok')
        return
      }

      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!active) return
      if (error) {
        setMfaStep('ok')
        return
      }

      if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        setMfaStep('challenge')
        return
      }

      // Admin must enroll TOTP when none exists yet.
      if (role === 'admin' && data.currentLevel === 'aal1' && data.nextLevel === 'aal1') {
        setMfaStep('enroll')
        return
      }

      setMfaStep('ok')
    }

    void resolveMfa()

    const interval = window.setInterval(() => {
      if (isSessionExpired()) {
        clearSessionStarted()
        void signOut()
      }
    }, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [loading, userId, role, signOut])

  if (loading || (userId && mfaStep === 'loading')) {
    return <PageLoading variant="full" />
  }

  if (!userId) {
    return <Navigate to="/login" replace />
  }

  if (mfaStep === 'challenge') {
    return (
      <MfaChallenge
        onVerified={() => {
          setMfaStep('ok')
        }}
      />
    )
  }

  if (mfaStep === 'enroll') {
    return (
      <MfaEnroll
        onEnrolled={() => {
          setMfaStep('ok')
        }}
        onSkip={() => {
          setMfaStep('ok')
        }}
      />
    )
  }

  return <Outlet />
}

export function RequireRole({ allow }: { allow: Array<'admin' | 'viewer'> }) {
  const { role } = useAuth()

  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
