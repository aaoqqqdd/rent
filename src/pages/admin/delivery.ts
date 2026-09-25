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

function badgeClass(status: string): string {
  const value = status.toLowerCase()
  if (['delivered', 'completed', 'returned'].includes(value)) return 'badge-success'
  if (['cancelled', 'failed', 'rejected'].includes(value)) return 'badge-danger'
  if (['booked', 'accepted', 'enroute', 'in_transit', 'pending'].includes(value)) return 'badge-primary'
  return 'badge-warning'
}

function bookingStatus(status: string | null): string {
  if (!status) return '未创建'
  return deliveryStatusInfo(status).label
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
    return `<span class="badge ${info.special ? 'badge-danger' : badgeClass(status || '')}">${escapeHtml(bookingStatus(status))}</span><small class="delivery-meta">${escapeHtml(info.description)}</small>${info.special ? '<small class="delivery-meta">该状态下不能更新或取消配送订单。</small>' : ''}${reference ? `<small class="delivery-meta">配送编号：${escapeHtml(reference)}</small>` : ''}${trackingUrl ? `<a class="link-button" href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer">查看追踪链接</a>` : ''}`
  }
  const eligibleStatuses = direction === 'outbound' ? ['paid', 'pending_pickup', 'active'] : ['active', 'extended', 'overdue', 'suspended', 'pending_return']
  const canCreate = configured && eligibleStatuses.includes(String(row.status).toLowerCase())
  return `<form method="post" action="/admin/delivery/bookings" class="delivery-booking-form"><input type="hidden" name="orderId" value="${escapeHtml(row.id)}"><input type="hidden" name="direction" value="${direction}"><input class="form-control delivery-datetime" type="datetime-local" name="readyDateTime" aria-label="${direction === 'outbound' ? '派送' : '回收'}时间" title="留空则按租期日期上午 9 点安排"><button class="button button-sm ${canCreate ? 'button-primary' : 'button-secondary'}" type="submit" ${canCreate ? '' : 'disabled'}>${direction === 'outbound' ? '创建派送单' : '创建回收单'}</button>${!configured ? '<small class="delivery-meta">需配置 Token</small>' : !canCreate ? '<small class="delivery-meta">当前订单状态不可创建</small>' : '<small class="delivery-meta">留空按租期日期 09:00</small>'}</form>`
}

export async function renderAdminDelivery(c: Context, user: any): Promise<string> {
  const { rows, available } = await getAdminDeliveryRows(c)
  const url = new URL(c.req.url)
  const error = url.searchParams.get('error') || ''
  const success = url.searchParams.get('success') || ''
  const deliveryConfig = await getDeliveryConfigSummary(c)
  const configured = deliveryConfig.adminConfigured
  const body = `<div class="page-header"><div><p class="section-code">OPERATIONS / DELIVERY</p><h2>配送管理</h2><p>统一查看送货与回收状态，并从这里创建 Zoom2u 配送订单。</p></div><div class="record-actions"><a class="button button-secondary" href="/admin/orders">租赁订单</a><a class="button button-secondary" href="/admin/calendar">租赁日历</a></div></div>
    ${error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ''}${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}
    ${!configured ? '<div class="alert">配送管理 Token 尚未配置。请在 rent 和 geekslope-web 两个 Worker 使用同一个 DELIVERY_ADMIN_TOKEN Secret。</div>' : ''}
    ${!available ? '<div class="alert">配送记录表尚未完成迁移。请先执行最新 D1 migration 0156。</div>' : ''}
    <div class="panel"><div class="section-title"><div><h3>送货订单</h3><span class="section-note">显示最近 200 笔未取消的送货订单</span></div><span class="badge badge-info">${rows.length} 笔</span></div>
      ${rows.length ? `<div class="table-wrapper"><table class="delivery-table"><thead><tr><th>订单 / 客户</th><th>设备 / 租期</th><th>送货地址</th><th>配送费</th><th>送货</th><th>回收</th></tr></thead><tbody>${rows.map(row => `<tr><td><a class="link-button" href="/admin/orders/${encodeURIComponent(row.id)}">${escapeHtml(row.orderNo || row.id)}</a><strong>${escapeHtml(row.customerName || '未知客户')}</strong><small>${escapeHtml(row.customerEmail || '')}</small><span class="badge badge-info">${escapeHtml(statusLabels[String(row.status).toLowerCase()] || row.status)}</span></td><td><strong>${escapeHtml(row.deviceName || '未知设备')}</strong><small>${escapeHtml(row.startDate)} 至 ${escapeHtml(row.endDate)}</small></td><td>${escapeHtml(row.pickupLocation || '未填写地址')}</td><td>${formatCurrency(Number(row.deliveryFee || 0))}</td><td>${renderBooking(row, 'outbound', configured)}</td><td>${renderBooking(row, 'return', configured)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">暂无送货订单。网站订单审核并完成付款后，订单会出现在这里。</div>'}
    </div>
    <style>.delivery-table td{vertical-align:top;min-width:130px}.delivery-table td:first-child{min-width:190px}.delivery-table td:nth-child(3){min-width:220px;max-width:320px;word-break:break-word}.delivery-table td>strong,.delivery-table td>small{display:block;margin-top:5px}.delivery-meta{display:block;margin-top:6px;color:var(--text-secondary);font-size:.78rem}.delivery-booking-form{display:flex;flex-direction:column;gap:6px;min-width:150px}.delivery-datetime{font-size:.78rem;padding:7px}.delivery-booking-form .button{white-space:nowrap}.empty-state{padding:40px;text-align:center;color:var(--text-secondary)}</style>`
  return buildLayout('配送管理 - 电脑租赁管理系统', body, user)
}
