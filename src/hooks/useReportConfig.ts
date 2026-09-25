import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { TrustWithRelations, Van } from '@/lib/heartbeat-types'
import { supabase } from '@/lib/supabase'

export function useReportConfig() {
  const [trusts, setTrusts] = useState<TrustWithRelations[]>([])
  const [unassigned, setUnassigned] = useState<Van[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [trustsResult, unassignedResult] = await Promise.all([
      supabase
        .from('trusts')
        .select(
          `
          id, name, slug, daily_enabled, weekly_enabled, active, created_at,
          vans ( id, trust_id, instance, display_name, modality_target, daily_enabled, weekly_enabled, speed_floor, status, created_at ),
          recipients ( id, trust_id, name, email, active, created_at )
        `,
        )
        .order('name', { ascending: true }),
      supabase
        .from('vans')
        .select(
          'id, trust_id, instance, display_name, modality_target, daily_enabled, weekly_enabled, speed_floor, status, created_at',
        )
        .eq('status', 'unassigned')
        .order('instance', { ascending: true }),
    ])

    if (trustsResult.error) {
      setError(trustsResult.error.message)
      setLoading(false)
      return
    }
    if (unassignedResult.error) {
      setError(unassignedResult.error.message)
      setLoading(false)
      return
    }

    const nextTrusts = (trustsResult.data ?? []).map((trust) => ({
      ...trust,
      vans: [...(trust.vans ?? [])].sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
      recipients: [...(trust.recipients ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    })) as TrustWithRelations[]

    setTrusts(nextTrusts)
    setUnassigned((unassignedResult.data ?? []) as Van[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { trusts, unassigned, loading, error, reload }
}

export async function runMutation(
  label: string,
  action: () => PromiseLike<{ error: { message: string } | null }>,
  onSuccess?: () => void | Promise<void>,
) {
  const { error } = await action()
  if (error) {
    toast.error(error.message)
    return false
  }
  toast.success(label)
  await onSuccess?.()
  return true
}
