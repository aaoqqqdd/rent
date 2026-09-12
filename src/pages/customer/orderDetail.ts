/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getDeviceById, formatCurrency, formatMelbourneDateTime, getContractByOrderId, ensureContractForOrder, systemSettings, diffOrderSnapshots, ORDER_CHANGE_TYPE_LABELS } from '../../site';
import { Context } from 'hono';
import { renderStripePaymentBox } from '../partials/stripePaymentSection';
import { depositPaymentModeForOrder, normalizeSecurityDepositMethod, securityDepositMethodLabel } from '../../domain/paymentPlan';
import { getOrderPriceAdjustmentSummary } from '../../actions/stripePayments';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: '信用卡（Stripe）', card: '信用卡（Stripe）', bank_transfer: '银行转账', alipay: '支付宝', wechat: '微信',
  customer_balance: '账户余额', balance: '账户余额', deposit: '押金', credit: '信用额度 / 调整',
};
const REFUND_TYPE_LABELS: Record<string, string> = { deposit: '押金退还', rent: '租金退款', order: '订单退款', service_fee: '服务费退款' };

export async function renderCustomerOrderDetail(c: Context, user: any, orderId: string, message?: string, type: 'success' | 'error' = 'error') {
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在或无权访问。</p></div>', user)
  }
  const [device, existingContract, transferProof, timeChanges, preInspection, returnInspection, depositRefund, refundStatus, changeHistory, paymentSources, refundRows, priceAdjustmentSummary, priceAdjustmentProof] = await Promise.all([getDeviceById(c, order.deviceId), getContractByOrderId(c, order.id), ['bank_transfer', 'alipay', 'wechat'].includes(String(order.paymentMethod)) ? c.env.RENT.prepare("SELECT pp.status, pp.reference_number, pp.rejection_reason FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND p.id NOT IN (SELECT COALESCE(payment_id, '') FROM order_price_adjustments WHERE order_id = ?) ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id, order.id).first() : Promise.resolve(null), c.env.RENT.prepare('SELECT * FROM order_time_change_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 10').bind(order.id).all(), c.env.RENT.prepare("SELECT snapshot_json, created_at FROM device_inspections WHERE rental_id = ? AND inspection_type = 'before_rental' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(), c.env.RENT.prepare("SELECT snapshot_json, created_at FROM device_inspections WHERE rental_id = ? AND inspection_type = 'after_return' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(), c.env.RENT.prepare("SELECT deduction_amount, deduction_reason FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(), c.env.RENT.prepare("SELECT status, refundable_amount, refund_amount FROM payment_refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1").bind(order.id).first(), c.env.RENT.prepare("SELECT change_type, before_json, after_json, reason, created_at FROM order_change_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 20").bind(order.id).all(), c.env.RENT.prepare("SELECT payment_method, amount, deposit_amount, rental_amount, processing_fee, status FROM payments WHERE rental_id = ? AND status IN ('paid','refunded') ORDER BY created_at").bind(order.id).all().then((r: any) => (r.results || []) as any[]), c.env.RENT.prepare("SELECT type, refund_amount, refund_method, status, created_at FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at").bind(order.id).all().then((r: any) => (r.results || []) as any[]), getOrderPriceAdjustmentSummary(c, order), c.env.RENT.prepare("SELECT pp.status, pp.reference_number, pp.rejection_reason FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id JOIN order_price_adjustments a ON a.payment_id = p.id WHERE a.order_id = ? AND a.direction = 'increase' ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first()]) as any[]
  const contract = existingContract || (order.status === 'approved' ? await ensureContractForOrder(c, order, user.id) : null)
  const alertMessage = message ? `<div class="page-notification page-notification--${type}">${message}</div>` : ''
  const depositMode = depositPaymentModeForOrder(order)
  const depositMethod = normalizeSecurityDepositMethod((order as any).deposit_method, depositMode === 'PAID' ? 'bank_transfer' : 'card_hold')
  const deposit = Number(order.depositAmount || 0)
  const serviceFee = Number(order.serviceFee || order.service_fee || 0)
  const immediatelyPaidAmount = Math.max(0, Number(order.totalAmount) - deposit)
  const rentalAmount = Math.max(0, immediatelyPaidAmount - serviceFee)
  const stripeFee = Math.round(immediatelyPaidAmount * 100 * 0.025) / 100
  const stripeTotal = Number(order.totalAmount) - deposit + stripeFee
  const transferPayment = ['bank_transfer', 'alipay', 'wechat'].includes(String(order.paymentMethod))
  let preSnapshot: any = {}; let returnData: any = {}
  try { preSnapshot = JSON.parse(preInspection?.snapshot_json || '{}') } catch (_) {}
  try { returnData = JSON.parse(returnInspection?.snapshot_json || '{}') } catch (_) {}
  const esc = (value: unknown) => String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const melbourneTime = (value: unknown) => {
    const raw = String(value || '')
    if (!raw) return '—'
    const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`)
    return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date)
  }
  const report = (data: any, keys: string[]) => `<dl class="data-list">${keys.map(key => `<div><dt>${esc(key)}</dt><dd>${esc(data[key])}</dd></div>`).join('')}</dl>`
  const deducted = Number(depositRefund?.deduction_amount || 0) > 0
  const refundLabel = refundStatus?.status === 'pending' ? '退款处理中' : refundStatus?.status === 'succeeded' ? (Number(refundStatus.refund_amount || 0) < Number(refundStatus.refundable_amount || refundStatus.refund_amount || 0) ? '部分退款' : '已退款') : ''
  const windowsData = typeof contract?.contract_data === 'string' ? (() => { try { return JSON.parse(contract.contract_data || '{}') } catch (_) { return {} } })() : (contract?.contract_data || {})
  const windowsPassword = String(windowsData.windows_password || '')
  const rentalStatusLabels: Record<string, string> = { pending: '待处理', pending_payment: '待处理', awaiting_signature: '待签合同', paid: '租赁已确认，等待开始', approved: '租赁已确认，等待开始', pending_pickup: '待取货', active: '租赁中', extended: '已延期 / 租赁中', overdue: '已逾期', suspended: '已暂停', pending_return: '待归还', returned: '已归还', completed: '已完成', cancelled: '已取消' }

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
          <p><strong>租金及服务费:</strong> ${formatCurrency(Number(order.totalAmount) - deposit)}</p>
          <p><strong>押金:</strong> ${formatCurrency(deposit)}（${securityDepositMethodLabel(depositMethod)}；${depositMode === 'PREAUTH' ? '预授权' : depositMode === 'SETUP_INTENT' ? 'SetupIntent 保存卡片，不预扣' : '单独处理'}）</p>
          <p><strong>订单合计:</strong> ${formatCurrency(order.totalAmount)}</p>
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
      ${returnInspection ? `<section class="panel" style="margin-top:20px"><h3>归还验机报告${deducted ? '与押金扣除' : ''}</h3>${deducted ? `<p><strong>扣除金额：</strong>${formatCurrency(Number(depositRefund.deduction_amount))}${depositRefund.deduction_reason ? ` · ${esc(depositRefund.deduction_reason)}` : ''}</p>` : ''}${report(returnData, ['screen_condition','keyboard_condition','trackpad_condition','body_condition','camera_condition','wifi_condition','power_test','damageDescription'])}${deducted ? `<form method="post" action="/customer/orders/${order.id}/inspection-dispute" style="margin-top:16px"><label class="form-label">提出异议</label><textarea class="form-control" name="message" required maxlength="2000" placeholder="请说明您对验机结果或押金扣除的异议"></textarea><button class="button button-warning" type="submit" style="margin-top:10px">提交异议</button></form>` : ''}</section>` : ''}

      ${changeHistory?.results?.length ? `<section class="panel" style="margin-top:20px"><h3>订单变更记录</h3><p class="form-text">您的订单关键信息（租期、设备、金额、取还地点）曾被调整，明细如下。</p>${changeHistory.results.map((item: any) => {
        let before: any = {}; let after: any = {}
        try { before = JSON.parse(item.before_json || '{}') } catch (_) {}
        try { after = JSON.parse(item.after_json || '{}') } catch (_) {}
        const diffs = diffOrderSnapshots(before, after).filter(d => d.field !== 'deviceId')
        const detail = diffs.length ? diffs.map(d => `${esc(d.label)}：${esc(String(d.before ?? '—'))} → ${esc(String(d.after ?? '—'))}`).join('；') : ''
        return `<p><strong>${melbourneTime(item.created_at)}</strong> · ${esc(ORDER_CHANGE_TYPE_LABELS[item.change_type] || item.change_type)}${detail ? `<br><span class="form-text">${detail}</span>` : ''}${item.reason ? `<br><span class="form-text">原因：${esc(item.reason)}</span>` : ''}</p>`
      }).join('')}</section>` : ''}

      ${(paymentSources.length || refundRows.length) ? `<section class="panel" style="margin-top:20px"><h3>付款与退款明细</h3>
        ${paymentSources.length ? `<h4 style="margin:12px 0 6px">已付款</h4><dl class="data-list">${paymentSources.map((p: any) => `<div><dt>${esc(PAYMENT_METHOD_LABELS[String(p.payment_method)] || p.payment_method)}</dt><dd>${formatCurrency(p.amount)}</dd></div>`).join('')}</dl>` : ''}
        ${refundRows.length ? `<h4 style="margin:16px 0 6px">已退款</h4><dl class="data-list">${refundRows.map((r: any) => `<div><dt>${esc(REFUND_TYPE_LABELS[String(r.type)] || r.type)}${r.refund_method ? ` · ${esc(PAYMENT_METHOD_LABELS[String(r.refund_method)] || r.refund_method)}` : ''}<br><span class="form-text">${melbourneTime(r.created_at)}</span></dt><dd>${formatCurrency(r.refund_amount)}</dd></div>`).join('')}</dl>` : ''}
        <p class="form-text" style="margin-top:12px">如对付款或退款金额有疑问，请联系您的专属客服。</p>
      </section>` : ''}

      ${['paid', 'pending_pickup'].includes(String(order.status)) ? `<div class="panel" style="margin-top:20px;"><h3>更改预约时间</h3><p class="form-text">已收取的服务费不退款；如新时段产生更高服务费，将追加到订单。</p><form method="post" action="/customer/orders/${order.id}/time-slots"><div class="grid grid-2"><div class="form-group"><label class="form-label">领取/送货时间</label><select class="form-control" name="pickupTimeSlot" required>${(String(order.deliveryMethod || order.delivery_method || 'Pickup') === 'Delivery' ? [['delivery_morning','9:00–12:00'],['delivery_afternoon','13:00–19:00']] : [['morning_service','7:00–8:00（服务费10%）'],['morning','9:00–12:00'],['afternoon','13:00–20:00'],['evening_service','21:00–23:00（服务费10%）']]).map(([v,l]) => `<option value="${v}" ${v === order.pickupTimeSlot ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">归还时间</label><select class="form-control" name="returnTimeSlot" required>${(String(order.deliveryMethod || order.delivery_method || 'Pickup') === 'Delivery' ? [['delivery_morning','9:00–12:00'],['delivery_afternoon','13:00–19:00']] : [['morning_service','7:00–8:00（服务费10%）'],['morning','9:00–12:00'],['afternoon','13:00–20:00'],['evening_service','21:00–23:00（服务费10%）']]).map(([v,l]) => `<option value="${v}" ${v === order.returnTimeSlot ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><button class="button button-primary" type="submit">保存预约时间</button></form></div>` : ''}
      ${timeChanges?.results?.length ? `<div class="panel" style="margin-top:20px;"><h3>预约时间变更记录</h3>${timeChanges.results.map((change: any) => `<p>${melbourneTime(change.created_at)}：${change.previous_pickup_slot || '未设置'} / ${change.previous_return_slot || '未设置'} → ${change.pickup_slot} / ${change.return_slot}${Number(change.additional_service_fee) > 0 ? `，新增服务费 ${formatCurrency(change.additional_service_fee)}` : ''}</p>`).join('')}</div>` : ''}

      ${['paid', 'active', 'completed'].includes(order.status) || String(order.status) === 'pending_return' ? `<p><a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / 收据</a>${order.status === 'active' ? (order.early_return_requested_at ? ' <span class="badge badge-warning">提前归还申请待审批</span>' : `<form method="post" action="/customer/orders/${order.id}/early-return" style="display:inline-block;margin-left:10px" data-site-confirm="确定申请提前归还此设备吗？将通知绑定员工和管理员。"><button class="button button-warning" type="submit">申请提前归还</button></form>`) : String(order.status) === 'pending_return' ? ' <span class="badge badge-warning">提前归还已批准，等待归还验机</span>' : ''}</p>` : ''}
      ${contract ? `
        <div class="section-title order-section-heading" style="margin-top: 24px;"><h3>合同详情 #${contract.contractNumber || '待生成'}</h3><span class="section-note">查看合同状态、签署记录和正式合同文件。</span></div>
        <div class="contract-detail-meta"><span><small>合同状态</small><strong>${contract.status === 'signed' || contract.status === 'completed' ? '已签署' : contract.status === 'pending_sign' ? '待签署' : contract.status}</strong></span><span><small>签署时间（墨尔本）</small><strong>${formatMelbourneDateTime(contract.signedAt) || '尚未签署'}</strong></span><span><small>有效期</small><strong>${contract.validFrom || order.startDate} 至 ${contract.validUntil || order.endDate}</strong></span></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          ${contract.status === 'signed' ? `<a class="button" href="/contract/view/${contract.id}?from=order" target="_blank">查看/下载合同</a>` : `<span class="section-note">正式合同将在签署完成后开放下载。</span>`}
          ${contract.status === 'pending_sign' ? `<a class="button button-primary" href="/contract/sign?token=${encodeURIComponent(contract.signToken || '')}&step=1">签署租赁协议</a>` : ''}
        </div>
        ${['signed', 'completed'].includes(String(contract.status)) && (contract as any).verification_token ? `<p class="section-note">公开验证链接（可提供给需要核实合同真实性的第三方，不包含任何个人信息）：<br><a href="/verify?number=${encodeURIComponent(contract.contractNumber || '')}&token=${encodeURIComponent((contract as any).verification_token)}" target="_blank">${new URL(c.req.url).origin}/verify?number=${encodeURIComponent(contract.contractNumber || '')}&token=${encodeURIComponent((contract as any).verification_token)}</a></p>` : ''}
        ${['signed', 'completed'].includes(String(contract.status)) ? `<section class="panel" style="margin-top:16px"><h3>Windows 登录账户</h3><p class="form-text">这是系统为租赁设备自动生成的独立 Windows 密码，不是网站登录密码。密码会保存并在此处重复显示，不支持自定义修改。</p><div class="form-group"><label class="form-label" for="windowsPassword">Windows 登录密码</label><code id="windowsPassword" class="form-control mono" style="display:block;user-select:all;word-break:break-all;">${esc(windowsPassword || '暂未生成')}</code></div></section>` : ''}
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        ${transferProof ? `<div class="payment-review-status payment-review-status--${transferProof.status === 'submitted' ? 'pending' : transferProof.status === 'rejected' ? 'failed' : 'success'}"><span class="payment-review-status__icon" aria-hidden="true"></span><div><strong>${transferProof.status === 'submitted' ? '转账凭证待审核' : transferProof.status === 'rejected' ? '转账审核未通过' : '转账审核已通过'}</strong><p>${transferProof.status === 'submitted' ? '管理员正在核对付款信息，请耐心等待。' : transferProof.status === 'rejected' ? `已驳回（${String(transferProof.rejection_reason || '').replace(/[&<>"']/g, '')}）` : '付款已确认，订单正在继续处理。'}</p></div></div>` : ''}
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="alert"><strong>收款明细：</strong>租金 ${formatCurrency(rentalAmount)} ＋ 时段服务费 ${formatCurrency(serviceFee)} ＝ ${formatCurrency(immediatelyPaidAmount)}；${depositMode === 'PREAUTH' ? `押金 ${formatCurrency(deposit)} 仅预授权` : depositMode === 'SETUP_INTENT' ? `押金 ${formatCurrency(deposit)} 不预扣` : `押金 ${formatCurrency(deposit)} 按${securityDepositMethodLabel(depositMethod)}单独处理`}。Stripe 手续费按租金及服务费计算 ${formatCurrency(stripeFee)}，付款合计 ${formatCurrency(stripeTotal)}。</div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          ${order.paymentMethod === 'bank_transfer' ? `<div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.bankName || '—'}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>请转账 ${formatCurrency(order.totalAmount)} 到以上账户，并在备注中填写合同编号 ${contract?.contractNumber || order.contractId}。</p>
            ${transferProof?.status === 'submitted' ? '<div class="payment-waiting-note"><span>转账信息已提交，正在等待管理员审核</span></div>' : `<form method="post" action="/customer/orders/${order.id}/bank-transfer-proof">
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
            <p>在本页安全填写卡信息完成支付，卡号由 Stripe 处理，本站不保存卡号、有效期或安全码。</p>
            <dl class="data-list" style="margin:8px 0">
              <div><dt>租金及服务费</dt><dd>${formatCurrency(Number(order.totalAmount) - deposit)}</dd></div>
              <div><dt>Stripe 租金及服务费支付手续费（2.5%）</dt><dd>${formatCurrency(stripeFee)}</dd></div>
              <div><dt><strong>信用卡最终扣款</strong></dt><dd><strong>${formatCurrency(stripeTotal)}</strong></dd></div>
            </dl>
            <p class="form-text">${depositMode === 'PREAUTH' ? `押金 ${formatCurrency(deposit)} 仅预授权（Visa/Mastercard 请求最多保留 30 天，其他卡 7 天），归还无损坏时释放。` : depositMode === 'SETUP_INTENT' ? `押金 ${formatCurrency(deposit)} 使用 SetupIntent 保存卡片，不预扣，仅在损坏或逾期时按实际费用扣款。` : '押金按订单约定处理。'} 手续费不计入押金。</p>
            ${renderStripePaymentBox({ intentUrl: `/customer/orders/${order.id}/stripe/intent`, returnUrl: `/payment/result?orderId=${encodeURIComponent(order.id)}`, buttonLabel: `支付 ${formatCurrency(stripeTotal)}`, domId: 'order-stripe-pay' })}
          </div>` : ''}
        </div>
      ` : ''}
      ${(priceAdjustmentSummary.amountDue > 0 || priceAdjustmentSummary.pendingDepositRefund > 0) && !['pending_payment', 'completed', 'cancelled'].includes(String(order.status)) ? `<section class="panel" style="margin-top:20px"><h3>订单差价</h3>${priceAdjustmentSummary.pendingDepositRefund > 0 ? `<div class="alert"><strong>订单已下调，待退差价 ${formatCurrency(priceAdjustmentSummary.pendingDepositRefund)}。</strong>由于您使用${order.paymentMethod === 'bank_transfer' ? '银行转账' : order.paymentMethod === 'alipay' ? '支付宝' : '微信'}付款，差价将在管理员退押金时一并退还。</div>` : ''}${priceAdjustmentSummary.amountDue > 0 ? `<div class="alert"><strong>订单价格已增加，需要补交 ${formatCurrency(priceAdjustmentSummary.amountDue)}。</strong>${transferPayment ? '转账类付款请提交差价凭证，管理员审核后生效。' : `信用卡支付含手续费 ${formatCurrency(priceAdjustmentSummary.processingFee)}，本次实际扣款 ${formatCurrency(priceAdjustmentSummary.chargedAmount)}。`}</div>` : ''}
        ${priceAdjustmentSummary.amountDue > 0 ? (transferPayment ? `${priceAdjustmentProof?.status === 'submitted' ? '<div class="payment-waiting-note"><span>差价付款凭证已提交，正在等待管理员审核</span></div>' : `<div class="payment-card"><h4>${order.paymentMethod === 'bank_transfer' ? '银行转账' : order.paymentMethod === 'alipay' ? '支付宝' : '微信'}差价付款</h4>${order.paymentMethod === 'bank_transfer' ? `<p><strong>银行名称:</strong> ${systemSettings.bankDetails.bankName || '—'}</p><p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p><p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>` : `<img src="${order.paymentMethod === 'alipay' ? systemSettings.rmbPayment.alipayQrUrl : systemSettings.rmbPayment.wechatQrUrl}" alt="${order.paymentMethod === 'alipay' ? '支付宝' : '微信'}收款码" loading="lazy" style="max-width:240px;display:block;margin:12px 0">`}<p id="rmb-adjustment-summary">请支付 ${formatCurrency(priceAdjustmentSummary.amountDue)}；提交付款凭证前获取实时汇率。</p><form method="POST" action="/customer/orders/${order.id}/bank-transfer-proof"><input type="hidden" name="priceAdjustment" value="1"><label class="form-label">付款 Reference</label><input class="form-control" name="referenceNumber" maxlength="100" required><label class="form-label">付款凭证图片链接</label><input class="form-control" type="url" name="imageUrl" placeholder="https://..." required><label class="form-label">备注（选填）</label><textarea class="form-control" name="note" maxlength="500"></textarea><button class="button button-primary" type="submit" style="margin-top:12px">提交差价付款凭证</button></form>${order.paymentMethod !== 'bank_transfer' ? `<script>(()=>{const s=document.getElementById('rmb-adjustment-summary');fetch('/api/payment/aud-cny?amount=${encodeURIComponent(String(priceAdjustmentSummary.amountDue))}').then(r=>r.ok?r.json():Promise.reject()).then(d=>{s.innerHTML='请支付 <strong>CNY '+Number(d.cnyAmount).toFixed(2)+'</strong>，1 AUD = '+Number(d.rate).toFixed(6)+' CNY，金额按两位小数上舍入。'}).catch(()=>{s.textContent='暂时无法获取实时人民币汇率，请稍后重试。'})})()</script>` : ''}</div>`}` : (systemSettings.paymentMethods.stripe ? `<div class="payment-card"><p>在本页安全填写卡信息完成差价支付，卡号由 Stripe 处理。</p>${renderStripePaymentBox({ intentUrl: `/customer/orders/${order.id}/price-adjustment/stripe/intent`, returnUrl: `/payment/result?orderId=${encodeURIComponent(order.id)}`, buttonLabel: `支付差价 ${formatCurrency(priceAdjustmentSummary.chargedAmount)}`, domId: 'order-price-adjustment-stripe-pay' })}</div>` : '<p>信用卡支付当前未启用，请联系客服完成差价支付。</p>')) : ''}
      </section>` : (priceAdjustmentSummary.refundedPrincipal > 0 && !['pending_payment', 'completed', 'cancelled'].includes(String(order.status)) ? `<section class="panel" style="margin-top:20px"><h3>订单差价</h3><div class="alert">订单下调差价 ${formatCurrency(priceAdjustmentSummary.refundedPrincipal)} 已自动退回。</div></section>` : '')}
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}
