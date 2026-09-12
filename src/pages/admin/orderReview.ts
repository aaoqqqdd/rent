/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, formatMelbourneDateTime } from '../../site'
import type { Context } from 'hono'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))

export async function renderAdminOrderReview(c: Context, user: any) {
  const rows = ((await c.env.RENT.prepare(`
    SELECT o.id, o.orderNo, o.startDate, o.endDate, o.totalAmount, o.depositAmount, o.createdAt,
           o.deliveryMethod, o.deliveryFee, o.rentalNote, u.name AS customerName, u.email AS customerEmail,
           u.account_type AS accountType, d.name AS deviceName, d.category AS deviceCategory
    FROM orders o
    LEFT JOIN users u ON u.id = o.userId
    LEFT JOIN devices d ON d.id = o.deviceId
    WHERE o.status = 'pending_approval'
    ORDER BY datetime(o.createdAt) ASC
  `).all()).results || []) as any[]

  const body = `<div class="page-header"><div><p class="section-code">ORDER REVIEW / WEBSITE</p><h2>网站订单审核</h2><p>数据直接来自 D1 的 orders 表，显示所有状态为“待审核”的订单。通过后进入合同与付款流程，拒绝后订单会取消。</p></div><a class="button button-secondary" href="/admin/orders">全部订单</a></div>
    <div class="stats-grid"><div class="stat-card ${rows.length ? 'warning' : ''}"><h3>待审核订单</h3><div class="value">${rows.length}</div><div class="trend">按提交时间从早到晚排列</div></div></div>
    <section class="panel"><div class="section-title"><h3>审核队列</h3><span class="section-note">请确认租期、设备档期和客户备注后处理；送货订单必须填写配送费</span></div>
      ${rows.length ? `<div class="table-wrapper"><table><thead><tr><th>订单 / 客户</th><th>设备</th><th>租期</th><th>金额</th><th>申请时间</th><th>操作</th></tr></thead><tbody>${rows.map(order => {
        const delivery = String(order.deliveryMethod || 'Pickup') === 'Delivery'
        return `<tr>
        <td><strong>${esc(order.customerName || '未知客户')}</strong><br><small>${esc(order.customerEmail || '')}${order.accountType === 'guest' ? ' · 临时账户' : ''}</small><br><a class="link-button" href="/admin/orders/${encodeURIComponent(order.id)}">查看订单详情</a></td>
        <td>${esc(order.deviceName || '未知设备')}<br><small>${esc(order.deviceCategory || '其他')}</small></td>
        <td>${esc(order.startDate)} 至 ${esc(order.endDate)}</td>
        <td><strong>${formatCurrency(order.totalAmount)}</strong><br><small>押金 ${formatCurrency(order.depositAmount)}</small>${delivery ? `<br><small>配送费 ${formatCurrency(order.deliveryFee)}</small>` : ''}</td>
        <td>${esc(formatMelbourneDateTime(order.createdAt))}</td>
        <td><div class="record-actions"><form method="post" action="/staff/orders/${encodeURIComponent(order.id)}/approve" class="website-order-approval-form" data-site-confirm="确认通过这笔网站租赁申请吗？"><label class="form-label">交付方式</label><select name="deliveryMethod" class="form-control"><option value="Pickup" ${delivery ? '' : 'selected'}>客户自取</option><option value="Delivery" ${delivery ? 'selected' : ''}>送货上门</option></select><div data-delivery-fee-field ${delivery ? '' : 'hidden'}><label class="form-label">配送费（AUD）</label><input name="deliveryFee" class="form-control" type="number" min="0" step="0.01" value="${Number(order.deliveryFee || 0).toFixed(2)}" ${delivery ? 'required' : 'disabled'} placeholder="请输入配送费"></div><button class="button button-sm button-primary" type="submit">审核通过</button></form><form method="post" action="/staff/orders/${encodeURIComponent(order.id)}/reject" data-site-confirm="确认拒绝并取消这笔网站租赁申请吗？"><button class="button button-sm button-danger" type="submit">拒绝订单</button></form></div></td>
      </tr>${order.rentalNote ? `<tr><td colspan="6" class="section-note">客户备注：${esc(order.rentalNote)}</td></tr>` : ''}`
      }).join('')}</tbody></table></div>` : '<div class="empty-state"><h3>暂无待审核订单</h3><p>网站新提交的租赁申请会自动出现在这里。</p></div>'}
    </section><script>(()=>{document.querySelectorAll('.website-order-approval-form').forEach(form=>{const method=form.querySelector('[name="deliveryMethod"]'),fee=form.querySelector('[name="deliveryFee"]'),field=form.querySelector('[data-delivery-fee-field]');if(!method||!fee||!field)return;const sync=()=>{const delivery=method.value==='Delivery';field.hidden=!delivery;fee.required=delivery;fee.disabled=!delivery};method.addEventListener('change',sync);sync()})})();</script>`
  return buildLayout('网站订单审核 - 电脑租赁管理系统', body, user)
}
