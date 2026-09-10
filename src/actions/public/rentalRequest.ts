/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 公开下单接口。供独立部署的营销官网（rent-web / geekslope-web）调用。
//
// 流程：访客在官网填租期等信息 -> 这里只创建一张 status='pending_approval' 的订单
// （不生成合同、不收款）-> 通知所有在职管理员 -> 管理员在后台确认后，再走既有的
// staff 建合同流程，生成 /contract/sign 链接让客户签署。
//
// 与 POST /customer/rent/:id 同一套校验；差异只是没有登录客户：order.userId 用一个
// ADMIN 占位账号，真实客户信息暂存在 rentalNote 里，管理员确认时补建。

import { Context } from 'hono'
import {
  getDeviceById,
  getSystemSettings,
  loadSystemSettingsFromDB,
  hasDeviceBookingConflict,
  insertOrder,
  insertUser,
  findUserByEmail,
  generateUniqueUserId,
  hashPassword,
  verifyPassword,
  isStrongPassword,
  getUsers,
  createNotification,
  type Order,
} from '../../site'
import { findEligibleCoupon, calculateCouponDiscount } from '../coupons'
import { nanoid } from 'nanoid'

const AU_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']

function json(c: Context, status: number, payload: Record<string, unknown>) {
  return c.json(payload, status as any)
}

async function verifyTurnstile(c: Context, token: string): Promise<boolean> {
  const secret = String((c.env as any).TURNSTILE_SECRET_KEY || '')
  if (!secret) return true // 未配置 Turnstile 时放行，由部署方决定
  if (!token) return false
  const result = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: c.req.header('CF-Connecting-IP') }),
  })
    .then((r) => r.json())
    .catch(() => ({ success: false }))) as any
  return Boolean(result.success)
}

