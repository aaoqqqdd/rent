/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById, getOrdersForUser, getDevicesByIds, formatCurrency, splitPersonName } from '../../site';
import { Context } from 'hono';

export async function renderStaffCustomerDetail(c: Context, user: any, customerId: string) {
  const customer = await getUserById(c, customerId)
  if (!customer || customer.role !== 'CUSTOMER' || (user.role !== 'ADMIN' && customer.staffId !== user.id)) {
    return buildLayout('客户详情 - 电脑租赁管理系统', '<div class="panel"><h2>客户未找到</h2><p>您请求的客户不存在。</p></div>', user)
  }

  const orders = await getOrdersForUser(c, customerId)
  const deviceIds = Array.from(new Set(orders.map((order) => order.deviceId).filter(Boolean)))
  const devices = await getDevicesByIds(c, deviceIds)
  const deviceMap = new Map(devices.map((device) => [device.id, device]))
  const personName = splitPersonName(customer.name)

  const accountNotice = customer.accountType === 'guest' ? `<div class="page-notification page-notification--info"><strong>访客/临时账户</strong> · 仅限订单 ${customer.guestOrderId || '-'} · 计划删除日期 ${customer.guestExpiresAt || '租期结束'}</div>` : customer.accountType === 'deleted_guest' ? '<div class="page-notification page-notification--error"><strong>已删除访客账户</strong> · 登录权限和个人联系方式已清除。</div>' : ''
  const body = `
    ${accountNotice}
    <div class="entity-header"><div class="identity-strip mono"><span>CUSTOMER / ${customer.id}</span><span>ACTIVE RECORD</span></div><div class="entity-heading"><div><p class="section-code">CUSTOMER RECORD</p><h2>${customer.name}</h2><p>${customer.email}</p></div><div class="entity-heading-actions"><a class="button button-secondary" href="/staff/customers">返回客户列表</a><a class="button" href="/staff/customers/${customer.id}/edit">编辑客户</a></div></div></div>
    <div class="panel record-panel single-column"><div class="record-grid">
        <section class="record-section"><p class="section-code">PROFILE</p><h3>基本信息</h3><dl class="data-list"><div><dt>客户 ID</dt><dd class="mono">${customer.id}</dd></div><div><dt>名 / Given name</dt><dd>${personName.firstName || '未填写'}</dd></div><div><dt>姓 / Family name</dt><dd>${personName.lastName || '未填写'}</dd></div><div><dt>邮箱</dt><dd>${customer.email}</dd></div><div><dt>手机</dt><dd>${customer.phone ?? '未填写'}</dd></div><div><dt>注册日期</dt><dd>${customer.registrationDate || customer.createdAt || '-'}</dd></div></dl></section>
        <section class="record-section"><p class="section-code">ACCOUNT</p><h3>账户信息</h3><dl class="data-list"><div><dt>余额</dt><dd class="mono">${formatCurrency(customer.balance)}</dd></div><div><dt>BSB</dt><dd class="mono">${customer.bsb || '未填写'}</dd></div><div><dt>银行账号</dt><dd class="mono">${customer.accountNumber || customer.account || '未填写'}</dd></div></dl>
        </section></div>

      <div class="section-title" style="margin-top: 24px;"><h3>订单历史</h3></div>
      ${orders.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${orders.map((order) => {
              const device = deviceMap.get(order.deviceId)
              return `<tr><td>${order.orderNo}</td><td>${device?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看订单</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>此客户暂无订单历史。</p>'}
    </div>
  `
  return buildLayout('客户详情 - 电脑租赁管理系统', body, user)
}
