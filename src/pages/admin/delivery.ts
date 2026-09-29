/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatCurrency } from '../../site'
import { escapeHtml } from '../../lib/html'
import { getAdminDeliveryRows, type AdminDeliveryRow, type DeliveryDirection } from '../../services/deliveryAdmin'
import { getDeliveryConfigSummary } from '../../deliveryConfig'
import { deliveryStatusInfo } from '../../deliveryStatus'
import type { Context } from 'hono'

const statusLabels: Record<string, string> = {
  pending_approval: '待审核', pending_payment: '待支付', approved: '已审核', paid: '已支付',
  pending_pickup: '待取货', active: '租赁中', extended: '已延期', overdue: '已逾期',
  suspended: '已暂停', pending_return: '待归还', returned: '已归还', completed: '已完成',
}

const deliveryStatusLabels: Record<string, string> = {
  unassigned: '待分配', accepted: '已接单', on_route_to_pickup: '前往取货', picked_up: '已取货',
  on_route_to_dropoff: '配送中', tried_to_deliver: '尝试送达', dropped_off: '已送达', cancelled: '已取消',
  returning: '退回中', returned: '已回收', on_hold_with_courier: '配送暂停',
}

const deliveryStatusDescriptions: Record<string, string> = {
  unassigned: '等待配送员接单。', accepted: '配送员已接受订单。', on_route_to_pickup: '配送员正在前往取货地点。',
  picked_up: '设备已由配送员取走。', on_route_to_dropoff: '设备正在送往客户地址。', tried_to_deliver: '配送员曾尝试送达，请及时跟进。',
  dropped_off: '设备已送达客户地址。', cancelled: '该配送订单已取消。', returning: '设备正在退回取货地点。',
  returned: '设备已回收到取货地点。', on_hold_with_courier: '配送订单已暂停，请联系配送服务。',
}

const DELIVERY_ISSUE_STATUSES = new Set(['tried_to_deliver', 'cancelled', 'on_hold_with_courier'])

function normalizeDeliveryStatus(value: unknown): string {
  return String(value || '').trim().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_')
}

function badgeClass(status: string): string {
  const value = status.toLowerCase()
  if (['delivered', 'completed', 'returned'].includes(value)) return 'badge-success'
  if (['cancelled', 'failed', 'rejected'].includes(value)) return 'badge-danger'
  if (['booked', 'accepted', 'enroute', 'in_transit', 'pending'].includes(value)) return 'badge-primary'
  return 'badge-warning'
}

function bookingStatus(status: string | null): string {
  if (!status) return '未创建'
  const key = normalizeDeliveryStatus(status)
  return deliveryStatusLabels[key] || deliveryStatusInfo(status).label
}

function bookingDescription(status: string | null): string {
  if (!status) return ''
  const key = normalizeDeliveryStatus(status)
  return deliveryStatusDescriptions[key] || deliveryStatusInfo(status).description
}

