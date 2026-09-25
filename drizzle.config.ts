import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Source of truth for applied DDL is supabase/migrations; Drizzle is typed mirror.
  strict: true,
  verbose: true,
})
