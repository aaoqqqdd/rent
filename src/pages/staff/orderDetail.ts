/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency, formatMelbourneDateTime, getContractByOrderId, systemSettings, isContractExpired } from '../../site'
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
  const statusLabels: Record<string, string> = { pending: '待处理', pending_approval: '待处理', pending_payment: '待处理', awaiting_signature: '待签合同', approved: '租赁已确认，等待开始', paid: '租赁已确认，等待开始', pending_pickup: '待取货', active: '租赁中', extended: '已延期 / 租赁中', overdue: '已逾期', suspended: '已暂停', pending_return: '待归还', returned: '已归还', completed: '已完成', cancelled: '已取消' }

  const body = `
    <div class="panel order-detail-shell staff-order-detail">
      <div class="section-title"><h2>${order.orderNo ? `订单详情 #${order.orderNo}` : '订单详情'}</h2><span class="section-note">${order.orderNo ? '查看订单、设备、合同签署及支付信息。订单状态由管理员管理。' : '订单编号将在付款确认后生成。'}</span></div>
      ${alertMessage}
      <div class="order-detail-grid">
        <div class="order-info-card">
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${statusLabels[String(order.status)] || '待处理'}</p>
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
          ${order.status === 'paid' ? `<button class="button button-primary" type="button" id="open-handover-dialog">记录交付并开始租赁</button>` : ''}
          ${order.status === 'active' && order.early_return_requested_at ? `<div class="alert">客户已申请提前归还，等待审批。<form method="post" action="/staff/orders/${order.id}/early-return/approve" style="display:inline;margin-left:12px" data-site-confirm="确认批准客户提前归还吗？"><button class="button button-sm button-warning" type="submit">批准提前归还</button></form></div>` : ''}
          ${['active', 'extended', 'overdue'].includes(String(order.status)) ? `<form method="POST" action="/staff/orders/${order.id}/suspend" data-site-confirm="确认暂停这笔租赁吗？"><button class="button button-warning" type="submit">暂停租赁</button><small class="form-text">仅绑定该客户的员工或管理员可以操作。</small></form>` : ''}
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
        <div class="contract-detail-meta"><span><small>合同状态</small><strong>${contract.status === 'signed' || contract.status === 'completed' ? '已签署' : contract.status === 'pending_sign' ? '待签署' : contract.status}</strong></span><span><small>签署时间（墨尔本）</small><strong>${formatMelbourneDateTime(contract.signedAt) || '尚未签署'}</strong></span><span><small>有效期</small><strong>${contract.validFrom || order.startDate} 至 ${contract.validUntil || order.endDate}</strong></span></div>
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
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.bankName || '—'}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>客户需转账 ${formatCurrency(order.totalAmount)} 到以上账户。</p>
          </div>
          ${systemSettings.paymentMethods.stripe ? `<div class="payment-card"><h4>信用卡支付（Stripe）</h4><p>客户将通过 Stripe 托管结账页付款。</p></div>` : ''}
        </div>
      ` : ''}
    </div>
    ${order.status === 'paid' ? `<dialog id="handover-dialog" class="panel" style="max-width:680px;width:calc(100% - 32px)"><form id="handover-form"><div class="section-title"><h2>交付设备</h2><button class="button button-secondary" type="button" id="close-handover-dialog">关闭</button></div><p class="section-note">确认设备、配件和客户核对后，订单将进入租赁中。</p><div id="handover-error" class="page-notification page-notification--error" hidden></div><div class="grid grid-2"><div><label class="form-label">设备</label><input class="form-control" value="${device?.name || order.deviceId}" readonly></div><div><label class="form-label">设备序列号</label><input class="form-control" name="deviceSerialNumber" value="${device?.serialNumber || ''}" required></div></div><label class="form-label">交付配件</label><textarea class="form-control" name="accessories" required maxlength="1000" placeholder="例如：电源适配器、充电线、电脑包"></textarea><label class="form-label">设备状态与备注</label><textarea class="form-control" name="conditionNotes" required maxlength="2000" placeholder="例如：外观正常，屏幕无划痕"></textarea><label class="form-check"><input type="checkbox" name="customerConfirmed" value="1" required> 客户已当场核对设备序列号、配件及状态</label><label class="form-label">客户确认姓名</label><input class="form-control" name="customerConfirmationName" value="${customer?.name || ''}" required maxlength="120"><div class="record-actions"><button class="button button-primary" type="submit">确认交付并开始租赁</button></div></form></dialog><script>(()=>{const dialog=document.getElementById('handover-dialog'),open=document.getElementById('open-handover-dialog'),close=document.getElementById('close-handover-dialog'),form=document.getElementById('handover-form'),error=document.getElementById('handover-error');open?.addEventListener('click',()=>dialog.showModal());close?.addEventListener('click',()=>dialog.close());form?.addEventListener('submit',async event=>{event.preventDefault();error.hidden=true;const response=await fetch('/staff/orders/${order.id}/pickup',{method:'POST',headers:{Accept:'application/json'},body:new FormData(form)});const data=await response.json().catch(()=>({message:'交付保存失败'}));if(!response.ok||!data.success){error.textContent=data.message||'交付保存失败';error.hidden=false;return;}location.href=data.redirect||location.href;});})();</script>` : ''}
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}
