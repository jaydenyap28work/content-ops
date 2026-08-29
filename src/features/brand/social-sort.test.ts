import { describe, expect, it } from 'vitest'
import type { BrandSocialAccount } from './brand-api'
import type { PlatformRecord } from '../publishing/publishing-api'
import { buildSocialOverview, formatFollowerCount, socialPlatformName } from './social-sort'

const platforms = [
  { id: 'a', code: 'facebook', name: 'Facebook' },
  { id: 'b', code: 'douyin', name: 'Douyin' },
  { id: 'c', code: 'youtube', name: 'YouTube' },
] satisfies PlatformRecord[]

const account = (id: string, platformId: string, followers: number | null) => ({
  id, platform_id: platformId, followers,
} as BrandSocialAccount)

describe('social account overview ordering', () => {
  it('sorts known follower counts descending and keeps unknown values last', () => {
    const result = buildSocialOverview(platforms, [account('1', 'a', 1200), account('2', 'c', 3200), account('3', 'b', null)])
    expect(result.map((item) => item.platform.code)).toEqual(['youtube', 'facebook', 'douyin'])
  })

  it('never displays unknown followers as zero and localizes Douyin', () => {
    expect(formatFollowerCount(null, true)).toBe('待核对')
    expect(socialPlatformName('douyin', 'Douyin', true)).toBe('抖音')
  })
})
