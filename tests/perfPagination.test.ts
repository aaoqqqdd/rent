/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 分页参数解析 + 列表 SQL 下推的正确性测试。
//
// 重点证明两件事：
//   1. `page` 的边界处理（含越界回落）与分页条链接生成。
//   2. 列表查询真的把过滤/排序/分页下推到了 SQL：语句里含 WHERE/LIMIT/OFFSET，
//      且所有用户输入都走 `.bind()` 参数绑定，不拼进 SQL 文本（防注入）。

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_PAGE_SIZE,
  buildPaginationMeta,
  clampPageRequest,
  normalizePage,
  pageHref,
  parsePageRequest,
  renderPager,
} from '../src/lib/pagination'
import { queryAdminUsers, queryStaffCustomers, queryStaffOrders, normalizeSearchTerm, escapeLikePattern } from '../src/services/paginatedLists'

/** 记录所有下发语句的假 D1：返回固定页数据，供断言 SQL 形态与绑定参数。 */
function recordingDb(rowsByTable: Record<string, any[]> = {}, total = 0) {
  const statements: { sql: string; params: any[] }[] = []
  const db = {
    statements,
    prepare(sql: string) {
      const record = { sql, params: [] as any[] }
      statements.push(record)
      const query: any = {
        bind(...params: any[]) { record.params = params; return query },
        async first() { return { total, pending: 0 } },
        async all() { return { results: rowsByTable[sql.includes('FROM users') ? 'users' : sql.includes('FROM devices') ? 'devices' : 'orders'] || [] } },
      }
      return query
    },
  }
  return db
}

const ctx = (db: any) => ({ env: { RENT: db } }) as any

test('normalizePage: 默认 1，非法/越界/负数/小数都回落', () => {
  assert.equal(normalizePage(undefined), 1)
  assert.equal(normalizePage(null), 1)
  assert.equal(normalizePage(''), 1)
  assert.equal(normalizePage('abc'), 1)
  assert.equal(normalizePage('0'), 1)
  assert.equal(normalizePage('-3'), 1)
  assert.equal(normalizePage('2.9'), 2)
  assert.equal(normalizePage('4'), 4)
  assert.equal(normalizePage('999999999999'), 100_000, '超大页码必须封顶，不能把 OFFSET 撑爆')
  assert.equal(DEFAULT_PAGE_SIZE, 50, '默认每页 50 条')
})

test('parsePageRequest: offset 按 pageSize 计算，默认 50 条', () => {
  assert.deepEqual(parsePageRequest('1'), { page: 1, pageSize: 50, offset: 0 })
  assert.deepEqual(parsePageRequest('3'), { page: 3, pageSize: 50, offset: 100 })
  assert.deepEqual(parsePageRequest('2', 10), { page: 2, pageSize: 10, offset: 10 })
  assert.deepEqual(parsePageRequest('bad', 10), { page: 1, pageSize: 10, offset: 0 })
  assert.deepEqual(parsePageRequest('1', 0), { page: 1, pageSize: DEFAULT_PAGE_SIZE, offset: 0 }, '非法 pageSize 回落默认')
})

test('clampPageRequest / buildPaginationMeta: 页码越界回落到最后一页', () => {
  const request = parsePageRequest('99')
  assert.deepEqual(clampPageRequest(request, 0), { page: 1, pageSize: 50, offset: 0 }, '0 条数据固定第 1 页')
  assert.deepEqual(clampPageRequest(request, 120), { page: 3, pageSize: 50, offset: 100 }, '120 条 → 第 3 页')
  assert.deepEqual(clampPageRequest(request, 500), { page: 10, pageSize: 50, offset: 450 })

  const meta = buildPaginationMeta(120, parsePageRequest('99'), 20)
  assert.equal(meta.page, 3)
  assert.equal(meta.totalPages, 3)
  assert.equal(meta.offset, 100)
  assert.equal(meta.hasPrev, true)
  assert.equal(meta.hasNext, false)
  assert.equal(meta.total, 120)

  const first = buildPaginationMeta(0, parsePageRequest('5'), 0)
  assert.equal(first.page, 1)
  assert.equal(first.totalPages, 1)
  assert.equal(first.hasPrev, false)
  assert.equal(first.hasNext, false)
})

