/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, getUserById, getOrdersForUser, getDevicesByIds, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderStaffCustomerDetail(c: Context, user: any, customerId: string) {
  const customer = await getUserById(c, customerId)
  if (!customer || customer.role !== 'CUSTOMER') {
    return buildLayout('客户详情 - 电脑租赁管理系统', '<div class="panel"><h2>客户未找到</h2><p>您请求的客户不存在。</p></div>', user)
  }

  const orders = await getOrdersForUser(c, customerId)
  const deviceIds = Array.from(new Set(orders.map((order) => order.deviceId).filter(Boolean)))
  const devices = await getDevicesByIds(c, deviceIds)
  const deviceMap = new Map(devices.map((device) => [device.id, device]))

  const body = `
    <div class="panel">
      <div class="section-title"><h2>客户详情 - ${customer.name}</h2><span class="section-note">查看客户资料、订单历史及管理。</span></div>
      <div class="grid grid-2">
        <div>
          <h3>基本信息</h3>
          <p><strong>姓名:</strong> ${customer.name}</p>
          <p><strong>邮箱:</strong> ${customer.email}</p>
          <p><strong>手机:</strong> ${customer.phone ?? 'N/A'}</p>
          <p><strong>注册日期:</strong> ${customer.registrationDate}</p>
          <p><strong>余额:</strong> ${formatCurrency(customer.balance)}</p>
        </div>
        <div>
          <h3>操作</h3>
          <a class="button" href="/staff/customers/${customer.id}/edit">编辑客户信息</a>
          <form method="POST" action="/staff/customers/${customer.id}/delete" onsubmit="return confirm('确定要删除此客户吗？');" style="margin-top: 10px;">
            <button class="button button-danger" type="submit">删除客户</button>
          </form>
        </div>
      </div>

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
