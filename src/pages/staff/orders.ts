/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, staffOrderPath } from '../../site';
import { renderOrderStatusBadge } from '../partials/orderStatusBadge';
import { Context } from 'hono';
import { queryStaffOrders } from '../../services/paginatedLists';
import { renderPager } from '../../lib/pagination';

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// 兼容旧签名 renderStaffOrders(c, user, searchTerm)。
// 订单不再整表读入：按「归属员工 + 关键字」下推成 SQL，只取当前页（默认 50 条）。
export async function renderStaffOrders(c: Context, user: any, searchTerm: string = '') {
  const { rows: pageOrders, meta, usersById, devicesById } = await queryStaffOrders(c, {
    user,
    searchTerm,
    page: c.req.query('page'),
  });

  // 返回链接携带当前搜索条件与页码，从详情页回来时列表位置不丢失。
  const backQuery = new URLSearchParams()
  if (searchTerm) backQuery.set('searchTerm', searchTerm)
  if (meta.page > 1) backQuery.set('page', String(meta.page))
  const backQueryString = backQuery.toString()
  const backSuffix = backQueryString ? `?${esc(new URLSearchParams({ back: backQueryString }).toString())}` : ''
  const clearSearchLink = searchTerm ? `<a class="button button-secondary" href="/staff/orders">清除搜索</a>` : ''

  const rows = pageOrders.map((order) => {
    const customer = usersById.get(String(order.userId ?? order.user_id ?? ''));
    const device = devicesById.get(String(order.deviceId ?? order.device_id ?? ''));
    return `<tr><td class="mono">${order.orderNo ? esc(order.orderNo) : '<span class="text-muted">付款后生成</span>'}</td><td>${esc(customer?.name ?? 'N/A')}${customer?.accountType === 'guest' ? ' <span class="badge badge-warning">访客/临时账户</span>' : ''}</td><td>${esc(device?.name ?? 'N/A')}</td><td>${esc(order.startDate)} ~ ${esc(order.endDate)}</td><td>${formatCurrency(order.totalAmount)}</td><td>${renderOrderStatusBadge(order.status)}</td><td><a class="link-button" href="${staffOrderPath(order)}${backSuffix}">查看</a></td></tr>`;
  }).join('')

  const table = pageOrders.length
    ? `<div class="table-wrapper"><table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : meta.total > 0
      // 页码越界：给出回到第一页的出口，而不是把用户丢在空表里。
      ? `<div class="empty-state"><h3>这一页没有订单</h3><p>当前列表共 ${meta.total} 条订单，请返回第一页查看。</p><a class="button button-primary" href="/staff/orders">回到第一页</a></div>`
      : `<div class="empty-state"><h3>${searchTerm ? '没有匹配的订单' : '暂无订单'}</h3><p>${searchTerm ? `没有找到与“${esc(searchTerm)}”匹配的订单，请调整关键词。` : '客户下单后会显示在这里。'}</p>${searchTerm ? clearSearchLink : '<a class="button button-primary" href="/staff/customers/new">创建客户账户</a>'}</div>`

  const body = `
    <div class="panel">
      <div class="section-title"><p class="section-code">RENTAL OPERATIONS</p><h2>租赁管理</h2><span class="section-note">管理租赁订单、交付状态、租期和归还流程；合同内容请前往合同管理。</span></div>
      <div class="search-bar" style="margin-bottom: 20px;">
        <form action="/staff/orders" method="GET" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <input type="search" name="searchTerm" class="form-control" placeholder="搜索订单号、客户或设备..." value="${esc(searchTerm)}" style="flex-grow: 1;" />
          <button type="submit" class="button button-primary">搜索</button>
          ${clearSearchLink}
        </form>
      </div>
      ${table}
      ${renderPager(meta, { basePath: '/staff/orders', search: new URLSearchParams({ ...(searchTerm ? { searchTerm } : {}) }).toString(), label: '条订单' })}
    </div>
  `;
  return buildLayout('租赁管理 - 电脑租赁管理系统', body, user);
}
