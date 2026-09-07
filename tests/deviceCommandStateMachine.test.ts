/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionDeviceCommand, DEVICE_COMMAND_TERMINAL_STATES, isHighRiskDeviceCommand } from '../src/site'

test('device command happy path transitions are allowed', () => {
  assert.equal(canTransitionDeviceCommand('QUEUED', 'SENT'), true)
  assert.equal(canTransitionDeviceCommand('SENT', 'ACKNOWLEDGED'), true)
  assert.equal(canTransitionDeviceCommand('ACKNOWLEDGED', 'RUNNING'), true)
  assert.equal(canTransitionDeviceCommand('RUNNING', 'SUCCESS'), true)
})

test('device command failure and lifecycle exits are allowed from the right states', () => {
  for (const from of ['QUEUED', 'SENT', 'ACKNOWLEDGED', 'RUNNING']) {
    assert.equal(canTransitionDeviceCommand(from, 'FAILED'), true, `${from} -> FAILED`)
  }
  assert.equal(canTransitionDeviceCommand('QUEUED', 'CANCELLED'), true)
  assert.equal(canTransitionDeviceCommand('QUEUED', 'EXPIRED'), true)
  assert.equal(canTransitionDeviceCommand('RUNNING', 'EXPIRED'), true)
})

test('device command illegal transitions are rejected', () => {
  assert.equal(canTransitionDeviceCommand('QUEUED', 'RUNNING'), false, 'cannot skip SENT')
  assert.equal(canTransitionDeviceCommand('SENT', 'CANCELLED'), false, 'only queued commands cancel')
  assert.equal(canTransitionDeviceCommand('ACKNOWLEDGED', 'QUEUED'), false, 'no going back')
  assert.equal(canTransitionDeviceCommand('SUCCESS', 'RUNNING'), false, 'terminal is terminal')
  assert.equal(canTransitionDeviceCommand('CANCELLED', 'SENT'), false)
  assert.equal(canTransitionDeviceCommand('bogus', 'SENT'), false)
})

test('terminal states are exactly the four end states', () => {
  assert.deepEqual([...DEVICE_COMMAND_TERMINAL_STATES].sort(), ['CANCELLED', 'EXPIRED', 'FAILED', 'SUCCESS'])
  for (const s of DEVICE_COMMAND_TERMINAL_STATES) {
    assert.equal(canTransitionDeviceCommand(s, 'FAILED'), false)
  }
})

test('high-risk device commands are matched case-insensitively', () => {
  for (const cmd of ['LOCK_DEVICE', 'reboot', 'Data_Wipe', 'SYSTEM_RESET', 'REREGISTER_AGENT', 'DELETE_RENTAL_USER']) {
    assert.equal(isHighRiskDeviceCommand(cmd), true, cmd)
  }
  for (const cmd of ['SYNC', 'SHOW_MESSAGE', 'REFRESH_DEVICE_INFO', 'CREATE_RENTAL_USER', '']) {
    assert.equal(isHighRiskDeviceCommand(cmd), false, cmd)
  }
})
