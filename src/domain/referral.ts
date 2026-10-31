/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export const DEFAULT_REFERRAL_SETTINGS = {
  defaultRate: 10,
  levelLimit: 3,
  referralsPerLevel: 5,
  rateIncreasePerLevel: 0,
  settlementPeriod: 30,
}

export type ReferralSettings = typeof DEFAULT_REFERRAL_SETTINGS

// Fill fields absent from older saved settings without changing their base rate.
export function normalizeReferralSettings(input: Partial<ReferralSettings> = {}): ReferralSettings {
  const number = (key: keyof ReferralSettings, min: number, max = Number.MAX_SAFE_INTEGER, integer = false) => {
    const value = Number(input[key] ?? DEFAULT_REFERRAL_SETTINGS[key])
    return Number.isFinite(value) ? Math.min(max, Math.max(min, integer ? Math.floor(value) : value)) : DEFAULT_REFERRAL_SETTINGS[key]
  }
  return {
    defaultRate: number('defaultRate', 0, 100),
    levelLimit: number('levelLimit', 1, Number.MAX_SAFE_INTEGER, true),
    referralsPerLevel: number('referralsPerLevel', 1, Number.MAX_SAFE_INTEGER, true),
    rateIncreasePerLevel: number('rateIncreasePerLevel', 0, 100),
    settlementPeriod: number('settlementPeriod', 1, Number.MAX_SAFE_INTEGER, true),
  }
}

export function validateReferralSettings(settings: ReferralSettings): void {
  if (![settings.defaultRate, settings.rateIncreasePerLevel].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new Error('推荐分成比例和每级加成必须在 0% 到 100% 之间')
  }
  if (![settings.levelLimit, settings.referralsPerLevel, settings.settlementPeriod].every(value => Number.isSafeInteger(value) && value >= 1)) {
    throw new Error('最高推荐等级、升级人数和结算天数必须为正整数')
  }
}

export function calculateReferralTier(effectiveReferrals: number, input: Partial<ReferralSettings>) {
  const settings = normalizeReferralSettings(input)
  const count = Math.max(0, Math.floor(Number(effectiveReferrals) || 0))
  const level = Math.min(settings.levelLimit, 1 + Math.floor(count / settings.referralsPerLevel))
  const rate = Number(Math.min(100, settings.defaultRate + (level - 1) * settings.rateIncreasePerLevel).toFixed(2))
  return { level, rate, effectiveReferrals: count, referralsToNextLevel: level < settings.levelLimit ? level * settings.referralsPerLevel - count : 0 }
}

export function calculateReferralRent(order: { totalAmount: number; depositAmount?: number; deliveryFee?: number; serviceFee?: number }): number {
  const amount = Number(order.totalAmount || 0) - Number(order.depositAmount || 0) - Number(order.deliveryFee || 0) - Number(order.serviceFee || 0)
  return Number.isFinite(amount) ? Number(Math.max(0, amount).toFixed(2)) : 0
}
