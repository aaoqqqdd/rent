/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { createAuditLog, getDeviceById, getDevicesByIds, recordDeviceLifecycle } from '../../site'

export async function getRelistableDevices(c: Context) {
  const { results = [] } = await c.env.RENT.prepare(`
    SELECT d.id FROM devices d
    WHERE d.deleted_at IS NULL AND d.lifecycle_status IN ('RETURNED', 'MAINTENANCE')
      AND (d.lifecycle_status = 'RETURNED' OR (
        SELECT m.status FROM maintenance_records m WHERE m.device_id = d.id ORDER BY m.started_at DESC, m.rowid DESC LIMIT 1
      ) = 'COMPLETED')
      AND NOT EXISTS (SELECT 1 FROM maintenance_records m WHERE m.device_id = d.id AND m.status IN ('OPEN','IN_PROGRESS','DATA_CLEAN','SYSTEM_RESET','CLIENT_CHECK'))
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.deviceId = d.id AND o.deleted_at IS NULL AND o.status IN ('paid','pending_pickup','active','extended','overdue','suspended','pending_return','returned'))
    ORDER BY d.updatedAt DESC, d.id
  `).all() as any
  return getDevicesByIds(c, results.map((device: any) => device.id))
}

export async function deviceRelistBlockReason(c: Context, device: any): Promise<string | undefined> {
  const lifecycle = String(device.lifecycle_status || device.lifecycleStatus)
  if (!['RETURNED', 'MAINTENANCE'].includes(lifecycle)) return '只有已归还或维修完成的设备才能上架'
  const openMaintenance = await c.env.RENT.prepare("SELECT id FROM maintenance_records WHERE device_id = ? AND status IN ('OPEN','IN_PROGRESS','DATA_CLEAN','SYSTEM_RESET','CLIENT_CHECK') LIMIT 1").bind(device.id).first()
  if (openMaintenance) return '该设备还有未完成的维护记录，完成维护后才能标记为可用'
  if (lifecycle === 'MAINTENANCE') {
    const maintenance = await c.env.RENT.prepare('SELECT status FROM maintenance_records WHERE device_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1').bind(device.id).first() as any
    if (maintenance?.status !== 'COMPLETED') return '请先完成设备维修'
  }
  const activeOrder = await c.env.RENT.prepare("SELECT id FROM orders WHERE deviceId = ? AND deleted_at IS NULL AND status IN ('paid','pending_pickup','active','extended','overdue','suspended','pending_return','returned') LIMIT 1").bind(device.id).first()
  if (activeOrder) return '设备仍有关联的未完成订单，暂不能上架'
}

export async function relistReturnedDevice(c: Context, user: any, deviceId: string): Promise<Response> {
  const device = await getDeviceById(c, deviceId)
  if (!device) return c.text('设备不存在', 404)
  const blockedReason = await deviceRelistBlockReason(c, device)
  if (blockedReason) return c.text(blockedReason, 409)
  await recordDeviceLifecycle(c, device.id, 'READY', { reason: '管理员上架设备', changedBy: user.id })
  await c.env.RENT.prepare("UPDATE devices SET device_mode = 'normal' WHERE id = ?").bind(device.id).run()
  await createAuditLog(c, { actor: user, action: 'DEVICE_STATUS_CHANGED', targetType: 'DEVICE', targetId: device.id, before: { lifecycleStatus: device.lifecycle_status || device.lifecycleStatus, status: device.status }, after: { lifecycleStatus: 'READY', status: 'available' }, reason: '管理员上架设备' })
  return c.redirect(`/admin/devices/relist?success=${encodeURIComponent('设备已上架')}`, 303)
}
