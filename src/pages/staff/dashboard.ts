/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, staffOrderPath } from '../../site';
import { escapeHtml } from '../../lib/html';

export function renderStaffDashboard(user: any, dashboardData: any) {
  const { stats, recentOrders, recentDevices } = dashboardData;

  const pendingApproval = Number(stats.pendingOrders || 0)
  const body = `
    <div class="hero">
      <h2>欢迎回来，${escapeHtml(user.name)}</h2>
    </div>
    <section class="summary" aria-label="工作摘要">
      <div class="summary__lead">
        <span class="summary__eyebrow">待处理订单 / TO-DO</span>
        <div class="summary__figure ${pendingApproval ? 'is-attention' : ''}">${pendingApproval}<small>笔</small></div>
        <p class="summary__note">${pendingApproval ? '待审核与待支付' : '暂无待处理'}</p>
      </div>
      <div class="summary__aside">
        <a class="summary__cell" href="/staff/orders">
          <h3>活跃租赁</h3>
          <div class="value">${stats.activeRentals || 0}<span class="unit">笔</span></div>
          <div class="trend">进行中</div>
        </a>
        <a class="summary__cell" href="/staff/devices">
          <h3>可用设备</h3>
          <div class="value">${stats.availableDevices || 0}<span class="unit">/</span>${stats.totalDevices || 0}</div>
          <div class="trend">可出租</div>
        </a>
        <a class="summary__cell" href="/admin/finance">
          <h3>总收入</h3>
          <div class="value">${formatCurrency(stats.totalRevenue || 0)}</div>
          <div class="trend">已支付与已完成</div>
        </a>
      </div>
    </section>
    ${pendingApproval ? `
    <section class="attention" aria-labelledby="attention-title">
      <div class="attention__head"><h3 id="attention-title">需要你处理</h3><span>${pendingApproval} 笔待审核</span></div>
      <ol>
        <li><a href="/staff/orders?status=pending_approval"><span class="attention__title">待审核订单</span><span class="attention__meta is-warn">${pendingApproval} 笔 ›</span></a></li>
      </ol>
    </section>` : ''}
    <div class="panel">
      <div class="section-title">
        <h3>最新订单</h3>
      </div>
      <table><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${recentOrders.map((order: any) => {
          const statusClass = order.status === 'completed' ? 'badge-success' : 
                             order.status === 'pending_payment' || order.status === 'pending_approval' ? 'badge-warning' : 
                             order.status === 'active' ? 'badge-primary' : 'badge-info';
          return `<tr><td>${order.orderNo || 'N/A'}</td><td>${order.customerName ?? '未知用户'}</td><td>${order.deviceName ?? '未知设备'}</td><td><span class="badge ${statusClass}">${order.status}</span></td><td><a class="link-button" href="${staffOrderPath(order)}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>设备概览</h3>
      </div>
      <table><thead><tr><th>设备名称</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${recentDevices.map((device: any) => {
          const deviceStatusClass = device.status === 'available' ? 'badge-success' :
                                   device.status === 'rented' ? 'badge-primary' : 'badge-warning';
          const needsAcceptance = device.lifecycle_status === 'RETURNED' || device.lifecycle_status === 'INSPECTION';
          const action = needsAcceptance
            ? `<a class="link-button" href="/admin/devices/${device.id}/accept">去验收</a>`
            : `<a class="link-button" href="/staff/devices/${device.id}">查看详情</a>`;
          return `<tr><td>${escapeHtml(device.name)}</td><td><span class="badge ${deviceStatusClass}">${escapeHtml(device.status)}</span></td><td>${escapeHtml(device.customerName) || '无'}</td><td>${action}</td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('员工仪表盘 - 电脑租赁管理系统', body, user)
}
