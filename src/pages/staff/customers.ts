/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getAccountTypeDisplay, splitPersonName } from '../../site';
import { Context } from 'hono';
import { queryStaffCustomers } from '../../services/paginatedLists';
import { renderPager } from '../../lib/pagination';

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// 兼容旧签名 renderStaffCustomers(c, user, searchTerm)。
// 客户不再整表读入：role/staff_id/关键字都下推成 SQL，只取当前页（默认 50 条）。
export async function renderStaffCustomers(c: Context, user: any, searchTerm: string = '') {
  const { rows: pageCustomers, meta } = await queryStaffCustomers(c, {
    user,
    searchTerm,
    page: c.req.query('page'),
  });

  // 返回链接携带当前搜索条件与页码，从详情/编辑页回到列表时筛选与位置不丢失。
  const backQuery = new URLSearchParams()
  if (searchTerm) backQuery.set('searchTerm', searchTerm)
  if (meta.page > 1) backQuery.set('page', String(meta.page))
  const backQueryString = backQuery.toString()
  const backSuffix = backQueryString ? `?${esc(new URLSearchParams({ back: backQueryString }).toString())}` : ''
  const clearSearchLink = searchTerm ? `<a class="button button-secondary" href="/staff/customers">清除搜索</a>` : ''

  const tableRows = pageCustomers.map((customer) => {
    const personName = splitPersonName(customer.name); const accountType = getAccountTypeDisplay(customer);
    return `<tr>
              <td>${esc(personName.firstName || '-')}</td>
              <td>${esc(personName.lastName || '-')}</td>
              <td>${esc(customer.email)}</td>
              <td><span class="badge ${esc(accountType.class)}">${esc(accountType.text)}</span></td>
              <td>${esc(customer.phone ?? 'N/A')}</td>
              <td>${esc(customer.registrationDate)}</td>
              <td>
                <a class="link-button" href="/staff/customers/${encodeURIComponent(customer.id)}${backSuffix}">查看</a>
                <a class="link-button" href="/staff/customers/${encodeURIComponent(customer.id)}/edit${backSuffix}">编辑</a>
              </td>
            </tr>`
  }).join('')

  const table = pageCustomers.length
    ? `<div class="table-wrapper"><table class="table"><thead><tr><th>名</th><th>姓</th><th>邮箱</th><th>账户类型</th><th>手机</th><th>注册日期</th><th>操作</th></tr></thead><tbody>${tableRows}</tbody></table></div>`
    : meta.total > 0
      ? `<div class="empty-state"><h3>这一页没有客户</h3><p>当前列表共 ${meta.total} 位客户，请返回第一页查看。</p><a class="button button-primary" href="/staff/customers">回到第一页</a></div>`
      : `<div class="empty-state"><h3>${searchTerm ? '没有匹配的客户' : '暂无客户'}</h3><p>${searchTerm ? `没有找到与“${esc(searchTerm)}”匹配的客户，请调整关键词。` : '创建客户账户后即可为客户下单。'}</p>${searchTerm ? clearSearchLink : '<a class="button button-primary" href="/staff/customers/new">创建客户账户</a>'}</div>`

  const body = `
    <div class="panel">
      <div class="section-title"><div><h2>客户管理</h2><span class="section-note">管理所有注册客户。</span></div><a class="button" href="/staff/customers/new">创建客户账户</a></div>
      <div class="search-bar" style="margin-bottom: 20px;">
        <form action="/staff/customers" method="GET" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <input type="search" name="searchTerm" class="form-control" placeholder="搜索客户姓名、邮箱或手机..." value="${esc(searchTerm)}" style="flex-grow: 1;" />
          <button type="submit" class="button button-primary">搜索</button>
          ${clearSearchLink}
        </form>
      </div>
      ${table}
      ${renderPager(meta, { basePath: '/staff/customers', search: new URLSearchParams({ ...(searchTerm ? { searchTerm } : {}) }).toString(), label: '位客户' })}
    </div>
  `;
  return buildLayout('客户管理 - 电脑租赁管理系统', body, user);
}
