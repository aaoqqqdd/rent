/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canTransitionPaymentDispute,
  isPaymentDisputeOpen,
  paymentsBlockedByDispute,
  mapStripeDisputeStatus,
  PAYMENT_DISPUTE_TERMINAL_STATES,
} from '../src/site'

test('dispute state machine allows opened → review/won/lost/closed', () => {
  assert.equal(canTransitionPaymentDispute('DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW'), true)
  assert.equal(canTransitionPaymentDispute('DISPUTE_OPENED', 'DISPUTE_WON'), true)
  assert.equal(canTransitionPaymentDispute('DISPUTE_UNDER_REVIEW', 'DISPUTE_LOST'), true)
  assert.equal(canTransitionPaymentDispute('DISPUTE_UNDER_REVIEW', 'DISPUTE_CLOSED'), true)
})

test('dispute state machine rejects backwards and terminal transitions', () => {
  assert.equal(canTransitionPaymentDispute('DISPUTE_UNDER_REVIEW', 'DISPUTE_OPENED'), false)
  assert.equal(canTransitionPaymentDispute('DISPUTE_WON', 'DISPUTE_UNDER_REVIEW'), false)
  assert.equal(canTransitionPaymentDispute('DISPUTE_LOST', 'DISPUTE_CLOSED'), false)
  assert.equal(canTransitionPaymentDispute('DISPUTE_CLOSED', 'DISPUTE_WON'), false)
  assert.equal(canTransitionPaymentDispute('NONSENSE', 'DISPUTE_WON'), false)
  for (const terminal of PAYMENT_DISPUTE_TERMINAL_STATES) {
    assert.deepEqual([...PAYMENT_DISPUTE_TERMINAL_STATES].filter(to => canTransitionPaymentDispute(terminal, to)), [])
  }
})

test('open-state predicate is case-insensitive and only true for pre-resolution states', () => {
  assert.equal(isPaymentDisputeOpen('DISPUTE_OPENED'), true)
  assert.equal(isPaymentDisputeOpen('dispute_under_review'), true)
  assert.equal(isPaymentDisputeOpen('DISPUTE_WON'), false)
  assert.equal(isPaymentDisputeOpen('DISPUTE_LOST'), false)
  assert.equal(isPaymentDisputeOpen('DISPUTE_CLOSED'), false)
  assert.equal(isPaymentDisputeOpen(''), false)
})

test('paymentsBlockedByDispute blocks refunds while any dispute is unresolved', () => {
  assert.equal(paymentsBlockedByDispute([{ status: 'DISPUTE_WON' }, { status: 'DISPUTE_OPENED' }]), true)
  assert.equal(paymentsBlockedByDispute([{ status: 'DISPUTE_WON' }, { status: 'DISPUTE_CLOSED' }]), false)
  assert.equal(paymentsBlockedByDispute([]), false)
  assert.equal(paymentsBlockedByDispute([null, undefined]), false)
})

test('mapStripeDisputeStatus maps Stripe statuses onto the internal enum', () => {
  assert.equal(mapStripeDisputeStatus('needs_response'), 'DISPUTE_OPENED')
  assert.equal(mapStripeDisputeStatus('warning_needs_response'), 'DISPUTE_OPENED')
  assert.equal(mapStripeDisputeStatus('under_review'), 'DISPUTE_UNDER_REVIEW')
  assert.equal(mapStripeDisputeStatus('warning_under_review'), 'DISPUTE_UNDER_REVIEW')
  assert.equal(mapStripeDisputeStatus('won'), 'DISPUTE_WON')
  assert.equal(mapStripeDisputeStatus('lost'), 'DISPUTE_LOST')
  assert.equal(mapStripeDisputeStatus('warning_closed'), 'DISPUTE_CLOSED')
  assert.equal(mapStripeDisputeStatus('charge_refunded'), 'DISPUTE_CLOSED')
  assert.equal(mapStripeDisputeStatus('anything-else'), 'DISPUTE_CLOSED')
})
