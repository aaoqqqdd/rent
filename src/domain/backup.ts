/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 备份与恢复 (完善.md §26, §39 / P4 #19, #20)

export type BackupHealthStatus = 'OK' | 'WARN' | 'STALE' | 'NONE'

// 依据 RPO 目标评估最近一次备份的新鲜度：超过 RPO 记 WARN，超过 2×RPO 记 STALE。
export function backupHealth(lastBackupAt: string | number | Date | null | undefined, rpoMinutes: number, now: Date = new Date()): { status: BackupHealthStatus; ageMinutes: number | null } {
  if (!lastBackupAt) return { status: 'NONE', ageMinutes: null }
  const t = lastBackupAt instanceof Date ? lastBackupAt.getTime() : new Date(String(lastBackupAt).replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return { status: 'NONE', ageMinutes: null }
  const ageMinutes = Math.max(0, Math.round((now.getTime() - t) / 60000))
  const rpo = Math.max(1, Number(rpoMinutes) || 0)
  const status: BackupHealthStatus = ageMinutes > rpo * 2 ? 'STALE' : ageMinutes > rpo ? 'WARN' : 'OK'
  return { status, ageMinutes }
}

// 恢复演练是否已超期（默认要求至少每 90 天演练一次）。
export function restoreTestOverdue(lastTestAt: string | number | Date | null | undefined, maxIntervalDays = 90, now: Date = new Date()): boolean {
  if (!lastTestAt) return true
  const t = lastTestAt instanceof Date ? lastTestAt.getTime() : new Date(String(lastTestAt).replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return true
  return (now.getTime() - t) > Math.max(1, maxIntervalDays) * 86400000
}
