/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, getDevices, getSystemSettings, loadSystemSettingsFromDB } from '../../site'
import { escapeHtml as esc } from '../../lib/html'

export async function renderAdminRentalLinks(c: Context, user: any) {
  await loadSystemSettingsFromDB(c)
  const [devices, links] = await Promise.all([
    getDevices(c),
    c.env.RENT.prepare('SELECT l.*, d.name AS device_name, d.serialNumber, (SELECT COUNT(*) FROM orders o WHERE o.rental_link_id = l.id) AS order_count FROM rental_links l JOIN devices d ON d.id = l.device_id ORDER BY l.created_at DESC').all(),
  ])
  const locations = getSystemSettings().companyDetails.pickupLocations
  const input = (name: string, label: string, extra = '') => `<div class="form-group"><label class="form-label" for="link-${name}">${label}</label><input class="form-control" id="link-${name}" name="${name}" ${extra}></div>`
  const body = `<div class="page-header"><div><h2>自助租赁链接</h2><p>为单台设备创建固定链接。不同客户打开同一链接，选择各自的租期、签约并付款。</p></div><a class="button button-secondary" href="/admin/orders">查看租赁订单</a></div>
    ${c.req.query('error') ? `<div class="page-notification page-notification--error" role="alert">${esc(c.req.query('error'))}</div>` : ''}
    ${c.req.query('created') ? '<div class="page-notification page-notification--success">固定链接已创建，可在下方复制并分享给多个客户。</div>' : ''}
    <section class="panel"><h3>创建固定链接</h3><form method="POST" action="/admin/rental-links"><div class="grid grid-2">
      <div class="form-group"><label class="form-label" for="link-deviceId">指定设备</label><select class="form-control" id="link-deviceId" name="deviceId" required><option value="">请选择一台设备</option>${devices.filter(device => !['maintenance', 'retired'].includes(String(device.status))).map(device => `<option value="${esc(device.id)}">${esc(device.name)} · ${esc(device.serialNumber)}</option>`).join('')}</select></div>
      ${input('title', '链接名称（选填）', 'maxlength="120" placeholder="默认使用设备名称"')}
      ${input('pickupLocation', '自取地点', `required maxlength="300" list="link-locations" value="${esc(locations[0] || '')}"`)}
      ${input('returnLocation', '归还地点', `required maxlength="300" list="link-locations" value="${esc(locations[0] || '')}"`)}
      ${input('deviceCondition', '设备状况（选填）', 'maxlength="1000" placeholder="默认以交付验机记录为准"')}
      ${input('deviceAccessories', '随附配件（选填）', 'maxlength="500"')}
      ${input('lateFeePerDay', '合同约定逾期费用 / 天（AUD，选填）', 'type="number" min="0" max="99999" step="0.01" placeholder="0"')}
    </div><datalist id="link-locations">${locations.map(location => `<option value="${esc(location)}">`).join('')}</datalist><p class="form-text">租金与押金使用设备当前定价，客户自行选择租期。链接长期有效，直到管理员停用；每次签约会生成独立合同。停用不影响已经生成的合同和订单。</p><button class="button button-primary" type="submit">生成固定链接</button></form></section>
    <section class="panel"><h3>已创建的链接</h3>${(links.results || []).length ? `<div class="table-wrapper"><table><thead><tr><th>名称 / 设备</th><th>固定链接</th><th>状态</th><th>订单数</th><th>操作</th></tr></thead><tbody>${(links.results as any[]).map(link => {
      const url = new URL(`/rent/${link.token}`, c.req.url).toString()
      return `<tr><td><strong>${esc(link.title)}</strong><br>${esc(link.device_name)} · ${esc(link.serialNumber)}</td><td><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="word-break:break-all">${esc(url)}</a></td><td>${link.enabled ? '启用中' : '已停用'}</td><td>${Number(link.order_count)}</td><td><div class="record-actions"><button class="button button-secondary" type="button" data-rental-link-copy="${esc(url)}">复制链接</button><form method="POST" action="/admin/rental-links/${encodeURIComponent(link.id)}/toggle"><input type="hidden" name="enabled" value="${link.enabled ? '0' : '1'}"><button class="button button-secondary" type="submit">${link.enabled ? '停用' : '启用'}</button></form></div></td></tr>`
    }).join('')}</tbody></table></div>` : '<p class="empty-state">还没有固定链接。选择设备并生成第一个链接。</p>'}</section>
    <script>document.querySelectorAll('[data-rental-link-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.rentalLinkCopy);button.textContent='已复制'}catch{button.textContent='请手动复制链接'}}));</script>`
  return buildLayout('自助租赁链接 - 电脑租赁管理系统', body, user)
}
