/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText, worstHealthLevel, type MonitorMetric } from '../../site';

const LEVEL_TONE: Record<string, string> = { OK: '', WARN: 'warning', CRITICAL: 'danger' }
const LEVEL_LABEL: Record<string, string> = { OK: '正常', WARN: '注意', CRITICAL: '严重' }

export function renderAdminMonitoring(user: any, metrics: MonitorMetric[] = [], jobRuns: any[] = []) {
  const overall = worstHealthLevel(metrics)
  const cards = metrics.map(m => `<div class="stat-card ${LEVEL_TONE[m.level]}">
    <h3>${sanitizePlainText(m.label, 60)}</h3>
    <div class="value">${m.key === 'open_exception_backlog' ? m.numerator : `${(m.rate * 100).toFixed(1)}%`}</div>
    <div class="trend">${LEVEL_LABEL[m.level]} · ${m.numerator}/${m.denominator || (m.key === 'open_exception_backlog' ? '—' : 0)}${m.note ? ` · ${sanitizePlainText(m.note, 40)}` : ''}</div>
  </div>`).join('')

  const jobRows = jobRuns.map(r => `<tr><td>${sanitizePlainText(r.job_name, 60)}</td><td><span class="badge ${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}">${sanitizePlainText(r.status, 20)}</span></td><td>${sanitizePlainText(r.started_at, 40)}</td><td>${sanitizePlainText(r.completed_at || '-', 40)}</td><td>${sanitizePlainText(r.error_message || r.result_summary || '', 200)}</td></tr>`).join('')

  const body = `<div class="page-header"><div><p class="section-code">OBSERVABILITY / MONITORING</p><h2>系统健康监控</h2><p>近 24 小时失败率与积压量。CRITICAL 指标会自动写入异常任务中心。</p></div><span class="badge ${overall === 'OK' ? 'badge-success' : overall === 'WARN' ? 'badge-warning' : 'badge-danger'}">整体：${LEVEL_LABEL[overall]}</span></div>
  <div class="stats-grid">${cards || '<div class="empty-state">暂无指标</div>'}</div>
  <div class="panel">
    <div class="section-title"><h3>最近定时任务</h3><a class="button button-sm button-secondary" href="/admin/exceptions">异常任务中心</a></div>
    ${jobRows ? `<div class="table-wrapper"><table><thead><tr><th>任务</th><th>状态</th><th>开始</th><th>完成</th><th>结果 / 错误</th></tr></thead><tbody>${jobRows}</tbody></table></div>` : '<div class="empty-state">暂无任务运行记录</div>'}
  </div>
  <div class="panel"><p class="section-note">机器可读健康检查见 <a href="/health">/health</a>（数据库 / Stripe / 邮件 / 设备 / 定时任务）。</p></div>`
  return buildLayout('系统健康监控 - 电脑租赁管理系统', body, user)
}
