/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, getDeviceById, getDeviceRentalRules, formatCurrency } from '../../site'
import { escapeHtml as esc } from '../../lib/html'
import { getRentalLink, expireRentalLinkDrafts } from '../../services/rentalLinks'

export async function renderPublicRentalLink(c: Context) {
  c.header('Cache-Control', 'private, no-store')
  const link = await getRentalLink(c, c.req.param('token') || '')
  const device = link ? await getDeviceById(c, link.device_id) : null
  if (!link || !device || ['maintenance', 'retired'].includes(String(device.status))) return c.html(buildLayout('租赁链接不可用', '<div class="panel"><h2>该租赁链接暂不可用</h2><p>设备正在维护、已退役，或链接已停用。请联系工作人员。</p></div>'), 404)
  await expireRentalLinkDrafts(c)
  const rules = await getDeviceRentalRules(c, device.id)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const bookings = ((await c.env.RENT.prepare("SELECT startDate, endDate, startPeriod, endPeriod FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled') AND (endDate >= ? OR startDate IS NULL OR endDate IS NULL) ORDER BY startDate LIMIT 100").bind(device.id, today).all()).results || []) as any[]
  const unknownDates = bookings.some(booking => !booking.startDate || !booking.endDate)
  const periodLabel = (period: string) => period === 'PM' ? '下午' : '上午'
  const dateField = (name: string, label: string) => `<div class="form-group"><label class="form-label" for="rental-${name}">${label}</label><input class="form-control" type="date" id="rental-${name}" name="${name}" min="${today}" required></div>`
  const periodField = (name: string, label: string) => `<div class="form-group"><label class="form-label" for="rental-${name}">${label}</label><select class="form-control" id="rental-${name}" name="${name}"><option value="AM">上午</option><option value="PM">下午</option></select></div>`
  const body = `<div class="rental-link-shell"><div class="entity-header"><div class="identity-strip mono"><span>自助租赁</span><span>选择租期 → 填写资料并签约 → 付款</span></div><div class="entity-heading"><div><h2>${esc(link.title)}</h2><p>${esc(device.name)}${device.model ? ` · ${esc(device.model)}` : ''}</p></div><span class="badge badge-info">最短 ${rules.minimumRentalDays} 天</span></div></div>
    ${c.req.query('error') ? `<div class="page-notification page-notification--error" role="alert">${esc(c.req.query('error'))}</div>` : ''}
    <div class="grid grid-2"><section class="panel"><h3>选择您的租期</h3><p class="section-note">无需先注册。选择租期后，会为您单独生成合同，请在 30 分钟内完成签约。</p>
      ${unknownDates ? '<p class="alert">设备当前有一笔尚未确定归还日期的租赁，暂时无法在线预订，请联系工作人员。</p>' : ''}
      <form method="POST" action="/rent/${esc(link.token)}"><fieldset ${unknownDates ? 'disabled' : ''} style="border:0;padding:0;margin:0"><div class="grid grid-2">${dateField('startDate', '取货日期')}${periodField('startPeriod', '取货时段')}${dateField('endDate', '归还日期')}${periodField('endPeriod', '归还时段')}</div><p class="form-text">具体取还时间将在签约时确认。提交后系统会再次检查设备档期。</p><button class="button button-primary" type="submit">继续填写资料并签署合同</button></fieldset></form></section>
      <aside class="panel"><h3>租赁信息</h3><dl class="data-list"><div><dt>日租金</dt><dd>${formatCurrency(device.pricePerDay)}</dd></div><div><dt>押金</dt><dd>${formatCurrency(device.depositAmount)}</dd></div><div><dt>取货地点</dt><dd>${esc(link.pickup_location)}</dd></div><div><dt>归还地点</dt><dd>${esc(link.return_location)}</dd></div></dl>
        ${Number(device.weeklyDiscountPercent) ? `<p class="section-note">满 7 天部分租金优惠 ${Number(device.weeklyDiscountPercent)}%。</p>` : ''}${Number(device.monthlyDiscountPercent) ? `<p class="section-note">满 30 天部分租金优惠 ${Number(device.monthlyDiscountPercent)}%。</p>` : ''}<p class="form-text">租金按实际租期计算。完整金额、押金处理方式、可能产生的非营业时段服务费及支付手续费将在签约付款时展示。</p>
      </aside></div>
    <section class="panel"><h3>暂不可选的租期</h3><p class="form-text">以下时段已被预订${rules.bufferDays ? `，预订前后另预留 ${rules.bufferDays} 天周转时间` : ''}。</p>${bookings.filter(booking => booking.startDate && booking.endDate).length ? `<ul>${bookings.filter(booking => booking.startDate && booking.endDate).map(booking => `<li>${esc(booking.startDate)} ${periodLabel(booking.startPeriod)} — ${esc(booking.endDate)} ${periodLabel(booking.endPeriod)}</li>`).join('')}</ul>` : '<p class="section-note">暂无已预订的租期。</p>'}${rules.unavailableDates.filter(date => date >= today).length ? `<p class="section-note">设备维护或店铺不可用日期：${rules.unavailableDates.filter(date => date >= today).map(date => esc(date)).join('、')}</p>` : ''}</section></div>`
  return c.html(buildLayout(`${link.title} - 自助租赁`, body))
}
