/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { formatMelbourneDate } from '../lib/format'

export function createDemoAvailableFrom(now = new Date(), random = Math.random()): string {
  const today = new Date(`${formatMelbourneDate(now)}T00:00:00Z`)
  const year = today.getUTCFullYear(), month = today.getUTCMonth(), day = today.getUTCDate()
  const lastDay = new Date(Date.UTC(year, month + 7, 0)).getUTCDate()
  const until = new Date(Date.UTC(year, month + 6, Math.min(day, lastDay)))
  const days = Math.round((until.getTime() - today.getTime()) / 86400000)
  today.setUTCDate(day + 1 + Math.floor(random * days))
  return today.toISOString().slice(0, 10)
}
