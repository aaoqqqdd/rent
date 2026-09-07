/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqualStr } from '../src/site'

test('timingSafeEqualStr matches only identical strings', () => {
  assert.equal(timingSafeEqualStr('abc123', 'abc123'), true)
  assert.equal(timingSafeEqualStr('abc123', 'abc124'), false)
  assert.equal(timingSafeEqualStr('abc123', 'abc1234'), false)
  assert.equal(timingSafeEqualStr('', ''), true)
  assert.equal(timingSafeEqualStr('token', ''), false)
})

test('timingSafeEqualStr coerces nullish input without throwing', () => {
  assert.equal(timingSafeEqualStr(undefined as any, undefined as any), true)
  assert.equal(timingSafeEqualStr('x', null as any), false)
})
