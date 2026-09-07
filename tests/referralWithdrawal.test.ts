/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { planWithdrawalConsumption } from '../src/site'

test('consumes whole FIFO rewards and splits the boundary reward', () => {
  const plan = planWithdrawalConsumption(
    [{ id: 'r1', amount: 40 }, { id: 'r2', amount: 35 }, { id: 'r3', amount: 50 }],
    100,
  )
  assert.equal(plan.eligible, true)
  assert.deepEqual(plan.fullyConsumedIds, ['r1', 'r2']) // 40 + 35 = 75
  assert.deepEqual(plan.split, { id: 'r3', withdrawnAmount: 25, residualAmount: 25 }) // needs 25 more of r3
  assert.equal(plan.total, 125)
  assert.equal(plan.shortfall, 0)
})

test('exact match needs no split', () => {
  const plan = planWithdrawalConsumption([{ id: 'a', amount: 25 }, { id: 'b', amount: 25 }], 25)
  assert.deepEqual(plan.fullyConsumedIds, ['a'])
  assert.equal(plan.split, undefined)
  assert.equal(plan.eligible, true)
})

test('first reward alone covers it -> that reward is the split', () => {
  const plan = planWithdrawalConsumption([{ id: 'big', amount: 100 }], 30)
  assert.deepEqual(plan.fullyConsumedIds, [])
  assert.deepEqual(plan.split, { id: 'big', withdrawnAmount: 30, residualAmount: 70 })
})

test('ineligible when the ledger cannot cover the request', () => {
  const plan = planWithdrawalConsumption([{ id: 'a', amount: 30 }, { id: 'b', amount: 20 }], 100)
  assert.equal(plan.eligible, false)
  assert.deepEqual(plan.fullyConsumedIds, ['a', 'b'])
  assert.equal(plan.split, undefined)
  assert.equal(plan.total, 50)
  assert.equal(plan.shortfall, 50)
})

test('skips zero / negative rewards', () => {
  const plan = planWithdrawalConsumption([{ id: 'z', amount: 0 }, { id: 'n', amount: -5 }, { id: 'g', amount: 100 }], 80)
  assert.deepEqual(plan.fullyConsumedIds, [])
  assert.deepEqual(plan.split, { id: 'g', withdrawnAmount: 80, residualAmount: 20 })
})

test('cent-accurate across many tiny rewards', () => {
  const rewards = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, amount: 0.1 }))
  const plan = planWithdrawalConsumption(rewards, 1)
  assert.equal(plan.eligible, true)
  assert.equal(plan.fullyConsumedIds.length, 10)
  assert.equal(plan.split, undefined)
  assert.equal(plan.total, 1)
})

test('empty ledger is ineligible', () => {
  const plan = planWithdrawalConsumption([], 1)
  assert.equal(plan.eligible, false)
  assert.deepEqual(plan.fullyConsumedIds, [])
  assert.equal(plan.shortfall, 1)
})
