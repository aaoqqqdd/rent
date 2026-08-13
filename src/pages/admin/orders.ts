/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrders, getDevices, getUsers, formatCurrency } from '../../site';
import { Context } from 'hono';
import { renderOrderStatusFeedback } from './orderStatusFeedback';

export const adminOrderStatusMap: Record<string, { text: string; class: string }> = {
  all: { text: '全部', class: 'badge-info' },
  pending_approval: { text: '待审核', class: 'badge-warning' },
  pending_payment: { text: '待支付', class: 'badge-warning' },
  approved: { text: '已审核', class: 'badge-info' },
  paid: { text: '已支付', class: 'badge-primary' },
  active: { text: '租赁中', class: 'badge-primary' },
  completed: { text: '已完成', class: 'badge-success' },
  cancelled: { text: '已取消', class: 'badge-danger' }
};

export async function getFilteredAdminOrders(
  c: Context,
  filters?: {
    userId?: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const [allOrders, allUsers, allDevices] = await Promise.all([getOrders(c), getUsers(c), getDevices(c)]);
  const userIdFilter = (filters?.userId || '').trim();
  const rawStatusFilter = String(filters?.status || 'all').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const statusFilter = ({ pending: 'pending_payment', in_progress: 'active', complete: 'completed', canceled: 'cancelled' } as Record<string, string>)[rawStatusFilter] || rawStatusFilter;
  const searchTerm = (filters?.search || '').trim();
  const dateFrom = (filters?.dateFrom || '').trim();
  const dateTo = (filters?.dateTo || '').trim();

  const usersById = new Map(allUsers.map(item => [item.id, item]));
  const devicesById = new Map(allDevices.map(item => [item.id, item]));
  const ordersWithDetail = allOrders.map((order: any) => ({
    ...order,
    customer: usersById.get(order.userId) || null,
    device: devicesById.get(order.device_id || order.deviceId) || null,
  }));

  return ordersWithDetail.filter((order: any) => {
    const matchesUser = !userIdFilter || String(order.userId) === String(userIdFilter);
    const rawOrderStatus = String(order.status || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const orderStatus = ({ pending: 'pending_payment', in_progress: 'active', complete: 'completed', canceled: 'cancelled' } as Record<string, string>)[rawOrderStatus] || rawOrderStatus;
    const matchesStatus = statusFilter === 'all' || orderStatus === statusFilter;

    const searchableText = [
      order.id,
      order.orderNo,
      order.customer?.name,
      order.customer?.email,
      order.device?.name,
      order.device?.brand,
      order.device?.model,
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !searchTerm || searchableText.includes(searchTerm.toLowerCase());

    const createdDateValue = order.created_at || order.createdAt || '2020-01-01T00:00:00.000Z';
    const createdDate = new Date(createdDateValue);
    const matchesDateFrom = !dateFrom || createdDate >= new Date(`${dateFrom}T00:00:00`);
    const matchesDateTo = !dateTo || createdDate <= new Date(`${dateTo}T23:59:59`);

    return matchesUser && matchesStatus && matchesSearch && matchesDateFrom && matchesDateTo;
  }).sort((a: any, b: any) => {
    const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
    const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export async function renderAdminOrders(c: Context, user: any) {
  const url = new URL(c.req.url);
  const userIdFilter = url.searchParams.get('userId') || '';
  const statusFilter = url.searchParams.get('status') || 'all';
  const searchTerm = (url.searchParams.get('search') || '').trim();
  const dateFrom = (url.searchParams.get('dateFrom') || '').trim();
  const dateTo = (url.searchParams.get('dateTo') || '').trim();

  const errorMessage = url.searchParams.get('error')?.trim() || '';
  const successMessage = url.searchParams.get('success')?.trim() || '';
  const allUsers = await getUsers(c);
  const filteredOrders = await getFilteredAdminOrders(c, {
    userId: userIdFilter,
    status: statusFilter,
    search: searchTerm,
    dateFrom,
    dateTo,
  });

  const exportQuery = new URLSearchParams({
    ...(userIdFilter ? { userId: userIdFilter } : {}),
    ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }).toString();

  const totalRevenue = filteredOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || order.totalAmount || 0), 0);
  const pendingCount = filteredOrders.filter((order: any) => ['pending_approval', 'pending_payment', 'approved'].includes(order.status)).length;
  const activeCount = filteredOrders.filter((order: any) => ['paid', 'active'].includes(order.status)).length;
  const completedCount = filteredOrders.filter((order: any) => order.status === 'completed').length;

  const body = `
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>订单管理</h2>
          <span class="section-note">查看和管理系统中的所有订单。</span>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <a href="/admin/orders/export${exportQuery ? `?${exportQuery}` : ''}" class="button button-secondary">导出 CSV</a>
        </div>
      </div>

      ${successMessage ? `<div class="page-notification page-notification--success">${successMessage}</div>` : ''}
      ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 20px 0;">
        <div class="panel" style="padding: 18px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe;">
          <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">总订单</div>
          <div style="font-size: 1.8rem; font-weight: 700;">${filteredOrders.length}</div>
        </div>
        <div class="panel" style="padding: 18px; background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1px solid #fed7aa;">
          <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">待处理</div>
          <div style="font-size: 1.8rem; font-weight: 700;">${pendingCount}</div>
        </div>
        <div class="panel" style="padding: 18px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0;">
          <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">已完成</div>
          <div style="font-size: 1.8rem; font-weight: 700;">${completedCount}</div>
        </div>
        <div class="panel" style="padding: 18px; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe;">
          <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">营收</div>
          <div style="font-size: 1.6rem; font-weight: 700;">${formatCurrency(totalRevenue)}</div>
        </div>
      </div>
      <div class="panel" style="margin: 20px 0; background: #f8fafc; border: 1px solid var(--border);">
        <form method="GET" action="/admin/orders" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: end;">
          <div style="flex: 1 1 180px; min-width: 180px;">
            <label for="status" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">状态筛选</label>
            <select id="status" name="status" class="form-control" style="width: 100%;">
              ${Object.entries(adminOrderStatusMap).map(([value, meta]) => `
                <option value="${value}" ${statusFilter === value ? 'selected' : ''}>${meta.text}</option>
              `).join('')}
            </select>
          </div>

          <div style="flex: 1 1 200px; min-width: 200px;">
            <label for="userId" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">客户筛选</label>
            <select id="userId" name="userId" class="form-control" style="width: 100%;">
              <option value="">全部客户</option>
              ${allUsers.filter((u: any) => u.role === 'CUSTOMER').map((u: any) => `
                <option value="${u.id}" ${userIdFilter === u.id ? 'selected' : ''}>${u.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="flex: 1 1 160px; min-width: 160px;">
            <label for="dateFrom" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">开始日期</label>
            <input id="dateFrom" type="date" name="dateFrom" class="form-control" value="${dateFrom}" style="width: 100%;" />
          </div>

          <div style="flex: 1 1 160px; min-width: 160px;">
            <label for="dateTo" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">结束日期</label>
            <input id="dateTo" type="date" name="dateTo" class="form-control" value="${dateTo}" style="width: 100%;" />
          </div>

          <div style="flex: 1 1 220px; min-width: 220px;">
            <label for="search" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">搜索</label>
            <input id="search" type="text" name="search" class="form-control" placeholder="订单号、客户、设备..." value="${searchTerm}" style="width: 100%;" />
          </div>

          <div style="display: flex; gap: 8px; align-items: center; margin-top: auto;">
            <button type="submit" class="button button-primary">筛选</button>
            <a href="/admin/orders" class="button button-secondary">重置</a>
          </div>
        </form>
      </div>

      ${filteredOrders.length === 0 ? `
        <div style="text-align: center; padding: 48px 24px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📋</div>
          <h3>暂无订单</h3>
          <p>${userIdFilter ? '当前用户暂无相关订单记录' : '没有符合筛选条件的订单记录'}</p>
        </div>
      ` : `
      <div style="margin-bottom: 12px; color: var(--text-secondary); font-size: 0.9rem;">
        共 ${filteredOrders.length} 条订单
        ${userIdFilter ? ' · 当前查看用户关联订单' : ''}
      </div>
      <form id="bulk-order-form" method="POST" action="/admin/orders/bulk-update">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
          <label style="display: inline-flex; align-items: center; gap: 8px; margin: 0;">
            <input type="checkbox" id="select-all-orders" />
            <span>全选</span>
          </label>
          <select name="status" class="form-control" style="min-width: 150px; padding: 8px 12px;">
            <option value="">批量更新状态</option>
            <option value="pending_payment">待支付</option>
            <option value="paid">已支付</option>
            <option value="active">租赁中</option>
            <option value="cancelled">已取消</option>
          </select>
          <button type="submit" class="button button-primary" style="padding: 8px 16px;">批量更新</button>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: -8px; margin-bottom: 12px;">已完成状态必须逐笔执行归还验机，批量操作暂不支持。</div>
      </form>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;"></th>
              <th>订单号</th>
              <th>客户</th>
              <th>设备</th>
              <th>总金额</th>
              <th>状态</th>
              <th>租期</th>
              <th>下单日期</th>
              <th>管理</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map((order: any) => {
    const status = adminOrderStatusMap[order.status] || { text: order.status, class: 'badge-info' };
    const totalAmount = order.total_amount || order.totalAmount || 0;
    const startDate = order.start_date || order.startDate || '-';
    const endDate = order.end_date || order.endDate || '-';
    const createdAt = order.created_at || order.createdAt;
    return `
                <tr>
                  <td><input type="checkbox" name="orderIds" value="${order.id}" class="order-checkbox" form="bulk-order-form" /></td>
                  <td style="font-family: monospace;">${order.id}</td>
                  <td>
                    <div><strong>${order.customer?.name || '未知用户'}</strong>${order.customer?.accountType === 'guest' ? ' <span class="badge badge-warning">访客/临时账户</span>' : ''}</div>
                    <small style="color: var(--text-secondary);">${order.customer?.email || ''}</small>
                  </td>
                  <td>${order.device?.name || '未知设备'}</td>
                  <td><strong>${formatCurrency(totalAmount)}</strong></td>
                  <td><span class="badge ${status.class}">${status.text}</span></td>
                  <td>${startDate} ~ ${endDate}</td>
                  <td>${createdAt ? new Date(createdAt).toLocaleDateString('zh-CN') : '-'}</td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 8px; min-width: 160px;">
                      <form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form" style="display: flex; gap: 8px; align-items: center;">
                        <select name="status" class="form-control" style="min-width: 110px; padding: 6px 10px; font-size: 0.85rem;">
                          <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>待支付</option>
                          <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>已支付</option>
                          <option value="active" ${order.status === 'active' ? 'selected' : ''}>租赁中</option>
                          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>已完成</option>
                          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                        </select>
                        <button type="submit" class="button button-secondary" style="padding: 6px 10px; font-size: 0.8rem;">更新</button>
                      </form>
                      <a class="link-button" href="/admin/orders/${order.id}">查看详情</a>
                    </div>
                  </td>
                </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  const selectAllScript = `
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        const selectAll = document.getElementById('select-all-orders');
        const checkboxes = Array.from(document.querySelectorAll('.order-checkbox'));
        if (selectAll) {
          selectAll.addEventListener('change', function () {
            checkboxes.forEach((checkbox) => {
              checkbox.checked = selectAll.checked;
            });
          });
        }
      });
    </script>
  `;

  return buildLayout('订单管理 - 电脑租赁管理系统', body + renderOrderStatusFeedback() + selectAllScript, user);
}
