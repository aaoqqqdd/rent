/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { isRiskFlagCurrentlyActive, findBlockingRiskFlag } from '../src/site'
import { renderAdminRiskFlags } from '../src/pages/admin/riskFlags'

test('isRiskFlagCurrentlyActive only depends on status, never expires on its own', () => {
  assert.equal(isRiskFlagCurrentlyActive({ status: 'ACTIVE' }), true)
  assert.equal(isRiskFlagCurrentlyActive({ status: 'RESOLVED' }), false)
  assert.equal(isRiskFlagCurrentlyActive(null), false)
})

test('findBlockingRiskFlag blocks on any HIGH severity flag', () => {
  const flag = { flag_type: 'MANUAL_REVIEW', severity: 'HIGH', status: 'ACTIVE' }
  assert.equal(findBlockingRiskFlag([flag]), flag)
})

test('findBlockingRiskFlag blocks on hard-block types regardless of severity', () => {
  for (const type of ['PAYMENT_RISK', 'DEVICE_NOT_RETURNED', 'CHARGEBACK', 'FRAUD_SUSPECTED']) {
    const flag = { flag_type: type, severity: 'LOW', status: 'ACTIVE' }
    assert.equal(findBlockingRiskFlag([flag]), flag, `${type} should block`)
  }
})

test('findBlockingRiskFlag ignores low/medium soft flags and resolved flags, never on its own from age', () => {
  assert.equal(findBlockingRiskFlag([{ flag_type: 'MANUAL_REVIEW', severity: 'MEDIUM', status: 'ACTIVE' }]), null)
  assert.equal(findBlockingRiskFlag([{ flag_type: 'IDENTITY_RISK', severity: 'LOW', status: 'ACTIVE' }]), null)
  assert.equal(findBlockingRiskFlag([{ flag_type: 'CHARGEBACK', severity: 'HIGH', status: 'RESOLVED' }]), null)
  assert.equal(findBlockingRiskFlag([]), null)
})

test('findBlockingRiskFlag returns the first blocking flag when several are present', () => {
  const soft = { flag_type: 'MANUAL_REVIEW', severity: 'LOW', status: 'ACTIVE' }
  const hard = { flag_type: 'FRAUD_SUSPECTED', severity: 'LOW', status: 'ACTIVE' }
  assert.equal(findBlockingRiskFlag([soft, hard]), hard)
})


test('blocking risk assessment has a persistent critical panel with a next step', () => {
  const html = renderAdminRiskFlags({ id: 'admin', role: 'ADMIN' }, { id: 'customer', name: '客户' }, [], [], { score: 60, level: 'HIGH', blocked: true, reasons: ['付款失败'] })
  assert.match(html, /data-notice-priority="critical" role="alert"/)
  assert.match(html, /高风险：已拦截新增租赁/)
  assert.match(html, /请核实下方风险原因/)
  assert.match(html, /付款失败/)
  assert.doesNotMatch(html, /data-flash-notice/)
})

test('nonblocking medium risk uses a warning without critical treatment', () => {
  const html = renderAdminRiskFlags({ id: 'admin', role: 'ADMIN' }, { id: 'customer', name: '客户' }, [], [], { score: 30, level: 'MEDIUM', blocked: false, reasons: [] })
  assert.match(html, /risk-score-notice page-notification--warning/)
  assert.doesNotMatch(html, /data-notice-priority="critical"/)
})
