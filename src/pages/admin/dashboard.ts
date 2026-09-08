/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency } from '../../site';
import type { AdminDashboardData } from '../../services/adminDashboard';

export function renderAdminDashboard(
  user: any,
  data: AdminDashboardData,
  opsCounts?: { failedPayments: number; failedCommands: number; pendingDamage: number }
) {
  const { stats, recentOrders, recentDevices } = data

  const statusMap: Record<string, { text: string; class: string }> = {
    'pending_approval': { text: '待审核', class: 'badge-warning' },
    'pending_payment': { text: '待支付', class: 'badge-warning' },
    'approved': { text: '已审核', class: 'badge-info' },
    'paid': { text: '已支付', class: 'badge-primary' },
    'active': { text: '租赁中', class: 'badge-primary' },
    'completed': { text: '已完成', class: 'badge-success' },
    'cancelled': { text: '已取消', class: 'badge-danger' }
  }

  const deviceStatusMap: Record<string, { text: string; class: string }> = {
    'available': { text: '可用', class: 'badge-success' },
    'rented': { text: '已出租', class: 'badge-primary' },
    'maintenance': { text: '维护中', class: 'badge-warning' },
    'retired': { text: '已退役', class: 'badge-info' }
  }

  const body = `
    <div class="hero">
      <h2>欢迎回来，${user.name}！</h2>
      <p>这是您的管理员控制中心，管理整个系统的所有数据和设置。</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card primary">
        <h3>总收入</h3>
        <div class="value">${formatCurrency(stats.totalRevenue)}</div>
        <div class="trend">↑ 已支付/租赁中/已完成订单，不含已取消</div>
      </div>
      <div class="stat-card success">
        <h3>活跃租赁</h3>
        <div class="value">${stats.activeRentals} 笔</div>
        <div class="trend">正在进行中的订单</div>
      </div>
      <div class="stat-card warning">
        <h3>待处理订单</h3>
        <div class="value">${stats.pendingOrders} 笔</div>
        <div class="trend">需要处理的订单</div>
      </div>
      <div class="stat-card info">
        <h3>可用设备</h3>
        <div class="value">${stats.availableDevices}/${stats.totalDevices}</div>
        <div class="trend">可租赁的设备数量</div>
      </div>
      <div class="stat-card" style="margin-top: 0;">
        <h3>注册用户</h3>
        <div class="value">${stats.totalUsers} 人</div>
        <div class="trend">有效用户数（不含已删除访客账户）</div>
      </div>
    </div>
    <div class="section-title" style="margin-top:24px"><h3>今日运营</h3></div>
    <div class="stats-grid">
      <div class="stat-card"><h3>今日取货</h3><div class="value">${stats.todayPickups}</div></div>
      <div class="stat-card"><h3>今日归还</h3><div class="value">${stats.todayReturns}</div></div>
      <div class="stat-card ${stats.overdueRentals ? 'warning' : ''}"><h3>逾期租赁</h3><div class="value">${stats.overdueRentals}</div></div>
      <div class="stat-card ${stats.pendingDeposits ? 'warning' : ''}"><h3>待结算押金</h3><div class="value">${stats.pendingDeposits}</div></div>
      <div class="stat-card"><h3>预留设备</h3><div class="value">${stats.reservedDevices}</div></div>
      <div class="stat-card ${stats.maintenanceDevices ? 'warning' : ''}"><h3>维护中设备</h3><div class="value">${stats.maintenanceDevices}</div></div>
      <div class="stat-card ${stats.damagedDevices ? 'warning' : ''}"><h3>损坏设备</h3><div class="value">${stats.damagedDevices}</div></div>
      <div class="stat-card ${opsCounts?.failedPayments ? 'warning' : ''}"><h3>近7日失败付款</h3><div class="value">${opsCounts?.failedPayments ?? '-'}</div></div>
      <div class="stat-card ${opsCounts?.failedCommands ? 'warning' : ''}"><h3>近7日失败远程命令</h3><div class="value">${opsCounts?.failedCommands ?? '-'}</div></div>
      <div class="stat-card ${opsCounts?.pendingDamage ? 'warning' : ''}"><h3>待处理损坏记录</h3><div class="value">${opsCounts?.pendingDamage ?? '-'}</div></div>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>最新订单</h3>
        <span class="section-note">最近的5条租赁记录</span>
      </div>
      ${recentOrders.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">暂无订单</div>
      ` : `
      <table><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${recentOrders.map((order) => {
    const status = statusMap[order.status] || { text: order.status, class: 'badge-info' }
    return `<tr><td style="font-family: monospace;">${order.id}</td><td>${order.customerName ?? '未知用户'}</td><td>${order.deviceName ?? '未知设备'}</td><td>${formatCurrency(order.totalAmount)}</td><td><span class="badge ${status.class}">${status.text}</span></td><td><a class="link-button" href="/admin/orders/${order.id}">查看详情</a></td></tr>`
  }).join('')}
      </tbody></table>
      `}
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>设备概览</h3>
        <span class="section-note">最近的5台设备状态</span>
      </div>
      ${recentDevices.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">暂无设备</div>
      ` : `
      <table><thead><tr><th>设备名称</th><th>型号</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${recentDevices.map((device) => {
    const deviceStatus = deviceStatusMap[device.status] || { text: device.status, class: 'badge-info' }
    return `<tr><td><strong>${device.name}</strong></td><td>${device.model || '-'}</td><td><span class="badge ${deviceStatus.class}">${deviceStatus.text}</span></td><td>${device.customerName ?? '无'}</td><td><a class="link-button" data-full-navigation="true" href="/admin/devices/${encodeURIComponent(device.id)}/edit">编辑</a> <a class="link-button" data-full-navigation="true" href="/admin/device-agent-bindings">远程操作</a></td></tr>`
  }).join('')}
      </tbody></table>
      `}
    </div>
  `;
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user);
}
