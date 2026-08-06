/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, getDevices, getOrders, getUsers, sanitizePlainText } from '../../site'
import type { Context } from 'hono'

const ongoingStatuses = new Set(['pending_payment', 'paid', 'pending_pickup', 'active', 'pending_return'])
const statusLabels: Record<string, string> = {
  pending_payment: '等待付款', paid: '待交付', pending_pickup: '待客户取货', active: '租赁中', pending_return: '待归还验机',
}

export async function renderStaffOrdersOngoing(c: Context, user: any) {
  const [orders, users, devices] = await Promise.all([getOrders(c), getUsers(c), getDevices(c)])
  const usersById = new Map(users.map(account => [account.id, account]))
  const devicesById = new Map(devices.map(device => [device.id, device]))
  const ongoingOrders = orders.filter(order => ongoingStatuses.has(order.status) && (user.role === 'ADMIN' || usersById.get(order.userId)?.staffId === user.id))
  const esc = (value: unknown) => sanitizePlainText(value, 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const body = `
    <div class="page-header"><div><p class="section-code">RENTAL OPERATIONS</p><h2>进行中的订单</h2><p>查看自己负责订单的付款、交付和租赁状态；订单审核由管理员处理。</p></div><a class="button button-secondary" href="/staff/contracts">租赁管理</a></div>
    <div class="panel">
      ${ongoingOrders.length ? `<div class="table-wrapper"><table class="table"><thead><tr><th>订单编号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>当前阶段</th><th>操作</th></tr></thead><tbody>
        ${ongoingOrders.map(order => {
          const customer = usersById.get(order.userId)
          const device = devicesById.get(order.deviceId)
          const inspectionAvailable = ['active', 'pending_return'].includes(order.status)
          return `<tr><td class="mono">${esc(order.orderNo || '付款后生成')}</td><td>${esc(customer?.name || '未知客户')}</td><td>${esc(device?.name || '未知设备')}</td><td>${esc(order.startDate)} 至 ${esc(order.endDate)}</td><td>${formatCurrency(order.totalAmount)}</td><td><span class="badge ${inspectionAvailable ? 'badge-primary' : 'badge-warning'}">${statusLabels[order.status] || esc(order.status)}</span></td><td><div class="table-actions"><a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看状态</a>${inspectionAvailable ? `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>` : ''}</div></td></tr>`
        }).join('')}
      </tbody></table></div>` : '<div class="empty-state"><span class="empty-state-code mono">NO ACTIVE ORDERS</span><h3>目前没有进行中的订单</h3><p>已付款或进入租赁流程的订单会显示在这里。</p></div>'}
    </div>`
  return buildLayout('进行中的订单 - 电脑租赁管理系统', body, user)
}

export const renderStaffOrdersPending = renderStaffOrdersOngoing