test('pageHref / renderPager: 保留筛选条件，第 1 页不写 page 参数', () => {
  assert.equal(pageHref('/staff/orders', '', 2), '/staff/orders?page=2')
  assert.equal(pageHref('/staff/orders', 'searchTerm=%E5%BC%A0', 2), '/staff/orders?searchTerm=%E5%BC%A0&page=2')
  assert.equal(pageHref('/staff/orders', 'searchTerm=a&page=3', 1), '/staff/orders?searchTerm=a', '回到第 1 页应删除 page')

  const meta = buildPaginationMeta(120, parsePageRequest('2'), 50)
  const html = renderPager(meta, { basePath: '/staff/orders', search: 'searchTerm=abc', label: '条订单' })
  assert.match(html, /class="pager"/)
  assert.match(html, /第 2 \/ 3 页，共 120 条订单/)
  assert.match(html, /href="\/staff\/orders\?searchTerm=abc"[^>]*>上一页/, '第 1 页链接不带 page 参数')
  assert.match(html, /href="\/staff\/orders\?searchTerm=abc&amp;page=3"|href="\/staff\/orders\?searchTerm=abc&page=3"/, '下一页带 page=3')
  assert.match(html, /data-full-navigation="true"/, '翻页走整页导航，避免 SPA 局部缓存')

  const singlePage = renderPager(buildPaginationMeta(10, parsePageRequest('1'), 10), { basePath: '/x' })
  assert.match(singlePage, /共 10 条/)
  assert.doesNotMatch(singlePage, /下一页/, '只有一页时不渲染翻页按钮')
})

test('escapeLikePattern / normalizeSearchTerm: LIKE 通配符转义与长度上限', () => {
  assert.equal(escapeLikePattern('100%'), '100\\%')
  assert.equal(escapeLikePattern('a_b'), 'a\\_b')
  assert.equal(escapeLikePattern('a\\b'), 'a\\\\b')
  assert.equal(normalizeSearchTerm('  hello  '), 'hello')
  assert.equal(normalizeSearchTerm('x'.repeat(500)).length, 120)
  assert.equal(normalizeSearchTerm(undefined), '')
})

test('queryStaffOrders: STAFF 查询带归属过滤、LIMIT/OFFSET，且参数全部绑定', async () => {
  const db = recordingDb({ orders: [{ id: 'o1', userId: 'c1', deviceId: 'd1', orderNo: 'OD-1', status: 'active' }], users: [], devices: [] }, 120)
  const result = await queryStaffOrders(ctx(db), { user: { id: 'staff-1', role: 'STAFF' }, searchTerm: '', page: '2' })

  const countStatement = db.statements.find((statement) => statement.sql.startsWith('SELECT COUNT(*)'))!
  assert.ok(countStatement, '必须有独立的 COUNT 查询')
  assert.match(countStatement.sql, /AND u\.staff_id = \?/, '员工归属过滤必须在 SQL 里')
  assert.deepEqual(countStatement.params, ['staff-1'], '员工 id 走参数绑定')

  const pageStatement = db.statements.find((statement) => statement.sql.includes('LIMIT'))!
  assert.match(pageStatement.sql, /LIMIT \? OFFSET \?/, '分页必须下推为 LIMIT/OFFSET')
  assert.match(pageStatement.sql, /ORDER BY o\.createdAt DESC/, '排序在 SQL 侧完成')
  assert.deepEqual(pageStatement.params, ['staff-1', 50, 50], 'LIMIT=50、OFFSET=(2-1)*50')

  assert.equal(result.meta.page, 2)
  assert.equal(result.meta.total, 120)
  assert.equal(result.rows.length, 1)
})

test('queryStaffOrders: 搜索词不会拼进 SQL 文本（防注入），并按订单号/客户/设备匹配', async () => {
  const db = recordingDb({}, 0)
  await queryStaffOrders(ctx(db), { user: { id: 'staff-1', role: 'STAFF' }, searchTerm: "x' OR 1=1 --", page: '1' })
  for (const statement of db.statements) {
    assert.ok(!statement.sql.includes("OR 1=1"), `搜索词不能出现在 SQL 文本里：${statement.sql}`)
    assert.ok(!statement.sql.includes('x\''), '搜索词不能出现在 SQL 文本里')
  }
  const countStatement = db.statements[0]
  assert.match(countStatement.sql, /LOWER\(COALESCE\(o\.orderNo, ''\)\) LIKE \? ESCAPE/, '订单号匹配')
  assert.match(countStatement.sql, /LOWER\(COALESCE\(u\.name, ''\)\) LIKE \? ESCAPE/, '客户名匹配')
  assert.match(countStatement.sql, /LOWER\(COALESCE\(d\.name, ''\)\) LIKE \? ESCAPE/, '设备名匹配')
  assert.equal(countStatement.params.length, 4, 'staff_id + 3 个 LIKE 参数')
})

