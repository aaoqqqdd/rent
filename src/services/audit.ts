/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 审计日志 + 错误日志。两张表都写 D1，`logError` 同时打 console。
// 被几乎所有路由 / 服务 / 调度任务调用；只依赖 db/client + nanoid，保持叶子层。

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { getDB } from '../db/client'

export type ErrorLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export async function createAuditLog(c: Context, input: { actor?: any, action: string, targetType: string, targetId: string, before?: unknown, after?: unknown, reason?: string }) {
  const actor = input.actor || c.get('user') as any
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, /password|token|secret|signature|authorization/i.test(key) ? '[REDACTED]' : redact(item)]))
    return value
  }
  await getDB(c).prepare('INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, before_json, after_json, reason, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(`audit-${nanoid(16)}`, actor?.id || null, actor?.role || null, input.action, input.targetType, input.targetId, input.before === undefined ? null : JSON.stringify(redact(input.before)), input.after === undefined ? null : JSON.stringify(redact(input.after)), input.reason || null, c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0].trim() || null, String(c.req.header('User-Agent') || '').slice(0, 500) || null).run()
}

/**
 * 记录错误到数据库和控制台
 * @param c Hono上下文对象
 * @param level 错误级别
 * @param message 错误消息
 * @param error 错误对象（可选）
 * @param contextData 额外的上下文数据（可选）
 */
export async function logError(c: Context, level: ErrorLevel, message: string, error?: Error, contextData?: Record<string, any>) {
  const user = c.get('user')
  const db = getDB(c)
  const errorId = `err-${nanoid(8)}`

  // 控制台输出，包含时间戳和级别
  const timestamp = new Date().toISOString()
  const consolePrefix = `[${timestamp}] [${level}]`

  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(`${consolePrefix} ${message}`, error?.stack || '')
  } else if (level === 'WARNING') {
    console.warn(`${consolePrefix} ${message}`)
  } else {
    console.log(`${consolePrefix} ${message}`)
  }

  try {
    // 保存到数据库
    const redact = (value: any): any => {
      if (Array.isArray(value)) return value.map(redact)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [/token|password|secret|signature|authorization/i.test(key) ? key : key, /token|password|secret|signature|authorization/i.test(key) ? '[REDACTED]' : redact(item)]))
      return value
    }
    const contextJson = contextData ? JSON.stringify(redact(contextData)) : null
    const stackTrace = error?.stack || null
    const userId = user?.id || null
    const parsedUrl = new URL(c.req.url)
    for (const key of ['token', 'number', 'session_id']) if (parsedUrl.searchParams.has(key)) parsedUrl.searchParams.set(key, '[REDACTED]')
    const url = parsedUrl.toString()
    const method = c.req.method

    await db.prepare(`
      INSERT INTO error_logs (id, error_level, error_message, error_stack, context_data, user_id, request_url, request_method, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(errorId, level, message, stackTrace, contextJson, userId, url, method).run()
  } catch (dbError) {
    // 如果数据库日志记录失败，至少保证控制台有日志
    console.error('Failed to write error to database:', dbError)
  }
}

/**
 * 清理过期的错误日志（保留30天）
 * @param c Hono上下文对象
 */
export async function cleanupOldErrorLogs(c: Context) {
  const db = getDB(c)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  try {
    await db.prepare(`
      DELETE FROM error_logs WHERE created_at < ?
    `).bind(thirtyDaysAgo.toISOString()).run()
    await logError(c, 'INFO', `Cleaned up error logs older than 30 days`)
  } catch (error) {
    await logError(c, 'WARNING', 'Failed to cleanup old error logs', error as Error)
  }
}
