/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, sanitizePlainText } from '../../site'

export function renderAdminDeviceRelistList(user: any, devices: any[]) {
  const esc = (value: unknown) => sanitizePlainText(value, 2000).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = `<div class="panel"><div class="section-title"><h2>设备上架</h2><a class="button button-secondary" href="/admin/devices" data-full-navigation="true">返回设备列表</a></div>
    ${devices.length ? `<div class="table-wrapper"><table><thead><tr><th>资产编号</th><th>设备名称</th><th>序列号</th><th>日租金</th><th>押金</th><th>操作</th></tr></thead><tbody>${devices.map(device => `<tr><td class="mono">${esc(device.assetTag || device.asset_tag || '—')}</td><td>${esc(device.name)}</td><td class="mono">${esc(device.serialNumber || device.serial_number || '—')}</td><td>${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}</td><td>${formatCurrency(device.depositAmount ?? 0)}</td><td><a class="button button-success button-sm" data-full-navigation="true" href="/admin/devices/${encodeURIComponent(device.id)}/relist">上架</a></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">暂无待上架设备。</p>'}
  </div>`
  return buildLayout('设备上架 - 电脑租赁管理系统', body, user)
}

export function renderAdminDeviceRelist(user: any, device: any, blockedReason?: string) {
  const esc = (value: unknown) => sanitizePlainText(value, 2000).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lifecycle = String(device.lifecycle_status || device.lifecycleStatus)
  const statusLabel = lifecycle === 'RETURNED' ? '已归还' : lifecycle === 'MAINTENANCE' ? (blockedReason ? '维修中' : '维修完成') : lifecycle === 'READY' ? '可租用' : lifecycle === 'DAMAGED' ? '损坏待处理' : lifecycle === 'RETIRED' ? '已退役' : '暂不能上架'
  const body = `
    <div class="page-header">
      <div><h2>设备上架</h2><p>${esc(device.name)}</p></div>
      <a class="button button-secondary" href="/admin/devices/relist" data-full-navigation="true">返回上架列表</a>
    </div>
    <div class="panel">
      ${blockedReason ? `<div class="alert">${esc(blockedReason)}</div>` : ''}
      <dl class="data-list">
        <div><dt>资产编号</dt><dd class="mono">${esc(device.assetTag || device.asset_tag || '—')}</dd></div>
        <div><dt>品牌</dt><dd>${esc(device.brand || '—')}</dd></div>
        <div><dt>型号</dt><dd>${esc(device.model || '—')}</dd></div>
        <div><dt>序列号</dt><dd class="mono">${esc(device.serialNumber || device.serial_number || '—')}</dd></div>
        <div><dt>状态</dt><dd>${statusLabel}</dd></div>
        <div><dt>日租金</dt><dd>${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}</dd></div>
        <div><dt>押金</dt><dd>${formatCurrency(device.depositAmount ?? 0)}</dd></div>
      </dl>
      ${blockedReason ? `<a class="button button-secondary" href="/admin/devices/${encodeURIComponent(device.id)}/control">远程控制</a>` : `<form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/relist" class="record-actions">
        <button class="button button-success" type="submit">确认上架</button>
      </form>`}
    </div>
  `
  return buildLayout('设备上架 - 电脑租赁管理系统', body, user)
}
