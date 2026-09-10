/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 站点变量 / 合同变量渲染：把模板里的 ${var} / {var} 占位符替换为实际值，
// 敏感字段（证件号等）默认脱敏，输出统一经 sanitize。合同字段的分组元数据
// 供管理端「变量说明」页使用。依赖 settings、lib（html/json/format/reference）、
// db（getUserById）、audit 无关。

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { sanitizeRichHtml, renderFlexibleContent } from '../lib/html'
import { safeJsonParse } from '../lib/json'
import { formatMelbourneDateTime } from '../lib/format'
import { generateReferenceNumber } from '../lib/reference'
import { getDB } from '../db/client'
import { getUserById } from '../db/repositories'
import type { Contract } from '../db/types'
import { systemSettings } from '../settings/systemSettings'

export function escapeContractValue(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

function maskContractValue(name: string, value: unknown): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (name === 'customer_id_number') return text.length <= 4 ? '****' : `${text.slice(0, 2)}${'*'.repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`
  if (name === 'customer_dob') return '****-**-**'
  if (name === 'customer_address') return text.length > 8 ? `${text.slice(0, 8)}****` : '****'
  if (name === 'esign_ip') return text.includes(':') ? `${text.split(':').slice(0, 2).join(':')}:****` : `${text.split('.').slice(0, 2).join('.')}.*.*`
  return text
}

