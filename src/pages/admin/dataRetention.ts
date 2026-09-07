/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText, retentionSweepActionable } from '../../site';

const ACTION_LABELS: Record<string, string> = {
  RETAIN: '永久保留', ARCHIVE: '归档', DELETE: '删除', ANONYMISE: '匿名化',
}

export function renderAdminDataRetention(user: any, policies: any[] = [], preview: Record<string, number> = {}) {
  const esc = (v: unknown, n = 200) => sanitizePlainText(v, n)
  const rows = policies.map(p => {
    const years = (Number(p.retention_days) / 365).toFixed(1)
    const due = preview[p.category] ?? null
    return `<tr>
      <td><strong>${esc(p.label, 80)}</strong><small>${esc(p.category, 60)}</small></td>
      <td>
        <form method="post" action="/admin/data-retention/${encodeURIComponent(p.category)}" style="display:grid;gap:6px;min-width:240px">
          <label>保留天数<input class="form-control" type="number" name="retentionDays" min="0" max="36500" value="${Number(p.retention_days) || 0}" required></label>
          <label>到期动作<select class="form-control" name="action">${['RETAIN', 'ARCHIVE', 'DELETE', 'ANONYMISE'].map(a => `<option value="${a}" ${p.action === a ? 'selected' : ''}>${ACTION_LABELS[a]}</option>`).join('')}</select></label>
          <label>依据<input class="form-control" name="basis" maxlength="200" value="${esc(p.basis, 200)}" required></label>
          <label>备注<input class="form-control" name="notes" maxlength="300" value="${esc(p.notes || '', 300)}"></label>
          <label class="form-check"><input type="checkbox" name="enabled" value="1" ${Number(p.enabled) === 1 ? 'checked' : ''}> 启用该策略</label>
          <button class="button button-sm button-primary" type="submit">保存</button>
        </form>
      </td>
      <td>${years} 年</td>
      <td>${retentionSweepActionable(p) ? `<span class="badge badge-warning">${ACTION_LABELS[p.action]}</span>` : '<span class="badge badge-neutral">仅保留</span>'}</td>
      <td>${due == null ? '-' : `<strong>${due}</strong> 条已过期`}<small>${p.updated_by ? `上次更新：${esc(p.updated_by, 60)} · ${esc(p.updated_at, 40)}` : `${esc(p.updated_at, 40)}`}</small></td>
    </tr>`
  }).join('')

  const body = `<div class="page-header"><div><p class="section-code">COMPLIANCE / DATA RETENTION</p><h2>数据保留策略</h2><p>按数据类别定义保留期与到期动作。合同、财务、审计记录为永久保留；其余类别到期后由清理任务归档 / 删除 / 匿名化。</p></div><a class="button button-secondary" href="/admin/settings">返回系统设置</a></div>
  <div class="panel">
    <div class="section-title"><h3>策略清单</h3><span class="section-note">“已过期条数”为只读预览，不会自动清理</span></div>
    <div class="table-wrapper"><table><thead><tr><th>数据类别</th><th>策略</th><th>保留期</th><th>到期动作</th><th>预览 / 更新</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty-state">尚未初始化策略</td></tr>'}</tbody></table></div>
  </div>
  <div class="panel">
    <p class="section-note">实际的到期数据清理由后台调度任务执行（见 §26 备份恢复 / §30 异常自动化）；本页仅负责定义策略与预览影响面。删除类动作不适用于合同与财务记录。</p>
  </div>`
  return buildLayout('数据保留策略 - 电脑租赁管理系统', body, user)
}
