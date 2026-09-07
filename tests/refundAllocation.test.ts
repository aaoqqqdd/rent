/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRefundAllocation, evaluatePaymentReconciliation } from '../src/site'

test('proportional strategy splits a refund across sources by remaining capacity', () => {
  assert.deepEqual(
    buildRefundAllocation([{ id: 'balance', amount: 50 }, { id: 'stripe', amount: 150 }], 100),
    [{ id: 'balance', method: undefined, amount: 25 }, { id: 'stripe', method: undefined, amount: 75 }],
  )
})

test('proportional strategy assigns rounding remainder to the earliest source', () => {
  assert.deepEqual(
    buildRefundAllocation([{ id: 'a', amount: 1 }, { id: 'b', amount: 2 }], 0.01),
    [{ id: 'a', method: undefined, amount: 0.01 }],
  )
})

test('priority strategy fills sources in order, original method first', () => {
  const lines = buildRefundAllocation(
    [{ id: 'stripe', amount: 150, method: 'card' }, { id: 'balance', amount: 50, method: 'balance' }],
    170,
    'priority',
  )
  assert.deepEqual(lines, [
    { id: 'stripe', method: 'card', amount: 150 },
    { id: 'balance', method: 'balance', amount: 20 },
  ])
})

test('refund cannot exceed the remaining refundable capacity of the sources', () => {
  assert.throws(() => buildRefundAllocation([{ id: 'a', amount: 10, refunded: 8 }], 3), /超过原始付款/)
  assert.throws(() => buildRefundAllocation([{ id: 'a', amount: 10 }], 0), /大于 0/)
})

test('reconciliation passes for a clean single-source order', () => {
  const r = evaluatePaymentReconciliation({
    payments: [{ id: 'p1', amount: 500, status: 'paid' }],
    paymentAllocations: [{ payment_id: 'p1', amount: 300 }, { payment_id: 'p1', amount: 200 }],
    refunds: [{ id: 'rf1', payment_id: 'p1', refund_amount: 120, status: 'succeeded' }],
    refundAllocations: [{ refund_id: 'rf1', payment_id: 'p1', amount: 120 }],
  })
  assert.equal(r.ok, true)
  assert.equal(r.paidTotal, 500)
  assert.equal(r.refundedTotal, 120)
})

test('reconciliation flags over-refund, orphan allocation and unallocated refund', () => {
  const r = evaluatePaymentReconciliation({
    payments: [{ id: 'p1', amount: 100, status: 'paid' }],
    paymentAllocations: [{ payment_id: 'p1', amount: 100 }],
    refunds: [
      { id: 'rf1', payment_id: 'p1', refund_amount: 130, status: 'succeeded' },
      { id: 'rf2', payment_id: 'p1', refund_amount: 10, status: 'succeeded' },
    ],
    refundAllocations: [
      { refund_id: 'rf1', payment_id: 'p1', amount: 130 },
      { refund_id: 'rfX', payment_id: 'p-not-ours', amount: 5 },
    ],
  })
  const codes = r.issues.map(i => i.code).sort()
  assert.deepEqual([...new Set(codes)], ['ORPHAN_REFUND_ALLOCATION', 'OVER_REFUND_ORDER', 'OVER_REFUND_SOURCE', 'UNALLOCATED_REFUND'])
  assert.equal(r.ok, false)
})

test('reconciliation flags a payment whose component split does not add up', () => {
  const r = evaluatePaymentReconciliation({
    payments: [{ id: 'p1', amount: 500, status: 'paid' }],
    paymentAllocations: [{ payment_id: 'p1', amount: 300 }],
    refunds: [],
    refundAllocations: [],
  })
  assert.deepEqual(r.issues.map(i => i.code), ['ALLOCATION_MISMATCH'])
})
