/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 独立营销官网的公开购物车下单接口。一次请求可为最多 10 台设备分别创建
// pending_approval 订单；不生成合同、不收款，管理员确认后再进入签约流程。

import { Context } from 'hono'
import { nanoid } from 'nanoid'
import {
  createNotification,
  findUserByEmail,
  generateUniqueUserId,
  getDeviceById,
  getSystemSettings,
  getUsers,
  hasDeviceBookingConflict,
  hashPassword,
  insertOrder,
  insertUser,
  isStrongPassword,
  loadSystemSettingsFromDB,
  verifyPassword,
  type Order,
} from '../../site'
import { calculateCouponDiscount, checkCustomerCouponEligibility } from '../coupons'
import { getStripePublishableKey, stripeRequest } from '../../stripe'
import { canUseAccountBalance } from '../../lib/access'

const AU_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']
const MAX_CART_ITEMS = 10

function json(c: Context, status: number, payload: Record<string, unknown>): Response {
  return c.json(payload, status as never)
}

function parseDeviceIds(body: Record<string, unknown>): string[] {
  let values: unknown[] = []
  if (Array.isArray(body.deviceIds)) values = body.deviceIds
  else if (typeof body.deviceIds === 'string') {
    try {
      const parsed = JSON.parse(body.deviceIds)
      values = Array.isArray(parsed) ? parsed : body.deviceIds.split(',')
    } catch {
      values = body.deviceIds.split(',')
    }
  }
  if (!values.length && body.deviceId) values = [body.deviceId]
  return values.map((value) => String(value || '').trim()).filter((id, index, ids) => id && ids.indexOf(id) === index)
}

async function verifyTurnstile(c: Context, token: string): Promise<boolean> {
  const secret = String((c.env as Record<string, unknown>).TURNSTILE_SECRET_KEY || '')
  if (!secret) return true
  if (!token) return false
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: c.req.header('CF-Connecting-IP') }),
  }).then((response) => response.json()).catch(() => ({ success: false })) as { success?: boolean }
  return Boolean(result.success)
}

export async function createPublicRentalSetupIntent(c: Context): Promise<Record<string, unknown>> {
  await loadSystemSettingsFromDB(c)
  const params = new URLSearchParams({
    usage: 'off_session',
    'automatic_payment_methods[enabled]': 'true',
    'metadata[source]': 'rent-web-rental-application',
  })
  const intent = await stripeRequest(c, 'setup_intents', params, `rental-setup-${nanoid(12)}`)
  return { clientSecret: intent.client_secret, publishableKey: await getStripePublishableKey(c), feeRate: getSystemSettings().paymentMethods.processingFeeRate ?? 0.025 }
}

export async function lookupPublicAccountBalance(c: Context, email: string): Promise<Record<string, unknown>> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { ok: true, available: false, accountEligible: false }
  await loadSystemSettingsFromDB(c)
  const user = await findUserByEmail(c, normalizedEmail) as any
  const accountEligible = canUseAccountBalance(user)
    && String(user?.status || 'active').toLowerCase() !== 'inactive'
    && String(user?.account_status || 'active').toLowerCase() !== 'banned'
  const available = getSystemSettings().paymentMethods.balancePayment && accountEligible && Number(user?.balance || 0) > 0
  return { ok: true, available, accountEligible }
}

async function verifyPublicRentalSetupIntent(c: Context, setupIntentId: string): Promise<{ id: string; paymentMethodId: string }> {
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) throw new Error('信用卡验证信息无效，请重新验证。')
  const intent = await stripeRequest(c, `setup_intents/${setupIntentId}`)
  const paymentMethodId = typeof intent.payment_method === 'string' ? intent.payment_method : String(intent.payment_method?.id || '')
  if (intent.status !== 'succeeded' || !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) throw new Error('请先完成信用卡验证。')
  return { id: setupIntentId, paymentMethodId }
}

function couponMatchesDevice(coupon: any, device: any): boolean {
  const text = [device.name, device.brand, device.model, device.cpu, device.ram, device.storage, device.gpu, device.os, device.description]
    .filter(Boolean).join(' ').toLowerCase()
  return (!coupon.device_id || String(coupon.device_id) === String(device.id))
    && (!coupon.brand || String(device.brand || '').trim().toLowerCase() === String(coupon.brand).trim().toLowerCase())
    && (!coupon.config_keyword || text.includes(String(coupon.config_keyword).trim().toLowerCase()))
}

