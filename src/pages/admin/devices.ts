/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency } from '../../site';

export function renderAdminDevices(user: any, devices: any[] = []) {
  const body = `
    <style>
      .link-button-danger {
        background: none;
        border: none;
        color: var(--danger);
        text-decoration: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 6px;
        transition: var(--transition);
      }
      .link-button-danger:hover {
        background: var(--danger-light);
      }
      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: var(--text-secondary);
      }
      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
    </style>
    <div class="panel">
      <div class="section-title">
        <h2>设备管理</h2>
        <span class="section-note">管理所有租赁设备信息。</span>
        <div class="record-actions" style="margin-left:auto"><a href="/admin/device-agent-bindings" class="button button-secondary">Windows 客户端管理</a><a href="/admin/devices/new" class="button button-success">添加入库设备</a></div>
      </div>
      ${devices.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💻</div>
          <h3>暂无设备</h3>
          <p>点击右上角"添加入库设备"添加第一台设备</p>
        </div>
      ` : `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>设备名称</th>
            <th>品牌</th>
            <th>型号</th>
            <th>资产编号</th>
            <th>序列号</th>
            <th>日租金</th>
            <th>押金</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${devices.map(device => {
            const statusClass = device.status === 'available' ? 'badge-success' :
                               device.status === 'rented' ? 'badge-primary' :
                               device.status === 'maintenance' ? 'badge-warning' : 'badge-info';
            const statusMap: Record<string, string> = {
              'available': '可用',
              'rented': '已出租',
              'maintenance': '维护中',
              'retired': '已退役'
            }
            const statusText = statusMap[device.status] || device.status;
            return `
              <tr>
                <td>${device.id}</td>
                <td><strong>${device.name}</strong></td>
                <td>${device.brand || '-'}</td>
                <td>${device.model || '-'}</td>
                <td class="mono">${device.assetTag || device.asset_tag || '-'}</td>
                <td style="font-family: monospace; font-size: 0.85rem;">${device.serialNumber || device.serial_number || '-'}</td>
                <td>${formatCurrency(device.pricePerDay || device.dailyRate)}</td>
                <td>${formatCurrency(device.depositAmount)}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                  <a class="link-button" data-full-navigation="true" href="/admin/devices/${encodeURIComponent(device.id)}/edit">编辑</a>
                  <a class="link-button" data-full-navigation="true" href="/admin/devices/${encodeURIComponent(device.id)}/control">远程控制</a>
                  <form method="post" action="/admin/devices/${device.id}/delete" style="display:inline" onsubmit="return confirm('确定要删除此设备吗？此操作不可恢复。')"><button class="link-button-danger" type="submit">删除</button></form>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;

  return buildLayout('设备管理 - 电脑租赁管理系统', body, user);
}
