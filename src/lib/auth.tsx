import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { JwtPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isRole, type Role } from '@/lib/roles'
import {
  clearSessionStarted,
  getSessionStartedAt,
  isSessionExpired,
  markSessionStarted,
} from '@/lib/session'

type Identity = {
  userId: string | null
  email: string | null
  fullName: string | null
  role: Role | null
}

type AuthContextValue = Identity & {
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const EMPTY: Identity = {
  userId: null,
  email: null,
  fullName: null,
  role: null,
}

const AuthContext = createContext<AuthContextValue | null>(null)

function identityFromClaims(claims: JwtPayload | undefined): Identity {
  if (!claims?.sub) return EMPTY
  const appMetadata = claims.app_metadata
  const userMetadata = claims.user_metadata
  const roleValue =
    appMetadata && typeof appMetadata === 'object' && 'role' in appMetadata
      ? appMetadata.role
      : undefined
  const fullName =
    userMetadata && typeof userMetadata === 'object' && 'full_name' in userMetadata
      ? userMetadata.full_name
      : undefined

  return {
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    fullName: typeof fullName === 'string' ? fullName : null,
    role: isRole(roleValue) ? roleValue : null,
  }
}

async function identityFromProfile(identity: Identity): Promise<Identity> {
  if (!identity.userId) return identity

  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', identity.userId)
    .maybeSingle()

  if (error || !data) return identity

  return {
    userId: identity.userId,
    email: data.email || identity.email,
    fullName: data.full_name,
    role: isRole(data.role) ? data.role : null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadClaims() {
      if (isSessionExpired()) {
        clearSessionStarted()
        await supabase.auth.signOut()
        if (!active) return
        setIdentity(EMPTY)
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.getClaims()
      if (!active) return
      if (error || !data?.claims?.sub) {
        clearSessionStarted()
        setIdentity(EMPTY)
      } else {
        const next = await identityFromProfile(identityFromClaims(data.claims))
        if (!active) return
        setIdentity(next)
      }
      setLoading(false)
    }

    void loadClaims()

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && getSessionStartedAt() == null) {
        markSessionStarted()
      }
      if (event === 'SIGNED_OUT') {
        clearSessionStarted()
      }
      // Avoid calling Supabase again inside this callback; it can deadlock the client.
      setTimeout(() => {
        void loadClaims()
      }, 0)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...identity,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (!error) {
          markSessionStarted()
        }
        return error?.message ?? null
      },
      async signOut() {
        clearSessionStarted()
        await supabase.auth.signOut()
      },
    }),
    [identity, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
