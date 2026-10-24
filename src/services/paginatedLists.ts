/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 员工/管理员列表页的分页查询。
//
// 背景：/staff/orders 和 /staff/customers 以前各自 `SELECT * FROM users` +
// `SELECT * FROM orders`，把整表读进 Worker 内存再 `Array.find` / `filter`——
// 10 万订单时一次页面请求要序列化 10 万行、再对每行做一次 O(n) 查找。
// 这里把「按角色 / 归属员工 / 关键字」全部下推成 SQL，只取当前页 50 行，
// 再按 id 批量取关联的客户与设备（两条 IN 查询），不再拉第三张整表。
//
// 鉴权与角色过滤口径与旧实现保持一致：
//   * ADMIN 看全部；
//   * STAFF 只看 `users.staff_id = 自己` 的客户所下的订单。

import type { Context } from 'hono'
import { getDB } from '../db/client'
import { normalizeUserRow } from '../db/repositories'
import type { User } from '../db/types'
import { DEFAULT_PAGE_SIZE, buildPaginationMeta, clampPageRequest, parsePageRequest } from '../lib/pagination'
import type { PageRequest, PaginationMeta } from '../lib/pagination'

export interface PageQuery {
  page?: unknown
  pageSize?: number
  /** 原始搜索词（页面回填用），会做 trim + 长度截断。 */
  searchTerm?: string
}

export interface StaffListQueryResult<TRow> {
  rows: TRow[]
  meta: PaginationMeta
  searchTerm: string
  /** 相关人员的显示名（订单列表里的客户 / 设备名），避免渲染层再查库。 */
  usersById: Map<string, User>
  devicesById: Map<string, { id: string; name: string }>
  queryCount: number
}

/** 搜索词规范化：去首尾空白、限长、大小写交给 SQL 的 LOWER()。 */
export function normalizeSearchTerm(raw: unknown, maxLength = 120): string {
  return String(raw ?? '').trim().slice(0, maxLength)
}

