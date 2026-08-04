/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

export function renderStaffDeviceNew(user: any, errorMessage?: string) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>添加新设备</h2><span class="section-note">填写设备详细信息以添加到库存。</span></div>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/staff/devices/new">
        <label class="form-label">设备名称</label>
        <input class="form-control" name="name" placeholder="例如：MacBook Pro 16寸" />
        <label class="form-label">型号</label>
        <input class="form-control" name="model" placeholder="例如：M1 Max" />
        <label class="form-label">序列号</label>
        <input class="form-control" name="serialNumber" placeholder="设备的唯一序列号" />
        <label class="form-label">日租金</label>
        <input class="form-control" type="number" step="0.01" name="dailyRate" placeholder="例如：50.00" />
        <label class="form-label">设备状态</label>
        <select class="form-control" name="status">
          <option value="available">可用</option>
          <option value="rented">已租借</option>
          <option value="maintenance">维护中</option>
          <option value="retired">已退役</option>
        </select>
        <button class="button button-primary" type="submit" style="margin-top: 20px;">添加设备</button>
      </form>
    </div>
  `
  return buildLayout('添加新设备 - 电脑租赁管理系统', body, user)
}
