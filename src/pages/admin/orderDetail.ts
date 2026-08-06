/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency, validateHostedImageUrls } from '../../site';
import { Context } from 'hono';
import { renderOrderStatusFeedback } from './orderStatusFeedback';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
}

export async function renderAdminOrderDetail(c: Context, user: any, orderId: string) {
  const order = await getOrderById(c, orderId);

  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user);
  }

  const customer = await getUserById(c, order.userId);
  const device = await getDeviceById(c, order.deviceId);
  const completedRefund = await c.env.RENT.prepare("SELECT type, refund_amount, refunded_processing_fee, deduction_amount, deduction_reason, refund_method, refund_bsb, refund_account_number, refund_account_name FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any;
  const transferProof = await c.env.RENT.prepare("SELECT pp.* FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() as any;
  let proofImage = ''
  try { proofImage = transferProof?.image_url ? validateHostedImageUrls(transferProof.image_url, 1)[0] : '' } catch {}
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

  const statusLabels: Record<string, {label: string, color: string, bg: string, icon: string}> = {
    'pending_payment': { label: '待付款', color: '#d97706', bg: '#fef3c7', icon: '⏳' },
    'paid': { label: '已付款', color: '#059669', bg: '#d1fae5', icon: '💳' },
    'active': { label: '租赁中', color: '#2563eb', bg: '#dbeafe', icon: '📦' },
    'completed': { label: '已完成', color: '#0891b2', bg: '#cffafe', icon: '✅' },
    'cancelled': { label: '已取消', color: '#dc2626', bg: '#fee2e2', icon: '❌' }
  };
  const currentStatus = statusLabels[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6', icon: '❓' };
  
  const body = `
    <div class="panel hero" style="padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">📋</div>
          <div>
            <h2 style="margin: 0 0 8px 0;">订单详情 - ${order.orderNo}</h2>
            <p style="margin: 0; opacity: 0.9;">查看和管理订单的详细信息</p>
          </div>
        </div>
        <span style="padding: 10px 20px; border-radius: 9999px; font-weight: 600; font-size: 1rem; background: ${currentStatus.bg}; color: ${currentStatus.color}; display: inline-flex; align-items: center; gap: 8px;">${currentStatus.icon} ${currentStatus.label}</span>
      </div>
    </div>

    ${['paid','active','completed'].includes(order.status) ? `<p><a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / Credit Note</a></p>` : ''}
    <div class="grid grid-2" style="gap: 24px; margin-bottom: 24px;">
      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">📦 订单基本信息</h3>
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
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">总金额</span>
            <span style="font-weight: 700; font-size: 1.1rem; color: #059669;">${formatCurrency(order.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">支付方式</span>
            <span style="font-weight: 500;">${order.paymentMethod || 'N/A'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">下单日期</span>
            <span style="font-weight: 500;">${order.createdAt}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">🔗 关联信息</h3>
        </div>
        <div style="display: grid; gap: 16px;">
          <div style="padding: 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="width: 40px; height: 40px; background: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</span>
              <div>
                <div style="font-size: 0.85rem; color: #3b82f6; font-weight: 500;">客户信息</div>
                <div style="font-weight: 600;">${customer?.name || 'N/A'}</div>
              </div>
            </div>
            <a href="/admin/users/${customer?.id}" class="link-button" style="width: 100%; text-align: center; margin-top: 8px;">查看客户详情 →</a>
          </div>
          <div style="padding: 16px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="width: 40px; height: 40px; background: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💻</span>
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
        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">⚙️ 订单管理操作</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        ${order.paymentMethod === 'bank_transfer' ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>银行转账审核</h4>${transferProof ? `<p>Reference：<strong>${escapeHtml(transferProof.reference_number)}</strong></p><p>备注：${escapeHtml(transferProof.note || '-')}</p>${proofImage ? `<a href="${escapeHtml(proofImage)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(proofImage)}" alt="转账凭证" loading="lazy" referrerpolicy="no-referrer" style="max-width:100%;max-height:320px;border-radius:8px"></a>` : '<p class="alert">凭证图片链接缺失或无效</p>'}<p>状态：${escapeHtml(transferProof.status)}</p>${transferProof.status === 'submitted' ? `<div style="display:flex;gap:10px"><form method="post" action="/admin/orders/${order.id}/transfer-proof/approve"><button class="button button-primary" type="submit">审核通过</button></form><form method="post" action="/admin/orders/${order.id}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" placeholder="驳回原因" required><button class="button button-danger" type="submit">驳回</button></form></div>` : ''}` : '<p>客户尚未提交转账 Reference。</p>'}</div>` : ''}
        <div style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">🔄 更新订单状态</h4>
          <form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="status" style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">选择新状态</label>
              <select id="status" name="status" style="width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>⏳ 待付款</option>
                <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>💳 已付款</option>
                <option value="active" ${order.status === 'active' ? 'selected' : ''}>📦 租赁中</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ 已完成</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ 已取消</option>
              </select>
            </div>
            <button type="submit" class="button button-primary" style="padding: 14px; border-radius: 12px; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">💾 更新状态</button>
          </form>
        </div>

        <div style="padding: 24px; background: linear-gradient(135deg, #fef7ed 0%, #feedd9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #c2410c;">💸 退款处理</h4>
          <p class="section-note">客户选择：${order.refundMethod === 'original' ? `原路退回${order.paymentMethod === 'bank_transfer' ? `（${escapeHtml(order.refundAccountName)} / ${escapeHtml(order.refundBsb)} / ${escapeHtml(order.refundAccountNumber)}）` : ''}` : '退回账户余额'}</p>
          ${completedRefund ? `<div class="alert">已通过${completedRefund.refund_method === 'stripe' ? 'Stripe' : completedRefund.refund_method === 'bank_transfer' ? '银行转账' : '账户余额'}处理${completedRefund.type === 'deposit' ? '押金' : '全额取消'}退款：${formatCurrency(completedRefund.refund_amount)}${Number(completedRefund.refunded_processing_fee || 0) ? `，另退押金对应手续费 ${formatCurrency(completedRefund.refunded_processing_fee)}` : ''}${completedRefund.deduction_amount ? `，扣除 ${formatCurrency(completedRefund.deduction_amount)}（${escapeHtml(completedRefund.deduction_reason)}）` : ''}</div>` : ''}
          ${order.status === 'completed' && !completedRefund ? `<form method="POST" action="/admin/orders/${order.id}/deposit-refund" onsubmit="return confirm('确定提交本次押金处理吗？每笔订单只能处理一次。');">
            ${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '<div class="alert">请先按上方账户信息完成银行转账，再确认本操作。</div>' : ''}
            <label class="form-label" for="refundAmount">退还押金金额（最多 ${formatCurrency(order.depositAmount)}）</label>
            <input class="form-control" id="refundAmount" name="refundAmount" type="number" min="0" max="${order.depositAmount}" step="0.01" value="${order.depositAmount}" required>
            <label class="form-label" for="deductionReason">扣款原因（未全额退还时必填）</label>
            <textarea class="form-control" id="deductionReason" name="deductionReason"></textarea>
            <button type="submit" class="button button-warning" style="margin-top:12px;">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '确认已转账并处理押金' : '处理押金'}</button>
          </form>` : ''}
          ${order.status === 'paid' && order.startDate > today && !completedRefund ? `<form method="POST" action="/admin/orders/${order.id}/cancel-and-refund" onsubmit="return confirm('确定取消订单并全额退还 ${formatCurrency(order.totalAmount)} 吗？');">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '<div class="alert">请先完成银行转账，再确认取消订单。</div>' : ''}<button type="submit" class="button button-danger">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '确认已转账并取消订单' : '取消并全额退款'}</button></form>` : ''}
        </div>
      </div>
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="/admin/orders" class="button button-secondary" style="padding: 12px 32px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">← 返回订单列表</a>
      </div>
    </div>
  `;

  return buildLayout('订单详情 - 电脑租赁管理系统', body + renderOrderStatusFeedback(), user);
}
