/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText, formatMelbourneDateTime } from '../../site';

const statusLabels: Record<string, string> = { PENDING: '待处理', PROCESSING: '处理中', ISSUED: '已发放', FAILED: '发放失败', SKIPPED: '已跳过' }
const statusBadge: Record<string, string> = { PENDING: 'badge-warning', PROCESSING: 'badge-warning', ISSUED: 'badge-success', FAILED: 'badge-danger', SKIPPED: 'badge-info' }
const rewardTypeLabels: Record<string, string> = { BALANCE: '账户余额', COUPON: '优惠码', GIFT_CARD: '礼品卡' }

export function renderAdminFeedbackRewards(user: any, rewards: any[] = []) {
  const rows = rewards.map((reward: any) => `<tr>
    <td>${sanitizePlainText(reward.customer_name || reward.customer_id, 100)}</td>
    <td>${rewardTypeLabels[reward.reward_type] || reward.reward_type}</td>
    <td><span class="badge ${statusBadge[reward.status] || 'badge-info'}">${statusLabels[reward.status] || reward.status}</span></td>
    <td>${reward.reward_amount == null ? '-' : `AUD$${Number(reward.reward_amount).toFixed(2)}`}</td>
    <td>${sanitizePlainText(reward.failure_reason || '-', 200)}</td>
    <td>${reward.issued_at ? formatMelbourneDateTime(reward.issued_at) : '-'}</td>
    <td>${formatMelbourneDateTime(reward.created_at)}</td>
    <td>${reward.status === 'FAILED' ? `<form method="post" action="/admin/feedback-rewards/${encodeURIComponent(reward.id)}/retry" style="display:inline"><button class="button button-sm button-primary" type="submit">重试发放</button></form>` : '-'}</td>
  </tr>`).join('')
  const pendingCount = rewards.filter((r: any) => r.status === 'PENDING' || r.status === 'PROCESSING').length
  const failedCount = rewards.filter((r: any) => r.status === 'FAILED').length
  const issuedCount = rewards.filter((r: any) => r.status === 'ISSUED').length
  const body = `<div class="page-header"><div><p class="section-code">TALLY / REWARDS</p><h2>客户反馈奖励记录</h2><p>客户提交 Tally 反馈问卷后系统自动发放的奖励记录；发放失败可在此手动重试。</p></div><a class="button button-secondary" href="/admin/feedback-gift-cards">礼品卡库存</a></div>
  <div class="stats-grid">
    <div class="stat-card ${failedCount ? 'warning' : ''}"><h3>发放失败</h3><div class="value">${failedCount}</div></div>
    <div class="stat-card ${pendingCount ? 'warning' : ''}"><h3>处理中</h3><div class="value">${pendingCount}</div></div>
    <div class="stat-card"><h3>已发放</h3><div class="value">${issuedCount}</div></div>
    <div class="stat-card"><h3>全部记录</h3><div class="value">${rewards.length}</div></div>
  </div>
  <div class="panel">
    <div class="section-title"><h3>反馈奖励记录</h3><a class="button button-sm button-secondary" href="/admin/settings">前往配置</a></div>
    ${rows ? `<div class="table-wrapper"><table><thead><tr><th>客户</th><th>奖励类型</th><th>状态</th><th>金额</th><th>失败原因</th><th>发放时间</th><th>提交时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">暂无反馈奖励记录</div>'}
  </div>`
  return buildLayout('客户反馈奖励记录 - PC Rental', body, user)
}
