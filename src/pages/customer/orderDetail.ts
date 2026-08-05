/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getDeviceById, formatCurrency, getContractByOrderId, systemSettings } from '../../site';
import { Context } from 'hono';

export async function renderCustomerOrderDetail(c: Context, user: any, orderId: string, message?: string, type: 'success' | 'error' = 'error') {
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在或无权访问。</p></div>', user)
  }
  const device = await getDeviceById(c, order.deviceId)
  const contract = await getContractByOrderId(c, order.id)
  const transferProof = order.paymentMethod === 'bank_transfer' ? await c.env.RENT.prepare("SELECT pp.status, pp.reference_number, pp.rejection_reason FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() as any : null
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''
  const stripeFee = Math.round(Number(order.totalAmount) * 100 * 0.025) / 100
  const stripeTotal = Number(order.totalAmount) + stripeFee

  const body = `
    <div class="panel">
      <div class="section-title"><h2>${order.orderNo ? `订单详情 #${order.orderNo}` : '合同付款资料'}</h2><span class="section-note">${order.orderNo ? '查看订单状态、设备信息、租金明细及合同。' : '订单编号将在付款确认后生成。'}</span></div>
      ${alertMessage}
      <div class="grid grid-2">
        <div>
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${order.status}</p>
          <p><strong>下单时间:</strong> ${order.orderDate}</p>
          <p><strong>租期:</strong> ${order.startDate} 至 ${order.endDate}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
        </div>
        <div>
          <h3>设备信息</h3>
          <p><strong>设备名称:</strong> ${device?.name ?? '未知设备'}</p>
          <p><strong>设备型号:</strong> ${device?.model ?? 'N/A'}</p>
          <p><strong>序列号:</strong> ${device?.serialNumber ?? 'N/A'}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device?.pricePerDay ?? device?.dailyRate ?? 0)}</p>
        </div>
      </div>

      ${['paid','active','completed'].includes(order.status) ? `<p><a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票</a></p>` : ''}
      ${contract ? `
        <div class="section-title" style="margin-top: 24px;"><h3>租赁合同</h3></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          ${contract.status === 'signed' ? `<a class="button" href="/contract/view/${contract.id}" target="_blank">查看/下载合同</a>` : `<span class="section-note">正式合同将在签署完成后开放下载。</span>`}
          ${contract.status === 'pending_sign' ? `<a class="button button-primary" href="/contract/sign?token=${encodeURIComponent(contract.signToken || '')}&step=1">签署租赁协议</a>` : ''}
        </div>
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        ${transferProof ? `<div class="alert">转账审核状态：${transferProof.status === 'submitted' ? '待审核' : transferProof.status === 'rejected' ? `已驳回（${String(transferProof.rejection_reason || '').replace(/[&<>"']/g, '')}）` : transferProof.status}</div>` : ''}
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          <div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.accountName}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>请转账 ${formatCurrency(order.totalAmount)} 到以上账户，并在备注中填写合同编号 ${contract?.contractNumber || order.contractId}。</p>
            ${transferProof?.status === 'submitted' ? '<p>转账信息已提交，请等待管理员审核。</p>' : `<form method="post" action="/customer/orders/${order.id}/bank-transfer-proof">
              <label class="form-label" for="referenceNumber">银行 Reference</label>
              <input class="form-control" id="referenceNumber" name="referenceNumber" maxlength="100" required>
              <label class="form-label" for="proofImageUrl">转账凭证图片链接</label>
              <input class="form-control" type="url" id="proofImageUrl" name="imageUrl" placeholder="https://图床域名/凭证图片.jpg" required>
              <small class="form-text">请先上传到图床，再粘贴公开 HTTPS 图片链接。</small>
              <label class="form-label" for="transferNote">备注（选填）</label>
              <textarea class="form-control" id="transferNote" name="note" maxlength="500"></textarea>
              <button class="button" type="submit" style="margin-top:12px">提交转账信息</button>
            </form>`}
          </div>
          ${systemSettings.paymentMethods.stripe ? `<div class="payment-card">
            <h4>信用卡支付（Stripe）</h4>
            <p>前往 Stripe 安全结账页面完成支付，本站不会接触您的卡号。</p>
            <p>订单本金 ${formatCurrency(order.totalAmount)} ＋ 2.5% 支付手续费 ${formatCurrency(stripeFee)}。手续费不予退款。</p>
            <form method="POST" action="/customer/orders/${order.id}/stripe/checkout">
              <button class="button button-primary" type="submit">支付 ${formatCurrency(stripeTotal)}</button>
            </form>
          </div>` : ''}
        </div>
      ` : ''}
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}
