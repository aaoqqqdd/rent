/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site';

const TIER_LABELS: Record<string, string> = { STANDARD: '标准', SILVER: '白银', GOLD: '黄金' }
const STATUS_LABELS: Record<string, string> = { INACTIVE: '未激活', ACTIVE: '生效中', SUSPENDED: '已暂停', TERMINATED: '已终止' }

export function renderAdminAgents(user: any, enabled: boolean, agents: any[] = []) {
  const esc = (v: unknown, n = 120) => sanitizePlainText(v, n)
  const rows = agents.map(a => `<tr>
    <td>${esc(a.user_name || a.user_id, 120)}<small>${esc(a.user_email || '', 120)}</small></td>
    <td>${TIER_LABELS[a.tier] || esc(a.tier, 20)}</td>
    <td>${(Number(a.commission_rate) * 100).toFixed(1)}%${a.max_commission_per_order ? ` · 单单上限 ${Number(a.max_commission_per_order).toFixed(2)}` : ''}</td>
    <td><span class="badge ${a.status === 'ACTIVE' ? 'badge-success' : a.status === 'SUSPENDED' ? 'badge-warning' : 'badge-neutral'}">${STATUS_LABELS[a.status] || esc(a.status, 20)}</span></td>
    <td>${esc(a.created_at, 40)}</td>
  </tr>`).join('')

  const body = `<div class="page-header"><div><p class="section-code">GROWTH / AGENT PROGRAM</p><h2>代理计划（预留）</h2><p>长期分销 / 代理关系，区别于一次性推荐奖励。当前为预留能力。</p></div><a class="button button-secondary" href="/admin/referrals">推荐奖励管理</a></div>
  <div class="page-notification ${enabled ? 'page-notification--info' : 'page-notification--warning'}">
    <strong>${enabled ? '已启用' : '未启用'}</strong> · ${enabled ? '代理归因与佣金结算流程需在后续版本接入下单链路。' : '数据表与佣金计算已预留（agentCommission），但未接入下单 / 结算 / 佣金发放。启用属于独立开发项。'}
  </div>
  <div class="panel">
    <div class="section-title"><h3>代理列表</h3><span class="section-note">共 ${agents.length} 个</span></div>
    ${rows ? `<div class="table-wrapper"><table><thead><tr><th>用户</th><th>层级</th><th>佣金</th><th>状态</th><th>创建时间</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">尚无代理记录</div>'}
  </div>`
  return buildLayout('代理计划 - 电脑租赁管理系统', body, user)
}
