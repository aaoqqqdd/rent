/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 列表页「不再整表读入」的回归测试：
// 用记录型假 D1 渲染真实页面函数，断言 ① 不存在 `SELECT * FROM users` / `FROM orders`
// 这种无 LIMIT 的全表查询；② 渲染输出的行数不超过每页上限；③ 分页条生效；
// ④ 归属过滤仍在（STAFF 看不到别人客户的订单）。

import test from 'node:test'
import assert from 'node:assert/strict'

import { renderStaffOrders } from '../src/pages/staff/orders'
import { renderStaffCustomers } from '../src/pages/staff/customers'
import { renderStaffOrdersOngoing } from '../src/pages/staff/ordersPending'
import { renderAdminUsers } from '../src/pages/admin/users'
import { renderAdminAnomalousOrders, loadAdminAnomalousOrders } from '../src/pages/admin/anomalousOrders'

interface RecordedStatement { sql: string; params: any[] }

/**
 * 记录型假 D1。
 * - 所有语句都被记录（sql + bind 参数），用于断言查询形态。
 * - `first()` 对 COUNT 查询返回总数；其他返回 `firstRows` 里匹配的兜底行。
 */
function recordingDb(options: {
  total?: number
  orders?: any[]
  users?: any[]
  devices?: any[]
  related?: any[]
  extraFirst?: Record<string, any>
} = {}) {
  const statements: RecordedStatement[] = []
  const db = {
    statements,
    prepare(sql: string) {
      const record: RecordedStatement = { sql, params: [] }
      statements.push(record)
      const query: any = {
        bind(...params: any[]) { record.params = params; return query },
        async first() {
          if (/COUNT\(\*\)/i.test(sql)) {
            if (/FROM anomalous_order_reviews\s+WHERE status/i.test(sql)) return { pending: options.total || 0 }
            return { total: options.total ?? 0 }
          }
          return options.extraFirst?.[sql] || null
        },
        async all() {
          if (/FROM orders/i.test(sql) || /FROM orders o/i.test(sql)) return { results: options.orders || [] }
          if (/FROM devices/i.test(sql)) return { results: options.devices || [] }
          if (/FROM users/i.test(sql)) return { results: options.users || [] }
          if (/FROM anomalous_order_reviews/i.test(sql)) return { results: options.extraFirst?.rows || [] }
          return { results: options.related || [] }
        },
      }
      return query
    },
  }
  return db
}

const c = (db: any, query: Record<string, string> = {}) => ({
  env: { RENT: db },
  req: { url: 'https://rent.example.test/x', query: (key: string) => query[key] },
}) as any

