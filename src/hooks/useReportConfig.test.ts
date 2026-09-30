import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))
import { applyVanPatch, restoreVan } from '@/hooks/useReportConfig'
import type { TrustWithRelations, Van } from '@/lib/heartbeat-types'

function van(overrides: Partial<Van> = {}): Van {
  return {
    id: 'van-1',
    trust_id: 'trust-1',
    instance: 'alpha.van',
    display_name: 'Alpha',
    modality_target: null,
    daily_enabled: true,
    weekly_enabled: true,
    speed_floor: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function state(vans: Van[], unassigned: Van[] = []) {
  const trust: TrustWithRelations = {
    id: 'trust-1',
    name: 'Alpha',
    slug: 'alpha',
    daily_enabled: true,
    weekly_enabled: true,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    vans,
    recipients: [],
  }
  return { trusts: [trust], unassigned }
}

describe('applyVanPatch', () => {
  it('flips a toggle without moving the van', () => {
    const next = applyVanPatch(state([van()]), 'van-1', { daily_enabled: false })
    expect(next.trusts[0]?.vans[0]?.daily_enabled).toBe(false)
    expect(next.unassigned).toEqual([])
  })

  it('moves an unassigned status out of the trust list', () => {
    const next = applyVanPatch(state([van()]), 'van-1', { status: 'unassigned' })
    expect(next.trusts[0]?.vans).toEqual([])
    expect(next.unassigned.map((item) => item.id)).toEqual(['van-1'])
  })

  it('drops a dismissed van from the unassigned list', () => {
    const loose = van({ id: 'van-2', trust_id: null, status: 'unassigned' })
    const next = applyVanPatch(state([], [loose]), 'van-2', { status: 'removed' })
    expect(next.unassigned).toEqual([])
  })

  it('puts a van back where it was after a failed save', () => {
    const original = van()
    const optimistic = applyVanPatch(state([original]), 'van-1', { status: 'unassigned' })
    const restored = restoreVan(optimistic, original)
    expect(restored.unassigned).toEqual([])
    expect(restored.trusts[0]?.vans[0]?.status).toBe('active')
  })
})
