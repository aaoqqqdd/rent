/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 支付争议 / Chargeback 状态机 (完善.md / TODO.md P2 #9)
//
//   DISPUTE_OPENED → DISPUTE_UNDER_REVIEW → DISPUTE_WON | DISPUTE_LOST | DISPUTE_CLOSED
//   DISPUTE_OPENED → DISPUTE_WON | DISPUTE_LOST | DISPUTE_CLOSED（Stripe 直接结案）
// 终态不可再流转。争议处于 OPENED / UNDER_REVIEW 时，对应付款禁止任何正常退款，
// 避免同一笔钱既被拒付又被主动退款（完善.md“防止争议金额被再次正常退款”）。

export const PAYMENT_DISPUTE_STATES = ['DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW', 'DISPUTE_WON', 'DISPUTE_LOST', 'DISPUTE_CLOSED'] as const
export type PaymentDisputeState = typeof PAYMENT_DISPUTE_STATES[number]

export const PAYMENT_DISPUTE_OPEN_STATES = new Set<PaymentDisputeState>(['DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW'])
export const PAYMENT_DISPUTE_TERMINAL_STATES = new Set<PaymentDisputeState>(['DISPUTE_WON', 'DISPUTE_LOST', 'DISPUTE_CLOSED'])

const PAYMENT_DISPUTE_TRANSITIONS: Record<PaymentDisputeState, PaymentDisputeState[]> = {
  DISPUTE_OPENED: ['DISPUTE_UNDER_REVIEW', 'DISPUTE_WON', 'DISPUTE_LOST', 'DISPUTE_CLOSED'],
  DISPUTE_UNDER_REVIEW: ['DISPUTE_WON', 'DISPUTE_LOST', 'DISPUTE_CLOSED'],
  DISPUTE_WON: [], DISPUTE_LOST: [], DISPUTE_CLOSED: [],
}

export function canTransitionPaymentDispute(from: string, to: string): boolean {
  return Boolean(PAYMENT_DISPUTE_TRANSITIONS[from as PaymentDisputeState]?.includes(to as PaymentDisputeState))
}

export function isPaymentDisputeOpen(status: string): boolean {
  return PAYMENT_DISPUTE_OPEN_STATES.has(String(status || '').trim().toUpperCase() as PaymentDisputeState)
}

// 一笔付款只要还有未结案的争议，就不允许再走正常退款流程。
export function paymentsBlockedByDispute(disputes: Array<{ status?: string } | null | undefined>): boolean {
  return (disputes || []).some(row => row && isPaymentDisputeOpen(String(row.status || '')))
}

// 把 Stripe 的 dispute.status / 结案原因映射到内部状态机。
// https://stripe.com/docs/api/disputes/object#dispute_object-status
export function mapStripeDisputeStatus(stripeStatus: string): PaymentDisputeState {
  switch (String(stripeStatus || '').trim().toLowerCase()) {
    case 'warning_needs_response':
    case 'needs_response':
      return 'DISPUTE_OPENED'
    case 'warning_under_review':
    case 'under_review':
      return 'DISPUTE_UNDER_REVIEW'
    case 'won':
      return 'DISPUTE_WON'
    case 'lost':
      return 'DISPUTE_LOST'
    case 'warning_closed':
    case 'charge_refunded':
    default:
      return 'DISPUTE_CLOSED'
  }
}
