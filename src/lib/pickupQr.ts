/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export const PICKUP_QR_PREFIX = 'RENT-PICKUP:'

export function buildPickupQrPayload(orderId: unknown): string {
  return `${PICKUP_QR_PREFIX}${String(orderId || '').trim()}`
}

export function parsePickupQrPayload(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw.startsWith(PICKUP_QR_PREFIX)) return ''
  const orderId = raw.slice(PICKUP_QR_PREFIX.length).trim()
  return /^[A-Za-z0-9_-]{2,120}$/.test(orderId) ? orderId : ''
}
