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
