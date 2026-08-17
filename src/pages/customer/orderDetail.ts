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
  const [device, contract, transferProof, timeChanges, preInspection, depositRefund, refundStatus] = await Promise.all([getDeviceById(c, order.deviceId), getContractByOrderId(c, order.id), ['bank_transfer', 'alipay', 'wechat'].includes(String(order.paymentMethod)) ? c.env.RENT.prepare("SELECT pp.status, pp.reference_number, pp.rejection_reason FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() : Promise.resolve(null), c.env.RENT.prepare('SELECT * FROM order_time_change_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 10').bind(order.id).all(), c.env.RENT.prepare('SELECT snapshot_json, created_at FROM device_inspections WHERE rental_id = ? ORDER BY created_at DESC LIMIT 1').bind(order.id).first(), c.env.RENT.prepare("SELECT deduction_amount, deduction_reason FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(), c.env.RENT.prepare("SELECT status, refundable_amount, refund_amount FROM payment_refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1").bind(order.id).first()]) as any[]
  const alertMessage = message ? `<div class="page-notification page-notification--${type}">${message}</div>` : ''
  const stripeFee = Math.round(Number(order.totalAmount) * 100 * 0.025) / 100
  const stripeTotal = Number(order.totalAmount) + stripeFee
  let preSnapshot: any = {}; let returnData: any = {}
  try { preSnapshot = JSON.parse(preInspection?.snapshot_json || '{}') } catch (_) {}
  try { returnData = typeof contract?.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : (contract?.contract_data || {}) } catch (_) {}
  const esc = (value: unknown) => String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const melbourneTime = (value: unknown) => {
    const raw = String(value || '')
    if (!raw) return '—'
    const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`)
    return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date)
  }
  const report = (data: any, keys: string[]) => `<dl class="data-list">${keys.map(key => `<div><dt>${esc(key)}</dt><dd>${esc(data[key])}</dd></div>`).join('')}</dl>`
  const deducted = Number(depositRefund?.deduction_amount || 0) > 0
  const refundLabel = refundStatus?.status === 'pending' ? 'REFUND_PENDING: 退款处理中' : refundStatus?.status === 'succeeded' ? (Number(refundStatus.refund_amount || 0) < Number(refundStatus.refundable_amount || refundStatus.refund_amount || 0) ? 'PARTIALLY_REFUNDED: 部分退款' : 'REFUNDED: 已退款') : ''
  const windowsData = typeof contract?.contract_data === 'string' ? (() => { try { return JSON.parse(contract.contract_data || '{}') } catch (_) { return {} } })() : (contract?.contract_data || {})
  const windowsPassword = String(windowsData.windows_password || '')
  const rentalStatusLabels: Record<string, string> = { pending: 'PENDING: 待处理', pending_payment: 'PENDING: 待处理', awaiting_signature: 'AWAITING_SIGNATURE: 待签合同', paid: 'CONFIRMED: 租赁已确认，等待开始', approved: 'CONFIRMED: 租赁已确认，等待开始', pending_pickup: 'READY_FOR_PICKUP: 待取货', active: 'ACTIVE: 租赁中', extended: 'EXTENDED: 已延期 / 租赁中', overdue: 'OVERDUE: 已逾期', suspended: 'SUSPENDED: 已暂停', pending_return: 'RETURN_PENDING: 待归还', returned: 'RETURNED: 已归还', completed: 'COMPLETED: 已完成', cancelled: 'CANCELLED: 已取消' }

  const body = `
    <div class="panel order-detail-shell customer-order-detail">
      <div class="section-title"><h2>${order.orderNo ? `订单详情 #${order.orderNo}` : '订单详情'}</h2><span class="section-note">${order.orderNo ? '查看订单状态、设备信息、租金明细及合同。' : '订单编号将在付款确认后生成。'}</span></div>
      ${alertMessage}
      <div class="order-detail-grid">
        <div class="order-info-card">
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${esc(rentalStatusLabels[String(order.status)] || String(order.status))}</p>
          <p><strong>下单时间:</strong> ${order.orderDate}</p>
          <p><strong>租期:</strong> ${order.startDate} ${order.startPeriod === 'PM' ? '下午' : '上午'} 至 ${order.endDate} ${order.endPeriod === 'PM' ? '下午' : '上午'}（${order.rentalPeriod || 0} 天）</p>
          <p><strong>领取/归还地点:</strong> ${order.pickupLocation || '待确认'} / ${order.returnLocation || '待确认'}</p>
          <p><strong>预约时间:</strong> ${order.pickupTimeSlot || '待确认'} / ${order.returnTimeSlot || '待确认'}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
          ${refundLabel ? `<p><strong>退款状态:</strong> ${esc(refundLabel)}</p>` : ''}
        </div>
        <div class="order-info-card">
          <h3>设备信息</h3>
          <p><strong>设备名称:</strong> ${device?.name ?? '未知设备'}</p>
          <p><strong>设备型号:</strong> ${device?.model ?? 'N/A'}</p>
          <p><strong>序列号:</strong> ${device?.serialNumber ?? 'N/A'}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device?.pricePerDay ?? device?.dailyRate ?? 0)}</p>
        </div>
      </div>

      <section class="panel" style="margin-top:20px"><h3>出租前验机报告</h3><p class="form-text">该报告为设备交付前的验机记录。</p>${preInspection ? `${report(preSnapshot, ['screen','keyboard','touchpad','body','camera','wifi','power'])}<small class="form-text">记录时间（墨尔本时间）：${esc(melbourneTime(preInspection.created_at))}</small>` : '<p>暂无出租前验机记录。</p>'}</section>
      ${deducted ? `<section class="panel" style="margin-top:20px"><h3>归还验机报告与押金扣除</h3><p><strong>扣除金额：</strong>${formatCurrency(Number(depositRefund.deduction_amount))}${depositRefund.deduction_reason ? ` · ${esc(depositRefund.deduction_reason)}` : ''}</p>${report(returnData, ['screen_condition','keyboard_condition','trackpad_condition','body_condition','camera_condition','wifi_condition','power_test','damage_description'])}<form method="post" action="/customer/orders/${order.id}/inspection-dispute" style="margin-top:16px"><label class="form-label">提出异议</label><textarea class="form-control" name="message" required maxlength="2000" placeholder="请说明您对验机结果或押金扣除的异议"></textarea><button class="button button-warning" type="submit" style="margin-top:10px">提交异议</button></form></section>` : ''}

      ${['paid', 'pending_pickup'].includes(String(order.status)) ? `<div class="panel" style="margin-top:20px;"><h3>更改预约时间</h3><p class="form-text">已收取的服务费不退款；如新时段产生更高服务费，将追加到订单。</p><form method="post" action="/customer/orders/${order.id}/time-slots"><div class="grid grid-2"><div class="form-group"><label class="form-label">领取/送货时间</label><select class="form-control" name="pickupTimeSlot" required>${(String(order.deliveryMethod || order.delivery_method || 'Pickup') === 'Delivery' ? [['delivery_morning','9:00–12:00'],['delivery_afternoon','13:00–19:00']] : [['morning_service','7:00–8:00（服务费10%）'],['morning','9:00–12:00'],['afternoon','13:00–20:00'],['evening_service','21:00–23:00（服务费10%）']]).map(([v,l]) => `<option value="${v}" ${v === order.pickupTimeSlot ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">归还时间</label><select class="form-control" name="returnTimeSlot" required>${(String(order.deliveryMethod || order.delivery_method || 'Pickup') === 'Delivery' ? [['delivery_morning','9:00–12:00'],['delivery_afternoon','13:00–19:00']] : [['morning_service','7:00–8:00（服务费10%）'],['morning','9:00–12:00'],['afternoon','13:00–20:00'],['evening_service','21:00–23:00（服务费10%）']]).map(([v,l]) => `<option value="${v}" ${v === order.returnTimeSlot ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><button class="button button-primary" type="submit">保存预约时间</button></form></div>` : ''}
      ${timeChanges?.results?.length ? `<div class="panel" style="margin-top:20px;"><h3>预约时间变更记录</h3>${timeChanges.results.map((change: any) => `<p>${melbourneTime(change.created_at)}：${change.previous_pickup_slot || '未设置'} / ${change.previous_return_slot || '未设置'} → ${change.pickup_slot} / ${change.return_slot}${Number(change.additional_service_fee) > 0 ? `，新增服务费 ${formatCurrency(change.additional_service_fee)}` : ''}</p>`).join('')}</div>` : ''}

      ${['paid', 'active', 'completed'].includes(order.status) || String(order.status) === 'pending_return' ? `<p><a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / 收据</a>${order.status === 'active' ? (order.early_return_requested_at ? ' <span class="badge badge-warning">提前归还申请待审批</span>' : `<form method="post" action="/customer/orders/${order.id}/early-return" style="display:inline-block;margin-left:10px" data-site-confirm="确定申请提前归还此设备吗？将通知绑定员工和管理员。"><button class="button button-warning" type="submit">申请提前归还</button></form>`) : String(order.status) === 'pending_return' ? ' <span class="badge badge-warning">提前归还已批准，等待归还验机</span>' : ''}</p>` : ''}
      ${contract ? `
        <div class="section-title order-section-heading" style="margin-top: 24px;"><h3>合同详情 #${contract.contractNumber || '待生成'}</h3><span class="section-note">查看合同状态、签署记录和正式合同文件。</span></div>
        <div class="contract-detail-meta"><span><small>合同状态</small><strong>${contract.status === 'signed' || contract.status === 'completed' ? '已签署' : contract.status === 'pending_sign' ? '待签署' : contract.status}</strong></span><span><small>签署时间</small><strong>${contract.signedAt || '尚未签署'}</strong></span><span><small>有效期</small><strong>${contract.validFrom || order.startDate} 至 ${contract.validUntil || order.endDate}</strong></span></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          ${contract.status === 'signed' ? `<a class="button" href="/contract/view/${contract.id}?from=order" target="_blank">查看/下载合同</a>` : `<span class="section-note">正式合同将在签署完成后开放下载。</span>`}
          ${contract.status === 'pending_sign' ? `<a class="button button-primary" href="/contract/sign?token=${encodeURIComponent(contract.signToken || '')}&step=1">签署租赁协议</a>` : ''}
        </div>
        ${['signed', 'completed'].includes(String(contract.status)) ? `<section class="panel" style="margin-top:16px"><h3>Windows 登录账户</h3><p class="form-text">这是租赁设备上的独立 Windows 账户密码，不是网站登录密码。</p><form method="post" action="/customer/orders/${order.id}/windows-password"><div class="grid grid-2"><div><label class="form-label" for="windowsPassword">Windows 登录密码</label><input class="form-control" id="windowsPassword" name="windowsPassword" type="password" value="${esc(windowsPassword)}" minlength="8" required></div><div style="display:flex;align-items:end"><button class="button button-primary" type="submit">保存密码</button></div></div></form></section>` : ''}
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        ${transferProof ? `<div class="payment-review-status payment-review-status--${transferProof.status === 'submitted' ? 'pending' : transferProof.status === 'rejected' ? 'failed' : 'success'}"><span class="payment-review-status__icon" aria-hidden="true">${transferProof.status === 'submitted' ? '⌛' : transferProof.status === 'rejected' ? '❌' : '✅'}</span><div><strong>${transferProof.status === 'submitted' ? '转账凭证待审核' : transferProof.status === 'rejected' ? '转账审核未通过' : '转账审核已通过'}</strong><p>${transferProof.status === 'submitted' ? '管理员正在核对付款信息，请耐心等待。' : transferProof.status === 'rejected' ? `已驳回（${String(transferProof.rejection_reason || '').replace(/[&<>"']/g, '')}）` : '付款已确认，订单正在继续处理。'}</p></div></div>` : ''}
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="alert"><strong>收款明细：</strong>租金 ${formatCurrency(Number(order.totalAmount) - Number(order.depositAmount) - Number(order.serviceFee || order.service_fee || 0))} ＋ 押金 ${formatCurrency(order.depositAmount)} ＋ 时段服务费 ${formatCurrency(order.serviceFee || order.service_fee || 0)} ＝ 订单本金 ${formatCurrency(order.totalAmount)}。Stripe 付款另收手续费 ${formatCurrency(stripeFee)}，合计 ${formatCurrency(stripeTotal)}。</div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          ${order.paymentMethod === 'bank_transfer' ? `<div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.accountName}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>请转账 ${formatCurrency(order.totalAmount)} 到以上账户，并在备注中填写合同编号 ${contract?.contractNumber || order.contractId}。</p>
            ${transferProof?.status === 'submitted' ? '<div class="payment-waiting-note"><span class="payment-hourglass" aria-hidden="true">⌛</span><span>转账信息已提交，正在等待管理员审核</span></div>' : `<form method="post" action="/customer/orders/${order.id}/bank-transfer-proof">
              <label class="form-label" for="referenceNumber">银行 Reference</label>
              <input class="form-control" id="referenceNumber" name="referenceNumber" maxlength="100" required>
              <label class="form-label" for="proofImageUrl">转账凭证图片链接</label>
              <input class="form-control" type="url" id="proofImageUrl" name="imageUrl" placeholder="https://图床域名/凭证图片.jpg" required>
              <small class="form-text">请先上传到图床，再粘贴公开 HTTPS 图片链接。</small>
              <label class="form-label" for="transferNote">备注（选填）</label>
              <textarea class="form-control" id="transferNote" name="note" maxlength="500"></textarea>
              <button class="button" type="submit" style="margin-top:12px">提交转账信息</button>
            </form>`}
          </div>` : ''}
          ${['alipay', 'wechat'].includes(String(order.paymentMethod)) ? `<div class="payment-card"><h4>${order.paymentMethod === 'alipay' ? '支付宝' : '微信'}（人民币）</h4><p id="rmb-order-summary">提交付款凭证前获取实时汇率并计算人民币金额。</p><img src="${order.paymentMethod === 'alipay' ? systemSettings.rmbPayment.alipayQrUrl : systemSettings.rmbPayment.wechatQrUrl}" alt="${order.paymentMethod === 'alipay' ? '支付宝' : '微信'}收款码" loading="lazy" style="max-width:240px;display:block;margin:12px 0"><form method="POST" action="/customer/orders/${order.id}/bank-transfer-proof"><label class="form-label">付款 Reference</label><input class="form-control" name="referenceNumber" maxlength="100" required><label class="form-label">付款凭证图片链接</label><input class="form-control" type="url" name="imageUrl" placeholder="https://..." required><label class="form-label">备注（选填）</label><textarea class="form-control" name="note" maxlength="500"></textarea><button class="button" type="submit" style="margin-top:12px">提交付款凭证</button></form><script>(()=>{const s=document.getElementById('rmb-order-summary');fetch('/api/payment/aud-cny?amount=${encodeURIComponent(String(order.totalAmount))}').then(r=>r.ok?r.json():Promise.reject()).then(d=>{s.innerHTML='请支付 <strong>CNY '+Number(d.cnyAmount).toFixed(2)+'</strong>，1 AUD = '+Number(d.rate).toFixed(6)+' CNY，金额按两位小数上舍入。'}).catch(()=>{s.textContent='暂时无法获取实时汇率，请稍后重试。'})})()</script></div>` : ''}
          ${systemSettings.paymentMethods.stripe ? `<div class="payment-card">
            <h4>信用卡支付（Stripe）</h4>
            <p>前往 Stripe 安全结账页面完成支付，本站不会接触您的卡号。</p>
            <p>订单本金 ${formatCurrency(order.totalAmount)} ＋ 2.5% 支付手续费 ${formatCurrency(stripeFee)}。仅退还押金时退回相应手续费，其他退款不退手续费。</p>
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
