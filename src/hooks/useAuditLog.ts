import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEntry } from '@/lib/heartbeat-types'
import { supabase } from '@/lib/supabase'

const DEFAULT_PAGE_SIZE = 40

export function useAuditLog(pageSize = DEFAULT_PAGE_SIZE) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingMoreRef = useRef(false)

  const fetchPage = useCallback(
    async (offset: number) => {
      const { data, error: queryError } = await supabase
        .from('audit_log')
        .select('id, at, user_id, action, entity, entity_id, before, after')
        .order('at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (queryError) {
        throw new Error(queryError.message)
      }
      return (data ?? []) as AuditEntry[]
    },
    [pageSize],
  )

  useEffect(() => {
    let active = true

    async function loadInitial() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPage(0)
        if (!active) return
        setEntries(data)
        setHasMore(data.length === pageSize)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load audit log')
        setEntries([])
        setHasMore(false)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitial()
    return () => {
      active = false
    }
  }, [fetchPage, pageSize])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const data = await fetchPage(entries.length)
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id))
        const next = data.filter((e) => !seen.has(e.id))
        return next.length ? [...prev, ...next] : prev
      })
      setHasMore(data.length === pageSize)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [entries.length, fetchPage, hasMore, pageSize])

  return { entries, loading, loadingMore, hasMore, error, loadMore }
}
