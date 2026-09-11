/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRentalFee, parseDeviceDiscountPercent } from '../src/domain/rentalPricing'

test('device rental discounts apply to full monthly and weekly blocks', () => {
  const device = { pricePerDay: 100, weeklyDiscountPercent: 10, monthlyDiscountPercent: 20 }
  assert.equal(calculateRentalFee(device, 6), 600)
  assert.equal(calculateRentalFee(device, 7), 630)
  assert.equal(calculateRentalFee(device, 30), 2400)
  assert.equal(calculateRentalFee(device, 45), 3760)
})

test('device rental discount percentages accept 0 through 100 only', () => {
  assert.equal(parseDeviceDiscountPercent(''), 0)
  assert.equal(parseDeviceDiscountPercent('12.345'), 12.35)
  assert.equal(parseDeviceDiscountPercent('0'), 0)
  assert.equal(parseDeviceDiscountPercent('100'), 100)
  assert.equal(parseDeviceDiscountPercent('-1'), null)
  assert.equal(parseDeviceDiscountPercent('100.01'), null)
  assert.equal(parseDeviceDiscountPercent('nope'), null)
})
