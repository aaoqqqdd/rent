/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getUserById, getDeviceById, getContractByOrderId, ensureContractForOrder, getCustomerRiskAssessment, formatCurrency, formatMelbourneDateTime, validateHostedImageUrls, isContractFinalized, diffOrderSnapshots, ORDER_CHANGE_TYPE_LABELS, formatOrderChangeActor, reconcileOrderPayments } from '../../site';
import { Context } from 'hono';
import { renderOrderStatusFeedback } from './orderStatusFeedback';
import { renderReconciliationPanel } from '../partials/reconciliationPanel';
import { normalizeSecurityDepositMethod } from '../../domain/paymentPlan';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
}

export async function renderAdminOrderDetail(c: Context, user: any, orderId: string) {
  const order = await getOrderById(c, orderId);

  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user);
  }

  const [customer, device, existingContract, completedRefund, depositRefundSummary, pendingPriceRefundSummary, transferProof, statusHistory, depositSettlement, changeHistory, swapDevices] = await Promise.all([
    getUserById(c, order.userId), getDeviceById(c, order.deviceId), getContractByOrderId(c, order.id),
    c.env.RENT.prepare("SELECT type, status, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_reason, refund_method, refund_bsb, refund_account_number, refund_account_name FROM payment_refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare("SELECT COALESCE(SUM(refund_amount), 0) AS refunded_amount FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded'").bind(order.id).first(),
    c.env.RENT.prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM order_price_adjustments WHERE order_id = ? AND direction = 'decrease' AND status = 'succeeded' AND refund_method = 'pending_deposit' AND deposit_refunded = 0").bind(order.id).first(),
    c.env.RENT.prepare("SELECT pp.*, p.payment_method AS proof_payment_method, p.deposit_amount AS proof_deposit_amount, a.id AS adjustment_id FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id LEFT JOIN order_price_adjustments a ON a.payment_id = p.id AND a.direction = 'increase' WHERE p.rental_id = ? ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare('SELECT old_status, new_status, trigger_type, triggered_by, reason, created_at FROM rental_status_history WHERE rental_id = ? ORDER BY created_at DESC LIMIT 20').bind(order.id).all(),
    c.env.RENT.prepare('SELECT * FROM deposit_settlements WHERE order_id = ? ORDER BY requested_at DESC LIMIT 1').bind(order.id).first(),
    c.env.RENT.prepare('SELECT h.change_type, h.before_json, h.after_json, h.reason, h.changed_by, h.created_at, u.name AS changed_by_name FROM order_change_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at DESC LIMIT 20').bind(order.id).all(),
    c.env.RENT.prepare("SELECT id, name, status FROM devices WHERE id != ? AND status NOT IN ('retired') ORDER BY name LIMIT 200").bind(order.deviceId).all()
  ]) as any[];
  const risk = !existingContract && order.status === 'approved' && customer?.role === 'CUSTOMER' ? await getCustomerRiskAssessment(c, customer.id) : null
  if (risk?.blocked) return buildLayout('订单风控限制 - 电脑租赁管理系统', `<div class="panel"><h2>订单存在风控限制</h2><p>客户风险分 ${risk.score}/100，当前不能创建合同。请先完成风控处理后再继续。</p></div>`, user)
  const contract = existingContract || (order.status === 'approved' ? await ensureContractForOrder(c, order, user.id) : null)
  const [reconciliation, paymentSources, refundRows] = await Promise.all([
    reconcileOrderPayments(c, order.id),
    c.env.RENT.prepare("SELECT id, payment_method, payment_provider, amount, deposit_amount, rental_amount, status, processing_fee, stripe_payment_intent_id, square_payment_id FROM payments WHERE rental_id = ? ORDER BY created_at").bind(order.id).all().then((r: any) => (r.results || []) as any[]),
    c.env.RENT.prepare("SELECT id, payment_id, type, refund_amount, refund_method, status, created_at FROM payment_refunds WHERE order_id = ? ORDER BY created_at").bind(order.id).all().then((r: any) => (r.results || []) as any[]),
  ]);
  const canModifyOrder = !['completed', 'cancelled'].includes(String(order.status));
  const paymentMethodLabels: Record<string, string> = {
    stripe: 'Stripe', card: 'Stripe', square: 'Square', bank_transfer: '转账', alipay: '转账', wechat: '转账', balance: '余额',
  };
  const paymentChannels = Array.from(new Set(paymentSources.flatMap((payment: any) => {
    const method = String(payment.payment_method || '').toLowerCase()
    const provider = String(payment.payment_provider || '').toLowerCase()
    const channels: string[] = []
    if (provider === 'square' || payment.square_payment_id) channels.push('Square')
    if (payment.stripe_payment_intent_id || (provider !== 'square' && ['card', 'stripe'].includes(method))) channels.push('Stripe')
    if (method === 'balance' || provider === 'balance') channels.push('余额')
    if (['bank_transfer', 'alipay', 'wechat'].includes(method)) channels.push('转账')
    return channels
  }))) as string[];
  const paymentMethod = String(order.paymentMethod || (order as any).payment_method || 'card');
  const isSquarePayment = String(order.paymentProvider || (order as any).payment_provider || '') === 'square'
  const fallbackPaymentChannel = isSquarePayment ? 'Square' : paymentMethodLabels[paymentMethod] || paymentMethod;
  const paymentMethodLabel = paymentChannels.length ? paymentChannels.join(' + ') : fallbackPaymentChannel;
  const isCardPayment = !isSquarePayment && ['card', 'stripe'].includes(paymentMethod)
  const hasStripeDepositCard = Boolean((order as any).stripe_deposit_payment_intent_id) || paymentSources.some((payment: any) => payment.payment_method === 'card' && payment.stripe_payment_intent_id && Number(payment.deposit_amount || 0) > 0)
  const canRefundOriginal = !isSquarePayment || hasStripeDepositCard
  const isDepositCardPayment = isCardPayment || hasStripeDepositCard
  const isTransferPayment = ['bank_transfer', 'alipay', 'wechat'].includes(paymentMethod)
  const transferProofPaymentMethod = String(transferProof?.proof_payment_method || '')
  const isAdjustmentTransferProof = Boolean(transferProof?.adjustment_id && ['bank_transfer', 'alipay', 'wechat'].includes(transferProofPaymentMethod))
  const isSquareDepositProof = isSquarePayment && !transferProof?.adjustment_id && transferProofPaymentMethod === 'bank_transfer' && Number(transferProof?.proof_deposit_amount || 0) > 0
  const contractFinalized = Boolean(contract && isContractFinalized(contract));
  const rentalPaid = ['paid', 'pending_pickup', 'active', 'extended', 'overdue', 'suspended', 'pending_return', 'returned', 'completed'].includes(String(order.status));
  const signingStep = !contract
    ? (order.status === 'pending_approval' ? 1 : 2)
    : contractFinalized
      ? (rentalPaid ? 6 : 5)
      : 2;
  const contractWorkflow = [
    ['订单审核', '管理员确认租期、设备和档期'],
    ['阅读并同意协议', '客户打开签署链接阅读完整合同'],
    ['填写客户资料', '客户确认身份与联系方式'],
    ['电子签名', '客户输入姓名完成电子签署'],
    [isSquarePayment ? 'Square 礼品卡支付' : 'Stripe 支付', isSquarePayment ? '客户通过 Square 礼品卡支付租金及服务费' : '客户通过 Stripe 支付租金及服务费'],
  ];
  const renderWorkflow = () => `<ol class="signing-steps admin-order-signing-steps" style="grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0;">${contractWorkflow.map(([title, description], index) => {
    const itemStep = index + 1;
    const state = itemStep < signingStep ? 'complete' : itemStep === signingStep ? 'current' : 'upcoming';
    const stateLabel = state === 'complete' ? '已完成' : state === 'current' ? '当前步骤' : '尚未开始';
    return `<li class="signing-step signing-step--${state}"${state === 'current' ? ' aria-current="step"' : ''}><span class="signing-step__number" aria-hidden="true">${String(itemStep).padStart(2, '0')}</span><span class="signing-step__copy"><span class="signing-step__title">${escapeHtml(title)}</span><span class="signing-step__state">${stateLabel}</span><small>${escapeHtml(description)}</small></span></li>`;
  }).join('')}</ol>`;
  const depositAmount = Number(order.depositAmount || order.deposit_amount || 0)
  const refundedDepositAmount = Number(depositRefundSummary?.refunded_amount || 0)
  const remainingDepositRefund = Math.max(0, Number((depositAmount - refundedDepositAmount).toFixed(2)))
  const pendingPriceRefund = Math.max(0, Number(Number(pendingPriceRefundSummary?.amount || 0).toFixed(2)))
  const remainingRefundTotal = Number((remainingDepositRefund + pendingPriceRefund).toFixed(2))
  const hasTransferPriceRefund = pendingPriceRefund > 0 && isTransferPayment
  const hasStripeRefundSource = isCardPayment && paymentSources.some((payment: any) => payment.payment_method === 'card' && payment.stripe_payment_intent_id)
  const defaultPriceRefundMethod = hasStripeRefundSource ? 'original' : isTransferPayment ? 'pending_deposit' : 'balance'
  const isSetupIntentDeposit = String((order as any).deposit_payment_mode || '') === 'SETUP_INTENT'
  const isPreauthDeposit = isDepositCardPayment && String((order as any).deposit_payment_mode || '') === 'PREAUTH'
  const preauthFee = Math.round(Math.max(0, Number(order.totalAmount) - depositAmount) * 0.025 * 100) / 100
  const displayedPreauthAmount = isSquarePayment ? depositAmount : Number(order.totalAmount) + preauthFee
  const customerRefundMethod = order.refundMethod === 'original'
    ? (paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'original')
    : order.refundMethod === 'balance' ? 'balance' : ''
  let proofImage = ''
  try { proofImage = transferProof?.image_url ? validateHostedImageUrls(transferProof.image_url, 1)[0] : '' } catch { }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
  const canSettleDeposit = order.status === 'completed' && (isSetupIntentDeposit || remainingRefundTotal > 0) && (!depositSettlement || depositSettlement.status === 'REJECTED' || depositSettlement.status === 'APPROVED')
  const canCancelBeforeHandover = ['paid', 'pending_pickup'].includes(String(order.status)) && !order.handover_completed_at
  const showRefundCard = order.status === 'completed' || (canCancelBeforeHandover && !completedRefund)
  const canHandover = ['paid', 'pending_pickup'].includes(String(order.status)) || (order.status === 'approved' && contract?.status === 'signed')

  const statusLabels: Record<string, { label: string, color: string, bg: string, icon: string }> = {
    'pending': { label: '待处理', color: '#d97706', bg: '#fef3c7', icon: '' },
    'pending_payment': { label: '待付款', color: '#d97706', bg: '#fef3c7', icon: '' },
    'awaiting_signature': { label: '待签合同', color: '#7c3aed', bg: '#ede9fe', icon: '' },
    'paid': { label: '租赁已确认，等待开始', color: '#059669', bg: '#d1fae5', icon: '' },
    'approved': { label: '已审核，等待签署/付款', color: '#7c3aed', bg: '#ede9fe', icon: '' },
    'pending_pickup': { label: '待取货', color: '#0891b2', bg: '#cffafe', icon: '' },
    'active': { label: '租赁中', color: '#2563eb', bg: '#dbeafe', icon: '' },
    'extended': { label: '已延期 / 租赁中', color: '#2563eb', bg: '#dbeafe', icon: '' },
    'overdue': { label: '已逾期', color: '#dc2626', bg: '#fee2e2', icon: '' },
    'suspended': { label: '已暂停', color: '#6b7280', bg: '#f3f4f6', icon: '' },
    'pending_return': { label: '待归还', color: '#d97706', bg: '#fef3c7', icon: '' },
    'returned': { label: '已归还', color: '#0891b2', bg: '#cffafe', icon: '' },
    'completed': { label: '已完成', color: '#0891b2', bg: '#cffafe', icon: '' },
    'cancelled': { label: '已取消', color: '#dc2626', bg: '#fee2e2', icon: '' }
  };
  const currentStatus = statusLabels[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6', icon: '' };
  const refundStatusLabel = completedRefund?.status === 'pending' ? 'REFUND_PENDING: 退款处理中' : completedRefund?.status === 'succeeded' ? (Number(completedRefund.refund_amount || 0) < Number(completedRefund.refundable_amount || completedRefund.refund_amount || 0) ? 'PARTIALLY_REFUNDED: 部分退款' : 'REFUNDED: 已退款') : '';

  const body = `
    <div class="panel hero order-detail-shell admin-order-detail" style="padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div>
            <h2 style="margin: 0 0 8px 0;">订单详情 - ${order.orderNo}</h2>
            <p style="margin: 0; opacity: 0.9;">查看和管理订单的详细信息</p>
          </div>
        </div>
        <span style="padding: 10px 20px; border-radius: 9999px; font-weight: 600; font-size: 1rem; background: ${currentStatus.bg}; color: ${currentStatus.color}; display: inline-flex; align-items: center; gap: 8px;">${currentStatus.label}</span>
      </div>
    </div>

    <div class="order-detail-actions">
      ${['paid', 'active', 'completed', 'pending_return'].includes(String(order.status)) ? `<a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / 收据</a>` : ''}
      ${canHandover ? `<a class="button button-primary" href="/staff/orders/${order.id}/handover">记录交付并开始租赁</a>` : ''}
      ${contract && isContractFinalized(contract) ? `<a class="button button-secondary" href="/contract/view/${contract.id}?from=order">查看合同</a>` : ''}
      ${contract && contract.status === 'pending_sign' ? `<a class="button button-primary" href="/staff/contracts/${encodeURIComponent(contract.id)}/progress">查看合同签署进度</a>` : ''}
    </div>
    <section class="panel" style="margin: 0 0 24px;"><div class="section-title"><h3>合同签署流程</h3><span class="section-note">${contract ? (contractFinalized ? '合同已签署' : '等待客户完成电子签名') : '合同尚未生成'}</span></div>${renderWorkflow()}${contract && contract.status === 'pending_sign' ? `<div class="record-actions" style="margin-top: 16px;"><a class="button button-secondary" href="/staff/contracts/${encodeURIComponent(contract.id)}/progress">打开签署链接管理</a></div>` : !contract ? '<p class="section-note" style="margin-top: 16px;">订单通过审核后，系统会自动生成客户签署合同。</p>' : ''}${order.status === 'approved' && contract?.status === 'pending_sign' ? '<p class="alert" style="margin-top: 16px;">当前订单还没有开始租赁：客户需先完成合同签署并完成付款，随后才能记录交付并开始租赁。</p>' : ''}</section>
    ${statusHistory?.results?.length ? `<section class="panel" style="margin: 0 0 24px;"><div class="section-title"><h3>租赁状态历史</h3><span class="section-note">最近 ${statusHistory.results.length} 条</span></div><div class="table-wrapper"><table><thead><tr><th>时间</th><th>状态变化</th><th>触发方式</th><th>原因</th></tr></thead><tbody>${statusHistory.results.map((item: any) => `<tr><td class="mono">${escapeHtml(formatMelbourneDateTime(item.created_at))}</td><td>${escapeHtml(item.old_status || '—')} → <strong>${escapeHtml(item.new_status)}</strong></td><td>${escapeHtml(item.trigger_type)}${item.triggered_by ? ` · ${escapeHtml(item.triggered_by)}` : ''}</td><td>${escapeHtml(item.reason || '—')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    ${changeHistory?.results?.length ? `<section class="panel" style="margin: 0 0 24px;"><div class="section-title"><h3>订单修改历史</h3><span class="section-note">最近 ${changeHistory.results.length} 条</span></div><div class="table-wrapper"><table><thead><tr><th>时间</th><th>类型</th><th>变更内容</th><th>原因</th><th>操作人</th></tr></thead><tbody>${changeHistory.results.map((item: any) => {
      let before: any = {}; let after: any = {};
      try { before = JSON.parse(item.before_json || '{}') } catch { }
      try { after = JSON.parse(item.after_json || '{}') } catch { }
      const diffs = diffOrderSnapshots(before, after);
      const detail = diffs.length ? diffs.map(d => `<div>${escapeHtml(d.label)}：<span class="mono">${escapeHtml(String(d.before ?? '—'))}</span> → <strong class="mono">${escapeHtml(String(d.after ?? '—'))}</strong></div>`).join('') : '—';
      return `<tr><td class="mono">${escapeHtml(formatMelbourneDateTime(item.created_at))}</td><td>${escapeHtml(ORDER_CHANGE_TYPE_LABELS[item.change_type] || item.change_type)}</td><td>${detail}</td><td>${escapeHtml(item.reason || '—')}</td><td>${escapeHtml(formatOrderChangeActor(item.changed_by_name, item.changed_by))}</td></tr>`;
    }).join('')}</tbody></table></div></section>` : ''}
    ${renderReconciliationPanel({ reconciliation, paymentSources, refundRows })}
    <div class="grid grid-2" style="gap: 24px; margin-bottom: 24px;">
      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">订单基本信息</h3>
        </div>
        <div style="display: grid; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">订单号</span>
            <span style="font-family: monospace; font-weight: 600;">${order.orderNo}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">租期</span>
            <span style="font-weight: 500;">${order.startDate} ~ ${order.endDate}</span>
          </div>
          ${isPreauthDeposit ? `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;"><span style="color: #6b7280;">${isSquarePayment ? '押金信用卡预授权' : '信用卡预授权总额'}</span><span style="font-weight: 700; font-size: 1.1rem; color: #2563eb;">${formatCurrency(displayedPreauthAmount)}</span></div>` : `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;"><span style="color: #6b7280;">租金（含服务费）</span><span style="font-weight: 700; font-size: 1.1rem; color: #059669;">${formatCurrency(Number(order.totalAmount) - depositAmount)}</span></div><div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;"><span style="color: #6b7280;">押金${isSetupIntentDeposit ? '（SetupIntent，不预扣）' : ' 预授权'}</span><span style="font-weight: 700; font-size: 1.1rem; color: #2563eb;">${formatCurrency(depositAmount)}</span></div>`}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">支付方式</span>
            <span style="font-weight: 500;">${escapeHtml(paymentMethodLabel)}</span>
          </div>
          ${refundStatusLabel ? `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff7ed; border-radius: 8px;"><span style="color: #6b7280;">退款状态</span><strong>${escapeHtml(refundStatusLabel)}</strong></div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">下单日期</span>
            <span style="font-weight: 500;">${formatMelbourneDateTime(order.createdAt)}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">关联信息</h3>
        </div>
        <div style="display: grid; gap: 16px;">
          <div style="padding: 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div>
                <div style="font-size: 0.85rem; color: #3b82f6; font-weight: 500;">客户信息</div>
                <div style="font-weight: 600;">${customer?.name || 'N/A'}</div>
              </div>
            </div>
            <a href="/admin/users/${customer?.id}" class="link-button" style="width: 100%; text-align: center; margin-top: 8px;">查看客户详情 →</a>
          </div>
          <div style="padding: 16px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div>
                <div style="font-size: 0.85rem; color: #16a34a; font-weight: 500;">租赁设备</div>
                <div style="font-weight: 600;">${device?.name || 'N/A'}</div>
              </div>
            </div>
            <a href="/admin/devices/${device?.id}/edit" class="link-button" style="width: 100%; text-align: center; margin-top: 8px;">查看/编辑设备 →</a>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">订单管理操作</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        ${canModifyOrder ? `<div style="padding:24px;background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:16px">
          <h4 style="margin:0 0 12px 0;color:#4338ca;display:flex;align-items:center;gap:8px">订单修改</h4>
          <p class="section-note">调整关键字段会记录到订单修改历史并写入审计日志；换机与改期会自动做库存冲突检查。</p>
          <form method="POST" action="/admin/orders/${order.id}/changes" class="js-order-change-form" style="display:flex;flex-direction:column;gap:12px">
            <div>
              <label class="form-label" for="changeType">修改类型</label>
              <select class="form-control" id="changeType" name="changeType" required>
                <option value="">请选择…</option>
                <option value="EXTENSION">调整租期</option>
                <option value="DEVICE_SWAP">更换设备</option>
                <option value="PRICE_ADJUSTMENT">调整价格 / 押金</option>
                <option value="LOCATION_CHANGE">修改取还地点</option>
                <option value="REFUND_METHOD">修改押金退款方式</option>
              </select>
            </div>
            <div class="order-change-fields" data-for="EXTENSION" hidden>
              <label class="form-label">起租日期</label>
              <input class="form-control" type="date" name="startDate" value="${escapeHtml(order.startDate)}">
              <label class="form-label">归还日期</label>
              <input class="form-control" type="date" name="endDate" value="${escapeHtml(order.endDate)}">
            </div>
            <div class="order-change-fields" data-for="DEVICE_SWAP" hidden>
              <label class="form-label">替换设备</label>
              <select class="form-control" name="deviceId">
                <option value="">请选择设备…</option>
                ${(swapDevices?.results || []).map((d: any) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name || d.id)}（${escapeHtml(d.status)}）</option>`).join('')}
              </select>
            </div>
            <div class="order-change-fields" data-for="PRICE_ADJUSTMENT" hidden>
              <label class="form-label">订单总额</label>
              <input class="form-control" type="number" min="0" step="0.01" name="totalAmount" value="${Number(order.totalAmount || 0)}">
              <label class="form-label">押金</label>
              <input class="form-control" type="number" min="0" step="0.01" name="depositAmount" value="${Number(order.depositAmount || 0)}">
              <label class="form-label">优惠金额</label>
              <input class="form-control" type="number" min="0" step="0.01" name="discountAmount" value="${Number((order as any).discount_amount || 0)}">
              <div style="margin-top:12px;padding:16px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border-radius:12px">
                <strong style="display:block;color:#c2410c;margin-bottom:6px">退款处理</strong>
                <label class="form-label" for="priceRefundMethod">降价退款方式</label>
                <select class="form-control" id="priceRefundMethod" name="priceRefundMethod">
                  <option value="balance" ${defaultPriceRefundMethod === 'balance' ? 'selected' : ''}>退回账户余额</option>
                  ${hasStripeRefundSource ? `<option value="original" ${defaultPriceRefundMethod === 'original' ? 'selected' : ''}>原路退回（Stripe 信用卡）</option>` : ''}
                  ${isTransferPayment ? `<option value="pending_deposit" ${defaultPriceRefundMethod === 'pending_deposit' ? 'selected' : ''}>并入后续押金退款</option>` : ''}
                </select>
              </div>
            </div>
            <div class="order-change-fields" data-for="LOCATION_CHANGE" hidden>
              <label class="form-label">配送方式</label>
              <select class="form-control" name="deliveryMethod">
                <option value="Pickup" ${String(order.deliveryMethod || 'Pickup') === 'Delivery' ? '' : 'selected'}>自取 Pickup</option>
                <option value="Delivery" ${String(order.deliveryMethod || 'Pickup') === 'Delivery' ? 'selected' : ''}>配送 Delivery</option>
              </select>
              <label class="form-label">取货地点</label>
              <input class="form-control" name="pickupLocation" maxlength="200" value="${escapeHtml(order.pickupLocation || '')}">
              <label class="form-label">归还地点</label>
            <input class="form-control" name="returnLocation" maxlength="200" value="${escapeHtml(order.returnLocation || '')}">
            </div>
            <div class="order-change-fields" data-for="REFUND_METHOD" hidden>
              <label class="form-label" for="orderRefundMethod">退款方式</label>
              <select class="form-control" id="orderRefundMethod" name="refundMethod">
                <option value="balance" ${order.refundMethod !== 'original' ? 'selected' : ''}>退回账户余额${customerRefundMethod === 'balance' ? '（当前选择）' : ''}</option>
              ${canRefundOriginal ? `<option value="original" ${order.refundMethod === 'original' ? 'selected' : ''}>原路退回${order.paymentMethod === 'bank_transfer' ? '（银行转账）' : ''}${customerRefundMethod === 'original' ? '（当前选择）' : ''}</option>` : ''}
              </select>
              ${order.paymentMethod === 'bank_transfer' ? `<div id="orderRefundBankFields" class="grid grid-3" style="margin-top:12px;" ${order.refundMethod === 'original' ? '' : 'hidden'}><div><label class="form-label">BSB</label><input class="form-control" name="refundBsb" value="${escapeHtml(order.refundBsb || '')}" placeholder="000-000"></div><div><label class="form-label">账号</label><input class="form-control" name="refundAccountNumber" value="${escapeHtml(order.refundAccountNumber || '')}"></div><div><label class="form-label">账户名</label><input class="form-control" name="refundAccountName" value="${escapeHtml(order.refundAccountName || '')}"></div></div>
              <script>document.getElementById('orderRefundMethod')?.addEventListener('change',e=>{document.getElementById('orderRefundBankFields').hidden=e.target.value!=='original'})</script>` : ''}
            </div>
            <div>
              <label class="form-label" for="orderChangeReason">修改原因（必填）</label>
              <textarea class="form-control" id="orderChangeReason" name="reason" maxlength="500" rows="2" required placeholder="例如：客户申请延长租期 3 天"></textarea>
            </div>
            <button type="submit" class="button button-primary">保存修改</button>
          </form>
          <script>(function(){var sel=document.getElementById('changeType');if(!sel)return;var form=sel.closest('form');function sync(){var groups=form.querySelectorAll('.order-change-fields');for(var i=0;i<groups.length;i++){groups[i].hidden=groups[i].getAttribute('data-for')!==sel.value;}}sel.addEventListener('change',sync);sync();})();</script>
        </div>` : ''}
        ${['active', 'extended', 'overdue', 'suspended', 'pending_return'].includes(String(order.status)) ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>设备归还</h4><p>${String(order.status) === 'pending_return' ? '客户已获批提前归还，请完成归还验机。' : order.early_return_requested_at ? '客户已申请提前归还，等待审批。' : '订单租赁中，可申请提前归还并安排验机。'}</p>${String(order.status) === 'active' && order.early_return_requested_at ? `<form method="post" action="/staff/orders/${order.id}/early-return/approve" data-site-confirm="确认批准客户提前归还吗？"><button class="button button-warning" type="submit">批准提前归还</button></form>` : ''}<a class="button button-info" href="/staff/orders/${order.id}/inspection" data-full-navigation="true">归还验机</a></div>` : ''}
        ${((order.paymentMethod === 'bank_transfer' || isSquareDepositProof || (isAdjustmentTransferProof && transferProofPaymentMethod === 'bank_transfer')) && (String(order.status) !== 'active' || transferProof?.status === 'submitted')) ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>${isSquareDepositProof ? '押金银行转账审核' : `银行转账审核${isAdjustmentTransferProof ? '（差价）' : ''}`}</h4>${transferProof ? `<p>Reference：<strong>${escapeHtml(transferProof.reference_number)}</strong></p>${isSquareDepositProof ? `<p>押金金额：<strong>AUD$ ${Number(transferProof.proof_deposit_amount || 0).toFixed(2)}</strong></p>` : ''}<p>备注：${escapeHtml(transferProof.note || '-')}</p>${proofImage ? `<a href="${escapeHtml(proofImage)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(proofImage)}" alt="转账凭证" loading="lazy" referrerpolicy="no-referrer" style="max-width:100%;max-height:320px;border-radius:8px"></a>` : '<p class="alert">凭证图片链接缺失或无效</p>'}<p>状态：${escapeHtml(transferProof.status)}</p>${transferProof.status === 'submitted' ? `<div style="display:flex;gap:10px"><form method="post" action="/admin/orders/${order.id}/transfer-proof/approve"><button class="button button-primary" type="submit">审核通过</button></form><form method="post" action="/admin/orders/${order.id}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" placeholder="驳回原因" required><button class="button button-danger" style="margin-top:6px">驳回</button></form></div>` : ''}` : '<p>客户尚未提交转账 Reference。</p>'}</div>` : ''}
        ${(isAdjustmentTransferProof && ['alipay', 'wechat'].includes(transferProofPaymentMethod) || ['alipay', 'wechat'].includes(String(order.paymentMethod))) ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>${(isAdjustmentTransferProof ? transferProofPaymentMethod : order.paymentMethod) === 'alipay' ? '支付宝' : '微信'}付款审核${isAdjustmentTransferProof ? '（差价）' : ''}</h4>${transferProof ? `<p>Reference：<strong>${escapeHtml(transferProof.reference_number)}</strong></p><p>状态：${escapeHtml(transferProof.status)}</p>${transferProof.status === 'submitted' ? `<div style="display:flex;gap:10px"><form method="post" action="/admin/orders/${order.id}/transfer-proof/approve"><button class="button button-primary" type="submit">审核通过</button></form><form method="post" action="/admin/orders/${order.id}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" placeholder="驳回原因" required><button class="button button-danger" type="submit">驳回</button></form></div>` : ''}` : '<p>客户尚未提交付款凭证。</p>'}</div>` : ''}
        ${isSquarePayment && String(order.status) === 'pending_payment' ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>Square 礼品卡支付</h4><p>客户完成合同签署后，通过订单详情页的 Square Gift Card 安全组件支付租金及服务费。</p></div>` : ''}
        ${isCardPayment && String(order.status) === 'pending_payment' ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>Stripe 信用卡支付</h4><p>客户完成合同签署后，通过订单详情页的 Stripe 安全支付组件支付租金及服务费。银行卡信息不会保存到本站。</p></div>` : ''}
        <div style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">更新订单状态</h4>
          <form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form" id="orderStatusForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="status" style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">选择新状态</label>
              <select id="status" name="status" style="width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                ${order.status === 'suspended' ? '<option value="active">恢复租赁</option>' : '<option value="suspended">暂停租赁（仅管理员）</option>'}
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>已取消</option>
              </select>
            </div>
            <div id="statusReasonGroup" hidden>
              <label class="form-label" for="statusReasonPreset">常见原因</label>
              <select class="form-control" id="statusReasonPreset">
                <option value="">-- 选择常见原因（可选） --</option>
                <option value="设备无货">设备无货</option>
                <option value="订单金额错误">订单金额错误</option>
                <option value="客户申请">客户申请</option>
                <option value="__custom__">其他（请在下方填写）</option>
              </select>
              <label class="form-label" for="statusReason" style="margin-top: 10px;">暂停/取消原因（必填，将随通知发送给客户）</label>
              <textarea class="form-control" id="statusReason" name="reason" maxlength="300" rows="2" placeholder="请输入暂停/取消原因"></textarea>
            </div>
            <button type="submit" class="button button-primary" style="padding: 14px; border-radius: 12px; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">更新状态</button>
          </form>
          <script>(function(){
            var form = document.getElementById('orderStatusForm');
            if (!form) return;
            var statusSelect = form.querySelector('#status');
            var reasonGroup = form.querySelector('#statusReasonGroup');
            var reasonPreset = form.querySelector('#statusReasonPreset');
            var reasonText = form.querySelector('#statusReason');
            function sync() {
              var needsReason = statusSelect.value === 'suspended' || statusSelect.value === 'cancelled';
              reasonGroup.hidden = !needsReason;
              reasonText.required = needsReason;
            }
            statusSelect.addEventListener('change', sync);
            reasonPreset.addEventListener('change', function () {
              if (!reasonPreset.value) return;
              if (reasonPreset.value === '__custom__') { reasonText.value = ''; reasonText.focus(); return; }
              reasonText.value = reasonPreset.value;
            });
            sync();
          })();</script>
          ${['active', 'pending_return'].includes(String(order.status)) ? `<form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form force-complete-form" data-force-confirm="true" style="margin-top: 12px;">
            <input type="hidden" name="status" value="completed">
            <input type="hidden" name="force" value="1">
            <button type="submit" class="button button-warning" style="width: 100%;">强制标记为已完成</button>
            <small class="form-text">跳过归还验机，仅在设备已实际归还但无法完成验机时使用。</small>
          </form>` : ''}
        </div>

        ${showRefundCard ? `<div style="padding: 24px; background: linear-gradient(135deg, #fef7ed 0%, #feedd9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #c2410c;">退款处理</h4>
          ${hasTransferPriceRefund ? `<div class="alert"><strong>转账类付款待退差价：${formatCurrency(pendingPriceRefund)}</strong><br>该金额将在本次押金退款中一并退还；押金可退 ${formatCurrency(remainingDepositRefund)}，本次最多合计 ${formatCurrency(remainingRefundTotal)}。</div>` : ''}
          ${completedRefund?.status === 'succeeded' ? `<div class="alert">已通过${completedRefund.refund_method === 'stripe' ? 'Stripe' : completedRefund.refund_method === 'bank_transfer' ? '银行转账' : '账户余额'}处理${completedRefund.type === 'deposit' ? '押金' : '全额取消'}退款：${formatCurrency(completedRefund.refund_amount)}${Number(completedRefund.refunded_processing_fee || 0) ? `，另退押金对应手续费 ${formatCurrency(completedRefund.refunded_processing_fee)}` : ''}${completedRefund.deduction_amount ? `，扣除 ${formatCurrency(completedRefund.deduction_amount)}（${escapeHtml(completedRefund.deduction_reason)}）` : ''}</div>` : ''}
          ${depositSettlement && completedRefund?.status !== 'succeeded' ? `<div class="alert">结算单 ${escapeHtml(depositSettlement.settlement_number)}：${escapeHtml(depositSettlement.status)}${depositSettlement.review_note ? ` · ${escapeHtml(depositSettlement.review_note)}` : ''}</div>` : ''}
          ${canSettleDeposit ? `<form method="POST" action="/admin/orders/${order.id}/${depositSettlement?.status === 'APPROVED' ? 'deposit-refund' : 'deposit-settlements'}" onsubmit="return confirm('${depositSettlement?.status === 'APPROVED' ? '确认按已批准结算单执行本次押金结算吗？' : '确认提交本次押金结算供 Manager 审批吗？'}');">
            ${isSetupIntentDeposit ? `<input type="hidden" name="refundMethod" value="original"><p class="section-note">长期租赁：押金未预扣。无损坏或逾期时填 0；只有发生实际费用时才从已保存卡片扣款。</p>` : `<label class="form-label" for="refundMethod">退款方式</label>
            <select class="form-control" id="refundMethod" name="refundMethod" required>
              <option value="balance" ${order.refundMethod !== 'original' ? 'selected' : ''}>退回账户余额${customerRefundMethod === 'balance' ? '（当前选择）' : ''}</option>
              ${canRefundOriginal ? `<option value="original" ${order.refundMethod === 'original' && order.paymentMethod !== 'bank_transfer' ? 'selected' : ''}>原路退回${customerRefundMethod === 'original' ? '（当前选择）' : ''}</option>` : ''}
              ${!isSquarePayment ? `<option value="bank_transfer" ${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? 'selected' : ''}>银行转账${customerRefundMethod === 'bank_transfer' ? '（当前选择）' : ''}</option>` : ''}
            </select>
            <div id="refundBankFields" class="grid grid-3" style="margin-top:12px;" ${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '' : 'hidden'}><div><label class="form-label">BSB</label><input class="form-control" name="refundBsb" value="${escapeHtml(order.refundBsb || '')}" placeholder="000-000"></div><div><label class="form-label">账号</label><input class="form-control" name="refundAccountNumber" value="${escapeHtml(order.refundAccountNumber || '')}"></div><div><label class="form-label">账户名</label><input class="form-control" name="refundAccountName" value="${escapeHtml(order.refundAccountName || '')}"></div></div>
            <script>document.getElementById('refundMethod')?.addEventListener('change',e=>{document.getElementById('refundBankFields').hidden=e.target.value!=='bank_transfer'})</script>`}
            <label class="form-label" for="refundItem">退款项目</label>
            <select class="form-control" id="refundItem" name="refundItem" required onchange="document.getElementById('customRefundItem').hidden=this.value!=='other';document.getElementById('customRefundItem').required=this.value==='other';">
              <option value="deposit">押金退款</option>
              <option value="other">其他退款项目</option>
            </select>
            <input class="form-control" id="customRefundItem" name="customRefundItem" maxlength="100" placeholder="请输入退款项目名称" hidden>
            ${isSetupIntentDeposit ? `<label class="form-label" for="deductionAmount">本次实际扣款金额（押金额度 ${formatCurrency(depositAmount)}）</label><input class="form-control" id="deductionAmount" name="deductionAmount" type="number" min="0" max="${depositAmount}" step="0.01" value="${Number(depositSettlement?.deduction_amount || 0)}" required>` : `<label class="form-label" for="refundAmount">本次退款合计（押金 + 差价，最多 ${formatCurrency(remainingRefundTotal)}）</label>
            <input class="form-control" id="refundAmount" name="refundAmount" type="number" min="0" max="${remainingRefundTotal}" step="0.01" value="${Math.min(Number(depositSettlement?.refund_amount ?? remainingRefundTotal), remainingRefundTotal)}" required>`}
            <label class="form-label" for="deductionReason">扣款原因（发生损坏或逾期时必填）</label>
            <select class="form-control" id="deductionCategory" name="deductionCategory">
              <option value="">无扣款</option><option value="DAMAGE" ${depositSettlement?.deduction_category === 'DAMAGE' ? 'selected' : ''}>设备损坏</option><option value="MISSING_ACCESSORY" ${depositSettlement?.deduction_category === 'MISSING_ACCESSORY' ? 'selected' : ''}>配件遗失</option><option value="LATE_FEE" ${depositSettlement?.deduction_category === 'LATE_FEE' ? 'selected' : ''}>逾期费用</option><option value="DEVICE_NOT_RETURNED" ${depositSettlement?.deduction_category === 'DEVICE_NOT_RETURNED' ? 'selected' : ''}>设备未归还</option><option value="OTHER" ${depositSettlement?.deduction_category === 'OTHER' ? 'selected' : ''}>其他</option>
            </select>
            <textarea class="form-control" id="deductionReason" name="deductionReason">${escapeHtml(depositSettlement?.status === 'APPROVED' ? depositSettlement.deduction_reason || '' : '')}</textarea>
            <button type="submit" class="button button-warning" style="margin-top:12px;">${depositSettlement?.status === 'APPROVED' ? '执行已批准结算' : '提交结算审批'}</button>
          </form>` : ''}
          ${canCancelBeforeHandover && !completedRefund ? `<form method="POST" action="/admin/orders/${order.id}/cancel-and-refund" onsubmit="return confirm('确定取消订单并全额退还 ${formatCurrency(order.totalAmount)} 吗？');">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '<div class="alert">请先完成银行转账，再确认取消订单。</div>' : ''}<button type="submit" class="button button-danger">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '确认已转账并取消订单' : '取消并全额退款'}</button></form>` : ''}
        </div>` : ''}
      </div>
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
        <a href="/admin/orders" class="button button-secondary" style="padding: 12px 32px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">← 返回订单列表</a>
        <form method="POST" action="/admin/orders/${order.id}/delete" onsubmit="return confirm('删除订单是不可恢复的操作。确定要删除此订单吗？');">
          <button type="submit" class="button button-danger" style="padding: 12px 32px; border-radius: 10px;">删除订单</button>
        </form>
      </div>
    </div>
  `;

  return buildLayout('订单详情 - 电脑租赁管理系统', body + renderOrderStatusFeedback(), user);
}
