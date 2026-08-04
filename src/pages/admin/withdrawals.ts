/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, formatCurrency } from '../../site';
import { Context } from 'hono';

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return { text: '待处理', class: 'badge-warning' };
    case 'approved':
      return { text: '已审批', class: 'badge-info' };
    case 'completed':
      return { text: '已完成', class: 'badge-success' };
    case 'rejected':
      return { text: '未完成', class: 'badge-danger' };
    default:
      return { text: status || '未知', class: 'badge-info' };
  }
}

export async function renderAdminWithdrawals(c: Context, user: any) {
  const tableInfo = await c.env.RENT.prepare('PRAGMA table_info(commission_withdrawals)').all() as any;
  const withdrawalColumns = (tableInfo.results || []).map((column: any) => column.name);
  const hasAccountNameColumn = withdrawalColumns.includes('account_name') || withdrawalColumns.includes('accountName');
  const hasAccountNumberColumn = withdrawalColumns.includes('account_number') || withdrawalColumns.includes('accountNumber');
  const hasBsbColumn = withdrawalColumns.includes('bsb');
  const hasProcessedAtColumn = withdrawalColumns.includes('processed_at') || withdrawalColumns.includes('processedAt');

  const accountNameSelect = hasAccountNameColumn ? 'w.account_name AS account_name' : 'NULL AS account_name';
  const accountNumberSelect = hasAccountNumberColumn ? 'w.account_number AS account_number' : 'NULL AS account_number';
  const bsbSelect = hasBsbColumn ? 'w.bsb AS bsb' : 'NULL AS bsb';
  const processedAtSelect = hasProcessedAtColumn ? 'w.processed_at AS processed_at' : 'NULL AS processed_at';

  const result = await c.env.RENT.prepare(`
    SELECT
      w.id,
      w.user_id,
      w.amount,
      ${bsbSelect},
      ${accountNumberSelect},
      ${accountNameSelect},
      ${processedAtSelect},
      w.status,
      w.requested_at,
      u.name AS user_name,
      u.email AS user_email,
      u.phone AS user_phone
    FROM commission_withdrawals w
    LEFT JOIN users u ON w.user_id = u.id
    ORDER BY w.requested_at DESC, w.created_at DESC
  `).all();

  const withdrawals = (result.results || []) as any[];
  const pendingCount = withdrawals.filter((item) => item.status === 'pending').length;
  const completedCount = withdrawals.filter((item) => item.status === 'completed').length;
  const rejectedCount = withdrawals.filter((item) => item.status === 'rejected').length;
  const totalAmount = withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const rows = withdrawals.map((withdrawal) => {
    const status = getStatusLabel(withdrawal.status);
    const processedAt = withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString('zh-CN') : '-';
    return `
      <tr>
        <td>${withdrawal.user_name || withdrawal.user_id || '未知用户'}</td>
        <td>${formatCurrency(withdrawal.amount || 0)}</td>
        <td>${withdrawal.account_name || '未填写'}</td>
        <td>${withdrawal.bsb || '未填写'}</td>
        <td>${withdrawal.account_number || '未填写'}</td>
        <td>${withdrawal.requested_at ? new Date(withdrawal.requested_at).toLocaleString('zh-CN') : '-'}</td>
        <td><span class="badge ${status.class}">${status.text}</span></td>
        <td>${processedAt}</td>
        <td>
          ${withdrawal.status === 'pending' || withdrawal.status === 'approved' ? `
            <form method="POST" action="/admin/withdrawals/${withdrawal.id}/status" style="display:inline-block; margin-right:8px;">
              <input type="hidden" name="status" value="completed" />
              <button type="submit" class="button button-sm button-primary">标记已完成</button>
            </form>
            <form method="POST" action="/admin/withdrawals/${withdrawal.id}/status" style="display:inline-block;">
              <input type="hidden" name="status" value="rejected" />
              <button type="submit" class="button button-sm button-danger">标记未完成</button>
            </form>
          ` : '<span class="text-secondary">已处理</span>'}
        </td>
      </tr>
    `;
  }).join('');

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>佣金提现审核</h2>
        <span class="section-note">查看银行转账提现申请并人工处理状态。</span>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div style="padding: 16px; border-radius: 10px; background: var(--surface-secondary); border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-secondary);">待处理</div>
          <div style="font-size: 1.25rem; font-weight: 700; margin-top: 4px;">${pendingCount}</div>
        </div>
        <div style="padding: 16px; border-radius: 10px; background: var(--surface-secondary); border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-secondary);">已完成</div>
          <div style="font-size: 1.25rem; font-weight: 700; margin-top: 4px;">${completedCount}</div>
        </div>
        <div style="padding: 16px; border-radius: 10px; background: var(--surface-secondary); border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-secondary);">未完成</div>
          <div style="font-size: 1.25rem; font-weight: 700; margin-top: 4px;">${rejectedCount}</div>
        </div>
        <div style="padding: 16px; border-radius: 10px; background: var(--surface-secondary); border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-secondary);">总金额</div>
          <div style="font-size: 1.25rem; font-weight: 700; margin-top: 4px;">${formatCurrency(totalAmount)}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-secondary);">
        <strong>说明</strong>
        <p style="margin: 8px 0 0; color: var(--text-secondary);">银行转账提现需要满足最低 100 澳元；管理员可以根据实际打款情况标记为已完成或未完成，并查看客户的转账信息。</p>
      </div>

      ${withdrawals.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">暂无提现申请</div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>客户</th>
              <th>金额</th>
              <th>账户名称</th>
              <th>BSB</th>
              <th>Account</th>
              <th>申请时间</th>
              <th>状态</th>
              <th>处理时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;

  return buildLayout('佣金提现审核 - 电脑租赁管理系统', body, user);
}
