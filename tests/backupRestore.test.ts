/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { backupHealth, restoreTestOverdue, fnv1aHex } from '../src/site'

const NOW = new Date('2026-09-07T12:00:00Z')

test('backupHealth grades freshness against the RPO window', () => {
  assert.equal(backupHealth('2026-09-07T11:00:00Z', 1440, NOW).status, 'OK')
  assert.equal(backupHealth('2026-09-06T10:00:00Z', 1440, NOW).status, 'WARN') // ~26h old, between RPO and 2x RPO
  assert.equal(backupHealth('2026-09-01T11:00:00Z', 1440, NOW).status, 'STALE') // > 2x RPO
  assert.equal(backupHealth(null, 1440, NOW).status, 'NONE')
  assert.equal(backupHealth('not-a-date', 1440, NOW).status, 'NONE')
})

test('backupHealth reports age in minutes', () => {
  assert.equal(backupHealth('2026-09-07T11:00:00Z', 1440, NOW).ageMinutes, 60)
})

test('restoreTestOverdue is true when never tested or beyond the interval', () => {
  assert.equal(restoreTestOverdue(null), true)
  assert.equal(restoreTestOverdue('2026-01-01T00:00:00Z', 90, NOW), true)
  assert.equal(restoreTestOverdue('2026-08-20T00:00:00Z', 90, NOW), false)
})

test('fnv1aHex is stable, 8 hex chars, and sensitive to content', () => {
  assert.match(fnv1aHex('hello'), /^[0-9a-f]{8}$/)
  assert.equal(fnv1aHex('hello'), fnv1aHex('hello'))
  assert.notEqual(fnv1aHex('hello'), fnv1aHex('hello '))
})
