/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

/** 租期达到一个月时不再收取押金，改为仅保存可离线扣款的支付方式。 */
export const LONG_TERM_RENTAL_DAYS = 30

export type DepositPaymentMode = 'PAID' | 'PREAUTH' | 'SETUP_INTENT'

export function depositAuthorizationWindowDays(cardBrand: unknown): 7 | 30 {
  const brand = String(cardBrand || '').trim().toLowerCase()
  return brand === 'visa' || brand === 'mastercard' ? 30 : 7
}

export function depositPaymentModeForRental(rentalPeriod: number, cardPayment = true): DepositPaymentMode {
  if (!cardPayment) return 'PAID'
  return rentalPeriod >= LONG_TERM_RENTAL_DAYS ? 'SETUP_INTENT' : 'PREAUTH'
}

export function depositPaymentModeForOrder(order: { deposit_payment_mode?: unknown; depositPaymentMode?: unknown; rentalPeriod?: unknown; rental_period?: unknown }): DepositPaymentMode {
  const stored = String(order.deposit_payment_mode ?? order.depositPaymentMode ?? '').toUpperCase()
  if (stored === 'PREAUTH' || stored === 'SETUP_INTENT' || stored === 'PAID') return stored
  return 'PAID'
}