function assertNoFullTableScan(statements: RecordedStatement[], forbiddenTables: string[]) {
  for (const statement of statements) {
    const sql = statement.sql.replace(/\s+/g, ' ')
    for (const table of forbiddenTables) {
      const fromTable = new RegExp(`FROM\\s+${table}\\b`, 'i')
      if (!fromTable.test(sql)) continue
      // 允许：COUNT(*) 聚合、带 LIMIT 的分页、以及按主键 IN (...) 的批量回查。
      // 禁的只有「无条件把整表 SELECT * 回来」。
      const isBounded = /\bLIMIT\s+\?|\bLIMIT\s+\d+/i.test(sql)
        || /SELECT\s+COUNT\(\*\)/i.test(sql)
        || /WHERE\s+\w+\.?\w*\s*IN\s*\(/i.test(sql)
      assert.ok(isBounded, `禁止无界整表查询（${table}）：${sql}`)
    }
  }
}

test('renderStaffOrders: 不再整表读 orders/users/devices，按页渲染并带分页条', async () => {
  const orders = Array.from({ length: 50 }, (_, index) => ({
    id: `o${index}`, orderNo: `OD-${index}`, userId: 'c1', deviceId: 'd1',
    status: 'active', startDate: '2026-01-01', endDate: '2026-01-02', totalAmount: 100,
  }))
  const db = recordingDb({
    total: 120,
    orders,
    users: [{ id: 'c1', name: '客户甲', email: 'a@x', role: 'CUSTOMER', staff_id: 'staff-1' }],
    devices: [{ id: 'd1', name: 'MacBook Pro' }],
  })
  const html = await renderStaffOrders(c(db, { page: '2' }), { id: 'staff-1', role: 'STAFF' }, '')

  assertNoFullTableScan(db.statements, ['orders', 'users', 'devices'])
  assert.match(html, /第 2 \/ 3 页，共 120 条订单/)
  assert.equal((html.match(/class="link-button"/g) || []).length, 50, '只渲染一页 50 行')
  assert.match(html, /MacBook Pro/)
})

test('renderStaffCustomers: 客户列表按页取数并带分页条', async () => {
  const users = Array.from({ length: 3 }, (_, index) => ({
    id: `c${index}`, name: `张三${index}`, email: `c${index}@x.com`, role: 'CUSTOMER', staff_id: 'staff-1',
    registrationDate: '2026-01-01', accountType: 'formal',
  }))
  const db = recordingDb({ total: 51, users })
  const html = await renderStaffCustomers(c(db, {}), { id: 'staff-1', role: 'STAFF' }, '')

  assertNoFullTableScan(db.statements, ['users'])
  assert.match(html, /第 1 \/ 2 页，共 51 位客户/)
  const pageStatement = db.statements.find((statement) => /LIMIT \? OFFSET \?/.test(statement.sql))!
  assert.deepEqual(pageStatement.params, ['staff-1', 50, 0])
})

test('renderStaffOrdersOngoing: 状态与归属过滤下推，关联行按本页 id 批量取回', async () => {
  const db = recordingDb({
    orders: [{ id: 'o1', orderNo: 'OWN-1', userId: 'c1', deviceId: 'd1', status: 'active', startDate: '2026-01-01', endDate: '2026-01-02', totalAmount: 100 }],
    users: [{ id: 'c1', name: '客户甲', staff_id: 'staff-1' }],
    devices: [{ id: 'd1', name: 'MacBook' }],
  })
  const html = await renderStaffOrdersOngoing(c(db, {}), { id: 'staff-1', role: 'STAFF' })

  // 进行中订单页不按页截断（业务要求一次看全），但状态 + 归属过滤都在 SQL 里，
  // 关联行按本页 id 批量取回；这里只断言不再有「无条件整表」查询。
  for (const statement of db.statements) {
    if (/FROM (orders|users|devices)/i.test(statement.sql)) {
      assert.ok(/WHERE/i.test(statement.sql), `查询必须带 WHERE 过滤：${statement.sql}`)
      assert.ok(/status IN|staff_id = \?|id IN \(/.test(statement.sql), `查询必须带有效过滤条件：${statement.sql}`)
    }
  }
  const orderStatement = db.statements.find((statement) => /FROM orders o/.test(statement.sql))!
  assert.match(orderStatement.sql, /WHERE o\.status IN \(/) 
  assert.match(orderStatement.sql, /u\.staff_id = \?/)
  assert.deepEqual(orderStatement.params.slice(-1), ['staff-1'])
  const relationStatements = db.statements.filter((statement) => /\bWHERE id IN \(/.test(statement.sql))
  assert.equal(relationStatements.length, 2, '客户与设备各一次 IN 查询')
  assert.match(html, /OWN-1/)
})

test('renderAdminUsers: 分页 + 风险分级用聚合查询而不是每人一次', async () => {
  const users = [
    { id: 'c1', name: '客户甲', email: 'a@x', role: 'CUSTOMER', staff_id: 's1', referrer_id: null, balance: 0 },
    { id: 'c2', name: '客户乙', email: 'b@x', role: 'CUSTOMER', staff_id: 's1', referrer_id: null, balance: 0 },
  ]
  const statements: RecordedStatement[] = []
  const db = {
    prepare(sql: string) {
      const record: RecordedStatement = { sql, params: [] }
      statements.push(record)
      const query: any = {
        bind(...params: any[]) { record.params = params; return query },
        async first() { return /COUNT\(\*\)/i.test(sql) ? { total: 2 } : null },
        async all() {
          if (/FROM users WHERE role = 'CUSTOMER' AND id IN/.test(sql)) return { results: [{ id: 'c1', balance: 0 }, { id: 'c2', balance: 0 }] }
          if (/FROM users/.test(sql)) return { results: users }
          return { results: [] }
        },
      }
      return query
    },
  }
  const html = await renderAdminUsers({ id: 'admin-1', role: 'ADMIN' }, c(db, {}))

  // 2 个客户只允许 1 次风险聚合，而不是 2 次 × 6 条 SQL。
  const riskStatements = statements.filter((statement) => /FROM risk_flags|FROM payments|FROM damage_cases|FROM payment_refunds/.test(statement.sql))
  assert.equal(riskStatements.length, 4, `风险分级应为 4 条聚合查询，实际 ${riskStatements.length}`)
  for (const statement of riskStatements) {
    assert.match(statement.sql, /IN \(/, '聚合查询必须按客户 id 批量过滤')
    assert.ok(!/\bFROM \w+ WHERE (?:userId|customer_id|order_id) = \?/.test(statement.sql), '不得退化成单个客户查询')
  }
  assert.doesNotMatch(html, /暂无用户/)
})

test('loadAdminAnomalousOrders / renderAdminAnomalousOrders: 审核历史分页', async () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({
    id: `r${index}`, order_id: 'o1', order_no: `OD-${index}`, anomaly_type: 'PAID_ORDER_WITHOUT_PAYMENT',
    status: index === 0 ? 'PENDING' : 'RESTORED', original_status: 'paid', detected_at: '2026-01-01',
  }))
  const db = recordingDb({ total: 130, extraFirst: { rows } })
  const { reviews, meta, pendingCount } = await loadAdminAnomalousOrders(c(db, { page: '2' }))
  assert.equal(meta.page, 2)
  assert.equal(meta.total, 130)
  assert.equal(reviews.length, 50)
  assert.equal(pendingCount, 130)

  const pageStatement = db.statements.find((statement) => /FROM anomalous_order_reviews r/.test(statement.sql))!
  assert.match(pageStatement.sql, /LIMIT \? OFFSET \?/)
  assert.deepEqual(pageStatement.params, [50, 50])

  const html = renderAdminAnomalousOrders({ id: 'admin-1', role: 'ADMIN' }, reviews, { meta, pendingCount })
  assert.match(html, /第 2 \/ 3 页，共 130 条记录/)
  assert.match(html, /审核历史<\/h3><div class="value">130/)
})
