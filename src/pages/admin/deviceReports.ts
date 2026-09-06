/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency, sanitizePlainText } from '../../site';

export function renderAdminDeviceReports(user: any, rows: any[] = []) {
  const deviceCount = rows.length || 1
  const totalRecentRentalDays = rows.reduce((sum, r) => sum + Number(r.recent_rental_days || 0), 0)
  const fleetUtilisation = deviceCount ? (totalRecentRentalDays / (deviceCount * 30)) * 100 : 0
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0)
  const totalDamageCost = rows.reduce((sum, r) => sum + Number(r.damage_cost_cents || 0), 0) / 100

  const tableRows = rows.map(r => {
    const maintenanceCost = Number(r.maintenance_cost || 0)
    const maintenanceCount = Number(r.maintenance_count || 0)
    return `<tr>
      <td><strong>${sanitizePlainText(r.name, 100)}</strong><small>${sanitizePlainText(r.brand || '', 60)} ${sanitizePlainText(r.model || '', 60)}</small></td>
      <td>${formatCurrency(Number(r.total_revenue || 0))}</td>
      <td>${Number(r.total_rental_days || 0)} 天</td>
      <td>${maintenanceCount} 次 · ${formatCurrency(maintenanceCost)}${maintenanceCount ? ` · 均次 ${formatCurrency(maintenanceCost / maintenanceCount)}` : ''}</td>
      <td>${Number(r.damage_count || 0)} 次 · ${formatCurrency(Number(r.damage_cost_cents || 0) / 100)}</td>
      <td>${r.retired_at ? `已退役 · ${new Date(r.retired_at).toISOString().slice(0, 10)}` : sanitizePlainText(r.lifecycle_status || '-', 30)}</td>
    </tr>`
  }).join('')

  const body = `<div class="page-header"><div><p class="section-code">OPERATIONS / DEVICE REPORT</p><h2>设备运营报表</h2><p>按设备汇总收入、租用天数、维护与损坏成本，用于评估设备的运营表现。</p></div><a class="button button-secondary" href="/admin/dashboard">返回控制台</a></div>
  <div class="stats-grid">
    <div class="stat-card primary"><h3>车队利用率（近 30 天）</h3><div class="value">${fleetUtilisation.toFixed(1)}%</div><div class="trend">近 30 天新开始订单的租用天数 / (设备数 × 30)，为近似值</div></div>
    <div class="stat-card"><h3>设备总收入（估算）</h3><div class="value">${formatCurrency(totalRevenue)}</div><div class="trend">仅租金，已扣除押金与服务费；未计退款与押金扣款，非账目数据</div></div>
    <div class="stat-card"><h3>设备数量</h3><div class="value">${rows.length}</div></div>
    <div class="stat-card ${totalDamageCost ? 'warning' : ''}"><h3>累计损坏成本</h3><div class="value">${formatCurrency(totalDamageCost)}</div></div>
  </div>
  <div class="panel">
    <div class="section-title"><h3>按设备明细</h3><span class="section-note">按累计收入（估算租金）排序</span></div>
    ${tableRows ? `<div class="table-wrapper"><table><thead><tr><th>设备</th><th>累计收入</th><th>累计租用天数</th><th>维护次数/成本</th><th>损坏次数/成本</th><th>状态</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : '<div class="empty-state">暂无设备数据</div>'}
  </div>`
  return buildLayout('设备运营报表 - 电脑租赁管理系统', body, user)
}