export async function handlePublicRentalRequest(c: Context, body: Record<string, string>): Promise<Response> {
  if (!(await verifyTurnstile(c, String(body['cf-turnstile-response'] || '')))) {
    return json(c, 400, { ok: false, message: '人机验证失败，请重试。' })
  }

  const deviceId = String(body.deviceId || '').trim()
  const startDate = String(body.startDate || '').trim()
  const endDate = String(body.endDate || '').trim()
  const startPeriod = body.startPeriod === 'PM' ? 'PM' : 'AM'
  const endPeriod = body.endPeriod === 'PM' ? 'PM' : 'AM'
  const deliveryMethod = body.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pickup'
  const rawNote = String(body.rentalNote || '').trim().slice(0, 400)
  const couponCode = String(body.couponCode || '').trim().toUpperCase().slice(0, 40)

  const contact = {
    name: String(body.contactName || '').trim().slice(0, 120),
    email: String(body.contactEmail || '').trim().slice(0, 200),
    phone: String(body.contactPhone || '').trim().slice(0, 40),
  }

  if (!deviceId || !startDate || !endDate) {
    return json(c, 400, { ok: false, message: '请填写设备、开始日期和结束日期。' })
  }

  // 官网下单必须先注册（这里独立实现，不走 rent 的 /register，但写入同一个 users 表）。
  const password = String(body.password || '')
  const agreed = ['1', 'on', 'true', 'yes'].includes(String(body.agree || '').toLowerCase())
  const email = contact.email.trim().toLowerCase()
  if (!contact.name || !email) {
    return json(c, 400, { ok: false, message: '请填写姓名和邮箱以注册账号。' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(c, 400, { ok: false, message: '邮箱格式不正确。' })
  }
  if (!isStrongPassword(password)) {
    return json(c, 400, { ok: false, message: '密码至少 8 位，且需同时包含字母、数字和符号。' })
  }
  if (!agreed) {
    return json(c, 400, { ok: false, message: '请先阅读并同意服务条款与隐私政策。' })
  }

  await loadSystemSettingsFromDB(c)
  const settings = getSystemSettings()
  const rentalRules = settings.rentalRules
  const configuredLocations = settings.companyDetails.pickupLocations || []
  const fallbackPickup = configuredLocations[0] || '墨尔本 CBD 门店（下单后客服确认具体地址）'

  let pickupLocationValue = ''
  if (deliveryMethod === 'Pickup') {
    pickupLocationValue = String(body.pickupLocation || '').trim() || fallbackPickup
    if (configuredLocations.length && !configuredLocations.includes(pickupLocationValue)) {
      pickupLocationValue = fallbackPickup
    }
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

  // 日期校验（与 staff / customer 流程一致）
  const todayValue = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  if (startDate < todayValue || endDate < todayValue) {
    return json(c, 400, { ok: false, message: '开始日期和结束日期必须是今天或之后。' })
  }
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    return json(c, 400, { ok: false, message: '租赁结束日期必须晚于开始日期。' })
  }
  const halfDays =
    Math.round((end.getTime() - start.getTime()) / 86400000) * 2 +
    (endPeriod === 'PM' ? 1 : 0) -
    (startPeriod === 'PM' ? 1 : 0)
  if (halfDays <= 0) return json(c, 400, { ok: false, message: '归还时段必须晚于取货时段。' })
  const rentalPeriod = Math.ceil(halfDays / 2)
  if (rentalPeriod < rentalRules.minimumRentalDays) {
    return json(c, 400, { ok: false, message: `最短租赁时间为 ${rentalRules.minimumRentalDays} 天。` })
  }

  const unavailable = new Set(rentalRules.unavailableDates)
  for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (unavailable.has(day.toISOString().slice(0, 10))) {
      return json(c, 409, { ok: false, message: '所选租期包含不可取货或归还的日期。' })
    }
  }
  const deviceUnavailable = new Set(
    ((await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?').bind(deviceId).all()).results || []).map(
      (row: any) => row.unavailable_date,
    ),
  )
  for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (deviceUnavailable.has(day.toISOString().slice(0, 10))) {
      return json(c, 409, { ok: false, message: '该设备在所选日期不可用。' })
    }
  }

  const device = await getDeviceById(c, deviceId)
  if (!device || String(device.status || '').toLowerCase() !== 'available') {
    return json(c, 409, { ok: false, message: '该设备当前无法租赁。' })
  }
  if (await hasDeviceBookingConflict(c, deviceId, startDate, endDate, undefined, rentalRules.bufferDays)) {
    return json(c, 409, { ok: false, message: '该设备在所选日期或缓冲时间内已有订单。' })
  }

  // 注册 / 复用客户账号（写入同一个 users 表，之后可直接登录 rent 付款签约）
  let customerId: string
  let isNewAccount = false
  const existing = (await findUserByEmail(c, email)) as any
  if (existing) {
    const storedHash = existing.password_hash || existing.passwordHash || ''
    if (!storedHash || !(await verifyPassword(password, storedHash))) {
      return json(c, 409, {
        ok: false,
        message: '该邮箱已注册。请使用注册时的密码，或前往 rent 登录后下单。',
      })
    }
    if (String(existing.role || 'CUSTOMER') !== 'CUSTOMER') {
      return json(c, 409, { ok: false, message: '该邮箱不可用于自助下单，请更换邮箱或联系客服。' })
    }
    if (String(existing.status || 'active') === 'inactive' || String(existing.account_status || 'active') === 'banned') {
      return json(c, 403, { ok: false, message: '该账号当前无法下单，请联系客服。' })
    }
    customerId = existing.id
  } else {
    isNewAccount = true
    const newId = await generateUniqueUserId(c, 'CUSTOMER', 'formal')
    const created = await insertUser(c, {
      id: newId,
      name: contact.name,
      email,
      phone: contact.phone,
      passwordHash: await hashPassword(password),
      role: 'CUSTOMER',
      accountType: 'formal',
      status: 'active',
      balance: 0,
      commissionBalance: 0,
      createdAt: new Date().toISOString(),
    })
    customerId = (created as any).id || newId
  }

  const dailyRate = device.pricePerDay
  const depositAmount = device.depositAmount
  const rentAmount = rentalPeriod * dailyRate
  let discountAmount = 0
  let appliedCouponCode: string | null = null
  if (couponCode) {
    try {
      const coupon: any = await findEligibleCoupon(c, couponCode, device, rentAmount)
      discountAmount = calculateCouponDiscount(coupon, rentAmount)
      appliedCouponCode = String(coupon.code).toUpperCase()
    } catch (error: any) {
      return json(c, 400, { ok: false, message: error?.message || '优惠码无效。' })
    }
  }
  // 官网申请阶段不收款、不生成合同；优惠码只记录不占用，管理员确认时再正式核销。
  const totalAmount = rentAmount + depositAmount - discountAmount

  const leadLine =
    `【官网申请${isNewAccount ? '·新注册' : ''}】联系人：${contact.name}` +
    `${contact.phone ? ` / 电话：${contact.phone}` : ''}` +
    `${deliveryMethod === 'Delivery' ? ` / 送货至：${pickupLocationValue}` : ` / 自取点：${pickupLocationValue}`}`
  const rentalNote = `${leadLine}${rawNote ? `\n客户备注：${rawNote}` : ''}`.slice(0, 500)

  const orderId = `o-${nanoid(8)}`
  await insertOrder(c, {
    id: orderId,
    orderNo: null,
    userId: customerId,
    deviceId: device.id,
    startDate,
    endDate,
    startPeriod,
    endPeriod,
    rentalPeriod,
    status: 'pending_approval',
    paymentMethod: 'bank_transfer',
    totalAmount,
    depositAmount,
    dailyRate,
    contractId: '',
    signedAt: null,
    pickupLocation: deliveryMethod === 'Pickup' ? pickupLocationValue : pickupLocationValue,
    returnLocation: '到店归还',
    deliveryMethod,
    deliveryFee: 0,
    rentalNote,
    couponCode: appliedCouponCode,
    discountAmount,
    createdAt: new Date().toISOString(),
  } as unknown as Order)

  // 通知所有在职管理员：官网来了一笔待确认的租赁申请。
  try {
    const admins = (await getUsers(c)).filter(
      (u: any) => u.role === 'ADMIN' && (u.status ?? 'active') !== 'inactive',
    )
    const how = deliveryMethod === 'Delivery' ? `，需配送至 ${pickupLocationValue}（运费待确认）` : '，到店自取'
    const message =
      `官网新订单待确认：${contact.name} 申请租赁 ${device.name}` +
      `（${startDate} ${startPeriod} 至 ${endDate} ${endPeriod}，${rentalPeriod} 天）${how}。` +
      `预计租金 AUD$ ${rentAmount.toFixed(2)}${discountAmount ? `（优惠 -${discountAmount.toFixed(2)}）` : ''}` +
      ` + 押金 AUD$ ${depositAmount.toFixed(2)}。` +
      `${contact.phone ? ` 电话 ${contact.phone}。` : ''}${contact.email ? ` 邮箱 ${contact.email}。` : ''}` +
      `${rawNote ? ` 备注：${rawNote}` : ''} 请在后台确认后为客户创建合同。`
    await Promise.all(
      admins.map((admin: any) =>
        createNotification(c, {
          recipientId: admin.id,
          type: 'rental_application',
          title: deliveryMethod === 'Delivery' ? '官网新订单（需配送确认）' : '官网新订单待确认',
          message,
          orderId,
        }),
      ),
    )
  } catch {
    /* 通知失败不影响下单结果 */
  }

  return json(c, 200, {
    ok: true,
    orderId,
    accountCreated: isNewAccount,
    rentalPeriod,
    estimatedRent: Number(rentAmount.toFixed(2)),
    deposit: Number(depositAmount.toFixed(2)),
    message: isNewAccount
      ? '账号已注册，申请已提交。管理员确认后会联系你安排签约，届时再付款。你也可用该邮箱和密码登录 rent 查看进度。'
      : '申请已提交，管理员确认后会联系你安排签约，届时再付款。',
  })
}
