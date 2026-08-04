/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import type { Context } from 'hono'
import { buildLayout, CONTRACT_OPERATIONAL_FIELDS, CONTRACT_SIGNED_FIELDS, getContractById, validateHostedImageUrls } from '../../site'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))

export async function renderAdminContractData(c: Context, user: any, contractId: string) {
  const contract = await getContractById(c, contractId)
  if (!contract) return buildLayout('合同未找到', '<div class="panel"><h2>合同未找到</h2></div>', user)
  const data = typeof contract.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : (contract.contract_data || {})
  let damageImages: string[] = []
  try { if ((data as any).damage_photos) damageImages = validateHostedImageUrls((data as any).damage_photos) } catch {}
  const dateFields = new Set(['return_date', 'inspection_date', 'collection_date'])
  const numberFields = new Set(['delivery_fee', 'discount', 'replacement_cost', 'battery_cycles'])
  const longFields = new Set(['damage_description', 'damage_photos', 'notes', 'esign_signature', 'company_signature'])
  const options: Record<string, string[]> = {
    delivery_method: ['Pickup', 'Delivery'], return_status: ['Returned', 'Overdue', 'Damaged'],
    collection_required: ['否', '是'], power_test: ['通过', '失败'], insurance_required: ['否', '是'], waiver_signed: ['否', '是'],
    jurisdiction: ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
  }
  const renderField = ([name, label]: typeof CONTRACT_OPERATIONAL_FIELDS[number]) => {
    const value = escape((data as any)[name])
    if (options[name]) return `<div class="form-group"><label class="form-label" for="${name}">${label} <code>\${${name}}</code></label><select class="form-control" id="${name}" name="${name}"><option value="">请选择</option>${options[name].map(option => `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>`
    if (longFields.has(name)) return `<div class="form-group"><label class="form-label" for="${name}">${label} <code>\${${name}}</code></label><textarea class="form-control" id="${name}" name="${name}" rows="3">${value}</textarea></div>`
    const type = dateFields.has(name) ? 'date' : numberFields.has(name) ? 'number' : 'text'
    const numeric = type === 'number' ? ' min="0" step="0.01"' : ''
    return `<div class="form-group"><label class="form-label" for="${name}">${label} <code>\${${name}}</code></label><input class="form-control" type="${type}" id="${name}" name="${name}" value="${value}"${numeric}></div>`
  }
  const groups = [
    ['发票与交付', ['invoice_number','delivery_method','delivery_fee','return_status','return_date','inspection_date','inspection_by']],
    ['设备配置', ['device_brand','device_cpu','device_ram','device_storage','device_gpu','device_os','battery_health','charger_sn','asset_tag']],
    ['电子签约', ['esign_signature','company_signature','esign_location','esign_browser','esign_os','agreement_version']],
    ['优惠与损坏', ['discount','coupon_code','damage_description','damage_photos','repair_invoice','replacement_cost','collection_required','collection_date']],
    ['设备检查', ['screen_condition','keyboard_condition','trackpad_condition','body_condition','camera_condition','wifi_condition','battery_cycles','power_test']],
    ['后台与法律', ['approved_by','notes','jurisdiction','insurance_required','insurance_provider','waiver_signed','privacy_version']],
  ] as const
  const available = CONTRACT_OPERATIONAL_FIELDS.filter(([name]) => contract.status !== 'signed' || !CONTRACT_SIGNED_FIELDS.has(name))
  const sections = groups.map(([title, names]) => `<section style="margin-top:24px"><h3>${title}</h3><div class="grid grid-2">${available.filter(([name]) => (names as readonly string[]).includes(name)).map(renderField).join('')}</div></section>`).join('')
  const previews = damageImages.length ? `<section><h3>损坏照片预览</h3><div style="display:flex;gap:12px;flex-wrap:wrap">${damageImages.map(url => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><img src="${escape(url)}" alt="损坏照片" loading="lazy" referrerpolicy="no-referrer" style="width:180px;height:130px;object-fit:cover;border-radius:8px"></a>`).join('')}</div></section>` : ''
  return buildLayout('合同变量数据', `<div class="panel"><div class="section-title"><h2>合同变量数据</h2><a class="button button-secondary" href="/admin/contracts/${contract.id}">返回合同</a></div><p class="section-note">付款、退款、逾期费用和后台时间等字段由系统自动计算；这里维护设备配置、交付、检查、损坏及法律资料。合同签署后，电子签约记录不可修改。</p>${previews}<form method="post" action="/admin/contracts/${contract.id}/data">${sections}<button class="button button-primary" type="submit">保存合同资料</button></form></div>`, user)
}
