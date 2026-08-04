/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, getDeviceById } from '../../site'
import type { Context } from 'hono'

export async function renderStaffDeviceEdit(c: Context, user: any, deviceId: string, errorMessage?: string) {
  const device = await getDeviceById(c, deviceId)
  if (!device) {
    return buildLayout('编辑设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user)
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>编辑设备 - ${device.name}</h2><span class="section-note">修改设备详细信息。</span></div>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/staff/devices/${device.id}/edit">
        <label class="form-label">设备名称</label>
        <input class="form-control" name="name" value="${device.name}" />
        <label class="form-label">型号</label>
        <input class="form-control" name="model" value="${device.model}" />
        <label class="form-label">序列号</label>
        <input class="form-control" name="serialNumber" value="${device.serialNumber}" />
        <label class="form-label">日租金</label>
        <input class="form-control" type="number" step="0.01" name="dailyRate" value="${device.dailyRate}" />
        <label class="form-label">设备状态</label>
        <select class="form-control" name="status">
          <option value="available" ${device.status === 'available' ? 'selected' : ''}>可用</option>
          <option value="rented" ${device.status === 'rented' ? 'selected' : ''}>已租借</option>
          <option value="maintenance" ${device.status === 'maintenance' ? 'selected' : ''}>维护中</option>
          <option value="retired" ${device.status === 'retired' ? 'selected' : ''}>已退役</option>
        </select>
        <button class="button button-primary" type="submit" style="margin-top: 20px;">保存修改</button>
      </form>
    </div>
  `
  return buildLayout('编辑设备 - 电脑租赁管理系统', body, user)
}
