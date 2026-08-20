/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site';

const FLAG_TYPE_LABELS: Record<string, string> = {
  PAYMENT_RISK: '付款风险',
  IDENTITY_RISK: '身份风险',
  DEVICE_NOT_RETURNED: '设备未归还历史',
  SERIOUS_DAMAGE: '严重损坏历史',
  CHARGEBACK: '拒付/争议',
  ABUSE: '滥用行为',
  FRAUD_SUSPECTED: '疑似欺诈',
  MANUAL_REVIEW: '需人工复核',
}

export function renderAdminRiskFlags(user: any, targetUser: any, activeFlags: any[] = [], history: any[] = []) {
  const flagRow = (flag: any) => `<tr>
    <td>${FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}</td>
    <td>${sanitizePlainText(flag.severity, 20)}</td>
    <td>${sanitizePlainText(flag.reason, 500)}</td>
    <td>${sanitizePlainText(flag.created_by, 60)}</td>
    <td>${flag.created_at || '-'}</td>
    <td>${flag.status === 'ACTIVE'
      ? `<form method="post" action="/admin/users/${encodeURIComponent(targetUser.id)}/risk/${encodeURIComponent(flag.id)}/resolve"><input class="form-control" name="resolutionReason" maxlength="500" required placeholder="解除原因（必填）"><button class="button button-sm button-secondary" type="submit" style="margin-top:6px">解除标记</button></form>`
      : `已解除 · ${sanitizePlainText(flag.resolution_reason || '', 500)}（${flag.resolved_at || '-'}）`}</td>
  </tr>`
  const body = `<div class="page-header"><div><p class="section-code">RISK MANAGEMENT</p><h2>风险标记 · ${sanitizePlainText(targetUser.name, 100)}</h2><p>高风险客户将被禁止通过网站自助下单；员工建合同不受此限制，但会看到提示。</p></div><a class="button button-secondary" href="/admin/users/${encodeURIComponent(targetUser.id)}">返回客户</a></div>
  <div class="panel">
    <h3>新增风险标记</h3>
    <form method="post" action="/admin/users/${encodeURIComponent(targetUser.id)}/risk" class="grid grid-2">
      <select class="form-control" name="flagType" required>${Object.entries(FLAG_TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
      <select class="form-control" name="severity"><option value="LOW">低</option><option value="MEDIUM" selected>中</option><option value="HIGH">高</option></select>
      <textarea class="form-control" name="reason" maxlength="500" required placeholder="标记原因（必填）" style="grid-column:1/-1"></textarea>
      <textarea class="form-control" name="evidence" maxlength="1000" placeholder="证据说明或链接（可选）" style="grid-column:1/-1"></textarea>
      <input class="form-control" name="expiresAt" type="datetime-local" placeholder="到期时间（可留空，代表长期有效）">
      <button class="button button-primary" type="submit">创建标记</button>
    </form>
  </div>
  <div class="panel">
    <div class="section-title"><h3>当前有效标记</h3><span class="section-note">共 ${activeFlags.length} 条</span></div>
    ${activeFlags.length ? `<div class="table-wrapper"><table><thead><tr><th>类型</th><th>严重程度</th><th>原因</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${activeFlags.map(flagRow).join('')}</tbody></table></div>` : '<div class="empty-state">当前没有有效的风险标记</div>'}
  </div>
  <div class="panel">
    <div class="section-title"><h3>历史记录</h3><span class="section-note">共 ${history.length} 条</span></div>
    ${history.length ? `<div class="table-wrapper"><table><thead><tr><th>类型</th><th>严重程度</th><th>原因</th><th>创建人</th><th>创建时间</th><th>状态</th></tr></thead><tbody>${history.map(flagRow).join('')}</tbody></table></div>` : '<div class="empty-state">暂无历史记录</div>'}
  </div>`
  return buildLayout('风险标记 - 电脑租赁管理系统', body, user)
}
