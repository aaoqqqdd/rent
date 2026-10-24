/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRentalLinkAvailability, type RentalLinkAvailabilityConfig } from '../src/domain/rentalLinkAvailability'
import { renderRentalLinkDatePicker } from '../src/pages/partials/rentalLinkDatePicker'
import { extractInlineScripts } from './helpers'

const config: RentalLinkAvailabilityConfig = { today: '2090-01-01', minutes: 600, minimumRentalDays: 1, bufferDays: 0, unavailableDates: [], unavailableTimeSlots: {}, bookings: [] }

test('calendar disables occupied periods and maintenance dates without hiding available half-days', () => {
  const calendar = createRentalLinkAvailability({ ...config, unavailableDates: ['2090-01-05'], bookings: [{ startDate: '2090-01-10', startPeriod: 'PM', endDate: '2090-01-12', endPeriod: 'AM' }] })
  assert.equal(calendar.canStart('2090-01-05', 'AM'), false)
  assert.equal(calendar.canStart('2090-01-05', 'PM'), false)
  assert.equal(calendar.canStart('2090-01-11', 'AM'), false)
  assert.equal(calendar.canStart('2090-01-10', 'AM'), true)
  assert.equal(calendar.canStart('2090-01-10', 'PM'), false)
  assert.equal(calendar.canStart('2090-01-12', 'AM'), false)
  assert.equal(calendar.canStart('2090-01-12', 'PM'), true)
})

test('return selection rejects ranges crossing blocked dates or bookings and enforces the minimum rental', () => {
  const calendar = createRentalLinkAvailability({ ...config, minimumRentalDays: 3, unavailableDates: ['2090-01-09'], bookings: [{ startDate: '2090-01-12', endDate: '2090-01-15' }] })
  assert.equal(calendar.canEnd('2090-01-05', 'AM', '2090-01-07', 'AM'), false)
  assert.equal(calendar.canEnd('2090-01-05', 'AM', '2090-01-07', 'PM'), true)
  assert.equal(calendar.canEnd('2090-01-05', 'AM', '2090-01-10', 'AM'), false)
  assert.equal(calendar.canEnd('2090-01-10', 'AM', '2090-01-16', 'AM'), false)
  assert.equal(calendar.canEnd('2090-01-17', 'AM', '2090-01-20', 'AM'), true)
})

test('buffer days, past periods and partially unavailable days are not selectable', () => {
  const calendar = createRentalLinkAvailability({ ...config, minutes: 750, bufferDays: 2, bookings: [{ startDate: '2090-01-10', endDate: '2090-01-15' }], unavailableTimeSlots: { '2090-01-20': ['morning_service', 'morning'] } })
  assert.equal(calendar.canStart('2089-12-31', 'PM'), false)
  assert.equal(calendar.canStart('2090-01-01', 'AM'), false)
  assert.equal(calendar.canStart('2090-01-01', 'PM'), true)
  assert.equal(calendar.canStart('2090-01-16', 'PM'), false)
  assert.equal(calendar.canStart('2090-01-17', 'AM'), true)
  assert.equal(calendar.canStart('2090-01-20', 'AM'), false)
  assert.equal(calendar.canStart('2090-01-20', 'PM'), true)
  assert.equal(calendar.canEnd('2090-01-17', 'AM', '2090-01-21', 'AM'), false)
})

test('undated rentals block the entire calendar and malformed dates cannot form a range', () => {
  assert.equal(createRentalLinkAvailability({ ...config, bookings: [{ startDate: null, endDate: null }] }).canStart('2090-01-01', 'PM'), false)
  const calendar = createRentalLinkAvailability(config)
  for (const date of ['', '2090-02-30', 'invalid']) assert.equal(calendar.canStart(date, 'AM'), false)
  assert.equal(calendar.canEnd('2090-01-10', 'AM', '2090-01-09', 'PM'), false)
})

test('picker uses disabled calendar controls instead of unrestricted native date inputs', () => {
  const html = renderRentalLinkDatePicker(config)
  assert.doesNotMatch(html, /type="date"/)
  assert.match(html, /id="rental-calendar"/)
  assert.match(html, /cell\.disabled=disabled/)
  for (const script of extractInlineScripts(html)) assert.doesNotThrow(() => new Function(script))
})
