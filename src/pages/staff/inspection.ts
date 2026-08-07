/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, getOrderById, getDeviceById } from '../../site'

export async function renderStaffInspection(c: Context, user: any, orderId: string) {
  const order = await getOrderById(c, orderId)
  if (!order || !['active', 'pending_return'].includes(order.status)) return buildLayout('无法验机', '<div class="panel"><h2>当前订单不能执行归还验机</h2></div>', user)
  const device = await getDeviceById(c, order.deviceId)
  const checks = [['screenCondition','屏幕'],['keyboardCondition','键盘'],['trackpadCondition','触控板'],['bodyCondition','外壳'],['cameraCondition','摄像头'],['wifiCondition','WiFi'],['powerTest','开机测试']]
  const fields = checks.map(([name,label]) => `<div class="form-group"><label class="form-label">${label}</label><select class="form-control" name="${name}" required><option value="正常">正常</option><option value="异常">异常</option><option value="未测试">未测试</option></select></div>`).join('')
  return buildLayout('归还验机', `<div class="panel"><div class="section-title"><h2>归还验机</h2><span>${device?.name || order.deviceId}</span></div><form method="post" action="/staff/orders/${order.id}/inspection" data-site-confirm="提交后订单将完成归还，确认验机结果无误？"><div class="grid grid-2">${fields}<div class="form-group"><label class="form-label">电池循环次数</label><input class="form-control" type="number" min="0" name="batteryCycles"></div><div class="form-group"><label class="form-label">电池健康</label><input class="form-control" name="batteryHealth" placeholder="例如 92%"></div></div><div class="form-group"><label class="form-label">损坏说明（无损坏可留空）</label><textarea class="form-control" name="damageDescription" rows="3"></textarea></div><div class="grid grid-2"><div class="form-group"><label class="form-label">损坏照片 URL</label><textarea class="form-control" name="damagePhotos" rows="2"></textarea></div><div class="form-group"><label class="form-label">预计更换/维修费用（AUD）</label><input class="form-control" type="number" min="0" step="0.01" name="replacementCost" value="0"></div></div><button class="button button-primary" type="submit">提交验机并完成归还</button></form></div>`, user)
}
