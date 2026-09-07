/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionDeviceLifecycle, DEVICE_LIFECYCLE_FLOW, MAINTENANCE_ADVANCE_NEXT, MAINTENANCE_CHECK_TYPES } from '../src/site'

test('recommended device return-to-shelf flow is allowed end to end', () => {
  const path = ['RENTED', 'RETURNED', 'INSPECTION', 'MAINTENANCE', 'READY']
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(canTransitionDeviceLifecycle(path[i], path[i + 1]), true, `${path[i]} -> ${path[i + 1]}`)
  }
})

test('damage branch and retirement are allowed', () => {
  assert.equal(canTransitionDeviceLifecycle('INSPECTION', 'DAMAGED'), true)
  assert.equal(canTransitionDeviceLifecycle('DAMAGED', 'MAINTENANCE'), true)
  assert.equal(canTransitionDeviceLifecycle('DAMAGED', 'RETIRED'), true)
  assert.equal(canTransitionDeviceLifecycle('MAINTENANCE', 'RETIRED'), true)
})

test('illegal device lifecycle jumps are rejected', () => {
  assert.equal(canTransitionDeviceLifecycle('RENTED', 'READY'), true, 'early return straight to shelf is allowed')
  assert.equal(canTransitionDeviceLifecycle('RETIRED', 'READY'), false, 'retired is terminal')
  assert.equal(canTransitionDeviceLifecycle('READY', 'RETURNED'), false)
  assert.equal(canTransitionDeviceLifecycle('RESERVED', 'MAINTENANCE'), false)
  assert.equal(canTransitionDeviceLifecycle('bogus', 'READY'), false)
})

test('same-state transition is always a no-op success', () => {
  for (const s of Object.keys(DEVICE_LIFECYCLE_FLOW)) assert.equal(canTransitionDeviceLifecycle(s, s), true)
})

test('maintenance phase order and the ten return checks are fixed', () => {
  assert.equal(MAINTENANCE_ADVANCE_NEXT.OPEN, 'IN_PROGRESS')
  assert.equal(MAINTENANCE_ADVANCE_NEXT.SYSTEM_RESET, 'CLIENT_CHECK')
  assert.equal(MAINTENANCE_ADVANCE_NEXT.CLIENT_CHECK, undefined)
  assert.equal(MAINTENANCE_CHECK_TYPES.length, 10)
  assert.ok(MAINTENANCE_CHECK_TYPES.includes('DATA_WIPE'))
  assert.ok(MAINTENANCE_CHECK_TYPES.includes('ACCESSORIES'))
})
