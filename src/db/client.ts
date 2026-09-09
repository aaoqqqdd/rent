/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

// D1 句柄单例。首个带请求上下文的调用把 `c.env.RENT` 缓存下来，之后不带参数的
// 内部调用（历史遗留写法）也能拿到同一个 binding。
let dbInstance: any = null

export function getDB(c?: Context): any {
  if (c) {
    dbInstance = c.env.RENT
  }
  if (!dbInstance) {
    throw new Error('Database connection is not initialized. Ensure the request context is available.')
  }
  return dbInstance
}

// 表结构在部署（migrations）时才变，运行期不变。历史代码里有很多处在写入前跑
// `PRAGMA table_info(...)` 来兼容 snake_case / camelCase 列名，那是一条额外的 D1 往返。
// 这里按表名做 isolate 级缓存，命中后直接返回列名集合。
const tableColumnsCache = new Map<string, Promise<Set<string>>>()

export function getTableColumns(db: any, table: string): Promise<Set<string>> {
  const cached = tableColumnsCache.get(table)
  if (cached) return cached
  // 表名只来自代码内的字面量，不接受外部输入。
  const pending = db.prepare(`PRAGMA table_info(${table})`).all()
    .then((result: any) => new Set<string>((result.results || []).map((column: any) => String(column.name))))
    .catch((error: unknown) => { tableColumnsCache.delete(table); throw error })
  tableColumnsCache.set(table, pending)
  return pending
}
