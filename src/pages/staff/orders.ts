/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrders, getUsers, getDevices, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderStaffOrders(c: Context, user: any, searchTerm: string = '') {
  const orders = await getOrders(c);
  const usersData = await getUsers(c);
  const devicesData = await getDevices(c);

  const visibleOrders = user.role === 'ADMIN' ? orders : orders.filter(order => usersData.find(account => account.id === order.userId)?.staffId === user.id)
  const filteredOrders = visibleOrders.filter(order => {
    const customer = usersData.find(u => u.id === order.userId);
    const device = devicesData.find(d => d.id === order.deviceId);
    const searchLower = searchTerm.toLowerCase();
    return (order.orderNo ?? '').toLowerCase().includes(searchLower) ||
           (customer?.name ?? '').toLowerCase().includes(searchLower) ||
           (device?.name ?? '').toLowerCase().includes(searchLower);
  });

  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单状态</h2><span class="section-note">查看自己负责客户的订单；审核、付款确认、退款和取消由管理员处理。</span></div>
      <div class="search-bar" style="margin-bottom: 20px;">
        <form action="/staff/orders" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索订单号、客户或设备..." value="${searchTerm}" style="flex-grow: 1;" />
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${filteredOrders.map((order) => {
            const customer = usersData.find(u => u.id === order.userId);
            const device = devicesData.find(d => d.id === order.deviceId);
            return `<tr><td>${order.orderNo || '<span class="text-muted">付款后生成</span>'}</td><td>${customer?.name ?? 'N/A'}</td><td>${device?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`;
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `;
  return buildLayout('订单状态 - 电脑租赁管理系统', body, user);
}
