import { useEffect, useState } from 'react'
import type { AuditEntry } from '@/lib/heartbeat-types'
import { supabase } from '@/lib/supabase'

export function useAuditLog(limit = 100) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const { data, error: queryError } = await supabase
        .from('audit_log')
        .select('id, at, user_id, action, entity, entity_id, before, after')
        .order('at', { ascending: false })
        .limit(limit)

      if (!active) return
      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }
      setEntries((data ?? []) as AuditEntry[])
      setError(null)
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [limit])

  return { entries, loading, error }
}
