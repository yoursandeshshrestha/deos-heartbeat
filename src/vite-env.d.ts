/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __DEV_LOGIN_PASSWORD__: string
declare const __DEV_LOGINS__: { label: string; email: string }[]
/** Local `vite` only. True when BYPASS_AUTHENTICATOR is set. Never true in a production build. */
declare const __BYPASS_AUTHENTICATOR__: boolean
