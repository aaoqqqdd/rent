/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 数据保留策略 (完善.md / P3 #18)
//
// 每类数据配置：保留天数 + 到期动作。RETAIN = 永久保留（合同 / 财务 / 审计），
// ARCHIVE / DELETE / ANONYMISE = 到期后可被清理任务处理。这里只放纯判定，
// 实际清理由调度任务执行。

export const RETENTION_ACTIONS = ['RETAIN', 'ARCHIVE', 'DELETE', 'ANONYMISE'] as const
export type RetentionAction = typeof RETENTION_ACTIONS[number]

export interface RetentionPolicyLike { retention_days?: number; action?: string; enabled?: number | boolean }

// 保留期截止时间：早于该时刻的记录已过保留期。
export function retentionCutoffDate(retentionDays: number, now: Date = new Date()): Date {
  const days = Math.max(0, Math.floor(Number(retentionDays) || 0))
  return new Date(now.getTime() - days * 86400000)
}

export function isPastRetention(recordDate: string | number | Date, retentionDays: number, now: Date = new Date()): boolean {
  const t = recordDate instanceof Date ? recordDate.getTime() : new Date(String(recordDate).replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return false
  return t <= retentionCutoffDate(retentionDays, now).getTime()
}

// 该策略是否会真正清理数据（启用且动作不是 RETAIN）。
export function retentionSweepActionable(policy: RetentionPolicyLike | null | undefined): boolean {
  if (!policy) return false
  const enabled = policy.enabled === true || Number(policy.enabled) === 1
  return enabled && String(policy.action || '').toUpperCase() !== 'RETAIN' && RETENTION_ACTIONS.includes(String(policy.action || '').toUpperCase() as RetentionAction)
}
