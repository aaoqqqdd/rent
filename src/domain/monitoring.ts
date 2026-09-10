/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 系统健康监控 (完善.md / P8 #32, #33)
//
// 把“分子 / 分母”比率按阈值分级。分母为 0（没有样本）时记 OK 而非报警。

export type HealthLevel = 'OK' | 'WARN' | 'CRITICAL'
export type MonitorProbeStatus = 'ok' | 'degraded' | 'down'

export interface MonitorMetric { key: string; label: string; numerator: number; denominator: number; rate: number; level: HealthLevel; note?: string }

export function rateHealth(numerator: number, denominator: number, warnRate: number, critRate: number): { rate: number; level: HealthLevel } {
  const n = Math.max(0, Number(numerator) || 0)
  const d = Math.max(0, Number(denominator) || 0)
  if (d <= 0) return { rate: 0, level: 'OK' }
  const rate = n / d
  const level: HealthLevel = rate >= critRate ? 'CRITICAL' : rate >= warnRate ? 'WARN' : 'OK'
  return { rate: Math.round(rate * 10000) / 10000, level }
}

// runMonitoringSweep 把 CRITICAL 指标写进异常任务中心，entity_id 形如 `<metricKey>:<YYYY-MM-DD>`。
// 指标恢复后这些告警行不会自己消失（也没有人工处理入口），会一直挂在“异常任务积压”里。
// 给定当前仍为 CRITICAL 的指标 key，返回应当自动关闭的历史告警行 id：其指标已不再 CRITICAL。
export function staleMonitoringAlertIds(
  openAlerts: Array<{ id: string; entity_id: string }>,
  criticalKeys: string[],
): string[] {
  return openAlerts
    .filter(alert => !criticalKeys.some(key => String(alert.entity_id).startsWith(`${key}:`)))
    .map(alert => alert.id)
}

// 一组指标里最差的级别，作为系统整体健康度。
export function worstHealthLevel(metrics: Array<{ level: HealthLevel }>): HealthLevel {
  if (metrics.some(m => m.level === 'CRITICAL')) return 'CRITICAL'
  if (metrics.some(m => m.level === 'WARN')) return 'WARN'
  return 'OK'
}

export function monitorOverallStatus(checks: Array<{ status: MonitorProbeStatus }>): MonitorProbeStatus {
  if (checks.some(check => check.status === 'down')) return 'down'
  if (checks.some(check => check.status === 'degraded')) return 'degraded'
  return 'ok'
}

export function parseBearerToken(header: string | null | undefined): string | null {
  const match = String(header || '').match(/^Bearer\s+(\S+)$/i)
  return match?.[1] || null
}
