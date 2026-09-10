/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { rateHealth, worstHealthLevel } from '../src/site'
import { monitorOverallStatus, parseBearerToken, staleMonitoringAlertIds } from '../src/domain/monitoring'

test('rateHealth classifies against warn/critical thresholds', () => {
  assert.deepEqual(rateHealth(1, 100, 0.02, 0.1), { rate: 0.01, level: 'OK' })
  assert.deepEqual(rateHealth(5, 100, 0.02, 0.1), { rate: 0.05, level: 'WARN' })
  assert.deepEqual(rateHealth(20, 100, 0.02, 0.1), { rate: 0.2, level: 'CRITICAL' })
})

test('rateHealth treats an empty sample as OK, not an alert', () => {
  assert.deepEqual(rateHealth(0, 0, 0.02, 0.1), { rate: 0, level: 'OK' })
  assert.deepEqual(rateHealth(5, 0, 0.02, 0.1), { rate: 0, level: 'OK' })
})

test('rateHealth is exactly-at-threshold inclusive', () => {
  assert.equal(rateHealth(2, 100, 0.02, 0.1).level, 'WARN')
  assert.equal(rateHealth(10, 100, 0.02, 0.1).level, 'CRITICAL')
})

test('worstHealthLevel picks the most severe level present', () => {
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'WARN' }, { level: 'OK' }]), 'WARN')
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'CRITICAL' }, { level: 'WARN' }]), 'CRITICAL')
  assert.equal(worstHealthLevel([{ level: 'OK' }, { level: 'OK' }]), 'OK')
  assert.equal(worstHealthLevel([]), 'OK')
})

test('monitorOverallStatus returns the worst public probe state', () => {
  assert.equal(monitorOverallStatus([{ status: 'ok' }, { status: 'ok' }]), 'ok')
  assert.equal(monitorOverallStatus([{ status: 'ok' }, { status: 'degraded' }]), 'degraded')
  assert.equal(monitorOverallStatus([{ status: 'degraded' }, { status: 'down' }]), 'down')
  assert.equal(monitorOverallStatus([]), 'ok')
})

test('staleMonitoringAlertIds closes alerts whose metric is no longer CRITICAL', () => {
  const open = [
    { id: 'a', entity_id: 'open_exception_backlog:2026-09-08' },
    { id: 'b', entity_id: 'open_exception_backlog:2026-09-09' },
    { id: 'c', entity_id: 'payment_failure_rate:2026-09-09' },
  ]
  // backlog recovered, payment failure still critical -> only a,b are stale
  assert.deepEqual(staleMonitoringAlertIds(open, ['payment_failure_rate']), ['a', 'b'])
  // nothing critical -> every open alert is stale
  assert.deepEqual(staleMonitoringAlertIds(open, []), ['a', 'b', 'c'])
  // still critical -> keep the alert open
  assert.deepEqual(staleMonitoringAlertIds(open, ['open_exception_backlog', 'payment_failure_rate']), [])
})

test('staleMonitoringAlertIds matches on the metric-key prefix, not a substring', () => {
  const open = [{ id: 'x', entity_id: 'exception_backlog:2026-09-10' }]
  // 'backlog' critical key must not keep an 'exception_backlog' alert alive by accident
  assert.deepEqual(staleMonitoringAlertIds(open, ['backlog']), ['x'])
  assert.deepEqual(staleMonitoringAlertIds(open, ['exception_backlog']), [])
})

test('monitor API accepts only one Bearer token value', () => {
  assert.equal(parseBearerToken('Bearer monitor-secret'), 'monitor-secret')
  assert.equal(parseBearerToken('bearer monitor-secret'), 'monitor-secret')
  assert.equal(parseBearerToken('Basic monitor-secret'), null)
  assert.equal(parseBearerToken('Bearer one two'), null)
  assert.equal(parseBearerToken(null), null)
})
