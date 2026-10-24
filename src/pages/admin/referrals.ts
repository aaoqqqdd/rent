/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, sanitizePlainText, formatMelbourneDate } from '../../site';

const statusLabels: Record<string, string> = { PENDING: '待结算', PENDING_REVIEW: '待风险审核', AVAILABLE: '已发放', CANCELLED: '已撤销' }
const statusBadge: Record<string, string> = { PENDING: 'badge-warning', PENDING_REVIEW: 'badge-danger', AVAILABLE: 'badge-success', CANCELLED: 'badge-danger' }

export function renderAdminReferrals(user: any, rewards: any[] = [], settlementDays: number) {
  const rows = rewards.map((reward: any) => `<tr>
    <td class="mono">${sanitizePlainText(reward.reward_number, 40)}</td>
    <td>${sanitizePlainText(reward.referrer_name || reward.customer_id, 100)}</td>
    <td>${sanitizePlainText(reward.referee_name || '-', 100)}</td>
    <td>${formatCurrency(Number(reward.reward_amount || 0))}</td>
    <td><span class="badge ${statusBadge[reward.status] || 'badge-info'}">${statusLabels[reward.status] || reward.status}</span></td>
    <td>${reward.qualified_at ? formatMelbourneDate(reward.qualified_at) : '-'}</td>
    <td>${sanitizePlainText(reward.reason || '-', 200)}</td>
    <td>${reward.status === 'PENDING' || reward.status === 'PENDING_REVIEW' ? `
      <form method="post" action="/admin/referrals/${encodeURIComponent(reward.id)}/release" style="display:inline" data-site-confirm="发放后奖励金额会立即进入推荐人账户余额。" data-confirm-variant="danger" data-confirm-title="发放推荐奖励？" data-confirm-label="确认发放"><button class="button button-sm button-primary" type="submit">${reward.status === 'PENDING_REVIEW' ? '审核并发放' : '立即发放'}</button></form>
      <form method="post" action="/admin/referrals/${encodeURIComponent(reward.id)}/revoke" style="display:inline" data-site-confirm="撤销后该笔推荐奖励将不再发放，并写入审计记录。" data-confirm-variant="danger" data-confirm-title="撤销推荐奖励？" data-confirm-label="撤销奖励"><input class="form-control" name="reason" maxlength="300" required placeholder="撤销原因" style="width:140px;display:inline-block"><button class="button button-sm button-danger" type="submit">撤销</button></form>
    ` : reward.status === 'AVAILABLE' ? `
      <form method="post" action="/admin/referrals/${encodeURIComponent(reward.id)}/revoke" style="display:inline" data-site-confirm="撤销后该笔已发放奖励将被收回，并写入审计记录。" data-confirm-variant="danger" data-confirm-title="撤销已发放奖励？" data-confirm-label="撤销奖励"><input class="form-control" name="reason" maxlength="300" required placeholder="撤销原因" style="width:140px;display:inline-block"><button class="button button-sm button-danger" type="submit">撤销</button></form>
    ` : '-'}</td>
  </tr>`).join('')
  const pendingCount = rewards.filter((r: any) => r.status === 'PENDING').length
  const reviewCount = rewards.filter((r: any) => r.status === 'PENDING_REVIEW').length
  const availableTotal = rewards.filter((r: any) => r.status === 'AVAILABLE').reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0)
  const body = `<div class="page-header"><div><p class="section-code">GROWTH / REFERRAL</p><h2>推荐奖励管理</h2><p>结算期 ${settlementDays} 天。</p></div></div>
  <div class="stats-grid">
    <div class="stat-card ${pendingCount ? 'warning' : ''}"><h3>待结算</h3><div class="value">${pendingCount}</div></div>
    <div class="stat-card ${reviewCount ? 'warning' : ''}"><h3>待风险审核</h3><div class="value">${reviewCount}</div></div>
    <div class="stat-card"><h3>已发放总额</h3><div class="value">${formatCurrency(availableTotal)}</div></div>
    <div class="stat-card"><h3>全部记录</h3><div class="value">${rewards.length}</div></div>
  </div>
  <div class="panel">
    <div class="section-title"><h3>推荐奖励记录</h3></div>
    ${rows ? `<div class="table-wrapper"><table><thead><tr><th>奖励编号</th><th>推荐人</th><th>被推荐人</th><th>金额</th><th>状态</th><th>合格时间</th><th>备注</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">暂无推荐奖励记录</div>'}
  </div>`
  return buildLayout('推荐奖励管理 - 电脑租赁管理系统', body, user)
}
