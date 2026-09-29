/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)

export type TimeRange = { start: string; end: string }
export type WeeklyUnavailablePickupRange = TimeRange & { weekday: number }
export type PickupTimeSettings = {
  businessHours: TimeRange
  serviceFeeHours: TimeRange[]
  unavailablePickupHours: WeeklyUnavailablePickupRange[]
}

const defaults: PickupTimeSettings = {
  businessHours: { start: '09:00', end: '20:00' },
  serviceFeeHours: [{ start: '07:00', end: '08:00' }, { start: '21:00', end: '23:00' }],
  unavailablePickupHours: [],
}

export const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
const validTime = (value: unknown, fallback: string) => HALF_HOUR_TIME_OPTIONS.includes(String(value)) ? String(value) : fallback
const validRange = (value: any): value is TimeRange => value && HALF_HOUR_TIME_OPTIONS.includes(String(value.start)) && HALF_HOUR_TIME_OPTIONS.includes(String(value.end)) && minutes(String(value.start)) < minutes(String(value.end))

function ranges(value: unknown, fallback: TimeRange[]): TimeRange[] {
  if (Array.isArray(value)) return value.filter(validRange).map(range => ({ start: String(range.start), end: String(range.end) })).slice(0, 12)
  const legacy = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const legacyRanges = [
    { start: validTime(legacy.morningStart, ''), end: validTime(legacy.morningEnd, '') },
    { start: validTime(legacy.eveningStart, ''), end: validTime(legacy.eveningEnd, '') },
  ].filter(validRange)
  return legacyRanges.length ? legacyRanges : fallback.map(range => ({ ...range }))
}

export function pickupTimeSettings(rules: any): PickupTimeSettings {
  const business = rules?.businessHours || {}
  const unavailable = Array.isArray(rules?.unavailablePickupHours) ? rules.unavailablePickupHours : []
  return {
    businessHours: { start: validTime(business.start, defaults.businessHours.start), end: validTime(business.end, defaults.businessHours.end) },
    serviceFeeHours: ranges(rules?.serviceFeeHours, defaults.serviceFeeHours),
    unavailablePickupHours: unavailable.filter((range: any) => validRange(range) && Number.isInteger(Number((range as any).weekday)) && Number((range as any).weekday) >= 0 && Number((range as any).weekday) <= 6).map((range: any) => ({ start: String(range.start), end: String(range.end), weekday: Number((range as any).weekday) })).slice(0, 24),
  }
}

export function serviceFeeRate(rules: any): number {
  const rate = Number(rules?.serviceFeeRate ?? 0.1)
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.1
}

export function hasValidPickupTimeSettings(settings: PickupTimeSettings): boolean {
  if (!validRange(settings.businessHours) || !settings.serviceFeeHours.length) return false
  const businessStart = minutes(settings.businessHours.start), businessEnd = minutes(settings.businessHours.end)
  return settings.serviceFeeHours.every(validRange)
    && settings.serviceFeeHours.every(range => minutes(range.end) <= businessStart || minutes(range.start) >= businessEnd)
    && settings.unavailablePickupHours.every(range => validRange(range) && Number.isInteger(range.weekday) && range.weekday >= 0 && range.weekday <= 6)
}

function inRange(time: string, range: TimeRange): boolean {
  const value = minutes(time)
  return value >= minutes(range.start) && value < minutes(range.end)
}

export function pickupTimeMode(time: string, rules: any): 'business' | 'non_business' | '' {
  const settings = pickupTimeSettings(rules)
  if (!HALF_HOUR_TIME_OPTIONS.includes(time)) return ''
  if (inRange(time, settings.businessHours)) return 'business'
  return settings.serviceFeeHours.some(range => inRange(time, range)) ? 'non_business' : ''
}

export function legacyPickupSlot(time: string, rules: any): string {
  const mode = pickupTimeMode(time, rules)
  if (mode === 'non_business') return minutes(time) < 12 * 60 ? 'morning_service' : 'evening_service'
  if (mode === 'business') return minutes(time) < 13 * 60 ? 'morning' : 'afternoon'
  return ''
}

export function isUnavailablePickupTime(time: string, date: string, rules: any): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return pickupTimeSettings(rules).unavailablePickupHours.some(range => range.weekday === weekday && inRange(time, range))
}

export function pickupTimeOptions(rules: any, date: string, mode: 'business' | 'non_business'): string[] {
  return HALF_HOUR_TIME_OPTIONS.filter(time => pickupTimeMode(time, rules) === mode && !isUnavailablePickupTime(time, date, rules))
}

export function pickupTimeSlotEndMinutes(slot: string, _rules: any): number {
  return HALF_HOUR_TIME_OPTIONS.includes(slot) ? minutes(slot) : 24 * 60
}
