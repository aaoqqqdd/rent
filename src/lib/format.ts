/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return `AUD$0.00`
  }
  return `AUD$${value.toFixed(2)}`
}

const MELBOURNE_TZ = 'Australia/Melbourne'

function toTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const raw = value instanceof Date ? value.toISOString() : String(value).trim()
  if (!raw) return null
  // SQLite CURRENT_TIMESTAMP stores "YYYY-MM-DD HH:MM:SS" in UTC without a zone marker.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw
  const timestamp = new Date(normalized)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

/** Human-readable Melbourne local date + time, e.g. "2026-08-15 13:07"（24 小时制）. */
export function formatMelbourneDateTime(value: string | Date | null | undefined): string {
  const timestamp = toTimestamp(value)
  if (!timestamp) return value ? String(value) : ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(timestamp).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** Human-readable Melbourne local date only, e.g. "2026-08-15". */
export function formatMelbourneDate(value: string | Date | null | undefined): string {
  const timestamp = toTimestamp(value)
  if (!timestamp) return value ? String(value) : ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(timestamp)
}

export function formatDate(value: string): string {
  return formatMelbourneDate(value)
}
