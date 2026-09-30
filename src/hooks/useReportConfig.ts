import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Trust, TrustWithRelations, Van, Recipient } from '@/lib/heartbeat-types'
import { supabase } from '@/lib/supabase'

type ReportState = {
  trusts: TrustWithRelations[]
  unassigned: Van[]
}

export type TrustPatch = Partial<Pick<Trust, 'daily_enabled' | 'weekly_enabled' | 'active'>>
export type VanPatch = Partial<Pick<Van, 'daily_enabled' | 'weekly_enabled' | 'status'>>
export type RecipientPatch = Partial<Pick<Recipient, 'active'>>

function findVan(state: ReportState, id: string) {
  for (const trust of state.trusts) {
    const van = trust.vans.find((item) => item.id === id)
    if (van) return van
  }
  return state.unassigned.find((item) => item.id === id) ?? null
}

function sortVans(vans: Van[]) {
  return [...vans].sort((a, b) => a.display_name.localeCompare(b.display_name))
}

export function applyVanPatch(state: ReportState, id: string, patch: VanPatch): ReportState {
  const current = findVan(state, id)
  if (!current) return state
  const next = { ...current, ...patch }

  if (patch.status === 'unassigned') {
    return {
      trusts: state.trusts.map((trust) => ({
        ...trust,
        vans: trust.vans.filter((van) => van.id !== id),
      })),
      unassigned: [...state.unassigned.filter((van) => van.id !== id), next].sort((a, b) =>
        a.instance.localeCompare(b.instance),
      ),
    }
  }

  if (patch.status === 'removed') {
    return {
      trusts: state.trusts.map((trust) => ({
        ...trust,
        vans: trust.vans.map((van) => (van.id === id ? next : van)),
      })),
      unassigned: state.unassigned.filter((van) => van.id !== id),
    }
  }

  return {
    trusts: state.trusts.map((trust) => ({
      ...trust,
      vans: trust.vans.map((van) => (van.id === id ? next : van)),
    })),
    unassigned: state.unassigned.map((van) => (van.id === id ? next : van)),
  }
}

export function restoreVan(state: ReportState, previous: Van): ReportState {
  const stripped: ReportState = {
    trusts: state.trusts.map((trust) => ({
      ...trust,
      vans: trust.vans.filter((van) => van.id !== previous.id),
    })),
    unassigned: state.unassigned.filter((van) => van.id !== previous.id),
  }

  if (previous.status === 'unassigned') {
    return {
      trusts: stripped.trusts,
      unassigned: [...stripped.unassigned, previous].sort((a, b) =>
        a.instance.localeCompare(b.instance),
      ),
    }
  }

  return {
    trusts: stripped.trusts.map((trust) =>
      trust.id === previous.trust_id
        ? { ...trust, vans: sortVans([...trust.vans, previous]) }
        : trust,
    ),
    unassigned: stripped.unassigned,
  }
}

export function useReportConfig() {
  const [trusts, setTrusts] = useState<TrustWithRelations[]>([])
  const [unassigned, setUnassigned] = useState<Van[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const stateRef = useRef<ReportState>({ trusts, unassigned })
  stateRef.current = { trusts, unassigned }

  const commit = useCallback((next: ReportState) => {
    stateRef.current = next
    setTrusts(next.trusts)
    setUnassigned(next.unassigned)
  }, [])

  const reload = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
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

    if (trustsResult.error || unassignedResult.error) {
      const message = trustsResult.error?.message ?? unassignedResult.error?.message ?? 'Could not load report config'
      if (!hasLoaded.current) {
        setError(message)
        setLoading(false)
      } else {
        toast.error(message)
      }
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

    const nextUnassigned = (unassignedResult.data ?? []) as Van[]
    hasLoaded.current = true
    commit({ trusts: nextTrusts, unassigned: nextUnassigned })
    setLoading(false)
  }, [commit])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateTrust = useCallback(
    async (id: string, patch: TrustPatch, label: string) => {
      const previous = stateRef.current.trusts.find((trust) => trust.id === id)
      if (!previous) return false
      commit({
        trusts: stateRef.current.trusts.map((trust) =>
          trust.id === id ? { ...trust, ...patch } : trust,
        ),
        unassigned: stateRef.current.unassigned,
      })

      const { error: updateError } = await supabase.from('trusts').update(patch).eq('id', id)
      if (updateError) {
        commit({
          trusts: stateRef.current.trusts.map((trust) => {
            if (trust.id !== id) return trust
            const restored = { ...trust }
            for (const key of Object.keys(patch) as (keyof TrustPatch)[]) {
              const value = previous[key]
              if (value !== undefined) restored[key] = value
            }
            return restored
          }),
          unassigned: stateRef.current.unassigned,
        })
        toast.error(updateError.message)
        return false
      }
      toast.success(label)
      return true
    },
    [commit],
  )

  const updateVan = useCallback(
    async (id: string, patch: VanPatch, label: string) => {
      const previous = findVan(stateRef.current, id)
      if (!previous) return false
      commit(applyVanPatch(stateRef.current, id, patch))

      const { error: updateError } = await supabase.from('vans').update(patch).eq('id', id)
      if (updateError) {
        commit(restoreVan(stateRef.current, previous))
        toast.error(updateError.message)
        return false
      }
      toast.success(label)
      return true
    },
    [commit],
  )

  const updateRecipient = useCallback(
    async (id: string, patch: RecipientPatch, label: string) => {
      let previous: Recipient | null = null
      for (const trust of stateRef.current.trusts) {
        const recipient = trust.recipients.find((item) => item.id === id)
        if (recipient) {
          previous = recipient
          break
        }
      }
      if (!previous) return false

      commit({
        trusts: stateRef.current.trusts.map((trust) => ({
          ...trust,
          recipients: trust.recipients.map((recipient) =>
            recipient.id === id ? { ...recipient, ...patch } : recipient,
          ),
        })),
        unassigned: stateRef.current.unassigned,
      })

      const { error: updateError } = await supabase
        .from('recipients')
        .update(patch)
        .eq('id', id)
      if (updateError) {
        const restore = previous
        commit({
          trusts: stateRef.current.trusts.map((trust) => ({
            ...trust,
            recipients: trust.recipients.map((recipient) =>
              recipient.id === id ? restore : recipient,
            ),
          })),
          unassigned: stateRef.current.unassigned,
        })
        toast.error(updateError.message)
        return false
      }
      toast.success(label)
      return true
    },
    [commit],
  )

  return { trusts, unassigned, loading, error, reload, updateTrust, updateVan, updateRecipient }
}
