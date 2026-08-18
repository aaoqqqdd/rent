/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getUserById, getDeviceById, getContractByOrderId, formatCurrency, validateHostedImageUrls, isContractFinalized } from '../../site';
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

  const [customer, device, contract, completedRefund, transferProof, statusHistory, depositSettlement] = await Promise.all([
    getUserById(c, order.userId), getDeviceById(c, order.deviceId), getContractByOrderId(c, order.id),
    c.env.RENT.prepare("SELECT type, status, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_reason, refund_method, refund_bsb, refund_account_number, refund_account_name FROM payment_refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare("SELECT pp.* FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare('SELECT old_status, new_status, trigger_type, triggered_by, reason, created_at FROM rental_status_history WHERE rental_id = ? ORDER BY created_at DESC LIMIT 20').bind(order.id).all(),
    c.env.RENT.prepare('SELECT * FROM deposit_settlements WHERE order_id = ? ORDER BY requested_at DESC LIMIT 1').bind(order.id).first()
  ]) as any[];
  let proofImage = ''
  try { proofImage = transferProof?.image_url ? validateHostedImageUrls(transferProof.image_url, 1)[0] : '' } catch { }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

  const statusLabels: Record<string, { label: string, color: string, bg: string, icon: string }> = {
    'pending': { label: '待处理', color: '#d97706', bg: '#fef3c7', icon: '⏳' },
    'pending_payment': { label: '待付款', color: '#d97706', bg: '#fef3c7', icon: '⏳' },
    'awaiting_signature': { label: '待签合同', color: '#7c3aed', bg: '#ede9fe', icon: '✍️' },
    'paid': { label: '租赁已确认，等待开始', color: '#059669', bg: '#d1fae5', icon: '💳' },
    'approved': { label: '租赁已确认，等待开始', color: '#059669', bg: '#d1fae5', icon: '✅' },
    'pending_pickup': { label: '待取货', color: '#0891b2', bg: '#cffafe', icon: '📦' },
    'active': { label: '租赁中', color: '#2563eb', bg: '#dbeafe', icon: '📦' },
    'extended': { label: '已延期 / 租赁中', color: '#2563eb', bg: '#dbeafe', icon: '🔁' },
    'overdue': { label: '已逾期', color: '#dc2626', bg: '#fee2e2', icon: '⚠️' },
    'suspended': { label: '已暂停', color: '#6b7280', bg: '#f3f4f6', icon: '⏸️' },
    'pending_return': { label: '待归还', color: '#d97706', bg: '#fef3c7', icon: '↩️' },
    'returned': { label: '已归还', color: '#0891b2', bg: '#cffafe', icon: '📥' },
    'completed': { label: '已完成', color: '#0891b2', bg: '#cffafe', icon: '✅' },
    'cancelled': { label: '已取消', color: '#dc2626', bg: '#fee2e2', icon: '❌' }
  };
  const currentStatus = statusLabels[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6', icon: '❓' };
  const refundStatusLabel = completedRefund?.status === 'pending' ? 'REFUND_PENDING: 退款处理中' : completedRefund?.status === 'succeeded' ? (Number(completedRefund.refund_amount || 0) < Number(completedRefund.refundable_amount || completedRefund.refund_amount || 0) ? 'PARTIALLY_REFUNDED: 部分退款' : 'REFUNDED: 已退款') : '';

  const body = `
    <div class="panel hero order-detail-shell admin-order-detail" style="padding: 32px; margin-bottom: 24px;">
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

    <div class="order-detail-actions">
      ${['paid', 'active', 'completed', 'pending_return'].includes(String(order.status)) ? `<a class="button button-secondary" href="/orders/${order.id}/invoice">查看发票 / 收据</a>` : ''}
      ${['paid', 'pending_pickup'].includes(String(order.status)) ? `<form method="post" action="/staff/orders/${order.id}/pickup" style="display:inline" data-site-confirm="确认设备已经实际交付给客户吗？确认后订单将进入租赁中。"><button class="button button-primary" type="submit">确认设备已交付</button></form>` : ''}
      ${contract && isContractFinalized(contract) ? `<a class="button button-secondary" href="/contract/view/${contract.id}?from=order">查看合同</a>` : ''}
    </div>
    ${statusHistory?.results?.length ? `<section class="panel" style="margin: 0 0 24px;"><div class="section-title"><h3>租赁状态历史</h3><span class="section-note">最近 ${statusHistory.results.length} 条</span></div><div class="table-wrapper"><table><thead><tr><th>时间</th><th>状态变化</th><th>触发方式</th><th>原因</th></tr></thead><tbody>${statusHistory.results.map((item: any) => `<tr><td class="mono">${escapeHtml(item.created_at)}</td><td>${escapeHtml(item.old_status || '—')} → <strong>${escapeHtml(item.new_status)}</strong></td><td>${escapeHtml(item.trigger_type)}${item.triggered_by ? ` · ${escapeHtml(item.triggered_by)}` : ''}</td><td>${escapeHtml(item.reason || '—')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
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
          ${refundStatusLabel ? `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff7ed; border-radius: 8px;"><span style="color: #6b7280;">退款状态</span><strong>${escapeHtml(refundStatusLabel)}</strong></div>` : ''}
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
        ${['active', 'pending_return'].includes(String(order.status)) ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>设备归还</h4><p>${String(order.status) === 'pending_return' ? '客户已获批提前归还，请完成归还验机。' : order.early_return_requested_at ? '客户已申请提前归还，等待审批。' : '订单租赁中，可申请提前归还并安排验机。'}</p>${String(order.status) === 'active' && order.early_return_requested_at ? `<form method="post" action="/staff/orders/${order.id}/early-return/approve" data-site-confirm="确认批准客户提前归还吗？"><button class="button button-warning" type="submit">批准提前归还</button></form>` : ''}${String(order.status) === 'pending_return' ? `<a class="button button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>` : ''}</div>` : ''}
        ${order.paymentMethod === 'bank_transfer' && String(order.status) !== 'active' ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>银行转账审核</h4>${transferProof ? `<p>Reference：<strong>${escapeHtml(transferProof.reference_number)}</strong></p><p>备注：${escapeHtml(transferProof.note || '-')}</p>${proofImage ? `<a href="${escapeHtml(proofImage)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(proofImage)}" alt="转账凭证" loading="lazy" referrerpolicy="no-referrer" style="max-width:100%;max-height:320px;border-radius:8px"></a>` : '<p class="alert">凭证图片链接缺失或无效</p>'}<p>状态：${escapeHtml(transferProof.status)}</p>${transferProof.status === 'submitted' ? `<div style="display:flex;gap:10px"><form method="post" action="/admin/orders/${order.id}/transfer-proof/approve"><button class="button button-primary" type="submit">审核通过</button></form><form method="post" action="/admin/orders/${order.id}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" placeholder="驳回原因" required><button class="button button-danger" type="submit">驳回</button></form></div>` : ''}` : '<p>客户尚未提交转账 Reference。</p>'}</div>` : ''}
        ${['alipay', 'wechat'].includes(String(order.paymentMethod)) ? `<div style="padding:24px;background:#eff6ff;border-radius:16px"><h4>${order.paymentMethod === 'alipay' ? '支付宝' : '微信'}付款审核</h4>${transferProof ? `<p>Reference：<strong>${escapeHtml(transferProof.reference_number)}</strong></p><p>状态：${escapeHtml(transferProof.status)}</p>${transferProof.status === 'submitted' ? `<div style="display:flex;gap:10px"><form method="post" action="/admin/orders/${order.id}/transfer-proof/approve"><button class="button button-primary" type="submit">审核通过</button></form><form method="post" action="/admin/orders/${order.id}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" placeholder="驳回原因" required><button class="button button-danger" type="submit">驳回</button></form></div>` : ''}` : '<p>客户尚未提交付款凭证。</p>'}</div>` : ''}
        <div style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">🔄 更新订单状态</h4>
          <form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="status" style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">选择新状态</label>
              <select id="status" name="status" style="width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                <option value="suspended" ${order.status === 'suspended' ? 'selected' : ''}>已暂停（仅管理员）</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>已取消</option>
              </select>
            </div>
            <button type="submit" class="button button-primary" style="padding: 14px; border-radius: 12px; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">💾 更新状态</button>
          </form>
          ${['active', 'pending_return'].includes(String(order.status)) ? `<form method="POST" action="/admin/orders/${order.id}/update" class="js-order-status-form force-complete-form" data-force-confirm="true" style="margin-top: 12px;">
            <input type="hidden" name="status" value="completed">
            <input type="hidden" name="force" value="1">
            <button type="submit" class="button button-warning" style="width: 100%;">⚠️ 强制标记为已完成</button>
            <small class="form-text">跳过归还验机，仅在设备已实际归还但无法完成验机时使用。</small>
          </form>` : ''}
        </div>

        <div style="padding: 24px; background: linear-gradient(135deg, #fef7ed 0%, #feedd9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #c2410c;">💸 退款处理</h4>
          <p class="section-note">管理员可选择本次退款方式，提交后按所选方式处理。</p>
          ${completedRefund?.status === 'succeeded' ? `<div class="alert">已通过${completedRefund.refund_method === 'stripe' ? 'Stripe' : completedRefund.refund_method === 'bank_transfer' ? '银行转账' : '账户余额'}处理${completedRefund.type === 'deposit' ? '押金' : '全额取消'}退款：${formatCurrency(completedRefund.refund_amount)}${Number(completedRefund.refunded_processing_fee || 0) ? `，另退押金对应手续费 ${formatCurrency(completedRefund.refunded_processing_fee)}` : ''}${completedRefund.deduction_amount ? `，扣除 ${formatCurrency(completedRefund.deduction_amount)}（${escapeHtml(completedRefund.deduction_reason)}）` : ''}</div>` : ''}
          ${depositSettlement && completedRefund?.status !== 'succeeded' ? `<div class="alert">结算单 ${escapeHtml(depositSettlement.settlement_number)}：${escapeHtml(depositSettlement.status)}${depositSettlement.review_note ? ` · ${escapeHtml(depositSettlement.review_note)}` : ''}</div>` : ''}
          ${order.status === 'completed' && completedRefund?.status !== 'succeeded' && (!depositSettlement || depositSettlement.status === 'REJECTED' || depositSettlement.status === 'APPROVED') ? `<form method="POST" action="/admin/orders/${order.id}/${depositSettlement?.status === 'APPROVED' ? 'deposit-refund' : 'deposit-settlements'}" onsubmit="return confirm('${depositSettlement?.status === 'APPROVED' ? '确认按已批准结算单执行本次押金退款吗？' : '确认提交本次押金结算供 Manager 审批吗？'}');">
            <label class="form-label" for="refundMethod">退款方式</label>
            <select class="form-control" id="refundMethod" name="refundMethod" required>
              <option value="balance" ${order.refundMethod !== 'original' ? 'selected' : ''}>退回账户余额</option>
              <option value="original" ${order.refundMethod === 'original' && order.paymentMethod !== 'bank_transfer' ? 'selected' : ''}>原路退回</option>
              <option value="bank_transfer" ${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? 'selected' : ''}>银行转账</option>
            </select>
            <div id="refundBankFields" class="grid grid-3" style="margin-top:12px;" ${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '' : 'hidden'}><div><label class="form-label">BSB</label><input class="form-control" name="refundBsb" value="${escapeHtml(order.refundBsb || '')}" placeholder="000-000"></div><div><label class="form-label">账号</label><input class="form-control" name="refundAccountNumber" value="${escapeHtml(order.refundAccountNumber || '')}"></div><div><label class="form-label">账户名</label><input class="form-control" name="refundAccountName" value="${escapeHtml(order.refundAccountName || '')}"></div></div>
            <script>document.getElementById('refundMethod')?.addEventListener('change',e=>{document.getElementById('refundBankFields').hidden=e.target.value!=='bank_transfer'})</script>
            <label class="form-label" for="refundItem">退款项目</label>
            <select class="form-control" id="refundItem" name="refundItem" required onchange="document.getElementById('customRefundItem').hidden=this.value!=='other';document.getElementById('customRefundItem').required=this.value==='other';">
              <option value="deposit">押金退款</option>
              <option value="other">其他退款项目</option>
            </select>
            <input class="form-control" id="customRefundItem" name="customRefundItem" maxlength="100" placeholder="请输入退款项目名称" hidden>
            <label class="form-label" for="refundAmount">退款金额（最多 ${formatCurrency(order.totalAmount)}）</label>
            <input class="form-control" id="refundAmount" name="refundAmount" type="number" min="0" max="${order.depositAmount}" step="0.01" value="${depositSettlement?.status === 'APPROVED' ? depositSettlement.refund_amount : order.depositAmount}" required>
            <label class="form-label" for="deductionReason">扣款原因（未全额退还时必填）</label>
            <select class="form-control" id="deductionCategory" name="deductionCategory">
              <option value="">无扣款</option><option value="DAMAGE" ${depositSettlement?.deduction_category === 'DAMAGE' ? 'selected' : ''}>设备损坏</option><option value="MISSING_ACCESSORY" ${depositSettlement?.deduction_category === 'MISSING_ACCESSORY' ? 'selected' : ''}>配件遗失</option><option value="LATE_FEE" ${depositSettlement?.deduction_category === 'LATE_FEE' ? 'selected' : ''}>逾期费用</option><option value="DEVICE_NOT_RETURNED" ${depositSettlement?.deduction_category === 'DEVICE_NOT_RETURNED' ? 'selected' : ''}>设备未归还</option><option value="OTHER" ${depositSettlement?.deduction_category === 'OTHER' ? 'selected' : ''}>其他</option>
            </select>
            <textarea class="form-control" id="deductionReason" name="deductionReason">${escapeHtml(depositSettlement?.status === 'APPROVED' ? depositSettlement.deduction_reason || '' : '')}</textarea>
            <button type="submit" class="button button-warning" style="margin-top:12px;">${depositSettlement?.status === 'APPROVED' ? '执行已批准结算' : '提交结算审批'}</button>
          </form>` : ''}
          ${order.status === 'paid' && order.startDate > today && !completedRefund ? `<form method="POST" action="/admin/orders/${order.id}/cancel-and-refund" onsubmit="return confirm('确定取消订单并全额退还 ${formatCurrency(order.totalAmount)} 吗？');">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '<div class="alert">请先完成银行转账，再确认取消订单。</div>' : ''}<button type="submit" class="button button-danger">${order.refundMethod === 'original' && order.paymentMethod === 'bank_transfer' ? '确认已转账并取消订单' : '取消并全额退款'}</button></form>` : ''}
        </div>
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
