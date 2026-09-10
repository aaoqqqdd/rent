/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 系统健康监控 (完善.md / P8 #32, #33)
//
// 把“分子 / 分母”比率按阈值分级。分母为 0（没有样本）时记 OK 而非报警。

export type HealthLevel = 'OK' | 'WARN' | 'CRITICAL'
export type MonitorProbeStatus = 'ok' | 'degraded' | 'down'

export type MonitorMetricKind = 'rate' | 'count'
export interface MonitorMetric { key: string; label: string; kind: MonitorMetricKind; numerator: number; denominator: number; rate: number; level: HealthLevel; note?: string }

export function rateHealth(numerator: number, denominator: number, warnRate: number, critRate: number): { rate: number; level: HealthLevel } {
  const n = Math.max(0, Number(numerator) || 0)
  const d = Math.max(0, Number(denominator) || 0)
  if (d <= 0) return { rate: 0, level: 'OK' }
  const rate = n / d
  const level: HealthLevel = rate >= critRate ? 'CRITICAL' : rate >= warnRate ? 'WARN' : 'OK'
  return { rate: Math.round(rate * 10000) / 10000, level }
}

// 计数型指标（如未处理异常积压）：直接按条数分级，不伪造分母 / 比率。
export function countHealth(count: number, warnCount: number, critCount: number): { count: number; level: HealthLevel } {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  const level: HealthLevel = n >= critCount ? 'CRITICAL' : n >= warnCount ? 'WARN' : 'OK'
  return { count: n, level }
}

export interface MetricHistoryPoint { capturedAt: string; rate: number; level: HealthLevel }
export interface MetricHistorySummary { points: number; firstBreach: string | null; worstLevel: HealthLevel; sparkPath: string; sparkMax: number }

// 把一串按时间升序的指标快照压成给卡片用的摘要：整段最差级别、首次转为非 OK 的时间、
// 以及一条归一化到 [0,width] × [0,height] 视口的 SVG 折线（viewBox 由调用方固定）。
export function summarizeMetricHistory(history: MetricHistoryPoint[], opts?: { width?: number; height?: number }): MetricHistorySummary {
  const width = opts?.width ?? 120
  const height = opts?.height ?? 28
  const rows = [...(history || [])]
    .filter(p => p && typeof p.capturedAt === 'string')
    .sort((a, b) => a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0)
  if (rows.length === 0) return { points: 0, firstBreach: null, worstLevel: 'OK', sparkPath: '', sparkMax: 0 }

  const worstLevel = worstHealthLevel(rows)
  const firstBreach = rows.find(p => p.level !== 'OK')?.capturedAt ?? null
  const rates = rows.map(p => Math.max(0, Number(p.rate) || 0))
  const sparkMax = Math.max(...rates, 0.0001)
  const stepX = rows.length > 1 ? width / (rows.length - 1) : 0
  const sparkPath = rows
    .map((_, i) => {
      const x = Math.round((rows.length > 1 ? i * stepX : width / 2) * 100) / 100
      const y = Math.round((height - (rates[i] / sparkMax) * height) * 100) / 100
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
  return { points: rows.length, firstBreach, worstLevel, sparkPath, sparkMax }
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

// HTTP 状态码映射：让外部监控（Monitorflare）只凭状态码就能分级，
// 不必再对响应体做关键词匹配。
//   ok       -> 200
//   degraded -> 503 Service Unavailable（部分降级，仍在服务，触发告警）
//   down     -> 521（Cloudflare 风格「源站宕机」，与 degraded 区分严重程度）
export function monitorHttpStatus(status: MonitorProbeStatus): 200 | 503 | 521 {
  if (status === 'down') return 521
  if (status === 'degraded') return 503
  return 200
}

export function parseBearerToken(header: string | null | undefined): string | null {
  const match = String(header || '').match(/^Bearer\s+(\S+)$/i)
  return match?.[1] || null
}
