/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { canTransitionOrder } from '../domain/orderStatus'

export interface RentalLink {
  id: string; token: string; title: string; device_id: string; pickup_location: string; return_location: string;
  device_condition: string; device_accessories: string | null; late_fee_per_day: number; enabled: number; created_by: string;
}

export async function getRentalLink(c: Context, token: string): Promise<RentalLink | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null
  return c.env.RENT.prepare("SELECT l.* FROM rental_links l JOIN users u ON u.id = l.created_by WHERE l.token = ? AND l.enabled = 1 AND u.role = 'ADMIN' AND u.status = 'active'").bind(token).first()
}

// 自助签约只短暂保留档期，离开页面不完成签约的访问者不会一直占用设备。
export async function expireRentalLinkDrafts(c: Context): Promise<number> {
  if (!canTransitionOrder('draft', 'cancelled')) return 0
  // 这个函数在每次打开自助租赁链接页（GET）时都会调用。绝大多数访问没有任何过期草稿，
  // 直接跑两条 UPDATE 等于给每次浏览都加两次 D1 写；先做一次廉价的 EXISTS 探测，
  // 只有真的存在过期/已取消合同的草稿时才批量清理。
  const pending = await c.env.RENT.prepare(`SELECT 1 AS pending FROM orders o
    WHERE o.rental_link_id IS NOT NULL AND o.status = 'draft' AND (datetime(o.createdAt) <= datetime('now', '-30 minutes')
      OR EXISTS (SELECT 1 FROM contracts c WHERE c.orderId = o.id AND c.status = 'cancelled'))
    LIMIT 1`).first()
  if (!pending) return 0
  const results = await c.env.RENT.batch([
    c.env.RENT.prepare(`UPDATE orders SET status = 'cancelled', order_status = 'CANCELLED', rental_status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP
      WHERE rental_link_id IS NOT NULL AND status = 'draft' AND (datetime(createdAt) <= datetime('now', '-30 minutes')
        OR EXISTS (SELECT 1 FROM contracts c WHERE c.orderId = orders.id AND c.status = 'cancelled'))`),
    c.env.RENT.prepare("UPDATE contracts SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE status = 'pending_sign' AND orderId IN (SELECT id FROM orders WHERE rental_link_id IS NOT NULL AND status = 'cancelled')"),
  ])
  return Number(results[0]?.meta?.changes || 0)
}

export function validRentalLinkDates(form: Record<string, unknown>): boolean {
  const dates = [form.startDate, form.endDate].map(value => String(value || ''))
  return dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date)
    && ['AM', 'PM'].includes(String(form.startPeriod || 'AM')) && ['AM', 'PM'].includes(String(form.endPeriod || 'AM'))
    && Date.parse(dates[1]) - Date.parse(dates[0]) <= 366 * 86400000
}
