import { describe, expect, it } from 'vitest'
import {
  displayNameFromInstance,
  isExcludedInstance,
  trustSlugFromInstance,
} from './queries'

describe('isExcludedInstance', () => {
  it('excludes hubs, routers, and xray-mob', () => {
    expect(isExcludedInstance('bradford.dserver')).toBe(true)
    expect(isExcludedInstance('southampton.mamo-dserver')).toBe(true)
    expect(isExcludedInstance('milton_keynes.vserver')).toBe(true)
    expect(isExcludedInstance('bradford.van1.router')).toBe(true)
    expect(isExcludedInstance('oxford.van1.router2')).toBe(true)
    expect(isExcludedInstance('north_midlands.xray-mob')).toBe(true)
    expect(isExcludedInstance('bradford.van1-penyghent')).toBe(false)
  })
})

describe('instance helpers', () => {
  it('derives trust slug and display name', () => {
    expect(trustSlugFromInstance('bradford.van3-ingleborough')).toBe('bradford')
    expect(displayNameFromInstance('bradford.van3-ingleborough')).toBe(
      'van3-ingleborough',
    )
  })
})
