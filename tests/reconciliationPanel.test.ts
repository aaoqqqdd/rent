/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { renderReconciliationPanel } from '../src/pages/partials/reconciliationPanel'
import { evaluatePaymentReconciliation } from '../src/domain/refundAllocation'

test('a pending-only order shows the pending card without a vacuous "consistent" card', () => {
  const reconciliation = evaluatePaymentReconciliation({
    payments: [{ id: 'p-nmCMelpipfZb', amount: 943, status: 'pending' }],
    paymentAllocations: [],
    refunds: [],
    refundAllocations: [],
  })
  const html = renderReconciliationPanel({
    reconciliation,
    paymentSources: [{ id: 'p-nmCMelpipfZb', payment_method: 'card', amount: 943, processing_fee: 23, status: 'pending' }],
    refundRows: [],
  }, { readOnly: true })

  assert.match(html, /待确认/)
  assert.doesNotMatch(html, /账目一致/)
})

test('a fully paid order still shows the plain "consistent" card', () => {
  const reconciliation = evaluatePaymentReconciliation({
    payments: [{ id: 'p1', amount: 500, status: 'paid' }],
    paymentAllocations: [],
    refunds: [],
    refundAllocations: [],
  })
  const html = renderReconciliationPanel({
    reconciliation,
    paymentSources: [{ id: 'p1', payment_method: 'card', amount: 500, processing_fee: 0, status: 'paid' }],
    refundRows: [],
  }, { readOnly: true })

  assert.match(html, /账目一致/)
  assert.doesNotMatch(html, /待确认/)
})
