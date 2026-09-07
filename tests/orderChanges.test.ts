/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { orderChangeSnapshot, diffOrderSnapshots, buildOrderChangePlan } from '../src/site'

const baseOrder = {
  deviceId: 'd-1',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  rentalPeriod: 7,
  totalAmount: 500,
  depositAmount: 200,
  discount_amount: 0,
  pickupLocation: 'Melbourne CBD',
  returnLocation: 'Melbourne CBD',
  deliveryMethod: 'Pickup',
}

test('orderChangeSnapshot normalises camelCase and snake_case columns', () => {
  const snap = orderChangeSnapshot({ device_id: 'd-9', start_date: '2026-01-01', end_date: '2026-01-05', total_amount: 100, deposit_amount: 40 })
  assert.equal(snap.deviceId, 'd-9')
  assert.equal(snap.startDate, '2026-01-01')
  assert.equal(snap.endDate, '2026-01-05')
  assert.equal(snap.totalAmount, 100)
  assert.equal(snap.depositAmount, 40)
  assert.equal(snap.deliveryMethod, 'Pickup')
})

test('diffOrderSnapshots reports only changed fields with labels', () => {
  const before = orderChangeSnapshot(baseOrder)
  const after = { ...before, endDate: '2026-07-12', totalAmount: 560 }
  const diffs = diffOrderSnapshots(before, after)
  assert.deepEqual(diffs.map(d => d.field).sort(), ['endDate', 'totalAmount'])
  const endDiff = diffs.find(d => d.field === 'endDate')!
  assert.equal(endDiff.label, '归还日期')
  assert.equal(endDiff.before, '2026-07-08')
  assert.equal(endDiff.after, '2026-07-12')
})

test('diffOrderSnapshots treats numeric/string equal values as unchanged', () => {
  assert.equal(diffOrderSnapshots({ totalAmount: 500 }, { totalAmount: '500' }).length, 0)
})

test('EXTENSION change recomputes rental period and requests a booking check', () => {
  const before = orderChangeSnapshot(baseOrder)
  const plan = buildOrderChangePlan('EXTENSION', before, { endDate: '2026-07-15' })
  assert.ok(!('error' in plan))
  if ('error' in plan) return
  assert.equal(plan.patch.endDate, '2026-07-15')
  assert.equal(plan.patch.rentalPeriod, 14)
  assert.deepEqual(plan.bookingCheck, { deviceId: 'd-1', startDate: '2026-07-01', endDate: '2026-07-15' })
})

test('EXTENSION rejects malformed, inverted, and no-op ranges', () => {
  const before = orderChangeSnapshot(baseOrder)
  assert.deepEqual(buildOrderChangePlan('EXTENSION', before, { endDate: '07/15/2026' }), { error: '日期格式无效' })
  assert.deepEqual(buildOrderChangePlan('EXTENSION', before, { endDate: '2026-06-01' }), { error: '归还日期必须晚于起租日期' })
  assert.deepEqual(buildOrderChangePlan('EXTENSION', before, {}), { error: '租期没有变化' })
})

test('DEVICE_SWAP requires a different device and asks for availability + booking checks', () => {
  const before = orderChangeSnapshot(baseOrder)
  assert.deepEqual(buildOrderChangePlan('DEVICE_SWAP', before, {}), { error: '请选择替换设备' })
  assert.deepEqual(buildOrderChangePlan('DEVICE_SWAP', before, { deviceId: 'd-1' }), { error: '替换设备与当前设备相同' })
  const plan = buildOrderChangePlan('DEVICE_SWAP', before, { deviceId: 'd-2' })
  assert.ok(!('error' in plan))
  if ('error' in plan) return
  assert.equal(plan.patch.deviceId, 'd-2')
  assert.equal(plan.deviceAvailabilityCheck, 'd-2')
  assert.deepEqual(plan.bookingCheck, { deviceId: 'd-2', startDate: '2026-07-01', endDate: '2026-07-08' })
})

test('PRICE_ADJUSTMENT validates numbers, non-negativity and deposit ceiling', () => {
  const before = orderChangeSnapshot(baseOrder)
  assert.deepEqual(buildOrderChangePlan('PRICE_ADJUSTMENT', before, { totalAmount: 'x', depositAmount: '10' }), { error: '金额必须是数字' })
  assert.deepEqual(buildOrderChangePlan('PRICE_ADJUSTMENT', before, { totalAmount: '-1', depositAmount: '0' }), { error: '金额不能为负' })
  assert.deepEqual(buildOrderChangePlan('PRICE_ADJUSTMENT', before, { totalAmount: '100', depositAmount: '150' }), { error: '押金不能超过订单总额' })
  assert.deepEqual(buildOrderChangePlan('PRICE_ADJUSTMENT', before, { totalAmount: '500', depositAmount: '200' }), { error: '价格没有变化' })
  const plan = buildOrderChangePlan('PRICE_ADJUSTMENT', before, { totalAmount: '560.126', depositAmount: '200', discountAmount: '40' })
  assert.ok(!('error' in plan))
  if ('error' in plan) return
  assert.equal(plan.patch.totalAmount, 560.13)
  assert.equal(plan.patch.discountAmount, 40)
  assert.equal(plan.bookingCheck, undefined)
})

test('LOCATION_CHANGE validates delivery method and detects no-op edits', () => {
  const before = orderChangeSnapshot(baseOrder)
  assert.deepEqual(buildOrderChangePlan('LOCATION_CHANGE', before, { deliveryMethod: 'Teleport' }), { error: '配送方式无效' })
  assert.deepEqual(buildOrderChangePlan('LOCATION_CHANGE', before, {}), { error: '取还信息没有变化' })
  const plan = buildOrderChangePlan('LOCATION_CHANGE', before, { deliveryMethod: 'Delivery', pickupLocation: '  123 Collins St  ' })
  assert.ok(!('error' in plan))
  if ('error' in plan) return
  assert.equal(plan.patch.deliveryMethod, 'Delivery')
  assert.equal(plan.patch.pickupLocation, '123 Collins St')
  assert.equal(plan.patch.returnLocation, 'Melbourne CBD')
})

test('unknown change type is rejected', () => {
  assert.deepEqual(buildOrderChangePlan('WHATEVER', orderChangeSnapshot(baseOrder), {}), { error: '不支持的订单修改类型' })
})
