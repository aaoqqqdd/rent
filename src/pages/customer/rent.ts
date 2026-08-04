/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, getDeviceById, formatCurrency } from '../../site';
import type { Context } from 'hono';

export async function renderCustomerRent(c: Context, deviceId: string, user: any, errorMessage?: string) {
  const device = await getDeviceById(c, deviceId);

  if (!device) {
    return buildLayout('租赁设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求租赁的设备不存在。</p></div>', user);
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁设备: ${device.name}</h2><span class="section-note">填写租赁信息并确认订单。</span></div>
      ${errorMessage ? `<div class="alert alert-error">${errorMessage}</div>` : ''}
      <form method="POST" action="/customer/rent/${device.id}">
        <div class="form-group">
          <label class="form-label" for="deviceName">设备名称</label>
          <input type="text" id="deviceName" class="form-control" value="${device.name}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="deviceModel">型号</label>
          <input type="text" id="deviceModel" class="form-control" value="${device.model}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="dailyRate">日租金</label>
          <input type="text" id="dailyRate" class="form-control" value="${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="depositAmount">押金</label>
          <input type="text" id="depositAmount" class="form-control" value="${formatCurrency(device.depositAmount)}" readonly />
        </div>

        <div class="form-group">
          <label class="form-label" for="startDate">开始日期</label>
          <input type="date" id="startDate" name="startDate" class="form-control" min="${today}" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="endDate">结束日期</label>
          <input type="date" id="endDate" name="endDate" class="form-control" min="${today}" required />
        </div>

        <button type="submit" class="button button-primary" style="margin-top: 20px;">确认租赁</button>
      </form>
    </div>
  `;

  return buildLayout(`租赁 ${device.name} - 电脑租赁管理系统`, body, user);
}
