/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, formatDate, sanitizePlainText } from '../../site';

export function renderCustomerDashboard(user: any, allOrders: any[], devices: any[], announcementData: { items: any[], page: number, pageCount: number } = { items: [], page: 1, pageCount: 1 }) {
  const announcements = announcementData.items || []
  const orders = allOrders.filter(o => o.userId === user.id)
  const currentRentals = orders.filter((order) => order.status === 'active' || order.status === 'paid')
  const pendingPayment = orders.filter((order) => order.status === 'pending_payment').length
  const completedOrders = orders.filter((order) => order.status === 'completed').length
  const statusLabels: Record<string, string> = {
    active: '租赁中', paid: '已付款', pending_payment: '待付款',
    pending_approval: '待审核', completed: '已完成', cancelled: '已取消'
  }
  const getDaysUntil = (dateValue: unknown) => {
    const date = new Date(String(dateValue || ''))
    if (Number.isNaN(date.getTime())) return null
    return Math.ceil((date.getTime() - Date.now()) / 86400000)
  }
  const getDueText = (dateValue: unknown) => {
    const days = getDaysUntil(dateValue)
    if (days === null) return '请确认归还日期'
    if (days < 0) return `已逾期 ${Math.abs(days)} 天`
    if (days === 0) return '今天到期'
    if (days === 1) return '明天到期'
    return `${days} 天后到期`
  }

  const body = `
    <div class="hero">
      <h2>欢迎回来，${sanitizePlainText(user.name, 80)}</h2>
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
    <div class="grid grid-3">
      ${currentRentals.length > 0 ? `
      <div class="card upcoming-rental">
        <h3>即将到期提醒</h3>
        <p><span class="mono">${sanitizePlainText(currentRentals[0].orderNo, 40)}</span> · ${getDueText(currentRentals[0].endDate)}</p>
        <p class="dashboard-due-date">归还日期：${formatDate(currentRentals[0].endDate)}</p>
        <p style="margin-top: 12px;">
          <a class="button button-sm" href="/customer/rentals">续租申请</a>
          <a class="button button-sm button-secondary" href="/customer/rentals" style="margin-left:8px;">提前归还</a>
        </p>
      </div>` : ''}
      <div class="card quick-actions">
        <div class="quick-actions__heading"><div><h3>快捷操作</h3></div></div>
        <div class="quick-actions__list">
          <a class="quick-action" href="/customer/devices"><span class="quick-action__icon">⌘</span><span><strong>浏览可租设备</strong><small>查找下一台设备</small></span><b>→</b></a>
          <a class="quick-action" href="/customer/referral"><span class="quick-action__icon">+</span><span><strong>邀请好友赚佣金</strong><small>分享你的推荐链接</small></span><b>→</b></a>
          <a class="quick-action" href="/customer/profile"><span class="quick-action__icon">◎</span><span><strong>完善账户信息</strong><small>更新资料与联系方式</small></span><b>→</b></a>
        </div>
      </div>
      <div class="card dashboard-announcements">
        <div class="section-title"><h3>历史通告</h3><a class="link-button" href="/notifications">通知中心 →</a></div>
        ${announcements.length ? `<div class="notification-list">${announcements.map(item => `<a class="dashboard-announcement" href="/notifications/${encodeURIComponent(item.id)}"><strong>${sanitizePlainText(item.title, 160)}</strong><span>${sanitizePlainText(item.created_at, 40)}</span><p>${sanitizePlainText(item.message, 300)}</p></a>`).join('')}</div>${announcementData.pageCount > 1 ? `<nav class="pagination" aria-label="历史通告分页">${Array.from({ length: announcementData.pageCount }, (_, index) => `<a class="button button-sm ${index + 1 === announcementData.page ? 'button-primary' : 'button-secondary'}" href="/customer/dashboard?announcementPage=${index + 1}">${index + 1}</a>`).join('')}</nav>` : ''}` : '<p class="empty-state">暂无历史通告</p>'}
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
            <td data-label="订单号" class="mono">${sanitizePlainText(order.orderNo, 40)}</td>
            <td data-label="设备">${sanitizePlainText(device?.name ?? '-', 120)}</td>
            <td data-label="租期">${sanitizePlainText(order.startDate, 30)} ~ ${sanitizePlainText(order.endDate, 30)}</td>
            <td data-label="金额" class="mono">${formatCurrency(order.totalAmount)}</td>
            <td data-label="状态"><span class="badge ${statusClass}">${statusLabels[order.status] || '处理中'}</span></td>
            <td data-label="操作"><a class="link-button" href="/customer/orders/${encodeURIComponent(order.id)}">查看订单详情</a></td>
          </tr>`
        }).join('')}
        </tbody>
      </table>
    </div>
  `
  return buildLayout('控制台 - PC Rental', body, user)
}