export function renderSiteVariables(content: string, currentUser: any = {}, extraValues: Record<string, unknown> = {}): string {
  const values: Record<string, unknown> = {
    company_name: systemSettings.companyDetails.name,
    company_abn: systemSettings.companyDetails.abn,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    user_terms_version: systemSettings.legalMetadata.user.version,
    user_terms_last_updated_date: systemSettings.legalMetadata.user.lastUpdatedDate,
    // 兼容旧模板变量名
    user_agreement_version: systemSettings.legalMetadata.user.version,
    user_agreement_last_updated_date: systemSettings.legalMetadata.user.lastUpdatedDate,
    service_terms_version: systemSettings.legalMetadata.service.version,
    service_terms_last_updated_date: systemSettings.legalMetadata.service.lastUpdatedDate,
    privacy_policy_version: systemSettings.legalMetadata.privacy.version,
    privacy_policy_last_updated_date: systemSettings.legalMetadata.privacy.lastUpdatedDate,
    refund_policy_version: systemSettings.legalMetadata.copyright.version,
    refund_policy_last_updated_date: systemSettings.legalMetadata.copyright.lastUpdatedDate,
    cookie_policy_version: systemSettings.legalMetadata.cookie.version,
    cookie_policy_last_updated_date: systemSettings.legalMetadata.cookie.lastUpdatedDate,
    complaints_policy_version: systemSettings.legalMetadata.complaints.version,
    complaints_policy_last_updated_date: systemSettings.legalMetadata.complaints.lastUpdatedDate,
    acceptable_use_policy_version: systemSettings.legalMetadata.aup.version,
    acceptable_use_policy_last_updated_date: systemSettings.legalMetadata.aup.lastUpdatedDate,
    consumer_rights_version: systemSettings.legalMetadata.consumer.version,
    consumer_rights_last_updated_date: systemSettings.legalMetadata.consumer.lastUpdatedDate,
    user_name: currentUser?.name || '',
    user_email: currentUser?.email || '',
    ...extraValues,
  }

  const filled = Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\$\\{${key}\\}|\\{${key}\\}`, 'g'), escapeContractValue(value))
  }, String(content ?? ''))

  return sanitizeRichHtml(filled)
}

export const CONTRACT_VARIABLE_NAMES = [
  'contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction',
  'company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo',
  'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone',
  'device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories',
  'start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status',
  'currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference',
  'bank_name', 'account_name', 'bank_bsb', 'bank_account',
  'late_days', 'late_fee_per_day', 'late_fee',
  'inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes',
  'damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice',
  'deposit_refund', 'refund_amount', 'refund_date',
  'signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os',
  'company_representative', 'customer_initials', 'insurance_selected', 'insurance_fee',
  'pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement',
  'created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url',
] as const

export const CONTRACT_VARIABLE_GROUPS = [
  ['合同', ['contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction']],
  ['公司', ['company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo']],
  ['客户', ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone']],
  ['设备', ['device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories']],
  ['租赁', ['start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status']],
  ['付款', ['currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference']],
  ['银行', ['bank_name', 'account_name', 'bank_bsb', 'bank_account']],
  ['逾期归还', ['late_days', 'late_fee_per_day', 'late_fee']],
  ['验机', ['inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes']],
  ['损坏', ['damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice']],
  ['退款', ['deposit_refund', 'refund_amount', 'refund_date']],
  ['电子签名', ['signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os']],
  ['代表与确认', ['company_representative', 'customer_initials']],
  ['保险', ['insurance_selected', 'insurance_fee']],
  ['取还时间', ['pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement']],
  ['系统', ['created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url']],
] as const

// 证件号码在任何非本人视图里默认脱敏；只有 MANAGER/ADMIN 主动“显示完整证件”
// （经 sensitive_data_access_logs + 审计）或客户查看本人合同时才展示完整值。
// 完善.md — 普通 STAFF 不得查看完整证件号码。
export const SENSITIVE_CONTRACT_FIELDS = new Set(['customer_id_number'])

export async function logSensitiveDataAccess(
  c: Context,
  input: { actorId: string; targetUserId: string; field: string; purpose: string },
): Promise<void> {
  await getDB(c).prepare(
    'INSERT INTO sensitive_data_access_logs (id, actor_id, target_user_id, field_name, purpose) VALUES (?, ?, ?, ?, ?)',
  ).bind(`sda-${nanoid(14)}`, input.actorId, input.targetUserId, input.field, String(input.purpose || '').slice(0, 200)).run()
}

export function renderContractVariables(content: string, contract: Contract, order?: any, device?: any, customer?: any, extra: Record<string, unknown> = {}, includeInternal = false, revealSensitive = false): string {
  const rentOnly = Math.max(0, Number(order?.totalAmount ?? order?.total_amount ?? 0) - Number(order?.depositAmount ?? order?.deposit_amount ?? 0))
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const creatorName = String(extra.created_by || stored.created_by || '').trim()
  const emptyVariables = Object.fromEntries(CONTRACT_VARIABLE_NAMES.map(name => [name, '']))
  const values: Record<string, unknown> = {
    ...emptyVariables,
    ...stored,
    ...extra,
    contract_number: contract.contractNumber,
    order_no: order?.orderNo ?? order?.order_no,
    agreement_version: stored.agreement_version || '1.0',
    jurisdiction: stored.jurisdiction || 'VIC',
    company_name: systemSettings.companyDetails.name,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_contact: systemSettings.companyDetails.contact,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    customer_name: customer?.name,
    customer_phone: customer?.phone,
    customer_email: customer?.email,
    customer_address: stored.customer_address || customer?.address,
    customer_dob: stored.customer_dob || customer?.dob,
    customer_country: stored.customer_country || customer?.country,
    customer_id_type: stored.customer_id_type || contract.customer_id_type,
    customer_id_number: stored.customer_id_number || contract.customer_id_number,
    device_name: device?.name ?? order?.deviceName,
    device_brand: device?.brand,
    device_model: device?.model,
    device_cpu: device?.cpu,
    device_ram: device?.ram,
    device_storage: device?.storage,
    device_gpu: device?.gpu,
    device_os: device?.os,
    device_sn: device?.serialNumber ?? device?.serial_number,
    asset_tag: device?.assetTag ?? device?.asset_tag,
    charger_sn: stored.charger_sn || device?.chargerSn || device?.charger_sn,
    battery_health: stored.battery_health || device?.batteryHealth || device?.battery_health,
    battery_cycles: stored.battery_cycles || device?.batteryCycles || device?.battery_cycles,
    device_condition: stored.device_condition || contract.device_condition,
    device_accessories: stored.device_accessories || contract.device_accessories,
    start_date: order?.startDate ?? order?.start_date,
    end_date: order?.endDate ?? order?.end_date,
    rental_days: order?.rentalPeriod ?? order?.rental_period,
    daily_rate: Number(order?.dailyRate ?? order?.daily_rate ?? device?.pricePerDay ?? 0).toFixed(2),
    total_rent: rentOnly.toFixed(2),
    deposit_amount: Number(order?.depositAmount ?? order?.deposit_amount ?? 0).toFixed(2),
    late_fee_per_day: Number(stored.late_fee_per_day ?? contract.late_fee_per_day ?? 0).toFixed(2),
    repair_cost: stored.repair_cost ?? (contract.repair_cost == null ? '' : Number(contract.repair_cost).toFixed(2)),
    pickup_location: stored.pickup_location || contract.pickup_location,
    return_location: stored.return_location || contract.return_location,
    payment_method: order?.paymentMethod ?? order?.payment_method,
    bank_name: systemSettings.bankDetails.bankName,
    bank_bsb: systemSettings.bankDetails.bsb,
    bank_account: systemSettings.bankDetails.account,
    account_name: systemSettings.bankDetails.accountName,
    company_abn: systemSettings.companyDetails.abn,
    gst_included: systemSettings.companyDetails.gstIncluded ? '是' : '否',
    company_signature: creatorName,
    signer_name: stored.signer_name || customer?.name,
    sign_time: formatMelbourneDateTime(contract.signedAt),
    esign_ip: contract.esign_ip,
    esign_device: contract.esign_device,
    device_id: device?.id ?? order?.deviceId ?? order?.device_id,
    currency: 'AUD',
    created_time: contract.createdAt ?? (contract as any).created_at,
    updated_time: (contract as any).updatedAt ?? (contract as any).updated_at,
    contract_status: contract.status,
    refund_policy_version: stored.refund_policy_version || systemSettings.legalMetadata.copyright.version,
    last_updated_date: stored.last_updated_date || systemSettings.legalMetadata.copyright.lastUpdatedDate,
    rental_agreement_version: stored.rental_agreement_version || systemSettings.legalMetadata.rental.version,
    rental_agreement_last_updated_date: stored.rental_agreement_last_updated_date || systemSettings.legalMetadata.rental.lastUpdatedDate,
    contract_version: systemSettings.legalMetadata.contract.version,
    contract_last_updated_date: systemSettings.legalMetadata.contract.lastUpdatedDate,
    company_representative: creatorName,
    contract_url: stored.contract_url || `/contract/view/${contract.id}`,
    invoice_url: stored.invoice_url || (order?.id ? `/orders/${order.id}/invoice` : ''),
    deleted: contract.deleted_at ? '是' : '否',
  }
  if (!includeInternal) values.deleted = ''
  const filled = Object.entries(values).reduce((result, [name, value]) => {
    const signature = name === 'esign_signature' || name === 'company_signature'
    const raw = String(value ?? '')
    const forceMaskSensitive = SENSITIVE_CONTRACT_FIELDS.has(name) && !revealSensitive
    const safe = signature && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw)
      ? `<img src="${raw}" alt="电子签名" style="max-width:280px;max-height:100px;object-fit:contain">`
      : escapeContractValue(forceMaskSensitive || !includeInternal ? maskContractValue(name, value) : value)
    return result.replace(new RegExp(`\\$\\{${name}\\}|\\{${name}\\}`, 'g'), safe)
  }, String(content || ''))
  return renderFlexibleContent(filled)
}

export const CONTRACT_OPERATIONAL_FIELDS = [
  ['refund_policy_version', '退款政策版本'], ['last_updated_date', '协议最后更新日期'],
  ['rental_agreement_version', '租赁协议版本'], ['rental_agreement_last_updated_date', '租赁协议最后更新日期'],
  ['contract_version', '正式合同版本'], ['contract_last_updated_date', '正式合同最后更新日期'],
  ['agreement_version', '合同版本'], ['jurisdiction', '司法管辖区'],
  ['customer_address', '客户地址'], ['customer_dob', '客户出生日期'], ['customer_country', '客户国家'], ['customer_id_type', '证件类型'], ['customer_id_number', '证件号码'], ['customer_driver_expiry', '驾照到期日'], ['emergency_contact', '紧急联系人'], ['emergency_phone', '紧急联系电话'],
  ['invoice_number', '发票编号'], ['delivery_method', '配送方式（Pickup / Delivery）'], ['delivery_fee', '配送费'], ['return_method', '归还方式（CourierPickup / StoreReturn）'], ['pickup_location', '取货地点'], ['return_location', '归还地点'], ['pickup_time', '取货时间'], ['return_time', '归还时间'],
  ['return_status', '归还状态'], ['return_date', '实际归还日期'], ['inspection_date', '检查日期'], ['inspection_by', '检查员工'],
  ['device_brand', '设备品牌'], ['device_cpu', 'CPU'], ['device_ram', '内存'], ['device_storage', '存储'], ['device_gpu', '显卡'], ['device_os', '设备操作系统'],
  ['battery_health', '电池健康'], ['charger_sn', '充电器 SN'], ['asset_tag', '公司资产编号'], ['device_condition', '设备状况'], ['device_accessories', '交付配件'],
  ['esign_signature', '客户电子签名'], ['company_signature', '公司电子签名'], ['esign_location', '签约 GPS 位置'], ['esign_browser', '签约浏览器'], ['esign_os', '签约操作系统'], ['company_representative', '公司代表'], ['customer_initials', '客户姓名首字母'],
  ['discount', '优惠金额'], ['coupon_code', '优惠码'],
  ['damage_description', '损坏说明'], ['damage_photos', '损坏照片 URL'], ['repair_invoice', '维修发票'], ['replacement_cost', '更换费用'], ['repair_cost', '维修费用'],
  ['collection_required', '是否需要追回'], ['collection_date', '回收日期'],
  ['screen_condition', '屏幕状况'], ['keyboard_condition', '键盘状况'], ['trackpad_condition', '触控板状况'], ['body_condition', '外壳状况'], ['camera_condition', '摄像头状况'], ['wifi_condition', 'WiFi 状况'], ['battery_cycles', '电池循环次数'], ['power_test', '开机测试'], ['inspection_notes', '验机备注'], ['accessories_returned', '已归还配件'], ['customer_acknowledgement', '客户确认'],
  ['approved_by', '审批员工'], ['notes', '内部备注'], ['qr_code', '合同二维码图片 URL'],
  ['insurance_selected', '是否选择保险'], ['insurance_fee', '保险费用'], ['insurance_provider', '保险公司'], ['waiver_signed', '是否签署免责'], ['privacy_version', '隐私政策版本'],
] as const

export const CONTRACT_COMPUTED_FIELDS = [
  ['device_id', '系统内部设备 ID'], ['currency', '币种'], ['deposit_paid', '已支付押金'], ['rent_paid', '已支付租金'], ['amount_due', '剩余应付款'], ['payment_date', '付款日期'], ['payment_reference', '银行 Reference'],
  ['subtotal', '小计'], ['gst_amount', 'GST 金额'], ['refund_amount', '退款金额'], ['deposit_refund', '押金退款'], ['refund_date', '退款日期'], ['deduction_amount', '押金扣除金额'],
  ['late_days', '逾期天数'], ['late_fee', '逾期费用'], ['created_by', '创建员工'], ['created_time', '创建时间'], ['updated_time', '更新时间'], ['contract_status', '合同状态'], ['deleted', '是否删除'],
] as const

export const CONTRACT_SIGNED_FIELDS = new Set([
  'signer_name', 'customer_initials', 'esign_signature', 'company_signature', 'esign_location', 'esign_browser', 'esign_os', 'agreement_version',
])

export async function getContractVariableData(c: Context, contract: Contract, order: any): Promise<Record<string, unknown>> {
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const [payments, reference, refund, creator] = await Promise.all([
    c.env.RENT.prepare("SELECT COALESCE(SUM(amount),0) paid, COALESCE(SUM(deposit_amount),0) deposit_paid, COALESCE(SUM(rental_amount),0) rent_paid, MAX(paid_at) payment_date, MAX(currency) currency FROM payments WHERE rental_id = ? AND status = 'paid'").bind(order.id).first(),
    c.env.RENT.prepare("SELECT pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.created_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare("SELECT type, refund_amount, deduction_amount, created_at FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(),
    (contract.createdBy || contract.created_by) ? getUserById(c, contract.createdBy || contract.created_by || '') : Promise.resolve(null),
  ]) as any[]
  const invoice = await c.env.RENT.prepare("SELECT invoice_number FROM invoices WHERE order_id = ? AND type = 'invoice' ORDER BY issued_at DESC LIMIT 1").bind(order.id).first() as any
  const publicOrigin = new URL(c.req.url).origin
  const paid = Number(payments?.paid || 0)
  const deposit = Number(order.depositAmount ?? order.deposit_amount ?? 0)
  const total = Number(order.totalAmount ?? order.total_amount ?? 0)
  const discount = Number(stored.discount || 0)
  const deliveryFee = Number(stored.delivery_fee || 0)
  const rentSubtotal = Math.max(0, total - deposit - deliveryFee + discount)
  const returnDate = stored.return_date ? new Date(String(stored.return_date)) : null
  const dueDate = new Date(order.endDate ?? order.end_date)
  const lateDays = returnDate && returnDate > dueDate ? Math.ceil((returnDate.getTime() - dueDate.getTime()) / 86400000) : 0
  const returnStatus = stored.damage_description ? 'Damaged' : stored.return_date ? (lateDays > 0 ? 'Overdue' : 'Returned') : (order.status === 'completed' ? 'Returned' : '')
  return {
    ...stored,
    invoice_number: invoice?.invoice_number || stored.invoice_number || generateReferenceNumber('INV'),
    currency: payments?.currency || 'AUD',
    deposit_paid: Number(payments?.deposit_paid || 0).toFixed(2),
    rent_paid: Number(payments?.rent_paid || 0).toFixed(2),
    amount_due: Math.max(0, total - paid).toFixed(2),
    payment_date: payments?.payment_date || '',
    payment_reference: reference?.reference_number || '',
    subtotal: rentSubtotal.toFixed(2),
    gst_amount: systemSettings.companyDetails.gstIncluded ? (rentSubtotal / 11).toFixed(2) : '0.00',
    refund_amount: Number(refund?.refund_amount || 0).toFixed(2),
    deposit_refund: Number(refund?.type === 'deposit' ? refund.refund_amount : 0).toFixed(2),
    refund_date: refund?.created_at || '',
    deduction_amount: Number(refund?.deduction_amount || 0).toFixed(2),
    late_days: lateDays,
    late_fee: (lateDays * Number(contract.late_fee_per_day || 0)).toFixed(2),
    return_status: returnStatus,
    created_by: creator?.name || contract.createdBy || '',
    contract_url: `/contract/view/${contract.id}`,
    invoice_url: new URL(`/orders/${order.id}/invoice`, publicOrigin).toString(),
  }
}
