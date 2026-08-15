/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDeviceById, formatCurrency, getOrders, getUsers } from '../../site';
import { Context } from 'hono';

export async function renderStaffDeviceDetail(c: Context, user: any, deviceId: string) {
  const device = await getDeviceById(c, deviceId)
  if (!device) {
    return buildLayout('设备详情 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user)
  }

  const usersData = await getUsers(c)
  const usersById = new Map(usersData.map(account => [account.id, account]))
  const orders = (await getOrders(c)).filter(order => order.deviceId === device.id && (user.role === 'ADMIN' || usersById.get(order.userId)?.staffId === user.id))
  const setupCode = new URL(c.req.url).searchParams.get('agentSetupCode')

  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备详情 - ${device.name}</h2><span class="section-note">查看设备详细信息和自己负责的租赁记录。</span></div>
      <div class="grid grid-2">
        <div>
          <h3>基本信息</h3>
          <p><strong>设备名称:</strong> ${device.name}</p>
          <p><strong>型号:</strong> ${device.model}</p>
          <p><strong>备注:</strong> ${device.description || '未填写'}</p>
          <p><strong>序列号:</strong> ${device.serialNumber}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}</p>
          <p><strong>状态:</strong> ${device.status}</p>
        </div>
        <div><h3>维护权限</h3><p class="section-note">设备身份、配置、价格和状态由管理员维护。</p></div>
      </div>

      ${user.role === 'ADMIN' ? `<div class="panel" style="margin-top:20px;"><h3>Windows 客户端</h3>
        <p class="section-note">客户端会优先按序列号自动绑定；没有匹配序列号时使用一次性注册码。注册码有效 15 分钟，使用一次后失效。</p>
        ${setupCode ? `<p><strong>本次注册码：</strong><code>${setupCode}</code></p>` : ''}
        <form method="post" action="/staff/devices/${device.id}/agent-setup"><button class="button" type="submit">生成 Windows 客户端注册码</button></form>
      </div>` : ''}

      <div class="section-title" style="margin-top: 24px;"><h3>租赁历史</h3></div>
      ${orders.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>租期</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${orders.map((order) => {
              const customer = usersData.find(u => u.id === order.userId)
              return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看订单</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>此设备暂无租赁历史。</p>'}
    </div>
  `
  return buildLayout('设备详情 - 电脑租赁管理系统', body, user)
}
