/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { createAuditLog, getDeviceById, recordDeviceLifecycle } from '../../site'

export async function relistReturnedDevice(c: Context, user: any, deviceId: string): Promise<Response> {
  const device = await getDeviceById(c, deviceId)
  if (!device) return c.text('设备不存在', 404)
  if (String(device.lifecycle_status || device.lifecycleStatus) !== 'RETURNED') return c.text('只有已归还待上架的设备才能上架', 409)
  const openMaintenance = await c.env.RENT.prepare("SELECT id FROM maintenance_records WHERE device_id = ? AND status IN ('OPEN','IN_PROGRESS','DATA_CLEAN','SYSTEM_RESET','CLIENT_CHECK') LIMIT 1").bind(device.id).first()
  if (openMaintenance) return c.text('该设备还有未完成的维护记录，完成维护后才能标记为可用', 409)
  const activeOrder = await c.env.RENT.prepare("SELECT id FROM orders WHERE deviceId = ? AND deleted_at IS NULL AND status IN ('paid','pending_pickup','active','extended','overdue','suspended','pending_return','returned') LIMIT 1").bind(device.id).first()
  if (activeOrder) return c.text('设备仍有关联的未完成订单，暂不能上架', 409)
  await recordDeviceLifecycle(c, device.id, 'READY', { reason: '管理员上架设备', changedBy: user.id })
  await createAuditLog(c, { actor: user, action: 'DEVICE_STATUS_CHANGED', targetType: 'DEVICE', targetId: device.id, before: { lifecycleStatus: 'RETURNED', status: device.status }, after: { lifecycleStatus: 'READY', status: 'available' }, reason: '管理员上架设备' })
  return c.redirect(`/admin/devices?success=${encodeURIComponent('设备已上架')}`, 303)
}
