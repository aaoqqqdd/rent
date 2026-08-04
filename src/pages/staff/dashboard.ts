/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, formatCurrency } from '../../site';

export function renderStaffDashboard(user: any, dashboardData: any) {
  const { stats, recentOrders, recentDevices } = dashboardData;

  const body = `
    <div class="hero">
      <h2>欢迎回来，${user.name}！</h2>
      <p>这是您的员工控制中心，管理所有租赁订单和设备状态。</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card primary">
        <h3>总收入</h3>
        <div class="value">${formatCurrency(stats.totalRevenue || 0)}</div>
        <div class="trend">↑ 系统累计收入</div>
      </div>
      <div class="stat-card success">
        <h3>活跃租赁</h3>
        <div class="value">${stats.activeRentals || 0} 笔</div>
        <div class="trend">正在进行中的订单</div>
      </div>
      <div class="stat-card warning">
        <h3>待处理订单</h3>
        <div class="value">${stats.pendingOrders || 0} 笔</div>
        <div class="trend">需要您处理的订单</div>
      </div>
      <div class="stat-card info">
        <h3>可用设备</h3>
        <div class="value">${stats.availableDevices || 0}/${stats.totalDevices || 0}</div>
        <div class="trend">可租赁的设备数量</div>
      </div>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>最新订单</h3>
        <span class="section-note">最近的5条租赁记录</span>
      </div>
      <table><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${recentOrders.map((order: any) => {
          const statusClass = order.status === 'completed' ? 'badge-success' : 
                             order.status === 'pending_payment' || order.status === 'pending_approval' ? 'badge-warning' : 
                             order.status === 'active' ? 'badge-primary' : 'badge-info';
          return `<tr><td>${order.orderNo || 'N/A'}</td><td>${order.customerName ?? '未知用户'}</td><td>${order.deviceName ?? '未知设备'}</td><td><span class="badge ${statusClass}">${order.status}</span></td><td><a class="link-button" href="/staff/orders/${order.id}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>设备概览</h3>
        <span class="section-note">最近的5台设备状态</span>
      </div>
      <table><thead><tr><th>设备名称</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${recentDevices.map((device: any) => {
          const deviceStatusClass = device.status === 'available' ? 'badge-success' : 
                                   device.status === 'rented' ? 'badge-primary' : 'badge-warning';
          return `<tr><td>${device.name}</td><td><span class="badge ${deviceStatusClass}">${device.status}</span></td><td>${device.customerName ?? '无'}</td><td><a class="link-button" href="/staff/devices/${device.id}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('员工仪表盘 - 电脑租赁管理系统', body, user)
}