export async function previewPublicRentalCoupon(c: Context, deviceIds: string[], days: number, code: string): Promise<Record<string, unknown>> {
  if (!deviceIds.length || !Number.isInteger(days) || days < 1 || days > 365 || !code) {
    return { ok: false, message: '请先选择有效租期并输入优惠码。' }
  }
  const devices: any[] = []
  for (const deviceId of deviceIds.slice(0, MAX_CART_ITEMS)) {
    const device = await getDeviceById(c, deviceId) as any
    if (!device) return { ok: false, message: '购物车中有设备不存在或已下架。' }
    devices.push(device)
  }
  const coupon = await c.env.RENT.prepare(
    "SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)",
  ).bind(code.toUpperCase().slice(0, 40)).first() as any
  if (!coupon) return { ok: false, message: '优惠码无效、已过期或已达到使用次数上限。' }
  const rentAmounts = devices.map((device) => Number((days * Number(device.pricePerDay || 0)).toFixed(2)))
  const eligibleIndexes = devices.map((device, index) => couponMatchesDevice(coupon, device) ? index : -1).filter((index) => index >= 0)
  if (!eligibleIndexes.length) return { ok: false, message: '该优惠码不适用于购物车中的设备。' }
  const eligibleSubtotal = eligibleIndexes.reduce((sum, index) => sum + rentAmounts[index], 0)
  if (coupon.minimum_order_amount && eligibleSubtotal < Number(coupon.minimum_order_amount)) {
    return { ok: false, message: `订单金额未达到该优惠码要求的最低消费 AUD$${Number(coupon.minimum_order_amount).toFixed(2)}。` }
  }
  coupon._discountableBase = eligibleSubtotal
  const discount = calculateCouponDiscount(coupon, eligibleSubtotal)
  const deposit = devices.reduce((sum, device) => sum + Number(device.depositAmount || 0), 0)
  return {
    ok: true,
    rent: Number(rentAmounts.reduce((sum, amount) => sum + amount, 0).toFixed(2)),
    discount: Number(discount.toFixed(2)),
    deposit: Number(deposit.toFixed(2)),
    total: Number((rentAmounts.reduce((sum, amount) => sum + amount, 0) + deposit - discount).toFixed(2)),
    message: `已优惠 AUD$${discount.toFixed(2)}`,
  }
}

