/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export const PICKUP_QR_PREFIX = 'RENT-PICKUP:'
export const PICKUP_QR_PATH = '/pickup/'

export function buildPickupQrPayload(orderId: unknown, baseUrl = ''): string {
  const id = String(orderId || '').trim()
  if (!baseUrl) return `${PICKUP_QR_PREFIX}${id}`
  return new URL(`${PICKUP_QR_PATH}${encodeURIComponent(id)}`, baseUrl).toString()
}

export function parsePickupQrPayload(value: unknown): string {
  const raw = String(value || '').trim()
  let orderId = raw.startsWith(PICKUP_QR_PREFIX) ? raw.slice(PICKUP_QR_PREFIX.length).trim() : ''
  if (!orderId) {
    try {
      const url = new URL(raw)
      if (url.pathname.startsWith(PICKUP_QR_PATH)) orderId = decodeURIComponent(url.pathname.slice(PICKUP_QR_PATH.length)).trim()
    } catch (_) { /* not a URL */ }
  }
  return /^[A-Za-z0-9_-]{2,120}$/.test(orderId) ? orderId : ''
}
