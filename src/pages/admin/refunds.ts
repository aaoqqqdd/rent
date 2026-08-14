/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUsers, getDevices, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderAdminRefunds(c: Context, user: any) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = 10;
  const countResult = await c.env.RENT.prepare(`
    SELECT COUNT(*) AS total FROM orders o
    WHERE (o.status = 'completed' OR o.status = 'cancelled' OR (o.status = 'paid' AND o.startDate > ?))
      AND NOT EXISTS (SELECT 1 FROM payment_refunds r WHERE r.order_id = o.id AND r.status = 'succeeded')
  `).bind(today).first() as any;
  const total = Number(countResult?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const result = await c.env.RENT.prepare(`
    SELECT o.*, pending.id AS pending_refund_id, pending.refund_amount AS pending_refund_amount, pending.refund_bsb AS pending_refund_bsb, pending.refund_account_number AS pending_refund_account_number, pending.refund_account_name AS pending_refund_account_name, pending.deduction_reason AS pending_refund_reason FROM orders o
    LEFT JOIN payment_refunds pending ON pending.order_id = o.id AND pending.type = 'early_return' AND pending.status = 'pending'
    WHERE (o.status = 'completed' OR (o.status = 'paid' AND o.startDate > ?))
      AND NOT EXISTS (SELECT 1 FROM payment_refunds r WHERE r.order_id = o.id AND r.status = 'succeeded')
    ORDER BY o.updatedAt DESC
    LIMIT ? OFFSET ?
  `).bind(today, pageSize, (currentPage - 1) * pageSize).all();
  const refundOrders = (result.results || []) as any[];

  const [customers, devices] = await Promise.all([getUsers(c), getDevices(c)]);
  const customersById = new Map(customers.map(customer => [customer.id, customer]));
  const devicesById = new Map(devices.map(device => [device.id, device]));
  const ordersWithDetails = refundOrders.map(order => ({
    ...order,
    customer: customersById.get(order.userId) || null,
    device: devicesById.get(order.device_id || order.deviceId) || null,
  }));

  const body = `
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>待退款处理</h2>
          <p style="color: var(--text-secondary); margin-top: 4px; font-size: 0.9rem;">管理所有待退款的订单，处理客户退款请求。</p>
        </div>
      </div>
      
      ${ordersWithDetails.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户信息</th>
              <th>设备</th>
              <th>退款金额</th>
              <th>退款方式</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ordersWithDetails.map(order => {
              const refundAmount = order.pending_refund_amount != null ? order.pending_refund_amount : order.status === 'completed' ? (order.deposit_amount || order.depositAmount || 0) : (order.total_amount || order.totalAmount || 0);
              return `
                <tr>
                  <td style="font-family: monospace;">${order.id}</td>
                  <td>
                    <div><strong>${order.customer?.name || '未知客户'}</strong></div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">${order.customer?.email || ''}</div>
                  </td>
                  <td>${order.device?.name || '未知设备'}</td>
                  <td><span style="color: var(--danger); font-weight: bold;">${formatCurrency(refundAmount)}</span></td>
                  <td>
                    <div>${order.pending_refund_amount != null ? '提前归还租金退款' : order.status === 'completed' ? '押金退款' : '租前取消全额退款'}</div>
                    <small>${order.refundMethod === 'original' ? '原路退回' : '退回账户余额'}</small>
                    ${order.pending_refund_amount != null ? `<small style="display:block;color:var(--danger);">${order.pending_refund_reason || ''}<br>BSB：${order.pending_refund_bsb || '未填写'}<br>账号：${order.pending_refund_account_number || '未填写'}<br>账户名：${order.pending_refund_account_name || '未填写'}</small>` : ''}
                  </td>
                  <td><span class="badge badge-warning">待退款</span></td>
                  <td>
                    ${order.pending_refund_id ? `<form method="post" action="/admin/refunds/${order.pending_refund_id}/complete-bank-transfer" style="display:inline" onsubmit="return confirm('请确认已经完成银行转账，确认后系统将标记退款成功。');"><button class="button button-sm button-primary" type="submit">确认已转账</button></form>` : ''}
                    <a href="/admin/orders/${order.id}" class="link-button">查看详情</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `<div class="record-actions" style="justify-content:center;align-items:center;margin-top:20px;"><a class="button button-secondary ${currentPage <= 1 ? 'disabled' : ''}" href="/admin/refunds?page=${currentPage - 1}" ${currentPage <= 1 ? 'aria-disabled="true"' : ''}>上一页</a><span class="section-note">第 ${currentPage} / ${totalPages} 页，共 ${total} 条</span><a class="button button-secondary ${currentPage >= totalPages ? 'disabled' : ''}" href="/admin/refunds?page=${currentPage + 1}" ${currentPage >= totalPages ? 'aria-disabled="true"' : ''}>下一页</a></div>` : ''}
      ` : `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
          <h3 style="margin-bottom: 8px;">暂无待退款订单</h3>
          <p style="color: var(--text-secondary);">所有退款请求都已处理完毕！</p>
        </div>
      `}
    </div>
  `;

  return buildLayout('待退款处理 - 电脑租赁管理系统', body, user);
}
