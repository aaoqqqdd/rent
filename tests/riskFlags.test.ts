/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { isRiskFlagCurrentlyActive, findBlockingRiskFlag } from '../src/site'

const NOW = new Date('2026-09-07T00:00:00Z')

test('isRiskFlagCurrentlyActive respects status and expiry', () => {
  assert.equal(isRiskFlagCurrentlyActive({ status: 'ACTIVE', expires_at: null }, NOW), true)
  assert.equal(isRiskFlagCurrentlyActive({ status: 'RESOLVED', expires_at: null }, NOW), false)
  assert.equal(isRiskFlagCurrentlyActive({ status: 'ACTIVE', expires_at: '2026-12-01 00:00:00' }, NOW), true)
  assert.equal(isRiskFlagCurrentlyActive({ status: 'ACTIVE', expires_at: '2026-01-01 00:00:00' }, NOW), false)
  assert.equal(isRiskFlagCurrentlyActive(null, NOW), false)
})

test('findBlockingRiskFlag blocks on any HIGH severity flag', () => {
  const flag = { flag_type: 'MANUAL_REVIEW', severity: 'HIGH', status: 'ACTIVE', expires_at: null }
  assert.equal(findBlockingRiskFlag([flag], NOW), flag)
})

test('findBlockingRiskFlag blocks on hard-block types regardless of severity', () => {
  for (const type of ['PAYMENT_RISK', 'DEVICE_NOT_RETURNED', 'CHARGEBACK', 'FRAUD_SUSPECTED']) {
    const flag = { flag_type: type, severity: 'LOW', status: 'ACTIVE', expires_at: null }
    assert.equal(findBlockingRiskFlag([flag], NOW), flag, `${type} should block`)
  }
})

test('findBlockingRiskFlag ignores low/medium soft flags and expired/resolved flags', () => {
  assert.equal(findBlockingRiskFlag([{ flag_type: 'MANUAL_REVIEW', severity: 'MEDIUM', status: 'ACTIVE', expires_at: null }], NOW), null)
  assert.equal(findBlockingRiskFlag([{ flag_type: 'IDENTITY_RISK', severity: 'LOW', status: 'ACTIVE', expires_at: null }], NOW), null)
  assert.equal(findBlockingRiskFlag([{ flag_type: 'CHARGEBACK', severity: 'HIGH', status: 'ACTIVE', expires_at: '2026-01-01 00:00:00' }], NOW), null)
  assert.equal(findBlockingRiskFlag([{ flag_type: 'CHARGEBACK', severity: 'HIGH', status: 'RESOLVED', expires_at: null }], NOW), null)
  assert.equal(findBlockingRiskFlag([], NOW), null)
})

test('findBlockingRiskFlag returns the first blocking flag when several are present', () => {
  const soft = { flag_type: 'MANUAL_REVIEW', severity: 'LOW', status: 'ACTIVE', expires_at: null }
  const hard = { flag_type: 'FRAUD_SUSPECTED', severity: 'LOW', status: 'ACTIVE', expires_at: null }
  assert.equal(findBlockingRiskFlag([soft, hard], NOW), hard)
})
