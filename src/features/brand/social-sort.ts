import type { BrandSocialAccount } from './brand-api'
import type { PlatformRecord } from '../publishing/publishing-api'

export interface SocialOverviewItem {
  platform: PlatformRecord
  account: BrandSocialAccount | null
}

export function buildSocialOverview(platforms: PlatformRecord[], accounts: BrandSocialAccount[]) {
  return platforms
    .map((platform) => ({
      platform,
      account: accounts.find((account) => account.platform_id === platform.id) ?? null,
    }))
    .sort((left, right) => {
      const leftFollowers = left.account?.followers
      const rightFollowers = right.account?.followers
      if (leftFollowers == null && rightFollowers != null) return 1
      if (leftFollowers != null && rightFollowers == null) return -1
      if (leftFollowers != null && rightFollowers != null && leftFollowers !== rightFollowers) {
        return rightFollowers - leftFollowers
      }
      return left.platform.name.localeCompare(right.platform.name, 'en')
    })
}

export function socialPlatformName(code: string, fallback: string, zh: boolean) {
  if (!zh) return fallback
  if (code === 'xhs') return '小红书'
  if (code === 'douyin') return '抖音'
  return fallback
}

export function formatFollowerCount(value: number | null, zh: boolean) {
  if (value == null) return zh ? '待核对' : 'Pending'
  return new Intl.NumberFormat('en-MY', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}
