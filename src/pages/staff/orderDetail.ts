/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency, getContractByOrderId, systemSettings, isContractExpired } from '../../site'
import type { Context } from 'hono'

export async function renderStaffOrderDetail(c: Context, user: any, orderId: string, message?: string, type: 'success' | 'error' = 'error') {
  const order = await getOrderById(c, orderId)
  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user)
  }
  const customer = await getUserById(c, order.userId)
  if (user.role !== 'ADMIN' && customer?.staffId !== user.id) {
    return buildLayout('无权查看订单', '<div class="panel"><h2>无权查看订单</h2><p>员工只能查看自己名下客户的订单。</p></div>', user)
  }
  const [device, contract, timeChanges] = await Promise.all([getDeviceById(c, order.deviceId), getContractByOrderId(c, order.id), c.env.RENT.prepare('SELECT * FROM order_time_change_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 10').bind(order.id).all()])
  const contractExpired = contract ? isContractExpired(contract) : false
  const alertMessage = message ? `<div class="page-notification page-notification--${type}">${message}</div>` : ''

  const body = `
    <div class="panel order-detail-shell staff-order-detail">
      <div class="section-title"><h2>${order.orderNo ? `订单详情 #${order.orderNo}` : '订单详情'}</h2><span class="section-note">${order.orderNo ? '查看订单、设备、合同签署及支付信息。订单状态由管理员管理。' : '订单编号将在付款确认后生成。'}</span></div>
      ${alertMessage}
      <div class="order-detail-grid">
        <div class="order-info-card">
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${order.status}</p>
          <p><strong>下单时间:</strong> ${order.orderDate}</p>
          <p><strong>租期:</strong> ${order.startDate} 至 ${order.endDate}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
          <p><strong>客户:</strong> ${customer?.name ?? '未知'} (${customer?.email ?? ''})</p>
          <p><strong>设备:</strong> ${device?.name ?? '未知'} (${device?.serialNumber ?? ''})</p>
        </div>
        <div class="order-info-card order-actions-card">
          <h3>操作</h3>
          ${['STAFF', 'ADMIN'].includes(user.role) && order.status === 'pending_approval' ? `
            <form method="POST" action="/staff/orders/${order.id}/approve" style="margin-bottom: 10px;">
              <button class="button button-primary" type="submit">批准订单</button>
            </form>
            <form method="POST" action="/staff/orders/${order.id}/reject">
              <button class="button button-danger" type="submit">拒绝订单</button>
            </form>
          ` : ''}
          ${order.status === 'approved' && !contract ? `<a class="button button-primary" href="/staff/contracts/new">前往新建合同</a>` : ''}
          ${order.status === 'pending_payment' ? `
            <p class="alert">银行转账需由管理员审核客户提交的 Reference 后确认付款。</p>
          ` : ''}
          ${order.status === 'paid' ? `
            <form method="POST" action="/staff/orders/${order.id}/pickup" data-site-confirm="确认客户已完成取货吗？确认后订单将变为租赁中。">
              <button class="button button-primary" type="submit">已拿取</button>
            </form>
          ` : ''}
          ${['active', 'pending_return'].includes(String(order.status)) ? `
            <a class="button button-success" href="/staff/orders/${order.id}/inspection">设备归还 / 归还验机</a>
          ` : ''}
          ${['paid', 'active', 'completed', 'pending_return'].includes(String(order.status)) ? `<a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / 收据</a>` : ''}
          ${user.role === 'ADMIN' && (order.status === 'active' || order.status === 'paid') ? `
            <form method="POST" action="/staff/orders/${order.id}/cancel">
              <button class="button button-danger" type="submit">取消订单</button>
            </form>
          ` : ''}
        </div>
      </div>

      ${timeChanges?.results?.length ? `<div class="panel" style="margin-top:20px;"><h3>预约时间变更记录</h3>${timeChanges.results.map((change: any) => `<p>${change.created_at}：${change.previous_pickup_slot || '未设置'} / ${change.previous_return_slot || '未设置'} → ${change.pickup_slot} / ${change.return_slot}${Number(change.additional_service_fee) > 0 ? `，新增服务费 ${formatCurrency(change.additional_service_fee)}` : ''}</p>`).join('')}</div>` : ''}

      ${contract ? `
        <div class="section-title order-section-heading" style="margin-top: 24px;"><h3>合同详情 #${contract.contractNumber || '待生成'}</h3><span class="section-note">查看合同状态、签署记录和正式合同文件。</span></div>
        <div class="contract-detail-meta"><span><small>合同状态</small><strong>${contract.status === 'signed' || contract.status === 'completed' ? '已签署' : contract.status === 'pending_sign' ? '待签署' : contract.status}</strong></span><span><small>签署时间</small><strong>${contract.signedAt || '尚未签署'}</strong></span><span><small>有效期</small><strong>${contract.validFrom || order.startDate} 至 ${contract.validUntil || order.endDate}</strong></span></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          ${contract.status === 'signed' ? `<a class="button" href="/contract/view/${contract.id}?from=order" target="_blank">查看/下载合同</a>` : '<span class="section-note">正式合同将在客户完成签署后开放。</span>'}
          ${contractExpired ? '<span class="badge danger">已过期</span>' : contract.status === 'signed' ? `<span class="badge success">已签署</span>` : `<span class="badge warning-badge">${contract.status === 'pending_sign' ? '待签署' : '草稿'}</span>`}
        </div>
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          <div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.accountName}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>客户需转账 ${formatCurrency(order.totalAmount)} 到以上账户。</p>
          </div>
          ${systemSettings.paymentMethods.stripe ? `<div class="payment-card"><h4>信用卡支付（Stripe）</h4><p>客户将通过 Stripe 托管结账页付款。</p></div>` : ''}
        </div>
      ` : ''}
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}
