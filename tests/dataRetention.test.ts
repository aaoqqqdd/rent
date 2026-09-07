/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { retentionCutoffDate, isPastRetention, retentionSweepActionable } from '../src/site'

const NOW = new Date('2026-09-07T00:00:00Z')

test('retentionCutoffDate subtracts the retention window from now', () => {
  assert.equal(retentionCutoffDate(30, NOW).toISOString(), '2026-08-08T00:00:00.000Z')
  assert.equal(retentionCutoffDate(0, NOW).toISOString(), NOW.toISOString())
  assert.equal(retentionCutoffDate(-5, NOW).toISOString(), NOW.toISOString())
})

test('isPastRetention is true only for records older than the window', () => {
  assert.equal(isPastRetention('2026-07-01 00:00:00', 30, NOW), true)
  assert.equal(isPastRetention('2026-09-01 00:00:00', 30, NOW), false)
  assert.equal(isPastRetention('not-a-date', 30, NOW), false)
})

test('retentionSweepActionable requires an enabled, non-RETAIN policy', () => {
  assert.equal(retentionSweepActionable({ enabled: 1, action: 'DELETE' }), true)
  assert.equal(retentionSweepActionable({ enabled: true, action: 'ANONYMISE' }), true)
  assert.equal(retentionSweepActionable({ enabled: 1, action: 'RETAIN' }), false)
  assert.equal(retentionSweepActionable({ enabled: 0, action: 'DELETE' }), false)
  assert.equal(retentionSweepActionable({ enabled: 1, action: 'BOGUS' }), false)
  assert.equal(retentionSweepActionable(null), false)
})
