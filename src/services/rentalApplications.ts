/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { canTransitionOrder, updateOrderStatus, releaseStripePendingPaymentIntents } from '../site'
import { createNotification, deleteRentalApplicationNotifications } from './notifications'

export const RENTAL_APPLICATION_CONFLICT_MESSAGE = '所选租期与其他申请冲突，申请未通过。请重新选择租期或设备。'

interface Application {
  id: string; userId: string; startDate: string; endDate: string; startPeriod?: string; endPeriod?: string;
  status: string; createdAt: string; booking_buffer_days: number; has_paid_payment: number;
}

const period = (date: string, slot?: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86400000 * 2 + (slot === 'PM' ? 1 : 0)
const duration = (order: Application) => period(order.endDate, order.endPeriod) - period(order.startDate, order.startPeriod)

function overlaps(a: Application, b: Application, bufferDays: number): boolean {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return true
  const buffer = Math.max(0, bufferDays, a.booking_buffer_days || 0, b.booking_buffer_days || 0)
  const start = buffer ? period(a.startDate, 'AM') - buffer * 2 : period(a.startDate, a.startPeriod)
  const end = buffer ? period(a.endDate, 'PM') + buffer * 2 : period(a.endDate, a.endPeriod)
  return start < period(b.endDate, b.endPeriod) && period(b.startDate, b.startPeriod) < end
}

// 待审核申请按实际半天数、起租日期、提交时间排序；完全相同时保留先入库的一笔。
export async function resolveRentalApplicationConflicts(c: Context, deviceId: string, applicationId: string, bufferDays = 0): Promise<string[]> {
  const { results = [] } = await c.env.RENT.prepare(`SELECT o.*,
    EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = o.id AND p.status = 'paid') AS has_paid_payment
    FROM orders o WHERE o.deviceId = ? AND o.deleted_at IS NULL AND o.status NOT IN ('completed', 'cancelled')
    ORDER BY julianday(o.createdAt), o.rowid`).bind(deviceId).all() as { results: Application[] }
  const isApplication = (order: Application) => order.status === 'pending_approval' && !order.has_paid_payment
  const submitted = results.find(order => order.id === applicationId)
  if (!submitted || !isApplication(submitted)) return []
  const kept = results.filter(order => !isApplication(order))
  const applications = results.filter(order => isApplication(order) && overlaps(submitted, order, bufferDays))
    .sort((a, b) => duration(b) - duration(a) || a.startDate.localeCompare(b.startDate))
  const rejected: string[] = []
  for (const order of applications) {
    const winner = kept.find(other => overlaps(order, other, bufferDays))
    if (!winner) { kept.push(order); continue }
    if (!canTransitionOrder(order.status, 'cancelled')) continue
    // 只认领仍待审核的申请；并发请求已拒绝的订单不会重复通知，已通过的订单不会被覆盖。
    const claimed = await c.env.RENT.prepare(`UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending_approval' AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = orders.id AND status = 'paid')
        AND EXISTS (SELECT 1 FROM orders winner WHERE winner.id = ? AND winner.deleted_at IS NULL AND winner.status NOT IN ('completed', 'cancelled'))`)
      .bind(order.id, winner.id).run()
    if (!claimed.meta.changes) continue
    await updateOrderStatus(c, order.id, 'cancelled', { reason: RENTAL_APPLICATION_CONFLICT_MESSAGE })
    await releaseStripePendingPaymentIntents(c, order.id)
    await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE rental_id = ? AND status = 'pending'").bind(order.id).run()
    await deleteRentalApplicationNotifications(c, order.id)
    await createNotification(c, { recipientId: order.userId, type: 'rental_application_rejected', title: '租赁申请未通过',
      message: RENTAL_APPLICATION_CONFLICT_MESSAGE, orderId: order.id, dedupeKey: `application-conflict:${order.id}` })
    rejected.push(order.id)
  }
  return rejected
}
