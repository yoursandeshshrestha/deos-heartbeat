import { describe, expect, it } from 'vitest'
import { filterReportConfigTrusts } from './reportConfig'

describe('filterReportConfigTrusts', () => {
  it('drops inactive trusts, paused vans, and inactive recipients', () => {
    const result = filterReportConfigTrusts([
      {
        id: 't1',
        name: 'Active Trust',
        slug: 'active',
        daily_enabled: true,
        weekly_enabled: false,
        active: true,
        vans: [
          {
            id: 'v1',
            instance: 'a.van1',
            display_name: 'Van 1',
            daily_enabled: true,
            weekly_enabled: true,
            status: 'active',
          },
          {
            id: 'v2',
            instance: 'a.van2',
            display_name: 'Van 2',
            daily_enabled: true,
            weekly_enabled: true,
            status: 'paused',
          },
        ],
        recipients: [
          {
            id: 'r1',
            name: 'Alive',
            email: 'alive@ukdeos.com',
            active: true,
          },
          {
            id: 'r2',
            name: 'Gone',
            email: 'gone@ukdeos.com',
            active: false,
          },
        ],
      },
      {
        id: 't2',
        name: 'Inactive Trust',
        slug: 'inactive',
        daily_enabled: true,
        weekly_enabled: true,
        active: false,
        vans: [],
        recipients: [],
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('active')
    expect(result[0].vans).toHaveLength(1)
    expect(result[0].vans[0].instance).toBe('a.van1')
    expect(result[0].recipients).toHaveLength(1)
    expect(result[0].recipients[0].email).toBe('alive@ukdeos.com')
  })
})
