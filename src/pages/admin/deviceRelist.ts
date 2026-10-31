/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, sanitizePlainText } from '../../site'

export function renderAdminDeviceRelist(user: any, device: any) {
  const esc = (value: unknown) => sanitizePlainText(value, 2000).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = `
    <div class="page-header">
      <div><h2>设备上架</h2><p>${esc(device.name)}</p></div>
      <a class="button button-secondary" href="/admin/devices" data-full-navigation="true">返回设备列表</a>
    </div>
    <div class="panel">
      <dl class="data-list">
        <div><dt>资产编号</dt><dd class="mono">${esc(device.assetTag || device.asset_tag || '—')}</dd></div>
        <div><dt>品牌</dt><dd>${esc(device.brand || '—')}</dd></div>
        <div><dt>型号</dt><dd>${esc(device.model || '—')}</dd></div>
        <div><dt>序列号</dt><dd class="mono">${esc(device.serialNumber || device.serial_number || '—')}</dd></div>
        <div><dt>状态</dt><dd>已归还待上架</dd></div>
        <div><dt>日租金</dt><dd>${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}</dd></div>
        <div><dt>押金</dt><dd>${formatCurrency(device.depositAmount ?? 0)}</dd></div>
      </dl>
      <form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/relist" class="record-actions">
        <button class="button button-success" type="submit">确认上架</button>
      </form>
    </div>
  `
  return buildLayout('设备上架 - 电脑租赁管理系统', body, user)
}
