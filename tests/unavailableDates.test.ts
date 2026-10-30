/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUnavailableDates, formatUnavailableDates } from '../src/domain/unavailableDates'

test('unavailable date ranges include both endpoints and mix with individual dates', () => {
  assert.deepEqual(parseUnavailableDates('2028-02-28 ： 2028-03-01，2028-03-05\n2028-03-01:2028-03-02 2028-03-05'), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02', '2028-03-05'])
  assert.deepEqual(parseUnavailableDates('2026-12-31:2027-01-01'), ['2026-12-31', '2027-01-01'])
  assert.deepEqual(parseUnavailableDates('2026-12-25:2026-12-25'), ['2026-12-25'])
  assert.deepEqual(parseUnavailableDates(''), [])
})

test('long unavailable periods retain every date when edited and saved again', () => {
  const dates = parseUnavailableDates('2026-01-01:2027-12-31, 2028-01-03')
  assert.equal(dates.length, 731)
  assert.equal(formatUnavailableDates([...dates].reverse()), '2026-01-01:2027-12-31, 2028-01-03')
  assert.deepEqual(parseUnavailableDates(formatUnavailableDates(dates)), dates)
  assert.equal(formatUnavailableDates([]), '')
})

test('malformed, reversed and excessive ranges are rejected instead of silently discarded', () => {
  for (const value of ['2026-02-30', '2026-01-01:2026-02-30', '2026-01-02:2026-01-01', '2026-01-01:', ':2026-01-01', '2026-01-01:2026-01-02:2026-01-03', 'invalid', '0001-01-01:9999-12-31']) assert.throws(() => parseUnavailableDates(value), /不可用日期/)
})