export async function handlePublicRentalRequest(c: Context, body: Record<string, unknown>): Promise<Response> {
  if (!(await verifyTurnstile(c, String(body['cf-turnstile-response'] || '')))) {
    return json(c, 400, { ok: false, message: '人机验证失败，请重试。' })
  }

  const deviceIds = parseDeviceIds(body)
  if (!deviceIds.length) return json(c, 400, { ok: false, message: '购物车中没有可提交的设备。' })
  if (deviceIds.length > MAX_CART_ITEMS) return json(c, 400, { ok: false, message: `单次最多提交 ${MAX_CART_ITEMS} 台设备。` })

  const startDate = String(body.startDate || '').trim()
  const endDate = String(body.endDate || '').trim()
  const startPeriod = body.startPeriod === 'PM' ? 'PM' : 'AM'
  const endPeriod = body.endPeriod === 'PM' ? 'PM' : 'AM'
  const deliveryMethod = body.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pickup'
  const rawNote = String(body.rentalNote || '').trim().slice(0, 400)
  const couponCode = String(body.couponCode || '').trim().toUpperCase().slice(0, 40)
  const paymentMethod = body.paymentMethod === 'balance' ? 'balance' : 'card'
  const stripeSetupIntentId = String(body.stripeSetupIntentId || '').trim()
  const refundMethod = body.refundMethod === 'balance' ? 'balance' : 'original'
  const contact = {
    name: String(body.contactName || '').trim().slice(0, 120),
    email: String(body.contactEmail || '').trim().toLowerCase().slice(0, 200),
    phone: String(body.contactPhone || '').trim().slice(0, 40),
  }
  const password = String(body.password || '')
  const agreed = ['1', 'on', 'true', 'yes'].includes(String(body.agree || '').toLowerCase())

  if (!startDate || !endDate) return json(c, 400, { ok: false, message: '请填写开始日期和结束日期。' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return json(c, 400, { ok: false, message: '邮箱格式不正确。' })
  if (!isStrongPassword(password)) return json(c, 400, { ok: false, message: '密码至少 8 位，且需同时包含字母、数字和符号。' })
  if (!agreed) return json(c, 400, { ok: false, message: '请先阅读并同意服务条款与隐私政策。' })
  let stripePaymentMethodId = ''
  if (paymentMethod === 'card' && stripeSetupIntentId) {
    try { stripePaymentMethodId = (await verifyPublicRentalSetupIntent(c, stripeSetupIntentId)).paymentMethodId }
    catch (error: any) { return json(c, 400, { ok: false, message: error?.message || '信用卡验证失败，请重试。' }) }
  } else if (paymentMethod === 'card') {
    return json(c, 400, { ok: false, message: '请先填写并验证信用卡信息。' })
  }
  if (!contact.name || !contact.email) return json(c, 400, { ok: false, message: '请填写姓名和邮箱' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return json(c, 400, { ok: false, message: '邮箱格式不正确。' })

  await loadSystemSettingsFromDB(c)
  const settings = getSystemSettings()
  const rentalRules = settings.rentalRules
  const configuredLocations = settings.companyDetails.pickupLocations || []
  const fallbackPickup = configuredLocations[0] || '墨尔本 CBD 门店（下单后客服确认具体地址）'
  let pickupLocationValue = ''
  if (deliveryMethod === 'Pickup') {
    pickupLocationValue = String(body.pickupLocation || '').trim() || fallbackPickup
    if (configuredLocations.length && !configuredLocations.includes(pickupLocationValue)) pickupLocationValue = fallbackPickup
  } else {
    const street = String(body.deliveryStreet || '').trim()
    const suburb = String(body.deliverySuburb || '').trim()
    const state = String(body.deliveryState || '').trim().toUpperCase()
    const postcode = String(body.deliveryPostcode || '').trim()
    if (!street || !suburb || !AU_STATES.includes(state) || !/^\d{4}$/.test(postcode)) {
      return json(c, 400, { ok: false, message: '请填写完整有效的澳洲送货地址（街道、Suburb、州、邮编）。' })
    }
    pickupLocationValue = `${street}, ${suburb} ${state} ${postcode}, Australia`
  }

  const todayValue = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  if (startDate < todayValue || endDate < todayValue) return json(c, 400, { ok: false, message: '开始日期和结束日期必须是今天或之后。' })
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    return json(c, 400, { ok: false, message: '租赁结束日期必须晚于开始日期。' })
  }
  const halfDays = Math.round((end.getTime() - start.getTime()) / 86400000) * 2
    + (endPeriod === 'PM' ? 1 : 0) - (startPeriod === 'PM' ? 1 : 0)
  const rentalPeriod = Math.ceil(halfDays / 2)
  if (halfDays <= 0) return json(c, 400, { ok: false, message: '归还时段必须晚于取货时段。' })
  if (rentalPeriod < rentalRules.minimumRentalDays) {
    return json(c, 400, { ok: false, message: `最短租赁时间为 ${rentalRules.minimumRentalDays} 天。` })
  }
  const unavailable = new Set(rentalRules.unavailableDates)
  for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (unavailable.has(day.toISOString().slice(0, 10))) return json(c, 409, { ok: false, message: '所选租期包含不可取货或归还的日期。' })
  }

  const devices: any[] = []
  for (const deviceId of deviceIds) {
    const device = await getDeviceById(c, deviceId) as any
    if (!device || String(device.status || '').toLowerCase() !== 'available') {
      return json(c, 409, { ok: false, message: '购物车中有设备当前无法租赁，请移除后重试。' })
    }
    const deviceUnavailable = new Set(((await c.env.RENT.prepare(
      'SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?',
    ).bind(deviceId).all()).results || []).map((row: any) => row.unavailable_date))
    for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
      if (deviceUnavailable.has(day.toISOString().slice(0, 10))) {
        return json(c, 409, { ok: false, message: `${device.name} 在所选日期不可用。` })
      }
    }
    if (await hasDeviceBookingConflict(c, deviceId, startDate, endDate, undefined, rentalRules.bufferDays)) {
      return json(c, 409, { ok: false, message: `${device.name} 在所选日期或缓冲时间内已有订单。` })
    }
    devices.push(device)
  }

  const rentAmounts = devices.map((device) => rentalPeriod * Number(device.pricePerDay || 0))
  const discounts = devices.map(() => 0)
  let coupon: any = null
  if (couponCode) {
    coupon = await c.env.RENT.prepare(
      "SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)",
    ).bind(couponCode).first() as any
    if (!coupon) return json(c, 400, { ok: false, message: '优惠码无效、已过期或已达到使用次数上限。' })
    const eligibleIndexes = devices.map((device, index) => couponMatchesDevice(coupon, device) ? index : -1).filter((index) => index >= 0)
    if (!eligibleIndexes.length) return json(c, 400, { ok: false, message: '该优惠码不适用于购物车中的设备。' })
    const eligibleSubtotal = eligibleIndexes.reduce((sum, index) => sum + rentAmounts[index], 0)
    if (coupon.minimum_order_amount && eligibleSubtotal < Number(coupon.minimum_order_amount)) {
      return json(c, 400, { ok: false, message: `订单金额未达到该优惠码要求的最低消费 AUD$${Number(coupon.minimum_order_amount).toFixed(2)}。` })
    }
    coupon._discountableBase = eligibleSubtotal
    const totalDiscount = calculateCouponDiscount(coupon, eligibleSubtotal)
    let remaining = totalDiscount
    eligibleIndexes.forEach((index, position) => {
      const share = position === eligibleIndexes.length - 1
        ? remaining
        : Math.min(rentAmounts[index], Number((totalDiscount * rentAmounts[index] / eligibleSubtotal).toFixed(2)))
      discounts[index] = Number(share.toFixed(2))
      remaining = Number((remaining - discounts[index]).toFixed(2))
    })
  }

  let customerId = ''
  let isNewAccount = false
  const existing = await findUserByEmail(c, contact.email) as any
  if (existing) {
    const storedHash = existing.password_hash || existing.passwordHash || ''
    if (!storedHash || !(await verifyPassword(password, storedHash))) {
      return json(c, 409, { ok: false, message: '该邮箱已注册。请使用注册时的密码，或前往租赁系统登录后下单。' })
    }
    if (String(existing.role || 'CUSTOMER') !== 'CUSTOMER') return json(c, 409, { ok: false, message: '该邮箱不可用于自助下单，请更换邮箱或联系客服。' })
    if (String(existing.status || 'active') === 'inactive' || String(existing.account_status || 'active') === 'banned') {
      return json(c, 403, { ok: false, message: '该账号当前无法下单，请联系客服。' })
    }
    customerId = existing.id
  } else {
    isNewAccount = true
    const newId = await generateUniqueUserId(c, 'CUSTOMER', 'formal')
    const created = await insertUser(c, {
      id: newId, name: contact.name, email: contact.email, phone: contact.phone,
      passwordHash: await hashPassword(password), role: 'CUSTOMER', accountType: 'formal', status: 'active',
      balance: 0, commissionBalance: 0, createdAt: new Date().toISOString(),
    })
    customerId = (created as any).id || newId
  }
  if (refundMethod === 'balance' && (isNewAccount || !canUseAccountBalance(existing))) {
    return json(c, 400, { ok: false, message: '当前选择不可用，请改选其他选项。' })
  }
  if (paymentMethod === 'balance') {
    const settings = getSystemSettings()
    const requestedTotal = rentAmounts.reduce((sum, amount, index) => sum + amount + Number(devices[index].depositAmount || 0) - discounts[index], 0)
    if (!settings.paymentMethods.balancePayment || isNewAccount || !canUseAccountBalance(existing) || Number(existing?.balance || 0) < requestedTotal) {
      return json(c, 400, { ok: false, message: '当前账户余额不足以支付这笔申请，或余额支付尚未启用。' })
    }
  }
  if (coupon) {
    try { await checkCustomerCouponEligibility(c, coupon, customerId) }
    catch (error: any) { return json(c, 400, { ok: false, message: error?.message || '该账号无法使用此优惠码。' }) }
  }

  const batchId = `web-${nanoid(8)}`
  const createdAt = new Date().toISOString()
  const orderIds = devices.map(() => `o-${nanoid(8)}`)
  const insertedIds: string[] = []
  try {
    for (let index = 0; index < devices.length; index += 1) {
      const device = devices[index]
      const depositAmount = Number(device.depositAmount || 0)
      const discountAmount = discounts[index]
      const leadLine = `【官网购物车 ${batchId}${isNewAccount ? '·新注册' : ''}】联系人：${contact.name}`
        + `${contact.phone ? ` / 电话：${contact.phone}` : ''}`
        + `${deliveryMethod === 'Delivery' ? ` / 送货至：${pickupLocationValue}` : ` / 自取点：${pickupLocationValue}`}`
      await insertOrder(c, {
        id: orderIds[index], orderNo: null, userId: customerId, deviceId: device.id,
        startDate, endDate, startPeriod, endPeriod, rentalPeriod, status: 'pending_approval',
        paymentMethod: paymentMethod === 'balance' ? 'balance' : 'bank_transfer', totalAmount: rentAmounts[index] + depositAmount - discountAmount,
        depositAmount, dailyRate: Number(device.pricePerDay || 0), contractId: '', signedAt: null,
        pickupLocation: pickupLocationValue, returnLocation: '到店归还', deliveryMethod, deliveryFee: 0,
        rentalNote: `${leadLine}${rawNote ? `\n客户备注：${rawNote}` : ''}`.slice(0, 500),
        couponCode: discountAmount > 0 ? couponCode : null, discountAmount, createdAt,
      } as unknown as Order)
      await c.env.RENT.prepare('UPDATE orders SET stripe_payment_method_id = ?, stripe_setup_intent_id = ? WHERE id = ?')
        .bind(stripePaymentMethodId, stripeSetupIntentId, orderIds[index]).run()
      await c.env.RENT.prepare('UPDATE orders SET refundMethod = ? WHERE id = ?')
        .bind(refundMethod, orderIds[index]).run()
      insertedIds.push(orderIds[index])
    }
  } catch (error) {
    if (insertedIds.length) await c.env.RENT.batch(insertedIds.map((id) => c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(id)))
    console.error('Public cart order insertion failed:', error)
    return json(c, 500, { ok: false, message: '订单创建失败，请稍后重试。' })
  }

  try {
    const admins = (await getUsers(c)).filter((user: any) => user.role === 'ADMIN' && (user.status ?? 'active') !== 'inactive')
    const names = devices.map((device) => device.name).join('、')
    const totalRent = rentAmounts.reduce((sum, amount) => sum + amount, 0)
    const totalDeposit = devices.reduce((sum, device) => sum + Number(device.depositAmount || 0), 0)
    const totalDiscount = discounts.reduce((sum, amount) => sum + amount, 0)
    const message = `官网购物车新申请：${contact.name} 申请租赁 ${devices.length} 台设备（${names}），${startDate} ${startPeriod} 至 ${endDate} ${endPeriod}。`
      + `预计租金 AUD$ ${totalRent.toFixed(2)}${totalDiscount ? `，优惠 AUD$ ${totalDiscount.toFixed(2)}` : ''}，押金 AUD$ ${totalDeposit.toFixed(2)}。批次 ${batchId}。`
    await Promise.all(admins.map((admin: any) => createNotification(c, {
      recipientId: admin.id, type: 'rental_application', title: '官网购物车新申请待确认', message, orderId: orderIds[0],
    })))
  } catch {
    // 通知失败不影响已创建的订单。
  }

  const estimatedRent = rentAmounts.reduce((sum, amount) => sum + amount, 0)
  const deposit = devices.reduce((sum, device) => sum + Number(device.depositAmount || 0), 0)
  const discount = discounts.reduce((sum, amount) => sum + amount, 0)
  return json(c, 200, {
    ok: true, orderId: orderIds[0], orderIds, orderCount: orderIds.length, accountCreated: isNewAccount,
    rentalPeriod, estimatedRent: Number(estimatedRent.toFixed(2)), deposit: Number(deposit.toFixed(2)), discount: Number(discount.toFixed(2)),
    message: `${isNewAccount ? '账号已注册，' : ''}${orderIds.length} 台设备的申请已提交。管理员确认后会联系你安排签约与付款。`,
  })
}
