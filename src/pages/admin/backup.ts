/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText, backupHealth, restoreTestOverdue } from '../../site';

const HEALTH_LABEL: Record<string, string> = { OK: '正常', WARN: '接近 RPO', STALE: '超过 RPO', NONE: '尚无备份记录' }

export function renderAdminBackup(user: any, policy: any, runs: any[] = [], tests: any[] = []) {
  const esc = (v: unknown, n = 200) => sanitizePlainText(v, n)
  const lastRun = runs[0] || null
  const health = backupHealth(lastRun?.created_at, Number(policy?.rpo_minutes) || 1440)
  const overdue = restoreTestOverdue(policy?.last_restore_test_at)

  const runRows = runs.map(r => `<tr><td>${esc(r.created_at, 40)}</td><td>${esc(r.scope, 80)}</td><td><span class="badge ${r.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}">${esc(r.status, 20)}</span></td><td class="mono">${esc(r.checksum || '-', 20)}</td><td>${r.byte_size ? `${(Number(r.byte_size) / 1024).toFixed(1)} KB` : '-'}</td><td>${esc(r.created_by, 60)}</td></tr>`).join('')
  const testRows = tests.map(t => `<tr><td>${esc(t.created_at, 40)}</td><td>${esc(t.scope, 80)}</td><td><span class="badge ${t.outcome === 'PASS' ? 'badge-success' : 'badge-danger'}">${esc(t.outcome, 10)}</span></td><td>${t.duration_minutes != null ? `${Number(t.duration_minutes)} 分钟` : '-'}</td><td>${esc(t.notes || '', 300)}</td><td>${esc(t.created_by, 60)}</td></tr>`).join('')

  const body = `<div class="page-header"><div><p class="section-code">RELIABILITY / BACKUP &amp; RESTORE</p><h2>备份与恢复</h2><p>覆盖：${esc(policy?.scope_note || '', 200)}。</p></div><a class="button button-secondary" href="/admin/settings">返回系统设置</a></div>
  <div class="stats-grid">
    <div class="stat-card ${health.status === 'OK' ? '' : 'warning'}"><h3>最近备份</h3><div class="value">${health.ageMinutes == null ? '—' : health.ageMinutes < 120 ? `${health.ageMinutes} 分钟前` : `${Math.round(health.ageMinutes / 60)} 小时前`}</div><div class="trend">${HEALTH_LABEL[health.status]}（RPO ${Number(policy?.rpo_minutes) || 0} 分钟）</div></div>
    <div class="stat-card"><h3>RTO 目标</h3><div class="value">${Number(policy?.rto_minutes) || 0} 分钟</div></div>
    <div class="stat-card ${overdue ? 'warning' : ''}"><h3>上次恢复演练</h3><div class="value">${policy?.last_restore_test_at ? esc(String(policy.last_restore_test_at).slice(0, 10), 20) : '从未'}</div><div class="trend">${overdue ? '已超期，建议尽快演练' : '在 90 天周期内'}</div></div>
  </div>

  <div class="panel">
    <div class="section-title"><h3>离线快照</h3><span class="section-note">导出合同 / 付款 / 退款 / Ledger / 审计的 JSON 快照并记录一次备份</span></div>
    <p style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="button button-primary" href="/admin/backup/export.json">下载 JSON 快照</a>
      <form method="post" action="/admin/backup/runs"><button class="button button-secondary" type="submit">仅记录一次备份执行</button></form>
    </p>
  </div>

  <div class="panel">
    <div class="section-title"><h3>备份 / RPO / RTO 策略</h3></div>
    <form method="post" action="/admin/backup/policy" class="grid grid-2">
      <label>RPO（分钟）<input class="form-control" type="number" name="rpoMinutes" min="1" max="43200" value="${Number(policy?.rpo_minutes) || 1440}" required></label>
      <label>RTO（分钟）<input class="form-control" type="number" name="rtoMinutes" min="1" max="43200" value="${Number(policy?.rto_minutes) || 240}" required></label>
      <label style="grid-column:1/-1">备份计划说明<input class="form-control" name="scheduleNote" maxlength="300" value="${esc(policy?.schedule_note || '', 300)}"></label>
      <label style="grid-column:1/-1">覆盖范围说明<input class="form-control" name="scopeNote" maxlength="300" value="${esc(policy?.scope_note || '', 300)}"></label>
      <button class="button button-primary" type="submit">保存策略</button>
    </form>
  </div>

  <div class="panel">
    <div class="section-title"><h3>记录恢复演练</h3><span class="section-note">§20：不能只确认“有备份”，必须实际演练恢复</span></div>
    <form method="post" action="/admin/backup/restore-tests" class="grid grid-2">
      <label>演练范围<input class="form-control" name="scope" maxlength="120" placeholder="例如：数据库全量 + 合同 PDF" required></label>
      <label>结果<select class="form-control" name="outcome"><option value="PASS">通过</option><option value="FAIL">失败</option></select></label>
      <label>耗时（分钟）<input class="form-control" type="number" name="durationMinutes" min="0" max="10080"></label>
      <label>说明<input class="form-control" name="notes" maxlength="500"></label>
      <button class="button button-primary" type="submit">记录演练</button>
    </form>
  </div>

  <div class="panel">
    <div class="section-title"><h3>备份执行记录</h3></div>
    ${runRows ? `<div class="table-wrapper"><table><thead><tr><th>时间</th><th>范围</th><th>状态</th><th>校验和</th><th>大小</th><th>操作人</th></tr></thead><tbody>${runRows}</tbody></table></div>` : '<div class="empty-state">暂无备份记录</div>'}
  </div>
  <div class="panel">
    <div class="section-title"><h3>恢复演练记录</h3></div>
    ${testRows ? `<div class="table-wrapper"><table><thead><tr><th>时间</th><th>范围</th><th>结果</th><th>耗时</th><th>说明</th><th>操作人</th></tr></thead><tbody>${testRows}</tbody></table></div>` : '<div class="empty-state">暂无恢复演练记录</div>'}
  </div>`
  return buildLayout('备份与恢复 - 电脑租赁管理系统', body, user)
}
