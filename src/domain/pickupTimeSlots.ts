/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  return `${hours}:${index % 2 ? '30' : '00'}`
})

export type PickupTimeSettings = {
  serviceFeeHours: { morningStart: string; morningEnd: string; eveningStart: string; eveningEnd: string }
  businessHours: { start: string; end: string }
}

export const DEFAULT_PICKUP_TIME_SETTINGS: PickupTimeSettings = {
  serviceFeeHours: { morningStart: '07:00', morningEnd: '08:00', eveningStart: '21:00', eveningEnd: '23:00' },
  businessHours: { start: '09:00', end: '20:00' },
}

const validTime = (value: unknown, fallback: string) => HALF_HOUR_TIME_OPTIONS.includes(String(value)) ? String(value) : fallback
const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }

export function pickupTimeSettings(rules: any): PickupTimeSettings {
  const serviceFeeHours = rules?.serviceFeeHours || {}
  const businessHours = rules?.businessHours || {}
  return {
    serviceFeeHours: {
      morningStart: validTime(serviceFeeHours.morningStart, DEFAULT_PICKUP_TIME_SETTINGS.serviceFeeHours.morningStart),
      morningEnd: validTime(serviceFeeHours.morningEnd, DEFAULT_PICKUP_TIME_SETTINGS.serviceFeeHours.morningEnd),
      eveningStart: validTime(serviceFeeHours.eveningStart, DEFAULT_PICKUP_TIME_SETTINGS.serviceFeeHours.eveningStart),
      eveningEnd: validTime(serviceFeeHours.eveningEnd, DEFAULT_PICKUP_TIME_SETTINGS.serviceFeeHours.eveningEnd),
    },
    businessHours: {
      start: validTime(businessHours.start, DEFAULT_PICKUP_TIME_SETTINGS.businessHours.start),
      end: validTime(businessHours.end, DEFAULT_PICKUP_TIME_SETTINGS.businessHours.end),
    },
  }
}

export function hasValidPickupTimeSettings(settings: PickupTimeSettings): boolean {
  const service = settings.serviceFeeHours
  const business = settings.businessHours
  return minutes(service.morningStart) < minutes(service.morningEnd)
    && minutes(business.start) < minutes(business.end)
    && minutes(service.eveningStart) < minutes(service.eveningEnd)
    && minutes(service.morningEnd) <= minutes(business.start)
    && minutes(business.end) <= minutes(service.eveningStart)
}

export function serviceFeeRate(rules: any): number {
  const rate = Number(rules?.serviceFeeRate ?? 0.1)
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.1
}

const displayTime = (value: string) => value.replace(/^0/, '')

export function pickupTimeSlots(rules: any): Array<[string, string]> {
  const { serviceFeeHours, businessHours } = pickupTimeSettings(rules)
  const feePercent = Number((serviceFeeRate(rules) * 100).toFixed(2))
  return [
    ['morning_service', `${displayTime(serviceFeeHours.morningStart)}–${displayTime(serviceFeeHours.morningEnd)}（早间服务费 ${feePercent}%）`],
    ['morning', `${displayTime(businessHours.start)}–12:00（无服务费）`],
    ['afternoon', `13:00–${displayTime(businessHours.end)}（无服务费）`],
    ['evening_service', `${displayTime(serviceFeeHours.eveningStart)}–${displayTime(serviceFeeHours.eveningEnd)}（晚间服务费 ${feePercent}%）`],
  ]
}

export function pickupTimeSlotEndMinutes(slot: string, rules: any): number {
  const { serviceFeeHours, businessHours } = pickupTimeSettings(rules)
  const endTimes: Record<string, string> = {
    morning_service: serviceFeeHours.morningEnd,
    morning: '12:00',
    afternoon: businessHours.end,
    evening_service: serviceFeeHours.eveningEnd,
    delivery_morning: '12:00',
    delivery_afternoon: '19:00',
  }
  return endTimes[slot] ? minutes(endTimes[slot]) : 24 * 60
}
