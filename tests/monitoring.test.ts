/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { rateHealth, worstHealthLevel } from '../src/site'

test('rateHealth classifies against warn/critical thresholds', () => {
  assert.deepEqual(rateHealth(1, 100, 0.02, 0.1), { rate: 0.01, level: 'OK' })
  assert.deepEqual(rateHealth(5, 100, 0.02, 0.1), { rate: 0.05, level: 'WARN' })
  assert.deepEqual(rateHealth(20, 100, 0.02, 0.1), { rate: 0.2, level: 'CRITICAL' })
})

test('rateHealth treats an empty sample as OK, not an alert', () => {
  assert.deepEqual(rateHealth(0, 0, 0.02, 0.1), { rate: 0, level: 'OK' })
  assert.deepEqual(rateHealth(5, 0, 0.02, 0.1), { rate: 0, level: 'OK' })
})

test('rateHealth is exactly-at-threshold inclusive', () => {
  assert.equal(rateHealth(2, 100, 0.02, 0.1).level, 'WARN')
  assert.equal(rateHealth(10, 100, 0.02, 0.1).level, 'CRITICAL')
})

test('worstHealthLevel picks the most severe level present', () => {
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'WARN' }, { level: 'OK' }]), 'WARN')
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'CRITICAL' }, { level: 'WARN' }]), 'CRITICAL')
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'OK' }]), 'OK')
  assert.equal(worstHealthLevel([]), 'OK')
})
