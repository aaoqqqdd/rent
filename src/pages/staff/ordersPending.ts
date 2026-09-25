/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, getDB, getDevices, getUsers, sanitizePlainText, staffOrderPath } from '../../site'
import type { Context } from 'hono'

const ongoingStatuses = new Set(['approved', 'pending_payment', 'paid', 'pending_pickup', 'active', 'extended', 'overdue', 'suspended', 'pending_return'])
const statusLabels: Record<string, string> = {
  approved: '等待合同签署', pending_payment: '等待付款', paid: '待交付', pending_pickup: '待客户取货', active: '租赁中', extended: '已延期 / 租赁中', overdue: '已逾期', suspended: '已暂停', pending_return: '待归还验机',
}

// Pre-filters to the ongoing statuses in SQL (indexed) rather than pulling
// the entire orders table; the in-memory filter below is kept as-is so
// behavior stays identical regardless of what the query layer returns.
async function getOngoingStatusOrders(c: Context) {
  const db = getDB(c)
  const placeholders = Array.from(ongoingStatuses).map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM orders WHERE status IN (${placeholders})`).bind(...Array.from(ongoingStatuses)).all()
  return (result.results || []) as any[]
}

export async function renderStaffOrdersOngoing(c: Context, user: any) {
  const [orders, users, devices] = await Promise.all([getOngoingStatusOrders(c), getUsers(c), getDevices(c)])
  const usersById = new Map(users.map(account => [account.id, account]))
  const devicesById = new Map(devices.map(device => [device.id, device]))
  const stage = String(c.req?.query?.('stage') || '')
  const stageStatuses = stage === 'pickup'
    ? new Set(['paid', 'pending_pickup'])
    : stage === 'return'
      ? new Set(['active', 'extended', 'overdue', 'suspended', 'pending_return'])
      : ongoingStatuses
  const ongoingOrders = orders.filter(order => stageStatuses.has(order.status) && (user.role === 'ADMIN' || usersById.get(order.userId)?.staffId === user.id))
  const esc = (value: unknown) => sanitizePlainText(value, 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const pageTitle = stage === 'pickup' ? '待取货订单' : stage === 'return' ? '待归还订单' : '进行中的订单'
  const pageDescription = stage === 'pickup' ? '打开订单后确认设备、配件和客户信息，完成取货交付。' : stage === 'return' ? '打开订单后完成归还验机，提交后订单进入归还流程。' : '查看订单的付款、取货、归还和租赁状态。'

  const body = `
    <div class="page-header"><div><p class="section-code">RENTAL OPERATIONS</p><h2>${pageTitle}</h2><p>${pageDescription}</p></div><a class="button button-secondary" href="/staff/orders">查看全部订单</a></div>
    <div class="panel">
      ${ongoingOrders.length ? `<div class="table-wrapper"><table class="table"><thead><tr><th>订单编号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>当前阶段</th><th>操作</th></tr></thead><tbody>
        ${ongoingOrders.map(order => {
          const customer = usersById.get(order.userId)
          const device = devicesById.get(order.deviceId)
          const inspectionAvailable = ['active', 'extended', 'overdue', 'suspended', 'pending_return'].includes(order.status)
          const action = stage === 'pickup'
            ? `<a class="button button-sm button-primary" href="/staff/orders/${order.id}/handover">取货</a>`
            : stage === 'return'
              ? `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>`
              : inspectionAvailable ? `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>` : ''
          return `<tr><td class="mono">${esc(order.orderNo || '付款后生成')}</td><td>${esc(customer?.name || '未知客户')}</td><td>${esc(device?.name || '未知设备')}</td><td>${esc(order.startDate)} 至 ${esc(order.endDate)}</td><td>${formatCurrency(order.totalAmount)}</td><td><span class="badge ${inspectionAvailable ? 'badge-primary' : 'badge-warning'}">${statusLabels[order.status] || esc(order.status)}</span></td><td><div class="table-actions"><a class="button button-sm button-secondary" href="${staffOrderPath(order)}">查看订单</a>${action}</div></td></tr>`
        }).join('')}
      </tbody></table></div>` : '<div class="empty-state"><span class="empty-state-code mono">NO ACTIVE ORDERS</span><h3>目前没有进行中的订单</h3><p>已付款或进入租赁流程的订单会显示在这里。</p></div>'}
    </div>`
  return buildLayout('进行中的订单 - 电脑租赁管理系统', body, user)
}

export const renderStaffOrdersPending = renderStaffOrdersOngoing
