/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { rateHealth, countHealth, worstHealthLevel, summarizeMetricHistory } from '../src/site'
import { monitorOverallStatus, parseBearerToken } from '../src/domain/monitoring'
import { renderAdminMonitoring } from '../src/pages/admin/monitoring'

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

test('countHealth grades by count, not a faked ratio', () => {
  assert.deepEqual(countHealth(0, 3, 10), { count: 0, level: 'OK' })
  assert.deepEqual(countHealth(2, 3, 10), { count: 2, level: 'OK' })
  assert.deepEqual(countHealth(3, 3, 10), { count: 3, level: 'WARN' })
  assert.deepEqual(countHealth(9, 3, 10), { count: 9, level: 'WARN' })
  assert.deepEqual(countHealth(10, 3, 10), { count: 10, level: 'CRITICAL' })
  assert.deepEqual(countHealth(-4, 3, 10), { count: 0, level: 'OK' })
})

test('summarizeMetricHistory reports worst level and first breach in time order', () => {
  const history = [
    { capturedAt: '2026-09-08T02:00:00Z', rate: 0.01, level: 'OK' as const },
    { capturedAt: '2026-09-08T00:00:00Z', rate: 0.00, level: 'OK' as const },
    { capturedAt: '2026-09-08T04:00:00Z', rate: 0.05, level: 'WARN' as const },
    { capturedAt: '2026-09-08T06:00:00Z', rate: 0.20, level: 'CRITICAL' as const },
  ]
  const summary = summarizeMetricHistory(history)
  assert.equal(summary.points, 4)
  assert.equal(summary.worstLevel, 'CRITICAL')
  assert.equal(summary.firstBreach, '2026-09-08T04:00:00Z')
  assert.ok(summary.sparkPath.startsWith('M0 '))
  assert.ok(summary.sparkPath.includes('L120 '))
})

test('summarizeMetricHistory degrades gracefully with no or one point', () => {
  assert.deepEqual(summarizeMetricHistory([]), { points: 0, firstBreach: null, worstLevel: 'OK', sparkPath: '', sparkMax: 0 })
  const one = summarizeMetricHistory([{ capturedAt: '2026-09-08T00:00:00Z', rate: 0.5, level: 'WARN' }])
  assert.equal(one.points, 1)
  assert.equal(one.worstLevel, 'WARN')
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

test('renderAdminMonitoring draws sparklines, count values and first-breach time', () => {
  const metrics = [
    { key: 'api_error_rate', label: 'API 错误率（24h）', kind: 'rate' as const, numerator: 3, denominator: 100, rate: 0.03, level: 'WARN' as const },
    { key: 'open_exception_backlog', label: '异常任务积压', kind: 'count' as const, numerator: 12, denominator: 0, rate: 0, level: 'CRITICAL' as const, note: '未处理异常条数' },
  ]
  const history = {
    api_error_rate: [
      { capturedAt: '2026-09-08T00:00:00Z', rate: 0.0, level: 'OK' as const },
      { capturedAt: '2026-09-08T06:00:00Z', rate: 0.02, level: 'WARN' as const },
      { capturedAt: '2026-09-08T12:00:00Z', rate: 0.03, level: 'WARN' as const },
    ],
    open_exception_backlog: [{ capturedAt: '2026-09-08T00:00:00Z', rate: 12, level: 'CRITICAL' as const }],
  }
  const html = renderAdminMonitoring({ id: 'admin-1', name: 'Admin', role: 'ADMIN' }, metrics, [], history)
  assert.match(html, /整体：严重/)
  assert.match(html, /class="metric-spark"/)          // api_error_rate has >=2 points
  assert.match(html, /首次异常：/)                      // first non-OK snapshot surfaced
  assert.match(html, /<div class="value">12<\/div>/)   // count metric shows raw count, not a %
  assert.doesNotMatch(html.split('异常任务积压')[1].split('</div>')[0], /%/)
})

test('monitor API accepts only one Bearer token value', () => {
  assert.equal(parseBearerToken('Bearer monitor-secret'), 'monitor-secret')
  assert.equal(parseBearerToken('bearer monitor-secret'), 'monitor-secret')
  assert.equal(parseBearerToken('Basic monitor-secret'), null)
  assert.equal(parseBearerToken('Bearer one two'), null)
  assert.equal(parseBearerToken(null), null)
})
