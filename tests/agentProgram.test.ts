/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { agentCommission } from '../src/site'

test('agentCommission applies the rate and rounds to cents', () => {
  assert.equal(agentCommission(200, 0.1), 20)
  assert.equal(agentCommission(199.99, 0.075), 15) // 14.99925 -> 15.00
})

test('agentCommission clamps rate to 0..1 and floors negatives at 0', () => {
  assert.equal(agentCommission(100, 2), 100)
  assert.equal(agentCommission(100, -1), 0)
  assert.equal(agentCommission(-50, 0.1), 0)
})

test('agentCommission respects a per-order cap when provided', () => {
  assert.equal(agentCommission(1000, 0.1, 50), 50)
  assert.equal(agentCommission(1000, 0.1, 500), 100)
  assert.equal(agentCommission(1000, 0.1, null), 100)
})
