/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import {
  buildLayout, sanitizePlainText, worstHealthLevel, summarizeMetricHistory,
  formatMelbourneDateTime, type MonitorMetric, type MetricHistoryPoint,
} from '../../site';

const LEVEL_TONE: Record<string, string> = { OK: '', WARN: 'warning', CRITICAL: 'danger' }
const LEVEL_LABEL: Record<string, string> = { OK: '正常', WARN: '注意', CRITICAL: '严重' }
const SPARK_STROKE: Record<string, string> = { OK: '#16a34a', WARN: '#d97706', CRITICAL: '#dc2626' }

function renderSparkline(history: MetricHistoryPoint[]) {
  const summary = summarizeMetricHistory(history, { width: 120, height: 28 })
  if (summary.points < 2) return ''
  const stroke = SPARK_STROKE[summary.worstLevel] || SPARK_STROKE.OK
  const breach = summary.firstBreach
    ? `<div class="trend">首次异常：${sanitizePlainText(formatMelbourneDateTime(summary.firstBreach), 40)}</div>`
    : ''
  return `<svg class="metric-spark" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:28px;margin-top:6px">
      <path d="${summary.sparkPath}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>${breach}`
}

export function renderAdminMonitoring(
  user: any,
  metrics: MonitorMetric[] = [],
  jobRuns: any[] = [],
  history: Record<string, MetricHistoryPoint[]> = {},
) {
  const overall = worstHealthLevel(metrics)
  const cards = metrics.map(m => {
    const isCount = m.kind === 'count'
    const value = isCount ? String(m.numerator) : `${(m.rate * 100).toFixed(1)}%`
    const ratio = isCount ? `${m.numerator} 条` : `${m.numerator}/${m.denominator || 0}`
    return `<div class="stat-card ${LEVEL_TONE[m.level]}">
    <h3>${sanitizePlainText(m.label, 60)}</h3>
    <div class="value">${value}</div>
    <div class="trend">${LEVEL_LABEL[m.level]} · ${ratio}${m.note ? ` · ${sanitizePlainText(m.note, 40)}` : ''}</div>
    ${renderSparkline(history[m.key] || [])}
  </div>`
  }).join('')

  const jobRows = jobRuns.map(r => `<tr><td>${sanitizePlainText(r.job_name, 60)}</td><td><span class="badge ${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}">${sanitizePlainText(r.status, 20)}</span></td><td>${sanitizePlainText(r.started_at, 40)}</td><td>${sanitizePlainText(r.completed_at || '-', 40)}</td><td>${sanitizePlainText(r.error_message || r.result_summary || '', 200)}</td></tr>`).join('')

  const body = `<div class="page-header"><div><p class="section-code">OBSERVABILITY / MONITORING</p><h2>系统健康监控</h2><p>近 24 小时失败率与积压量，趋势取近 7 天快照（每 15 分钟一次）。CRITICAL 指标会自动写入异常任务中心。</p></div><span class="badge ${overall === 'OK' ? 'badge-success' : overall === 'WARN' ? 'badge-warning' : 'badge-danger'}">整体：${LEVEL_LABEL[overall]}</span></div>
  <div class="stats-grid">${cards || '<div class="empty-state">暂无指标</div>'}</div>
  <div class="panel">
    <div class="section-title"><h3>最近定时任务</h3><a class="button button-sm button-secondary" href="/admin/exceptions">异常任务中心</a></div>
    ${jobRows ? `<div class="table-wrapper"><table><thead><tr><th>任务</th><th>状态</th><th>开始</th><th>完成</th><th>结果 / 错误</th></tr></thead><tbody>${jobRows}</tbody></table></div>` : '<div class="empty-state">暂无任务运行记录</div>'}
  </div>
  <div class="panel"><p class="section-note">机器可读健康检查见 <a href="/health">/health</a>（数据库 / Stripe / 邮件 / 设备 / 定时任务 / 失败率汇总）。</p></div>`
  return buildLayout('系统健康监控 - 电脑租赁管理系统', body, user)
}