test('queryStaffOrders: ADMIN 不加归属过滤，总数 0 时不再发分页查询', async () => {
  const db = recordingDb({}, 0)
  const result = await queryStaffOrders(ctx(db), { user: { id: 'admin-1', role: 'ADMIN' }, searchTerm: '', page: '1' })
  const countStatement = db.statements[0]
  assert.doesNotMatch(countStatement.sql, /staff_id = \?/, 'ADMIN 不应过滤归属员工')
  assert.deepEqual(countStatement.params, [])
  assert.equal(db.statements.filter((statement) => statement.sql.includes('LIMIT')).length, 0, '空结果集不必再查一页')
  assert.equal(result.meta.total, 0)
  assert.equal(result.meta.page, 1)
})

test('queryStaffCustomers: role/staff_id 下推，排序带 LIMIT/OFFSET', async () => {
  const db = recordingDb({ users: [{ id: 'c1', name: '张 三', email: 'a@b.c', role: 'CUSTOMER', phone: '0400' }] }, 51)
  const result = await queryStaffCustomers(ctx(db), { user: { id: 'staff-9', role: 'STAFF' }, page: '2' })

  const countStatement = db.statements[0]
  assert.match(countStatement.sql, /FROM users WHERE role = 'CUSTOMER' AND staff_id = \?/)
  assert.deepEqual(countStatement.params, ['staff-9'])

  const pageStatement = db.statements.find((statement) => statement.sql.includes('LIMIT'))!
  // users 表的时间列是 snake_case 的 created_at（orders/devices 才是 createdAt）；
  // 同时用 `created_at AS createdAt` 保留下游页面/归一化函数依赖的字段名。
  assert.match(pageStatement.sql, /ORDER BY created_at DESC/)
  assert.match(pageStatement.sql, /created_at AS createdAt/)
  assert.deepEqual(pageStatement.params, ['staff-9', 50, 50])
  assert.equal(result.meta.page, 2)
  assert.equal(result.rows[0].email, 'a@b.c')
})

test('queryAdminUsers: 分页 + 关联人一次 IN 查询（不是 N+1）', async () => {
  const rows = [
    { id: 'u1', name: '甲', email: 'a@x', role: 'CUSTOMER', staff_id: 's1', referrer_id: 'r1' },
    { id: 'u2', name: '乙', email: 'b@x', role: 'CUSTOMER', staff_id: 's1', referrer_id: 'r1' },
  ]
  const db = recordingDb({ users: rows }, 2)
  const result = await queryAdminUsers(ctx(db), { page: '1' })

  const pageStatement = db.statements.find((statement) => statement.sql.includes('LIMIT'))!
  assert.match(pageStatement.sql, /LIMIT \? OFFSET \?/)
  assert.deepEqual(pageStatement.params, [50, 0])

  const relatedStatement = db.statements.find((statement) => statement.sql.includes('IN ('))!
  assert.ok(relatedStatement, '关联人必须用一次 IN 查询批量取回')
  assert.deepEqual(relatedStatement.params, ['s1', 'r1'], '去重后的关联 id')
  assert.equal(result.rows.length, 2)
  assert.equal(result.meta.total, 2)
})

test('queryStaffOrders: 页码越界时回落到最后一页并重新取数', async () => {
  const db = recordingDb({ orders: [{ id: 'o1', userId: 'c1', deviceId: 'd1', status: 'paid' }] }, 60)
  const result = await queryStaffOrders(ctx(db), { user: { id: 'staff-1', role: 'STAFF' }, searchTerm: '', page: '99' })
  assert.equal(result.meta.page, 2, '60 条 / 每页 50 → 最后一页是第 2 页')
  const pageStatement = db.statements.find((statement) => statement.sql.includes('LIMIT'))!
  assert.deepEqual(pageStatement.params, ['staff-1', 50, 50])
})