function safeTrackingUrl(value: string | null): string {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function renderBooking(row: AdminDeliveryRow, direction: DeliveryDirection, configured: boolean): string {
  const status = direction === 'outbound' ? row.outboundStatus : row.returnStatus
  const reference = direction === 'outbound' ? row.outboundReference : row.returnReference
  const trackingUrl = safeTrackingUrl(direction === 'outbound' ? row.outboundTrackingUrl : row.returnTrackingUrl)
  if (status || reference) {
    const info = deliveryStatusInfo(status)
    const statusKey = normalizeDeliveryStatus(status)
    const issue = DELIVERY_ISSUE_STATUSES.has(statusKey)
    const lockedNote = info.special && statusKey !== 'returned'
    return `<div class="delivery-status-card"><span class="badge ${issue ? 'badge-danger' : badgeClass(status || '')}">${escapeHtml(bookingStatus(status))}</span><small class="delivery-meta">${escapeHtml(bookingDescription(status))}</small>${lockedNote ? '<small class="delivery-meta delivery-meta--alert">该状态下不能更新或取消配送订单。</small>' : ''}${reference ? `<small class="delivery-meta">配送编号：${escapeHtml(reference)}</small>` : ''}${trackingUrl ? `<a class="link-button" href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer">查看追踪链接 ↗</a>` : ''}</div>`
  }
  const eligibleStatuses = direction === 'outbound' ? ['paid', 'pending_pickup', 'active'] : ['active', 'extended', 'overdue', 'suspended', 'pending_return']
  const canCreate = configured && eligibleStatuses.includes(String(row.status).toLowerCase())
  return `<form method="post" action="/admin/delivery/bookings" class="delivery-booking-form"><input type="hidden" name="orderId" value="${escapeHtml(row.id)}"><input type="hidden" name="direction" value="${direction}"><input class="form-control delivery-datetime" type="datetime-local" name="readyDateTime" aria-label="${direction === 'outbound' ? '派送' : '回收'}时间" title="留空则按租期日期上午 9 点安排"><button class="button button-sm ${canCreate ? 'button-primary' : 'button-secondary'}" type="submit" ${canCreate ? '' : 'disabled'}>${direction === 'outbound' ? '创建派送单' : '创建回收单'}</button>${!configured ? '<small class="delivery-meta">需配置 Token</small>' : !canCreate ? '<small class="delivery-meta">当前订单状态不可创建</small>' : '<small class="delivery-meta">留空按租期日期 09:00</small>'}</form>`
}

type DeliveryQueueState = 'attention' | 'pending' | 'outbound' | 'return' | 'completed'

function deliveryQueueState(row: AdminDeliveryRow): DeliveryQueueState {
  const outbound = normalizeDeliveryStatus(row.outboundStatus)
  const returned = normalizeDeliveryStatus(row.returnStatus)
  if (DELIVERY_ISSUE_STATUSES.has(outbound) || DELIVERY_ISSUE_STATUSES.has(returned)) return 'attention'
  if (!outbound) return 'pending'
  if (outbound !== 'dropped_off') return 'outbound'
  if (returned !== 'returned') return 'return'
  return 'completed'
}

function isDeliveryIssue(row: AdminDeliveryRow): boolean {
  return deliveryQueueState(row) === 'attention'
}

export async function renderAdminDelivery(c: Context, user: any): Promise<string> {
  const { rows, available } = await getAdminDeliveryRows(c)
  const url = new URL(c.req.url)
  const error = url.searchParams.get('error') || ''
  const success = url.searchParams.get('success') || ''
  const deliveryConfig = await getDeliveryConfigSummary(c)
  const configured = deliveryConfig.adminConfigured
  const pendingCount = rows.filter(row => deliveryQueueState(row) === 'pending').length
  const outboundCount = rows.filter(row => deliveryQueueState(row) === 'outbound').length
  const returnCount = rows.filter(row => deliveryQueueState(row) === 'return').length
  const completedCount = rows.filter(row => deliveryQueueState(row) === 'completed').length
  const issueCount = rows.filter(isDeliveryIssue).length
  const queueStats = [
    ['待安排', pendingCount, '尚未创建派送单', 'warning'],
    ['派送中', outboundCount, '已创建派送，等待送达', 'primary'],
    ['待回收', returnCount, '送达后等待创建 / 完成回收', 'accent'],
    ['已完成', completedCount, '送货与回收均已完成', 'success'],
  ]
  const rowMarkup = rows.map(row => {
    const queueState = deliveryQueueState(row)
    const searchText = [row.orderNo, row.customerName, row.customerEmail, row.deviceName, row.pickupLocation].filter(Boolean).join(' ').toLowerCase()
    const orderStatus = statusLabels[String(row.status).toLowerCase()] || row.status
    return `<tr class="delivery-row" data-delivery-row data-state="${queueState}" data-search="${escapeHtml(searchText)}"><td><div class="delivery-order-cell"><a class="link-button delivery-order-no" href="/admin/orders/${encodeURIComponent(row.id)}">${escapeHtml(row.orderNo || row.id)}</a><strong>${escapeHtml(row.customerName || '未知客户')}</strong><small>${escapeHtml(row.customerEmail || '未提供邮箱')}</small><span class="badge badge-info">${escapeHtml(orderStatus)}</span></div></td><td><strong>${escapeHtml(row.deviceName || '未知设备')}</strong><small class="delivery-period"><span>取货 ${escapeHtml(row.startDate)}</span><span>归还 ${escapeHtml(row.endDate)}</span></small></td><td><span class="delivery-address">${escapeHtml(row.pickupLocation || '未填写地址')}</span></td><td class="delivery-fee">${formatCurrency(Number(row.deliveryFee || 0))}</td><td>${renderBooking(row, 'outbound', configured)}</td><td>${renderBooking(row, 'return', configured)}</td></tr>`
  }).join('')
  const body = `<div class="page-header delivery-page-header"><div><p class="section-code">OPERATIONS / DELIVERY</p><h2>配送管理</h2><p>从订单确认到设备回收，集中处理每一笔上门配送。</p></div><div class="record-actions"><a class="button button-secondary" href="/admin/orders">租赁订单</a><a class="button button-secondary" href="/admin/calendar">租赁日历</a></div></div>
    ${error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ''}${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}
    ${!available ? '<div class="alert alert-danger"><strong>配送数据暂时不可用。</strong> 数据库查询失败，请检查 delivery_bookings 表或稍后重试。</div>' : ''}
    ${!configured ? '<div class="alert alert-warning"><strong>配送服务尚未配置。</strong> 请在「API 设置 → Zoom2u API」中填写配送管理 Token；状态仍可查看，但不能创建新配送单。</div>' : ''}
    ${issueCount ? `<div class="delivery-attention"><span class="delivery-attention__icon">!</span><div><strong>${issueCount} 笔配送需要跟进</strong><span>包含尝试送达、取消或配送暂停状态，请优先查看“需关注”队列。</span></div><button class="button button-sm button-secondary" type="button" data-delivery-filter="attention">查看异常</button></div>` : ''}
    <div class="stats-grid delivery-stats">${queueStats.map(([title, value, note, tone]) => `<div class="stat-card ${tone}"><h3>${title}</h3><div class="value">${value}</div><div class="trend">${note}</div></div>`).join('')}</div>
    <div class="panel delivery-panel"><div class="section-title delivery-panel__title"><div><h3>送货队列</h3><span class="section-note">最近 ${rows.length >= 200 ? '200' : rows.length} 笔未取消的送货订单 · 状态由 Zoom2u Webhook 实时更新</span></div><span class="delivery-result-count" aria-live="polite"><strong data-delivery-visible>${rows.length}</strong> / ${rows.length} 笔</span></div>
      <div class="delivery-toolbar"><label class="delivery-search"><span>搜索订单、客户、设备或地址</span><input class="form-control" type="search" placeholder="输入关键词…" data-delivery-search autocomplete="off"></label><div class="delivery-filters" role="group" aria-label="筛选配送队列"><button class="button button-sm button-primary" type="button" data-delivery-filter="all" aria-pressed="true">全部 <span>${rows.length}</span></button><button class="button button-sm button-secondary" type="button" data-delivery-filter="attention" aria-pressed="false">需关注 <span>${issueCount}</span></button><button class="button button-sm button-secondary" type="button" data-delivery-filter="pending" aria-pressed="false">待安排 <span>${pendingCount}</span></button><button class="button button-sm button-secondary" type="button" data-delivery-filter="outbound" aria-pressed="false">派送中 <span>${outboundCount}</span></button><button class="button button-sm button-secondary" type="button" data-delivery-filter="return" aria-pressed="false">待回收 <span>${returnCount}</span></button><button class="button button-sm button-secondary" type="button" data-delivery-filter="completed" aria-pressed="false">已完成 <span>${completedCount}</span></button></div></div>
      ${rows.length ? `<div class="table-wrapper delivery-table-wrapper"><table class="delivery-table"><thead><tr><th>订单 / 客户</th><th>设备 / 租期</th><th>送货地址</th><th>配送费</th><th>派送进度</th><th>回收进度</th></tr></thead><tbody>${rowMarkup}</tbody></table><div class="delivery-filter-empty" data-delivery-empty hidden>没有符合当前筛选条件的订单。<button class="link-button" type="button" data-delivery-clear>清除筛选</button></div></div>` : '<div class="empty-state"><strong>暂无送货订单</strong><span>网站订单审核并完成付款后，送货订单会出现在这里。</span><a class="button button-secondary button-sm" href="/admin/orders">查看租赁订单</a></div>'}
    </div>
    <style>
      .delivery-page-header{align-items:flex-end}.delivery-page-header p:last-child{max-width:620px}.delivery-stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:20px}.delivery-stats .stat-card{padding:20px 22px}.delivery-stats .stat-card .value{font-size:1.8rem}.delivery-panel{padding:24px}.delivery-panel__title{align-items:flex-start}.delivery-result-count{color:var(--text-secondary);font:600 .75rem var(--font-mono);white-space:nowrap}.delivery-result-count strong{color:var(--text);font-size:1rem}.delivery-toolbar{display:flex;align-items:flex-end;gap:16px;margin:-2px 0 18px;padding:14px;background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--radius)}.delivery-search{display:grid;gap:6px;min-width:230px;flex:1;color:var(--text-secondary);font:600 .68rem var(--font-mono);letter-spacing:.04em}.delivery-search .form-control{min-height:38px;background:var(--surface)}.delivery-filters{display:flex;flex-wrap:wrap;gap:6px}.delivery-filters .button{padding:8px 10px;font-size:.76rem}.delivery-filters .button span{opacity:.72;font-family:var(--font-mono)}.delivery-filters .button[aria-pressed=true]{box-shadow:0 0 0 2px var(--primary-light)}.delivery-table-wrapper{border-radius:var(--radius);overflow:auto}.delivery-table{min-width:1120px}.delivery-table th{white-space:nowrap}.delivery-table td{vertical-align:top;min-width:145px}.delivery-table td:first-child{min-width:205px}.delivery-table td:nth-child(2){min-width:155px}.delivery-table td:nth-child(3){min-width:220px;max-width:330px}.delivery-table td:nth-child(4){min-width:95px}.delivery-table td:nth-child(5),.delivery-table td:nth-child(6){min-width:185px}.delivery-order-cell,.delivery-status-card{display:flex;flex-direction:column;align-items:flex-start}.delivery-order-no{font-weight:700}.delivery-table td>strong,.delivery-table td>small{display:block;margin-top:5px}.delivery-period{display:grid;gap:3px}.delivery-period span:first-child{color:var(--text)}.delivery-period span:last-child{color:var(--text-secondary)}.delivery-address{display:block;max-width:280px;line-height:1.45;overflow-wrap:anywhere}.delivery-fee{font-family:var(--font-mono);font-weight:700;white-space:nowrap}.delivery-meta{display:block;margin-top:6px;color:var(--text-secondary);font-size:.75rem;line-height:1.35}.delivery-meta--alert{color:var(--danger);font-weight:600}.delivery-booking-form{display:flex;flex-direction:column;gap:6px;min-width:160px}.delivery-datetime{font-size:.78rem;padding:7px}.delivery-booking-form .button{white-space:nowrap}.delivery-booking-form .button:disabled{cursor:not-allowed;opacity:.62}.delivery-attention{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:14px 16px;border:1px solid #f0c36d;border-left:4px solid var(--warning);border-radius:var(--radius);background:#fff8e7}.delivery-attention__icon{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--warning);color:#fff;font-weight:800}.delivery-attention div{display:grid;gap:2px;flex:1}.delivery-attention span:not(.delivery-attention__icon){color:#805c18;font-size:.82rem}.delivery-filter-empty{padding:38px;text-align:center;color:var(--text-secondary)}.delivery-filter-empty .link-button{margin-left:6px}.empty-state{display:grid;justify-items:center;gap:10px;padding:48px 24px;color:var(--text-secondary)}.empty-state strong{color:var(--text);font-size:1.05rem}.empty-state span{font-size:.88rem}
      @media (max-width:1000px){.delivery-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.delivery-toolbar{align-items:stretch;flex-direction:column}.delivery-search{min-width:0}}
      @media (max-width:560px){.delivery-stats{grid-template-columns:1fr 1fr;gap:10px}.delivery-stats .stat-card{padding:16px}.delivery-stats .stat-card .value{font-size:1.45rem}.delivery-stats .stat-card .trend{font-size:.7rem}.delivery-panel{padding:16px}.delivery-panel__title{gap:8px}.delivery-attention{align-items:flex-start;flex-wrap:wrap}.delivery-attention .button{margin-left:40px}.delivery-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.delivery-filters .button{width:100%}}
      @media (prefers-reduced-motion:reduce){.delivery-table tbody tr{transition:none}}
    </style>
    <script>(()=>{const rows=[...document.querySelectorAll('[data-delivery-row]')],buttons=[...document.querySelectorAll('[data-delivery-filter]')],search=document.querySelector('[data-delivery-search]'),visible=document.querySelector('[data-delivery-visible]'),empty=document.querySelector('[data-delivery-empty]'),clear=document.querySelector('[data-delivery-clear]');if(!rows.length||!buttons.length)return;let active='all';const apply=()=>{const query=(search?.value||'').trim().toLowerCase();let count=0;rows.forEach(row=>{const matchesState=active==='all'||row.dataset.state===active;const matchesSearch=!query||(row.dataset.search||'').includes(query);const shown=matchesState&&matchesSearch;row.hidden=!shown;if(shown)count++});if(visible)visible.textContent=String(count);if(empty)empty.hidden=count>0;buttons.forEach(button=>{const selected=button.dataset.deliveryFilter===active;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('button-primary',selected);button.classList.toggle('button-secondary',!selected)});};buttons.forEach(button=>button.addEventListener('click',()=>{active=button.dataset.deliveryFilter||'all';apply()}));search?.addEventListener('input',apply);clear?.addEventListener('click',()=>{if(search)search.value='';active='all';apply()});document.querySelectorAll('.delivery-booking-form').forEach(form=>form.addEventListener('submit',()=>{const button=form.querySelector('button[type=submit]');if(button){button.disabled=true;button.textContent='正在创建…'}}));apply()})();</script>`
  return buildLayout('配送管理 - 电脑租赁管理系统', body, user)
}
