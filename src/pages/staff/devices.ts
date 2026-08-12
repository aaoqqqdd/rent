/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDevices, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderStaffDevices(c: Context, user: any) {
  const devices = await getDevices(c)
  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备目录</h2><span class="section-note">查看设备资料和租赁状态；设备信息由管理员维护。</span></div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>设备名称</th>
              <th>型号</th>
              <th>备注</th>
              <th>序列号</th>
              <th>日租金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${devices.map((device) => `
              <tr>
                <td>${device.name}</td>
                <td>${device.model}</td>
                <td>${device.description || '—'}</td>
                <td>${device.serialNumber}</td>
                <td>${formatCurrency(device.pricePerDay ?? device.price_per_day ?? 0)}</td>
                <td>${device.status}</td>
                <td><a class="link-button" href="/staff/devices/${device.id}">查看</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
  return buildLayout('设备目录 - 电脑租赁管理系统', body, user)
}
