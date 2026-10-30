/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { buildSync } from 'esbuild'
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

for (const minify of [false, true]) test(`Wrangler-bundled picker supports date selection and month navigation (minify=${minify})`, () => {
  // Wrangler 默认保留函数名；必须执行打包后的脚本，语法检查无法发现丢失的闭包依赖。
  const bundle = buildSync({ entryPoints: ['src/pages/partials/rentalLinkDatePicker.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', keepNames: true, minify })
  const module = { exports: {} as { renderRentalLinkDatePicker: typeof renderRentalLinkDatePicker } }
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports })

  class Element {
    value = ''
    textContent = ''
    disabled = false
    dataset: Record<string, string> = {}
    attributes: Record<string, string> = {}
    children: Element[] = []
    listeners: Record<string, () => void> = {}
    options: Element[] = []
    get selectedOptions() { return this.options.filter(option => option.value === this.value) }
    setAttribute(name: string, value: string) { this.attributes[name] = value }
    addEventListener(name: string, handler: () => void) { this.listeners[name] = handler }
    replaceChildren() { this.children = [] }
    appendChild(child: Element) { this.children.push(child) }
    closest() { return form }
    querySelector() { return submit }
    click() { assert.equal(this.disabled, false); this.listeners.click() }
  }
  const form = new Element(), submit = new Element()
  const elements = Object.fromEntries(['date-picker', 'startDate', 'endDate', 'startPeriod', 'endPeriod', 'choose-start', 'choose-end', 'calendar', 'month-label', 'picker-hint', 'prev-month', 'next-month'].map(id => ['rental-' + id, new Element()]))
  for (const id of ['rental-startPeriod', 'rental-endPeriod']) {
    elements[id].value = 'AM'
    elements[id].options = ['AM', 'PM'].map(value => Object.assign(new Element(), { value }))
  }
  const document = { readyState: 'complete', getElementById: (id: string) => elements[id], createElement: () => new Element() }
  const context = { document, setInterval() {} }
  const html = module.exports.renderRentalLinkDatePicker({ ...config, minimumRentalDays: 3 })
  runInNewContext(`Date = class extends Date { constructor(...args) { super(...(args.length ? args : ['2090-01-01T00:00:00Z'])) } };\n${extractInlineScripts(html)[0]}`, context)

  const calendar = elements['rental-calendar']
  const day = (date: string) => { const cell = calendar.children.find(child => child.dataset.date === date); assert.ok(cell); return cell }
  assert.equal(calendar.children.length, 42)
  assert.ok(elements['rental-month-label'].textContent)
  assert.equal(submit.disabled, true)
  assert.equal(elements['rental-choose-end'].disabled, true)
  assert.equal(elements['rental-prev-month'].disabled, true)
  day('2090-01-02').click()
  assert.equal(elements['rental-startDate'].value, '2090-01-02')
  assert.equal(elements['rental-choose-end'].disabled, false)
  assert.equal(day('2090-01-03').disabled, true)
  day('2090-01-05').click()
  assert.equal(elements['rental-endDate'].value, '2090-01-05')
  assert.equal(submit.disabled, false)
  elements['rental-choose-start'].click()
  day('2090-01-10').click()
  assert.equal(elements['rental-endDate'].value, '')
  assert.equal(submit.disabled, true)
  elements['rental-next-month'].click()
  assert.ok(calendar.children.some(child => child.dataset.date === '2090-02-15'))
  assert.equal(elements['rental-prev-month'].disabled, false)
  elements['rental-prev-month'].click()
  assert.ok(calendar.children.some(child => child.dataset.date === '2090-01-15'))
})
