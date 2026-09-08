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

export function formatMelbourneDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const raw = value instanceof Date ? value.toISOString() : String(value)
  const timestamp = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw)
  if (Number.isNaN(timestamp.getTime())) return raw
  return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(timestamp)
}

export function formatDate(value: string): string {
  return value
}
