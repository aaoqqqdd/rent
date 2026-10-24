/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { getDeviceById, sanitizePlainText, createAuditLog } from '../../site'

export async function createAdminRentalLink(c: Context) {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.text('仅管理员可管理租赁链接', 403)
  const form = await c.req.parseBody()
  const device = await getDeviceById(c, String(form.deviceId || ''))
  const pickup = sanitizePlainText(form.pickupLocation, 300), returns = sanitizePlainText(form.returnLocation, 300)
  const lateFee = Number(form.lateFeePerDay || 0)
  if (!device || ['maintenance', 'retired'].includes(String(device.status)) || !pickup || !returns || !Number.isFinite(lateFee) || lateFee < 0 || lateFee > 99999) return c.redirect('/admin/rental-links?error=' + encodeURIComponent('请选择可出租设备，填写取还地点及有效的逾期费用'), 303)
  const id = `rl-${nanoid(12)}`
  await c.env.RENT.prepare('INSERT INTO rental_links (id, token, title, device_id, pickup_location, return_location, device_condition, device_accessories, late_fee_per_day, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, nanoid(32), sanitizePlainText(form.title, 120) || device.name, device.id, pickup, returns, sanitizePlainText(form.deviceCondition, 1000) || '交付时以设备验机记录为准。', sanitizePlainText(form.deviceAccessories, 500) || null, lateFee, admin.id).run()
  await createAuditLog(c, { actor: admin, action: 'RENTAL_LINK_CREATED', targetType: 'RENTAL_LINK', targetId: id, after: { deviceId: device.id } })
  return c.redirect('/admin/rental-links?created=' + encodeURIComponent(id), 303)
}

export async function toggleAdminRentalLink(c: Context) {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.text('仅管理员可管理租赁链接', 403)
  const form = await c.req.parseBody()
  if (!['0', '1'].includes(String(form.enabled))) return c.text('链接状态无效', 400)
  const enabled = Number(form.enabled)
  const result = await c.env.RENT.prepare('UPDATE rental_links SET enabled = ? WHERE id = ?').bind(enabled, c.req.param('id')).run()
  if (!result.meta?.changes) return c.notFound()
  await createAuditLog(c, { actor: admin, action: 'RENTAL_LINK_UPDATED', targetType: 'RENTAL_LINK', targetId: String(c.req.param('id')), after: { enabled } })
  return c.redirect('/admin/rental-links', 303)
}
