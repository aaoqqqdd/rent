/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { deviceUtilisationRate, paymentMethodBreakdown } from '../src/site'

test('deviceUtilisationRate is used device-days over capacity, clamped to 0..1', () => {
  assert.equal(deviceUtilisationRate(150, 10, 30), 0.5)
  assert.equal(deviceUtilisationRate(0, 10, 30), 0)
  assert.equal(deviceUtilisationRate(600, 10, 30), 1) // over-capacity clamps to 1
  assert.equal(deviceUtilisationRate(-5, 10, 30), 0)
})

test('deviceUtilisationRate returns 0 when there is no fleet or no window', () => {
  assert.equal(deviceUtilisationRate(100, 0, 30), 0)
  assert.equal(deviceUtilisationRate(100, 10, 0), 0)
})

test('paymentMethodBreakdown returns shares that sum to exactly 100', () => {
  const rows = paymentMethodBreakdown([
    { method: 'card', amount: 100, count: 2 },
    { method: 'balance', amount: 50, count: 1 },
    { method: 'bank_transfer', amount: 50, count: 1 },
  ])
  assert.equal(rows.reduce((s, r) => s + r.share, 0), 100)
  assert.equal(rows[0].method, 'card')
  assert.equal(rows[0].share, 50)
})

test('paymentMethodBreakdown drops zero/negative rows and handles all-empty input', () => {
  assert.deepEqual(paymentMethodBreakdown([{ method: 'card', amount: 0 }, null, undefined]), [])
  assert.deepEqual(paymentMethodBreakdown([]), [])
})

test('paymentMethodBreakdown absorbs rounding drift into the largest method', () => {
  const rows = paymentMethodBreakdown([
    { method: 'a', amount: 1, count: 1 },
    { method: 'b', amount: 1, count: 1 },
    { method: 'c', amount: 1, count: 1 },
  ])
  assert.equal(rows.reduce((s, r) => s + r.share, 0), 100)
})
