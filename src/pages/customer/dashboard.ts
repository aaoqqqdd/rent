/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency } from '../../site';

export function renderCustomerDashboard(user: any, allOrders: any[], devices: any[]) {
  const orders = allOrders.filter(o => o.userId === user.id)
  const currentRentals = orders.filter((order) => order.status === 'active' || order.status === 'paid')
  const pendingPayment = orders.filter((order) => order.status === 'pending_payment').length
  const completedOrders = orders.filter((order) => order.status === 'completed').length

  const body = `
    <div class="hero">
      <h2>欢迎回来，${user.name}</h2>
      <p>管理您的设备租赁、查看订单状态、完成支付。</p>
    </div>
    <div class="stats-grid">
      <a class="stat-card primary dashboard-stat-link" href="/customer/rentals">
        <h3>当前租赁</h3>
        <div class="value">${currentRentals.length}</div>
        <div class="trend">台设备使用中</div>
      </a>
      <a class="stat-card warning dashboard-stat-link" href="/customer/orders?status=pending_payment">
        <h3>待付款</h3>
        <div class="value">${pendingPayment}</div>
        <div class="trend" style="color: var(--warning)">笔订单待处理</div>
      </a>
      <a class="stat-card success dashboard-stat-link balance-stat-link" href="/customer/balance">
        <h3>账户余额</h3>
        <div class="value mono">${formatCurrency(user.balance)}</div>
        <div class="trend">查看余额明细 →</div>
      </a>
      <a class="stat-card accent dashboard-stat-link" href="/customer/orders?status=completed">
        <h3>已完成订单</h3>
        <div class="value">${completedOrders}</div>
        <div class="trend">历史租赁</div>
      </a>
    </div>
    <div class="grid grid-2">
      ${currentRentals.length > 0 ? `
      <div class="card">
        <h3>即将到期提醒</h3>
        <p><span class="mono">${currentRentals[0].orderNo}</span> 将于 3 天后到期</p>
        <p style="margin-top: 12px;">
          <a class="button button-sm" href="/customer/rentals">续租申请</a>
          <a class="button button-sm button-secondary" href="/customer/rentals" style="margin-left:8px;">提前归还</a>
        </p>
      </div>` : ''}
      <div class="card">
        <h3>快捷操作</h3>
        <p><a class="link-button" href="/customer/devices">浏览可租设备 →</a></p>
        <p><a class="link-button" href="/customer/referral">邀请好友赚佣金 →</a></p>
        <p><a class="link-button" href="/customer/profile">完善账户信息 →</a></p>
      </div>
    </div>
    <div class="panel" style="margin-top: 20px;">
      <div class="section-title">
        <h2>我的订单</h2>
        <a class="link-button" href="/customer/orders">查看全部 →</a>
      </div>
      <table>
        <thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
        ${orders.slice(0, 5).map((order) => {
          const device = devices.find(d => d.id === order.deviceId)
          const statusMap: Record<string, string> = {
            'active': 'badge-success', 'paid': 'badge-info', 'pending_payment': 'badge-warning',
            'pending_approval': 'badge-warning', 'completed': 'badge-primary', 'cancelled': 'badge-danger'
          }
          const statusClass = statusMap[order.status] || 'badge-info'
          return `<tr>
            <td class="mono">${order.orderNo}</td>
            <td>${device?.name ?? '-'}</td>
            <td>${order.startDate} ~ ${order.endDate}</td>
            <td class="mono">${formatCurrency(order.totalAmount)}</td>
            <td><span class="badge ${statusClass}">${order.status}</span></td>
            <td><a class="link-button" href="/customer/orders/${order.id}">详情</a></td>
          </tr>`
        }).join('')}
        </tbody>
      </table>
    </div>
  `
  return buildLayout('控制台 - PC Rental', body, user)
}