/** LIKE 通配符转义（配合 `ESCAPE '\'`），避免用户输入 `%` 把全表捞出来。 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function isPrivileged(user: any): boolean {
  return String(user?.role || '').toUpperCase() === 'ADMIN'
}

/** 把查询结果里的 id 批量取回，组成 Map（一次 IN 查询，不是 N+1）。 */
async function loadByIds(c: Context, table: 'users' | 'devices', column: 'id', ids: string[]): Promise<any[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return []
  const db = getDB(c)
  const placeholders = unique.map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM ${table} WHERE ${column} IN (${placeholders})`).bind(...unique).all()
  return (result.results || []) as any[]
}

export interface StaffOrdersQuery extends PageQuery {
  /** 员工身份；ADMIN 时传 role='ADMIN'。 */
  user: any
}

/**
 * 员工「租赁订单」列表：SQL 分页 + 关键字搜索（订单号 / 客户名 / 设备名）。
 *
 * 等价于旧逻辑：
 *   orders = ALL orders
 *   visible = ADMIN ? orders : orders.filter(o => users.find(u => u.id === o.userId)?.staffId === staffId)
 *   filtered = visible.filter(o => orderNo / customer.name / device.name contains term)
 */
export async function queryStaffOrders(c: Context, query: StaffOrdersQuery): Promise<StaffListQueryResult<any>> {
  const db = getDB(c)
  const privileged = isPrivileged(query.user)
  const staffId = String(query.user?.id || '')
  const searchTerm = normalizeSearchTerm(query.searchTerm)
  const size = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE
  let request: PageRequest = parsePageRequest(query.page, size)

  // 归属过滤用 u.staff_id（users 表列名）：没有客户的订单在 STAFF 视角下不应出现，
  // 因此 LEFT JOIN + WHERE u.staff_id = ? 与旧实现的「find 到才可见」等价。
  const searchSql = searchTerm
    ? "AND (LOWER(COALESCE(o.orderNo, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(u.name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(d.name, '')) LIKE ? ESCAPE '\\')"
    : ''
  // 搜索要匹配客户名/设备名，所以恒用 LEFT JOIN；归属条件放在 WHERE 里，
  // 与旧实现「找不到对应客户 = 不可见」的口径一致。
  const joinSql = `FROM orders o LEFT JOIN users u ON u.id = o.userId LEFT JOIN devices d ON d.id = o.deviceId`
  const ownerSql = privileged ? '' : 'AND u.staff_id = ?'
  const whereSql = `WHERE 1=1 ${ownerSql} ${searchSql}`

  const pattern = searchTerm ? `%${escapeLikePattern(searchTerm.toLowerCase())}%` : ''
  const baseParams: any[] = privileged ? [] : [staffId]
  const params = searchTerm ? [...baseParams, pattern, pattern, pattern] : baseParams

  const countRow = await db.prepare(`SELECT COUNT(*) AS total ${joinSql} ${whereSql}`).bind(...params).first() as any
  const total = Number(countRow?.total || 0)
  request = clampPageRequest(request, total)
  const meta = buildPaginationMeta(total, request)

  let queryCount = 1
  let rows: any[] = []
  if (total > 0) {
    const result = await db.prepare(`SELECT o.* ${joinSql} ${whereSql} ORDER BY o.createdAt DESC, o.id DESC LIMIT ? OFFSET ?`)
      .bind(...params, meta.pageSize, meta.offset)
      .all()
    rows = (result.results || []) as any[]
    queryCount++
  }
  meta.count = rows.length

  const customerIds = rows.map((row) => String(row.userId ?? row.user_id ?? ''))
  const deviceIds = rows.map((row) => String(row.deviceId ?? row.device_id ?? ''))
  let usersById = new Map<string, User>()
  let devicesById = new Map<string, { id: string; name: string }>()
  if (rows.length) {
    const [users, devices] = await Promise.all([
      loadByIds(c, 'users', 'id', customerIds),
      loadByIds(c, 'devices', 'id', deviceIds),
    ])
    queryCount += 2
    usersById = new Map(users.map((row) => [String(row.id), normalizeUserRow(row)]))
    devicesById = new Map(devices.map((row) => [String(row.id), { id: String(row.id), name: String(row.name ?? '') }]))
  }

  return { rows, meta, searchTerm, usersById, devicesById, queryCount }
}

export interface StaffCustomersQuery extends PageQuery {
  user: any
}

/**
 * 员工「客户管理」列表：只查 role='CUSTOMER' 且归属当前员工的客户。
 * 关键字匹配姓名 / 邮箱 / 手机号。
 */
export async function queryStaffCustomers(c: Context, query: StaffCustomersQuery): Promise<StaffListQueryResult<User>> {
  const db = getDB(c)
  const privileged = isPrivileged(query.user)
  const staffId = String(query.user?.id || '')
  const searchTerm = normalizeSearchTerm(query.searchTerm)
  const size = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE
  let request: PageRequest = parsePageRequest(query.page, size)

  const clauses: string[] = ["role = 'CUSTOMER'"]
  const params: any[] = []
  if (!privileged) {
    clauses.push('staff_id = ?')
    params.push(staffId)
  }
  if (searchTerm) {
    const pattern = `%${escapeLikePattern(searchTerm.toLowerCase())}%`
    clauses.push("(LOWER(COALESCE(name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(email, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(phone, '')) LIKE ? ESCAPE '\\')")
    params.push(pattern, pattern, pattern)
  }
  const whereSql = clauses.join(' AND ')

  const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`).bind(...params).first() as any
  const total = Number(countRow?.total || 0)
  request = clampPageRequest(request, total)
  const meta = buildPaginationMeta(total, request)

  let queryCount = 1
  let rows: User[] = []
  if (total > 0) {
    // users 表时间列是 snake_case 的 created_at（orders/devices 才是 createdAt）。
    // 同时把 created_at 以 createdAt 别名选出，保证下游 normalizeUserRow / 页面拿到的字段不为 undefined。
    const result = await db.prepare(`SELECT *, created_at AS createdAt FROM users WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...params, meta.pageSize, meta.offset)
      .all()
    rows = ((result.results || []) as any[]).map(normalizeUserRow)
    queryCount++
  }
  meta.count = rows.length

  return { rows, meta, searchTerm, usersById: new Map(), devicesById: new Map(), queryCount }
}

export interface AdminUsersQuery extends PageQuery {
  /** 附加筛选：角色 / 状态（保留给后续页面使用，默认不过滤）。 */
  role?: string
  status?: string
}

/**
 * 管理员「用户管理」列表：SQL 分页，不再整表读入。
 * 里氏替换：返回的 User 行仍带 `staff_id` / `referrer_id`，渲染层用 usersById 查名字。
 */
export async function queryAdminUsers(c: Context, query: AdminUsersQuery): Promise<StaffListQueryResult<User>> {
  const db = getDB(c)
  const searchTerm = normalizeSearchTerm(query.searchTerm)
  const size = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE
  let request: PageRequest = parsePageRequest(query.page, size)

  const clauses: string[] = ['1=1']
  const params: any[] = []
  const role = String(query.role || '').trim().toUpperCase()
  if (role === 'CUSTOMER' || role === 'STAFF' || role === 'ADMIN') {
    clauses.push('role = ?')
    params.push(role)
  }
  const status = String(query.status || '').trim().toLowerCase()
  if (status) {
    clauses.push('COALESCE(account_status, CASE WHEN status = \'inactive\' THEN \'inactive\' ELSE \'active\' END) = ?')
    params.push(status)
  }
  if (searchTerm) {
    const pattern = `%${escapeLikePattern(searchTerm.toLowerCase())}%`
    clauses.push("(LOWER(COALESCE(name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(email, '')) LIKE ? ESCAPE '\\')")
    params.push(pattern, pattern)
  }
  const whereSql = clauses.join(' AND ')

  const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`).bind(...params).first() as any
  const total = Number(countRow?.total || 0)
  request = clampPageRequest(request, total)
  const meta = buildPaginationMeta(total, request)

  let queryCount = 1
  let rows: User[] = []
  if (total > 0) {
    // users 表时间列是 snake_case 的 created_at（orders/devices 才是 createdAt）。
    // 同时把 created_at 以 createdAt 别名选出，保证下游 normalizeUserRow / 页面拿到的字段不为 undefined。
    const result = await db.prepare(`SELECT *, created_at AS createdAt FROM users WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...params, meta.pageSize, meta.offset)
      .all()
    rows = ((result.results || []) as any[]).map(normalizeUserRow)
    queryCount++
  }
  meta.count = rows.length

  // 绑定员工 / 推荐人的显示名：只取本页涉及的人，一次 IN 查询。
  const relatedIds = rows.flatMap((row: any) => [String(row.staffId ?? row.staff_id ?? ''), String(row.referrerId ?? row.referrer_id ?? '')])
  let usersById = new Map<string, User>()
  if (rows.length) {
    const related = await loadByIds(c, 'users', 'id', relatedIds)
    queryCount++
    usersById = new Map(related.map((row) => [String(row.id), normalizeUserRow(row)]))
  }

  return { rows, meta, searchTerm, usersById, devicesById: new Map(), queryCount }
}
