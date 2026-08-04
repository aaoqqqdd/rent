/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, formatCurrency } from '../../site';

export function renderAdminDashboard(user: any, orders: any[], users: any[], devices: any[]) {
  const today = new Date()
  const totalRevenue = orders.filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'active').reduce((sum, order) => sum + (order.total_amount || order.totalAmount || 0), 0)
  
  // 活跃租赁：状态为active且当前日期在租期内
  const activeRentals = orders.filter(o => {
    if (o.status !== 'active' && o.status !== 'paid') return false
    const start = new Date(o.start_date || o.startDate)
    const end = new Date(o.end_date || o.endDate)
    return today >= start && today <= end
  }).length
  
  const pendingOrders = orders.filter(o => o.status === 'pending_approval' || o.status === 'pending_payment').length
  const availableDevices = devices.filter(d => d.status === 'available').length
  const totalUsers = users.length;

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
        <div class="value">${formatCurrency(totalRevenue)}</div>
        <div class="trend">↑ 系统累计收入</div>
      </div>
      <div class="stat-card success">
        <h3>活跃租赁</h3>
        <div class="value">${activeRentals} 笔</div>
        <div class="trend">正在进行中的订单</div>
      </div>
      <div class="stat-card warning">
        <h3>待处理订单</h3>
        <div class="value">${pendingOrders} 笔</div>
        <div class="trend">需要处理的订单</div>
      </div>
      <div class="stat-card info">
        <h3>可用设备</h3>
        <div class="value">${availableDevices}/${devices.length}</div>
        <div class="trend">可租赁的设备数量</div>
      </div>
      <div class="stat-card" style="margin-top: 0;">
        <h3>注册用户</h3>
        <div class="value">${totalUsers} 人</div>
        <div class="trend">系统总用户数</div>
      </div>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>最新订单</h3>
        <span class="section-note">最近的5条租赁记录</span>
      </div>
      ${orders.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">暂无订单</div>
      ` : `
      <table><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${orders.slice(0, 5).map((order) => {
          const customer = users.find(u => u.id === (order.userId))
          const device = devices.find(d => d.id === (order.device_id || order.deviceId))
          const status = statusMap[order.status] || { text: order.status, class: 'badge-info' }
          return `<tr><td style="font-family: monospace;">${order.id}</td><td>${customer?.name ?? '未知用户'}</td><td>${device?.name ?? '未知设备'}</td><td>${formatCurrency(order.total_amount || order.totalAmount || 0)}</td><td><span class="badge ${status.class}">${status.text}</span></td><td><a class="link-button" href="/admin/orders/${order.id}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
      `}
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>设备概览</h3>
        <span class="section-note">最近的5台设备状态</span>
      </div>
      ${devices.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">暂无设备</div>
      ` : `
      <table><thead><tr><th>设备名称</th><th>型号</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${devices.slice(0, 5).map((device) => {
          const currentOrder = orders.find(o => (o.device_id || o.deviceId) === device.id && (o.status === 'active' || o.status === 'paid'))
          const customer = currentOrder ? users.find(u => u.id === (currentOrder.userId)) : null
          const deviceStatus = deviceStatusMap[device.status] || { text: device.status, class: 'badge-info' }
          return `<tr><td><strong>${device.name}</strong></td><td>${device.model || '-'}</td><td><span class="badge ${deviceStatus.class}">${deviceStatus.text}</span></td><td>${customer?.name ?? '无'}</td><td><a class="link-button" href="/admin/devices/${device.id}/edit">编辑</a></td></tr>`
        }).join('')}
      </tbody></table>
      `}
    </div>
  `;
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user);
}
