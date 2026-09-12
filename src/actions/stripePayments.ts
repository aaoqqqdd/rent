/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { ensureOrderNumber, getOrderById, getSystemSettings, loadSystemSettingsFromDB, issueInvoice, issueCreditNote, enqueueRentalUserCreation, recordBalanceTransaction, recordExternalRentalFlow, recordFinancialLedgerEntry, generateReferenceNumber, recordDeviceLifecycle, revokeReferralRewardForOrder, claimWebhookEvent, markWebhookProcessed, markWebhookFailed, buildRefundAllocation, mapStripeDisputeStatus } from '../site'
import { stripeRequest, verifyStripeWebhook, getStripePublishableKey } from '../stripe'
import { releaseCouponForOrder } from './coupons'
import { depositAuthorizationWindowDays, depositPaymentModeForOrder } from '../domain/paymentPlan'

function cents(value: number): number {
  return Math.round(Number(value) * 100)
}

// 完善.md —— 一笔付款只要还有未结案的拒付争议，就不允许再走任何正常退款。
// 所有退款入口（押金退款、提前归还退款、取消退款、银行转账补款）统一调用。
export async function hasOpenPaymentDispute(c: Context, paymentId: string): Promise<boolean> {
  if (!paymentId) return false
  const row = await c.env.RENT.prepare(
    "SELECT 1 FROM payment_disputes WHERE payment_id = ? AND status IN ('DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW') LIMIT 1"
  ).bind(paymentId).first()
  return Boolean(row)
}

export const STRIPE_PROCESSING_FEE_RATE = 0.025
export function getStripeProcessingFeeRate(): number {
  return Math.min(1, Math.max(0, Number(getSystemSettings().paymentMethods.processingFeeRate ?? STRIPE_PROCESSING_FEE_RATE)))
}

function orderServiceFee(order: any): number {
  return Math.max(0, Number(order.serviceFee ?? order.service_fee ?? 0))
}

function orderDeposit(order: any): number {
  return Math.max(0, Number(order.depositAmount ?? order.deposit_amount ?? 0))
}

// 余额充值改用站内 Payment Element：创建（或按金额变化更新）一个 PaymentIntent，
// 返回 client_secret + publishable key 给页面初始化 Stripe.js，不再跳转 Stripe 托管页。
export async function createBalanceTopUpIntent(c: Context, user: any, topUpId: string): Promise<{ clientSecret: string; publishableKey: string; amountCents: number }> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.stripe) throw new Error('信用卡支付当前未启用')
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND user_id = ? AND status = 'pending'").bind(topUpId, user.id).first() as any
  if (!topup) throw new Error('充值记录不存在或已处理')
  const baseCents = cents(Number(topup.amount))
  const feeCents = Math.round(baseCents * getStripeProcessingFeeRate())
  const chargedCents = baseCents + feeCents
  if (!Number.isInteger(chargedCents) || chargedCents <= 0) throw new Error('充值金额无效')

  const intent = await upsertPaymentIntent(c, {
    existingIntentId: topup.stripe_payment_intent_id ? String(topup.stripe_payment_intent_id) : '',
    amountCents: chargedCents,
    receiptEmail: user.email,
    metadata: {
      topup_id: topUpId,
      customer_id: String(user.id),
      processing_fee: String(feeCents),
    },
    idempotencyKey: `topup-pi-${topUpId}`,
  })
  await c.env.RENT.prepare("UPDATE balance_topups SET stripe_payment_intent_id = ?, processing_fee = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(intent.id, feeCents / 100, topUpId).run()
  return { clientSecret: intent.client_secret as string, publishableKey: await getStripePublishableKey(c), amountCents: chargedCents }
}

// 创建或复用一个处于可支付状态的 PaymentIntent。金额可能因优惠码 / 时段服务费在
// 签约那一步发生变化，所以已存在的 PI 会先尝试改金额；若它已经进入处理 / 成功等
// 不可改状态，则新建一个。
async function upsertPaymentIntent(c: Context, opts: {
  existingIntentId?: string
  amountCents: number
  receiptEmail?: string
  metadata: Record<string, string>
  idempotencyKey: string
  paymentMethodId?: string
  confirmNow?: boolean
}): Promise<any> {
  const reusableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing']
  if (opts.existingIntentId) {
    const current = await stripeRequest(c, `payment_intents/${opts.existingIntentId}`).catch(() => null)
    if (current && reusableStatuses.includes(String(current.status)) && String(current.status) !== 'processing') {
      const params = new URLSearchParams({ amount: String(opts.amountCents), currency: 'aud' })
      if (opts.paymentMethodId) params.set('payment_method', opts.paymentMethodId)
      if (opts.confirmNow) { params.set('confirm', 'true'); params.set('off_session', 'true') }
      Object.entries(opts.metadata).forEach(([key, value]) => params.set(`metadata[${key}]`, value))
      if (opts.receiptEmail) params.set('receipt_email', opts.receiptEmail)
      const updated = await stripeRequest(c, `payment_intents/${opts.existingIntentId}`, params)
      if (updated?.client_secret) return updated
    } else if (current && current.status === 'succeeded') {
      // 已经付过款：直接返回，调用方据此判断无需再收款。
      return current
    }
  }
  const params = new URLSearchParams({
    amount: String(opts.amountCents),
    currency: 'aud',
    'automatic_payment_methods[enabled]': 'true',
  })
  if (opts.paymentMethodId) params.set('payment_method', opts.paymentMethodId)
  if (opts.confirmNow) { params.set('confirm', 'true'); params.set('off_session', 'true') }
  if (opts.receiptEmail) params.set('receipt_email', opts.receiptEmail)
  Object.entries(opts.metadata).forEach(([key, value]) => params.set(`metadata[${key}]`, value))
  const created = await stripeRequest(c, 'payment_intents', params, `${opts.idempotencyKey}-${nanoid(8)}`)
  if (!created?.client_secret) throw new Error('Stripe 未返回有效支付凭据')
  return created
}

/** 短期订单的押金只做预授权，不与租金放进同一笔可结算付款。 */
async function createDepositAuthorization(c: Context, order: any, paymentMethodId: string): Promise<void> {
  const depositAmount = orderDeposit(order)
  if (depositAmount <= 0) {
    await c.env.RENT.prepare("UPDATE orders SET deposit_payment_mode = 'PREAUTH', deposit_status = 'NOT_REQUIRED', deposit_held_amount = 0 WHERE id = ?").bind(order.id).run()
    return
  }
  const existingId = String((order as any).stripe_deposit_payment_intent_id || '')
  if (existingId) {
    const existing = await stripeRequest(c, `payment_intents/${existingId}`).catch(() => null)
    if (existing && ['requires_capture', 'succeeded'].includes(String(existing.status))) return
  }
  const paymentMethod = await stripeRequest(c, `payment_methods/${paymentMethodId}`)
  const cardBrand = String(paymentMethod.card?.brand || '').toLowerCase()
  const authorizationWindowDays = depositAuthorizationWindowDays(cardBrand)
  const params = new URLSearchParams({
    amount: String(cents(depositAmount)),
    currency: 'aud',
    payment_method: paymentMethodId,
    capture_method: 'manual',
    confirm: 'true',
    off_session: 'true',
    'metadata[order_id]': String(order.id),
    'metadata[type]': 'deposit_authorization',
    'metadata[deposit_amount]': String(cents(depositAmount)),
    'metadata[card_brand]': cardBrand || 'unknown',
    'metadata[authorization_window_days]': String(authorizationWindowDays),
  })
  if (authorizationWindowDays === 30) params.set('payment_method_options[card][request_extended_authorization]', 'if_available')
  const intent = await stripeRequest(c, 'payment_intents', params, `deposit-auth-${order.id}`)
  if (!['requires_capture', 'succeeded'].includes(String(intent.status))) throw new Error('押金预授权未完成，请重新验证信用卡。')
  const paymentId = `p-${nanoid(12)}`
  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT OR IGNORE INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, stripe_payment_intent_id)
      VALUES (?, ?, ?, 'card', ?, ?, 0, 'AUD', 'pending', ?)`)
      .bind(paymentId, order.id, order.userId, depositAmount, depositAmount, intent.id),
    c.env.RENT.prepare("UPDATE orders SET deposit_payment_mode = 'PREAUTH', stripe_deposit_payment_intent_id = ?, deposit_status = 'HELD', deposit_paid_at = COALESCE(deposit_paid_at, CURRENT_TIMESTAMP), deposit_held_amount = ? WHERE id = ?")
      .bind(intent.id, depositAmount, order.id),
  ])
}

/** 长期订单先用 SetupIntent 验证并保存卡片，再单独收取租金。 */
export async function createOrderSetupIntent(c: Context, user: any, orderId: string): Promise<{ clientSecret: string; publishableKey: string }> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.stripe) throw new Error('Stripe 支付当前未启用')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')
  if (depositPaymentModeForOrder(order) !== 'SETUP_INTENT') throw new Error('该订单不需要长期租赁卡片验证')

  const existingId = String((order as any).stripe_setup_intent_id || '')
  if (/^seti_[A-Za-z0-9_]+$/.test(existingId)) {
    const existing = await stripeRequest(c, `setup_intents/${existingId}`).catch(() => null)
    if (existing && ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(String(existing.status)) && existing.client_secret) {
      return { clientSecret: existing.client_secret, publishableKey: await getStripePublishableKey(c) }
    }
  }
  const intent = await stripeRequest(c, 'setup_intents', new URLSearchParams({
    usage: 'off_session',
    'automatic_payment_methods[enabled]': 'true',
    'metadata[order_id]': String(order.id),
    'metadata[customer_id]': String(user.id),
    'metadata[type]': 'rental_setup',
  }), `order-setup-${order.id}`)
  await c.env.RENT.prepare('UPDATE orders SET stripe_setup_intent_id = ? WHERE id = ?').bind(intent.id, order.id).run()
  return { clientSecret: intent.client_secret as string, publishableKey: await getStripePublishableKey(c) }
}

/** 校验长期订单的 SetupIntent 后，使用已保存的 PaymentMethod 收取租金。 */
export async function completeOrderSetupIntent(c: Context, user: any, orderId: string, setupIntentId: string): Promise<{ alreadyPaid?: boolean; clientSecret?: string; publishableKey?: string }> {
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) throw new Error('信用卡验证信息无效，请重新验证')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (depositPaymentModeForOrder(order) !== 'SETUP_INTENT') throw new Error('该订单不是长期租赁订单')
  const intent = await stripeRequest(c, `setup_intents/${setupIntentId}`)
  if (String(intent.metadata?.order_id || '') !== String(order.id) || String(intent.metadata?.customer_id || '') !== String(user.id)) throw new Error('信用卡验证信息与订单不匹配')
  const paymentMethodId = typeof intent.payment_method === 'string' ? intent.payment_method : String(intent.payment_method?.id || '')
  if (intent.status !== 'succeeded' || !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) throw new Error('请先完成信用卡验证')
  await c.env.RENT.prepare('UPDATE orders SET stripe_setup_intent_id = ?, stripe_payment_method_id = ? WHERE id = ?')
    .bind(setupIntentId, paymentMethodId, order.id).run()
  return createOrderPaymentIntent(c, user, order.id, true)
}

// 订单支付（自助结账 + 签约付款步骤共用）：为一笔待付款订单创建 / 更新 PaymentIntent，
// 并把 payments 行的金额、手续费、stripe_payment_intent_id 落库为 pending。
export async function createOrderPaymentIntent(c: Context, user: any, orderId: string, confirmNow = false): Promise<{ clientSecret: string; publishableKey: string; amountCents: number; alreadyPaid?: boolean }> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.stripe) throw new Error('Stripe 支付当前未启用')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (order.status === 'paid') return { clientSecret: '', publishableKey: '', amountCents: 0, alreadyPaid: true }
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')

  const { baseCents, feeCents, chargedCents } = stripePaymentAmounts(order.totalAmount, orderDeposit(order), orderServiceFee(order))
  if (!Number.isInteger(baseCents) || baseCents <= 0) throw new Error('订单金额无效')

  const depositMode = depositPaymentModeForOrder(order)
  const savedPaymentMethodId = String((order as any).stripe_payment_method_id || '')
  const shouldAuthorizeDeposit = confirmNow && Boolean(savedPaymentMethodId) && depositMode === 'PREAUTH'
  if (depositMode === 'SETUP_INTENT') {
    await c.env.RENT.prepare("UPDATE orders SET deposit_status = 'NOT_REQUIRED', deposit_held_amount = 0 WHERE id = ?").bind(order.id).run()
  }

  const existing = await c.env.RENT.prepare("SELECT id, stripe_payment_intent_id FROM payments WHERE rental_id = ? AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any

  const intent = await upsertPaymentIntent(c, {
    existingIntentId: existing?.stripe_payment_intent_id ? String(existing.stripe_payment_intent_id) : '',
    amountCents: chargedCents,
    receiptEmail: user.email,
    metadata: {
      order_id: order.id,
      customer_id: String(user.id),
      processing_fee: String(feeCents),
      rental_amount: String(cents(order.totalAmount - orderDeposit(order))),
      deposit_amount: '0',
      service_fee: String(cents(orderServiceFee(order))),
    },
    idempotencyKey: `order-pi-${order.id}`,
    paymentMethodId: savedPaymentMethodId,
    confirmNow,
  })
  const alreadyPaid = intent.status === 'succeeded'
  if (!alreadyPaid && !intent.client_secret) throw new Error('Stripe 未返回有效支付凭据')
  const paymentStatus = alreadyPaid ? 'paid' : 'pending'

  if (existing) {
    await c.env.RENT.prepare('UPDATE payments SET stripe_payment_intent_id = ?, amount = ?, processing_fee = ?, deposit_amount = 0, rental_amount = ?, status = ?, paid_at = CASE WHEN ? = \'paid\' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(intent.id, chargedCents / 100, feeCents / 100, order.totalAmount - orderDeposit(order), paymentStatus, paymentStatus, existing.id).run()
  } else {
    await c.env.RENT.prepare(`
      INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, processing_fee, currency, status, paid_at, stripe_payment_intent_id)
      VALUES (?, ?, ?, 'card', ?, ?, ?, ?, 'AUD', ?, ?, ?)
    `).bind(`p-${nanoid(12)}`, order.id, user.id, chargedCents / 100, 0, order.totalAmount - orderDeposit(order), feeCents / 100, paymentStatus, alreadyPaid ? new Date().toISOString() : null, intent.id).run()
  }
  if (shouldAuthorizeDeposit && alreadyPaid) await createDepositAuthorization(c, order, savedPaymentMethodId)
  if (alreadyPaid) {
    await c.env.RENT.prepare("UPDATE orders SET status = 'paid', order_status = 'CONFIRMED', payment_status = 'PAID', rental_status = 'READY_FOR_PICKUP', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id).run()
    return { clientSecret: '', publishableKey: '', amountCents: chargedCents, alreadyPaid: true }
  }
  return { clientSecret: intent.client_secret as string, publishableKey: await getStripePublishableKey(c), amountCents: chargedCents }
}

export function stripePaymentAmounts(orderTotal: number, depositAmount = 0, serviceFee = 0): { baseCents: number; feeCents: number; chargedCents: number } {
  const baseCents = cents(orderTotal)
  const depositCents = Math.max(0, cents(depositAmount))
  // total 已包含租金、时段服务费和押金；手续费覆盖前两项，只排除押金。
  const immediatelyPaidCents = Math.max(0, baseCents - depositCents)
  const feeCents = Math.round(immediatelyPaidCents * getStripeProcessingFeeRate())
  return { baseCents: immediatelyPaidCents, feeCents, chargedCents: immediatelyPaidCents + feeCents }
}

export function stripeCheckoutItems(order: any): Array<{ name: string; amountCents: number }> {
  const totalCents = cents(order.totalAmount)
  const depositCents = cents(order.depositAmount || 0)
  const serviceFeeCents = cents(order.serviceFee ?? order.service_fee ?? 0)
  if (depositCents < 0 || depositCents > totalCents) throw new Error('订单押金金额无效')
  const rentalCents = totalCents - depositCents - serviceFeeCents
  const period = Number(order.rentalPeriod ?? order.rental_period ?? 0)
  const depositMode = depositPaymentModeForOrder(order)
  const rentalLabel = period > 0
    ? `设备租金（${period} 天，${order.startDate} 至 ${order.endDate}）`
    : `设备租金（${order.startDate} 至 ${order.endDate}）`
  const feeCents = stripePaymentAmounts(order.totalAmount, order.depositAmount || 0, order.serviceFee ?? order.service_fee ?? 0).feeCents
  return [
    { name: rentalLabel, amountCents: rentalCents },
    ...(depositMode === 'PAID' ? [{ name: '设备押金', amountCents: depositCents }] : []),
    { name: '自取/归还时段服务费', amountCents: serviceFeeCents },
    { name: `Stripe 租金及服务费支付手续费（${(getStripeProcessingFeeRate() * 100).toString()}%）`, amountCents: feeCents },
  ].filter(item => item.amountCents > 0)
}

export function refundableDepositFee(refundAmount: number, payment: any): number {
  // 押金不再进入 Stripe 的收费本金，因此不存在“押金对应手续费”可退。
  return 0
}

// Thin back-compat wrapper over the shared refund allocation engine in site.ts.
export function allocateProportionalRefund(sources: Array<{ id: string; amount: number; refunded?: number }>, refundAmount: number): Array<{ id: string; amount: number }> {
  return buildRefundAllocation(sources, refundAmount, 'proportional').map(({ id, amount }) => ({ id, amount }))
}

function melbourneDate(): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export async function handleStripeWebhook(c: Context): Promise<Response> {
  const rawBody = await c.req.text()
  const payloadDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody))
  const payloadHash = Array.from(new Uint8Array(payloadDigest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  let event: any
  try {
    event = await verifyStripeWebhook(c, rawBody, c.req.header('stripe-signature'))
  } catch (error: any) {
    // Always acknowledge Stripe delivery at the HTTP layer. Invalid payloads
    // are rejected from business processing and logged for investigation;
    // returning 4xx here only causes Stripe to retry the same bad delivery.
    console.error('Stripe webhook verification failed:', error?.message || error)
    return c.json({ received: false, accepted: false, reason: 'verification_failed' }, 400)
  }

  const claim = await claimWebhookEvent(c, { provider: 'stripe', eventId: event.id, eventType: event.type, payloadHash })
  if (!claim.firstDelivery && claim.status === 'PROCESSED') return c.json({ received: true, duplicate: true })
  // A prior delivery that stalled at RECEIVED/FAILED falls through and is
  // reprocessed. Every business statement below is idempotent (status-guarded
  // UPDATEs / INSERT OR IGNORE), so a safe retry cannot double-apply.

  const session = event.data?.object
  const statements: any[] = []
  let paidOrderId = ''
  let disputedOrderId = ''
  let disputedCustomerId = ''
  let disputedStripeId = ''
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const topupId = String(session?.metadata?.topup_id || '')
    if (topupId) {
      const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND status = 'pending'").bind(topupId).first() as any
      const customerId = String(session?.metadata?.customer_id || '')
      const expected = topup ? cents(topup.amount) + Math.round(cents(topup.amount) * getStripeProcessingFeeRate()) : 0
      if (!topup || topup.user_id !== customerId || Number(session.amount_total) !== expected || session.payment_status !== 'paid') return c.text('Stripe 充值数据不匹配', 400)
      const user = await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(customerId).first() as any
      const next = Number((Number(user?.balance || 0) + Number(topup.amount)).toFixed(2))
      statements.push(c.env.RENT.prepare("UPDATE balance_topups SET status = 'paid', transaction_id = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(String(session.payment_intent || session.id), topupId), c.env.RENT.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(next, customerId), c.env.RENT.prepare("INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, 'top_up_card', ?, NULL)").bind(`bt-${nanoid(12)}`, customerId, topup.amount, next, `信用卡充值（含手续费 ${Number(topup.processing_fee || 0).toFixed(2)} AUD）`))
      paidOrderId = ''
    } else {
      const orderId = String(session?.metadata?.order_id || '')
      const customerId = String(session?.metadata?.customer_id || '')
      const order = await getOrderById(c, orderId)
      paidOrderId = orderId
      const payment = await c.env.RENT.prepare('SELECT rental_id, customer_id, amount, processing_fee FROM payments WHERE stripe_checkout_session_id = ?').bind(session.id).first() as any
      const expected = order ? stripePaymentAmounts(order.totalAmount, orderDeposit(order), orderServiceFee(order)) : null
      if (!order || !payment || !expected || payment.rental_id !== order.id || payment.customer_id !== customerId || cents(payment.amount) !== expected.chargedCents || cents(payment.processing_fee) !== expected.feeCents || order.userId !== customerId || String(session.currency).toLowerCase() !== 'aud' || Number(session.amount_total) !== expected.chargedCents || session.payment_status !== 'paid') {
        return c.text('Stripe 支付数据与订单不匹配', 400)
      }
      statements.push(
        c.env.RENT.prepare(`UPDATE payments SET status = 'paid', stripe_payment_intent_id = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE stripe_checkout_session_id = ?`)
          .bind(String(session.payment_intent || ''), generateReferenceNumber('TXN'), session.id),
        c.env.RENT.prepare("UPDATE orders SET status = 'paid', paymentMethod = 'card', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
      )
    }
  } else if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    const failedOrderId = String(session?.metadata?.order_id || '')
    statements.push(
      c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_checkout_session_id = ? AND status = 'pending'").bind(session.id),
    )
  } else if (event.type === 'payment_intent.succeeded') {
    // 站内 Payment Element 路径：付款对象是 PaymentIntent（session 即该对象），
    // 按 stripe_payment_intent_id 匹配落库的 pending 记录。
    const topupId = String(session?.metadata?.topup_id || '')
    const paidCents = Number(session?.amount_received ?? session?.amount ?? 0)
    if (session?.status !== 'succeeded' || String(session?.currency).toLowerCase() !== 'aud') return c.text('Stripe 支付状态无效', 400)
    const authorization = await c.env.RENT.prepare('SELECT id, rental_id, customer_id FROM payments WHERE stripe_payment_intent_id = ? AND rental_amount = 0 AND deposit_amount > 0').bind(session.id).first() as any
    if (authorization) {
      const order = await getOrderById(c, authorization.rental_id)
      if (!order || authorization.customer_id !== String(order.userId) || paidCents <= 0 || paidCents > cents(orderDeposit(order))) return c.text('Stripe 押金预授权数据不匹配', 400)
      statements.push(c.env.RENT.prepare("UPDATE payments SET status = 'paid', amount = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(paidCents / 100, session.id, authorization.id))
      paidOrderId = ''
    } else if (topupId) {
      const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND stripe_payment_intent_id = ? AND status = 'pending'").bind(topupId, session.id).first() as any
      const customerId = String(session?.metadata?.customer_id || '')
      const expected = topup ? cents(topup.amount) + Math.round(cents(topup.amount) * getStripeProcessingFeeRate()) : 0
      if (!topup || topup.user_id !== customerId || paidCents !== expected) return c.text('Stripe 充值数据不匹配', 400)
      const user = await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(customerId).first() as any
      const next = Number((Number(user?.balance || 0) + Number(topup.amount)).toFixed(2))
      statements.push(
        c.env.RENT.prepare("UPDATE balance_topups SET status = 'paid', transaction_id = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(String(session.id), topupId),
        c.env.RENT.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(next, customerId),
        c.env.RENT.prepare("INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, 'top_up_card', ?, NULL)").bind(`bt-${nanoid(12)}`, customerId, topup.amount, next, `信用卡充值（含手续费 ${Number(topup.processing_fee || 0).toFixed(2)} AUD）`),
      )
    } else {
      const orderId = String(session?.metadata?.order_id || '')
      const customerId = String(session?.metadata?.customer_id || '')
      const order = await getOrderById(c, orderId)
      paidOrderId = orderId
      const payment = await c.env.RENT.prepare('SELECT rental_id, customer_id, amount, processing_fee FROM payments WHERE stripe_payment_intent_id = ?').bind(session.id).first() as any
      // 不是本站站内 Payment Element 建的 PI（例如历史 Checkout 流程遗留），静默确认，
      // 交给对应的 checkout.session.* 事件处理，避免 Stripe 反复重投。
      if (!payment) { paidOrderId = ''; return c.json({ received: true, ignored: true }) }
      const expected = order ? stripePaymentAmounts(order.totalAmount, orderDeposit(order), orderServiceFee(order)) : null
      if (!order || !expected || payment.rental_id !== order.id || payment.customer_id !== customerId || cents(payment.amount) !== expected.chargedCents || cents(payment.processing_fee) !== expected.feeCents || order.userId !== customerId || paidCents !== expected.chargedCents) {
        return c.text('Stripe 支付数据与订单不匹配', 400)
      }
      statements.push(
        c.env.RENT.prepare(`UPDATE payments SET status = 'paid', transaction_id = COALESCE(transaction_id, ?), paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = ? AND status != 'paid'`)
          .bind(generateReferenceNumber('TXN'), session.id),
        c.env.RENT.prepare("UPDATE orders SET status = 'paid', paymentMethod = 'card', stripe_payment_method_id = COALESCE(stripe_payment_method_id, ?), updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(String(session.payment_method || ''), order.id),
      )
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    statements.push(
      c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = ? AND status = 'pending'").bind(session.id),
      c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = ? AND status = 'pending'").bind(session.id),
    )
  } else if (event.type === 'charge.dispute.created') {
    const dispute = session
    const disputedPayment = await c.env.RENT.prepare('SELECT p.id, p.rental_id, p.customer_id, o.deviceId AS device_id FROM payments p LEFT JOIN orders o ON o.id = p.rental_id WHERE p.stripe_payment_intent_id = ?').bind(String(dispute?.payment_intent || '')).first() as any
    if (disputedPayment) {
      const dueBy = dispute.evidence_details?.due_by ? new Date(Number(dispute.evidence_details.due_by) * 1000).toISOString() : null
      statements.push(c.env.RENT.prepare('INSERT OR IGNORE INTO payment_disputes (id, stripe_dispute_id, payment_id, order_id, customer_id, device_id, amount, currency, reason, status, evidence_due_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(`pd-${nanoid(12)}`, String(dispute.id), disputedPayment.id, disputedPayment.rental_id, disputedPayment.customer_id, disputedPayment.device_id || null, Number(dispute.amount || 0) / 100, String(dispute.currency || 'aud').toUpperCase(), String(dispute.reason || ''), 'DISPUTE_OPENED', dueBy))
      disputedOrderId = String(disputedPayment.rental_id || '')
      disputedCustomerId = String(disputedPayment.customer_id || '')
      disputedStripeId = String(dispute.id || '')
    }
  } else if (event.type === 'charge.dispute.updated') {
    // 举证期 / Stripe 状态变化时刷新——仅在争议尚未结案时更新。
    const dispute = session
    const dueBy = dispute.evidence_details?.due_by ? new Date(Number(dispute.evidence_details.due_by) * 1000).toISOString() : null
    statements.push(c.env.RENT.prepare("UPDATE payment_disputes SET status = ?, evidence_due_by = COALESCE(?, evidence_due_by), updated_at = CURRENT_TIMESTAMP WHERE stripe_dispute_id = ? AND status IN ('DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW')")
      .bind(mapStripeDisputeStatus(String(dispute?.status || '')), dueBy, String(dispute?.id || '')))
  } else if (event.type === 'charge.dispute.closed') {
    const dispute = session
    const mappedStatus = mapStripeDisputeStatus(String(dispute?.status || ''))
    // 败诉即资金已被划走：把争议金额记为真实财务影响（管理员之后可在后台修正）。
    const lostImpact = mappedStatus === 'DISPUTE_LOST' ? Number(dispute?.amount || 0) / 100 : null
    statements.push(c.env.RENT.prepare("UPDATE payment_disputes SET status = ?, result = ?, financial_impact = COALESCE(financial_impact, ?), updated_at = CURRENT_TIMESTAMP WHERE stripe_dispute_id = ? AND status IN ('DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW')")
      .bind(mappedStatus, String(dispute?.status || ''), lostImpact, String(dispute?.id || '')))
  }
  statements.push(c.env.RENT.prepare("INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type, payload_hash, processing_status, received_at) VALUES (?, ?, ?, 'PROCESSED', CURRENT_TIMESTAMP)").bind(event.id, event.type, payloadHash))
  try {
    await c.env.RENT.batch(statements)
  } catch (error: any) {
    if (String(error.message).includes('UNIQUE')) return c.json({ received: true, duplicate: true })
    await markWebhookFailed(c, claim.recordId, error?.message || String(error))
    throw error
  }
  await markWebhookProcessed(c, claim.recordId)

  const response = c.json({ received: true })
  if (paidOrderId) {
    try {
      const paidOrder = await getOrderById(c, paidOrderId)
      if (paidOrder) {
        await recordExternalRentalFlow(c, paidOrder.userId, Number(paidOrder.totalAmount) - orderDeposit(paidOrder), '信用卡', null, paidOrder.id)
        await recordDeviceLifecycle(c, paidOrder.deviceId, 'RESERVED', { orderId: paidOrder.id, reason: '信用卡付款成功' })
        if (depositPaymentModeForOrder(paidOrder) === 'PREAUTH' && !String((paidOrder as any).stripe_deposit_payment_intent_id || '') && String((paidOrder as any).stripe_payment_method_id || '')) {
          await createDepositAuthorization(c, paidOrder, String((paidOrder as any).stripe_payment_method_id))
        }
        await c.env.RENT.prepare("UPDATE coupon_redemptions SET status = 'REDEEMED', redeemed_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'RESERVED'").bind(paidOrder.id).run()
      }
      await ensureOrderNumber(c, paidOrderId, String(session.payment_intent || session.id || ''))
      await issueInvoice(c, paidOrderId)
      await enqueueRentalUserCreation(c, await getOrderById(c, paidOrderId))
    } catch (error: any) {
      console.error('Stripe webhook post-processing failed:', error?.message || error)
    }
  }
  if (disputedOrderId) {
    try {
      await revokeReferralRewardForOrder(c, disputedOrderId, 'Stripe 拒付争议')
    } catch (error: any) {
      console.error('Stripe webhook dispute post-processing failed:', error?.message || error)
    }
  }
  if (disputedCustomerId && disputedStripeId) {
    // Chargeback 自动升起 CHARGEBACK 风险标记（完善.md），阻止该客户继续自助下单。
    try {
      const existing = await c.env.RENT.prepare("SELECT id FROM risk_flags WHERE customer_id = ? AND flag_type = 'CHARGEBACK' AND status = 'ACTIVE' LIMIT 1").bind(disputedCustomerId).first() as any
      let flagId = existing?.id as string | undefined
      if (!flagId) {
        flagId = `rk-${nanoid(12)}`
        await c.env.RENT.prepare("INSERT INTO risk_flags (id, customer_id, flag_type, severity, reason, evidence, created_by) VALUES (?, ?, 'CHARGEBACK', 'HIGH', ?, ?, 'system')")
          .bind(flagId, disputedCustomerId, 'Stripe 拒付争议自动标记', `stripe_dispute:${disputedStripeId}`).run()
      }
      await c.env.RENT.prepare('UPDATE payment_disputes SET risk_flag_id = ? WHERE stripe_dispute_id = ? AND risk_flag_id IS NULL').bind(flagId, disputedStripeId).run()
    } catch (error: any) {
      console.error('Stripe webhook chargeback risk-flag failed:', error?.message || error)
    }
  }

  return response
}

async function paidPayment(c: Context, order: any): Promise<any> {
  let payment = await c.env.RENT.prepare("SELECT * FROM payments WHERE rental_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1").bind(order.id).first() as any
  if (payment) return payment
  const method = ['card', 'bank_transfer', 'balance'].includes(order.paymentMethod) ? order.paymentMethod : 'bank_transfer'
  const paymentId = `p-${nanoid(12)}`
  await c.env.RENT.prepare(`
    INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, transaction_id, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AUD', 'paid', ?, CURRENT_TIMESTAMP)
  `).bind(paymentId, order.id, order.userId, method, order.totalAmount, order.depositAmount, order.totalAmount - order.depositAmount, generateReferenceNumber('TXN')).run()
  return c.env.RENT.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first()
}

function refundChannel(order: any, payment: any): 'balance' | 'stripe' | 'bank_transfer' | 'unavailable' {
  if ((order.refundMethod ?? 'balance') !== 'original') return 'balance'
  if (payment.payment_method === 'card') return payment.stripe_payment_intent_id ? 'stripe' : 'unavailable'
  if (payment.payment_method === 'bank_transfer') return 'bank_transfer'
  return 'balance'
}

function cancellationRefundChannel(payment: any): 'balance' | 'stripe' | 'bank_transfer' | 'unavailable' {
  if (payment?.payment_method === 'balance') return 'balance'
  if (payment?.payment_method === 'card') return payment.stripe_payment_intent_id ? 'stripe' : 'unavailable'
  if (payment?.payment_method === 'bank_transfer') return 'bank_transfer'
  return 'unavailable'
}

function validateDepositDeduction(form: Record<string, any>, depositAmount: number, deductionAmount: number): { category: string; reason: string } | Response {
  const category = String(form.deductionCategory || '').trim()
  const reason = String(form.deductionReason || '').trim()
  const validCategories = new Set(['DAMAGE', 'MISSING_ACCESSORY', 'LATE_FEE', 'DEVICE_NOT_RETURNED', 'OTHER'])
  if (deductionAmount > 0 && !validCategories.has(category)) return new Response('请选择有效的押金扣款类别', { status: 400 })
  if (deductionAmount > 0 && !reason) return new Response('扣除押金时必须填写原因', { status: 400 })
  if (deductionAmount > depositAmount) return new Response('扣款金额不能高于押金金额', { status: 400 })
  return { category, reason }
}

async function settlePreauthorizedDeposit(c: Context, admin: any, order: any, form: Record<string, any>): Promise<Response> {
  const depositAmount = orderDeposit(order)
  const authorizationId = String((order as any).stripe_deposit_payment_intent_id || '')
  const payment = authorizationId
    ? await c.env.RENT.prepare('SELECT * FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1').bind(authorizationId).first() as any
    : null
  if (!authorizationId || !payment) return c.text('未找到押金预授权记录，无法结算', 409)
  if (await hasOpenPaymentDispute(c, payment.id)) return c.text('该笔押金预授权存在未解决的拒付争议，暂不能结算', 409)
  const refundText = String(form.refundAmount ?? '').trim()
  const refundAmount = Number(refundText)
  const previous = Number((await c.env.RENT.prepare("SELECT COALESCE(SUM(refund_amount), 0) AS amount FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded'").bind(order.id).first() as any)?.amount || 0)
  const remaining = Number(Math.max(0, depositAmount - previous).toFixed(2))
  if (!/^\d+(\.\d{1,2})?$/.test(refundText) || !Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > remaining) return c.text(`退款金额无效：本次最多可释放 ${remaining.toFixed(2)}`, 400)
  const totalReleased = Number((previous + refundAmount).toFixed(2))
  const deductionAmount = Number(Math.max(0, depositAmount - totalReleased).toFixed(2))
  const deduction = validateDepositDeduction(form, depositAmount, deductionAmount)
  if (deduction instanceof Response) return deduction

  let intent = await stripeRequest(c, `payment_intents/${authorizationId}`).catch(() => null)
  if (!intent || !['requires_capture', 'succeeded', 'canceled'].includes(String(intent.status))) return c.text('押金预授权状态无效，无法结算', 409)
  if (deductionAmount > 0 && intent.status === 'requires_capture') {
    intent = await stripeRequest(c, `payment_intents/${authorizationId}/capture`, new URLSearchParams({ amount_to_capture: String(cents(deductionAmount)) }), `deposit-capture-${order.id}`)
    if (intent.status !== 'succeeded') return c.text('押金扣款尚未成功，请稍后重试', 502)
    await c.env.RENT.prepare("UPDATE payments SET status = 'paid', amount = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(deductionAmount, authorizationId, payment.id).run()
  } else if (deductionAmount === 0 && intent.status === 'requires_capture') {
    await stripeRequest(c, `payment_intents/${authorizationId}/cancel`, new URLSearchParams(), `deposit-release-${order.id}`)
  }

  const nextStatus = deductionAmount >= depositAmount ? 'FORFEITED' : deductionAmount > 0 ? 'PARTIALLY_DEDUCTED' : 'REFUNDED'
  const statements: any[] = [
    c.env.RENT.prepare("UPDATE orders SET deposit_status = ?, deposit_deduction_amount = ?, deposit_refund_amount = 0, deposit_refund_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nextStatus, deductionAmount, order.id),
    c.env.RENT.prepare('UPDATE devices SET status = \'available\' WHERE id = ?').bind(order.deviceId),
  ]
  if (deductionAmount > 0) {
    statements.push(c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_category, deduction_reason, status, processed_by, refund_method)
      VALUES (?, ?, ?, ?, 'deposit', 0, 0, 0, ?, ?, ?, 'succeeded', ?, 'stripe')`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, deductionAmount, deduction.category, deduction.reason, admin.id))
  }
  await c.env.RENT.batch(statements)
  return c.redirect(`/admin/orders/${order.id}`, 303)
}

async function settleSetupIntentDeposit(c: Context, admin: any, order: any, form: Record<string, any>): Promise<Response> {
  const depositAmount = orderDeposit(order)
  const deductionText = String(form.deductionAmount ?? '0').trim()
  const deductionAmount = Number(deductionText)
  if (!/^\d+(\.\d{1,2})?$/.test(deductionText) || !Number.isFinite(deductionAmount) || deductionAmount < 0) return c.text('扣款金额无效', 400)
  const deduction = validateDepositDeduction(form, depositAmount, deductionAmount)
  if (deduction instanceof Response) return deduction
  if (deductionAmount === 0) {
    await c.env.RENT.prepare("UPDATE orders SET deposit_status = 'NOT_REQUIRED', deposit_deduction_amount = 0, deposit_refund_amount = 0, deposit_refund_at = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id).run()
    return c.redirect(`/admin/orders/${order.id}`, 303)
  }
  const paymentMethodId = String((order as any).stripe_payment_method_id || '')
  if (!/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) return c.text('订单没有可用于长期租赁结算的已验证信用卡', 409)
  const intent = await stripeRequest(c, 'payment_intents', new URLSearchParams({
    amount: String(cents(deductionAmount)), currency: 'aud', payment_method: paymentMethodId,
    confirm: 'true', off_session: 'true',
    'metadata[order_id]': String(order.id), 'metadata[type]': 'deposit_charge',
    'metadata[deduction_amount]': String(cents(deductionAmount)),
  }), `deposit-charge-${order.id}`)
  if (intent.status !== 'succeeded') return c.text('长期租赁押金扣款尚未成功，请改由客服处理', 502)
  const paymentId = `p-${nanoid(12)}`
  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, transaction_id, paid_at, stripe_payment_intent_id, processing_fee)
      VALUES (?, ?, ?, 'card', ?, ?, 0, 'AUD', 'paid', ?, CURRENT_TIMESTAMP, ?, 0)`)
      .bind(paymentId, order.id, order.userId, deductionAmount, deductionAmount, intent.id, intent.id),
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_category, deduction_reason, status, processed_by, refund_method)
      VALUES (?, ?, ?, ?, 'deposit', 0, 0, 0, ?, ?, ?, 'succeeded', ?, 'stripe')`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, paymentId, deductionAmount, deduction.category, deduction.reason, admin.id),
    c.env.RENT.prepare("UPDATE orders SET deposit_status = ?, deposit_deduction_amount = ?, deposit_refund_amount = 0, deposit_refund_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(deductionAmount >= depositAmount ? 'FORFEITED' : 'PARTIALLY_DEDUCTED', deductionAmount, order.id),
  ])
  return c.redirect(`/admin/orders/${order.id}`, 303)
}

export async function refundDeposit(c: Context, admin: any, orderId: string, form: Record<string, any>): Promise<Response> {
  const order = await getOrderById(c, orderId)
  if (!order) return c.text('订单不存在', 404)
  if (order.status !== 'completed') return c.text('只有已归还并完成的订单才能处理押金', 409)
  const depositMode = depositPaymentModeForOrder(order)
  if (depositMode === 'PREAUTH') return settlePreauthorizedDeposit(c, admin, order, form)
  if (depositMode === 'SETUP_INTENT') return settleSetupIntentDeposit(c, admin, order, form)
  const payment = await paidPayment(c, order)
  if (await hasOpenPaymentDispute(c, payment.id)) return c.text('该笔付款存在未解决的拒付争议，暂不能退款', 409)
  const refundedResult = await c.env.RENT.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) AS refunded_amount
    FROM payment_refunds
    WHERE payment_id = ? AND type = 'deposit' AND status = 'succeeded'
  `).bind(payment.id).first() as any
  const previouslyRefunded = Number(refundedResult?.refunded_amount || 0)
  const selectedRefundMethod = String(form.refundMethod || order.refundMethod || 'balance')
  if (!['balance', 'original', 'bank_transfer'].includes(selectedRefundMethod)) return c.text('退款方式无效', 400)
  if (selectedRefundMethod === 'bank_transfer') order.refundMethod = 'original'
  else order.refundMethod = selectedRefundMethod as any
  if (selectedRefundMethod === 'bank_transfer') {
    const bankAccount = { bsb: String(form.refundBsb || order.refundBsb || '').trim(), number: String(form.refundAccountNumber || order.refundAccountNumber || '').trim(), name: String(form.refundAccountName || order.refundAccountName || '').trim() }
    if (!/^\d{3}-?\d{3}$/.test(bankAccount.bsb) || !/^\d{4,10}$/.test(bankAccount.number) || !bankAccount.name) return c.text('银行转账退款需要完整的 BSB、账号和账户名', 400)
    order.refundBsb = bankAccount.bsb; order.refundAccountNumber = bankAccount.number; order.refundAccountName = bankAccount.name
    payment.payment_method = 'bank_transfer'
  }
  const refundText = String(form.refundAmount ?? '').trim()
  const refundAmount = Number(refundText)
  const depositAmount = Number(payment.deposit_amount ?? order.depositAmount)
  const remainingRefundable = Number(Math.max(0, depositAmount - previouslyRefunded).toFixed(2))
  if (!/^\d+(\.\d{1,2})?$/.test(refundText) || !Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > remainingRefundable) return c.text(`退款金额无效：本次最多可退 ${remainingRefundable.toFixed(2)}`, 400)
  const totalRefunded = Number((previouslyRefunded + refundAmount).toFixed(2))
  const deductionAmount = Number(Math.max(0, depositAmount - totalRefunded).toFixed(2))
  const refundedProcessingFee = refundableDepositFee(refundAmount, payment)
  const totalRefundAmount = Number((refundAmount + refundedProcessingFee).toFixed(2))
  const refundItem = String(form.refundItem || 'deposit').trim()
  const customRefundItem = String(form.customRefundItem || '').trim()
  if (refundItem === 'other' && !customRefundItem) return c.text('请输入其他退款项目名称', 400)
  const refundItemLabel = refundItem === 'other' ? customRefundItem : '押金退款'
  const reason = String(form.deductionReason || '').trim()
  const deductionCategory = String(form.deductionCategory || '').trim()
  const validDeductionCategories = new Set(['DAMAGE', 'MISSING_ACCESSORY', 'LATE_FEE', 'DEVICE_NOT_RETURNED', 'OTHER'])
  if (deductionAmount > 0 && !validDeductionCategories.has(deductionCategory)) return c.text('请选择有效的押金扣款类别', 400)
  const recordedReason = reason ? `${refundItemLabel}；${reason}` : refundItemLabel
  if (deductionAmount > 0 && !reason) return c.text('扣除押金时必须填写原因', 400)

  await c.env.RENT.prepare('UPDATE orders SET refundMethod = ?, refundBsb = ?, refundAccountNumber = ?, refundAccountName = ? WHERE id = ?').bind(order.refundMethod, order.refundBsb || null, order.refundAccountNumber || null, order.refundAccountName || null, order.id).run()

  let stripeRefundId: string | null = null
  let channel = refundChannel(order, payment)
  if (channel === 'unavailable' && refundAmount > 0) return c.text('历史信用卡付款没有 Stripe 交易编号，无法原路退款；请先将退款方式改为余额', 409)
  if (channel === 'unavailable') channel = 'balance'
  if (channel === 'bank_transfer' && (!order.refundBsb || !order.refundAccountNumber || !order.refundAccountName)) return c.text('订单缺少银行退款账户信息', 409)
  if (refundAmount > 0 && channel === 'stripe') {
    const params = new URLSearchParams({
      payment_intent: payment.stripe_payment_intent_id,
      amount: String(cents(totalRefundAmount)),
      'metadata[order_id]': order.id,
      'metadata[type]': 'deposit',
    })
    const refund = await stripeRequest(c, 'refunds', params, `deposit-refund-${order.id}`)
    if (refund.status !== 'succeeded') return c.text('Stripe 押金退款尚未成功，请稍后重试', 502)
    stripeRefundId = refund.id
  }

  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_category, deduction_reason, stripe_refund_id, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name) VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, remainingRefundable, refundAmount, refundedProcessingFee, deductionAmount, deductionAmount > 0 ? deductionCategory : null, recordedReason, stripeRefundId, admin.id, channel, channel === 'bank_transfer' ? order.refundBsb : null, channel === 'bank_transfer' ? order.refundAccountNumber : null, channel === 'bank_transfer' ? order.refundAccountName : null),
    ...(totalRefundAmount > 0 && channel === 'balance' ? [c.env.RENT.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(totalRefundAmount, order.userId)] : []),
    c.env.RENT.prepare("UPDATE orders SET deposit_status = ?, deposit_deduction_amount = ?, deposit_refund_amount = ?, deposit_refund_at = CURRENT_TIMESTAMP WHERE id = ?").bind(totalRefunded >= depositAmount ? 'REFUNDED' : totalRefunded <= 0 ? 'FORFEITED' : 'PARTIALLY_REFUNDED', deductionAmount, totalRefunded, order.id),
    c.env.RENT.prepare("UPDATE devices SET status = 'available' WHERE id = ?").bind(order.deviceId),
  ])
  if (totalRefundAmount > 0 && channel === 'balance') await recordBalanceTransaction(c, order.userId, totalRefundAmount, 'refund_credit', `${refundItemLabel}退回账户余额`, admin.id)
  const refund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (refund) await recordFinancialLedgerEntry(c, { entryType: 'REFUND', amount: -totalRefundAmount, customerId: order.userId, orderId: order.id, sourceType: 'PAYMENT_REFUND', sourceId: refund.id, description: refundItemLabel, createdBy: admin.id, metadata: { channel, principal: refundAmount, processingFee: refundedProcessingFee } })
  if (refundAmount > 0) await issueCreditNote(c, order.id, refundAmount, refundedProcessingFee, `deposit-${nanoid(12)}`)
  return c.redirect(`/admin/orders/${order.id}`, 303)
}

export async function refundUnusedRentalDays(c: Context, admin: any, order: any, returnedDate: string): Promise<void> {
  const end = new Date(`${order.endDate}T00:00:00Z`).getTime()
  const returned = new Date(`${returnedDate}T00:00:00Z`).getTime()
  const unusedDays = Math.max(0, Math.ceil((end - returned) / 86400000))
  const amount = Number((unusedDays * Number(order.dailyRate || 0)).toFixed(2))
  if (!amount) return
  const existing = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'early_return' AND status IN ('pending', 'succeeded')").bind(order.id).first()
  if (existing) return
  const payment = await paidPayment(c, order)
  if (await hasOpenPaymentDispute(c, payment.id)) throw new Error('该笔付款存在未解决的拒付争议，暂不能退还未使用租金')
  let channel = refundChannel(order, payment)
  if (channel === 'unavailable') channel = 'balance'
  if (channel === 'bank_transfer') {
    await c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, deduction_amount, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name, deduction_reason) VALUES (?, ?, ?, ?, 'early_return', ?, ?, 0, 'pending', ?, 'bank_transfer', ?, ?, ?, ?)`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, amount, amount, admin.id, order.refundBsb || null, order.refundAccountNumber || null, order.refundAccountName || null, `提前归还，未使用 ${unusedDays} 天租金`)
      .run()
    return
  }
  let stripeRefundId: string | null = null
  if (channel === 'stripe') {
    const refund = await stripeRequest(c, 'refunds', new URLSearchParams({ payment_intent: payment.stripe_payment_intent_id, amount: String(cents(amount)), 'metadata[order_id]': order.id, 'metadata[type]': 'early_return' }), `early-return-refund-${order.id}`)
    if (refund.status !== 'succeeded') throw new Error('未使用租金退款尚未成功，请稍后重试')
    stripeRefundId = refund.id
  }
  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, deduction_amount, stripe_refund_id, status, processed_by, refund_method) VALUES (?, ?, ?, ?, 'early_return', ?, ?, 0, ?, 'succeeded', ?, ?)`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, amount, amount, stripeRefundId, admin.id, channel),
    ...(channel === 'balance' ? [c.env.RENT.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(amount, order.userId)] : []),
  ])
  if (channel === 'balance') await recordBalanceTransaction(c, order.userId, amount, 'refund_credit', `提前归还未使用租金退款`, admin.id)
  const refund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'early_return' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (refund) await recordFinancialLedgerEntry(c, { entryType: 'REFUND', amount: -amount, customerId: order.userId, orderId: order.id, sourceType: 'PAYMENT_REFUND', sourceId: refund.id, description: '提前归还未使用租金退款', createdBy: admin.id, metadata: { channel } })
  await issueCreditNote(c, order.id, amount, 0, `early-${nanoid(12)}`)
}

export async function cancelAndRefund(c: Context, admin: any, orderId: string): Promise<Response> {
  const order = await getOrderById(c, orderId)
  if (!order) return c.text('订单不存在', 404)
  const today = melbourneDate()
  if (!['paid', 'pending_pickup'].includes(String(order.status)) || order.startDate <= today) return c.text('只有租赁开始前的已付款订单可以全额取消退款', 409)
  const existingRefund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'cancellation' AND status = 'succeeded'").bind(order.id).first()
  if (existingRefund) return c.text('该订单已经全额退款', 409)
  const payment = await c.env.RENT.prepare("SELECT * FROM payments WHERE rental_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1").bind(order.id).first() as any
  if (!payment) return c.text('未找到已结算付款，不能自动退款', 409)
  if (await hasOpenPaymentDispute(c, payment.id)) return c.text('该笔付款存在未解决的拒付争议，暂不能退款', 409)
  const channel = cancellationRefundChannel(payment)
  if (channel === 'unavailable') return c.text('未找到信用卡原路退款所需的 Stripe 交易记录，不能改为余额退款', 409)
  if (channel === 'bank_transfer' && (!order.refundBsb || !order.refundAccountNumber || !order.refundAccountName)) return c.text('订单缺少银行退款账户信息', 409)
  const refundAmount = Number(payment.amount || 0)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) return c.text('原始付款金额无效，不能自动退款', 409)
  const refundedProcessingFee = Math.max(0, Number(payment.processing_fee || 0))

  if (channel === 'bank_transfer') {
    await c.env.RENT.batch([
      c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, deduction_amount, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name, deduction_reason) VALUES (?, ?, ?, ?, 'cancellation', ?, ?, 0, 'pending', ?, 'bank_transfer', ?, ?, ?, '租前取消，等待管理员银行转账')`)
        .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, refundAmount, refundAmount, admin.id, order.refundBsb, order.refundAccountNumber, order.refundAccountName),
      c.env.RENT.prepare("UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id),
      c.env.RENT.prepare("UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
      c.env.RENT.prepare("UPDATE devices SET status = 'available' WHERE id = ?").bind(order.deviceId),
    ])
    await releaseCouponForOrder(c, order.id)
    await revokeReferralRewardForOrder(c, order.id, '订单取消并退款')
    return c.redirect(`/admin/orders/${order.id}`, 303)
  }

  let stripeRefundId: string | null = null
  if (channel === 'stripe') {
    const params = new URLSearchParams({ payment_intent: payment.stripe_payment_intent_id, amount: String(cents(refundAmount)), 'metadata[order_id]': order.id, 'metadata[type]': 'cancellation' })
    const refund = await stripeRequest(c, 'refunds', params, `cancellation-refund-${order.id}`)
    if (refund.status !== 'succeeded') return c.text('Stripe 全额退款尚未成功，请稍后重试', 502)
    stripeRefundId = refund.id
  }

  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, refund_number, order_id, payment_id, type, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, stripe_refund_id, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name) VALUES (?, ?, ?, ?, 'cancellation', ?, ?, ?, 0, ?, 'succeeded', ?, ?, ?, ?, ?)`)
      .bind(`rf-${nanoid(12)}`, generateReferenceNumber('RFD'), order.id, payment.id, refundAmount, refundAmount, refundedProcessingFee, stripeRefundId, admin.id, channel, null, null, null),
    ...(channel === 'balance' ? [c.env.RENT.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(refundAmount, order.userId)] : []),
    c.env.RENT.prepare("UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id),
    c.env.RENT.prepare("UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
    c.env.RENT.prepare("UPDATE devices SET status = 'available' WHERE id = ?").bind(order.deviceId),
  ])
  await releaseCouponForOrder(c, order.id)
  await revokeReferralRewardForOrder(c, order.id, '订单取消并退款')
  if (channel === 'balance') await recordBalanceTransaction(c, order.userId, refundAmount, 'refund_credit', '取消订单全额退款', admin.id)
  await issueCreditNote(c, order.id, Math.max(0, refundAmount - refundedProcessingFee), refundedProcessingFee, `cancellation-${nanoid(12)}`)
  await c.env.RENT.prepare("INSERT INTO order_change_history (id, order_id, change_type, before_json, after_json, reason, changed_by) VALUES (?, ?, 'CANCELLATION', ?, ?, ?, ?)").bind(`och-${nanoid(12)}`, order.id, JSON.stringify({ status: order.status, deviceId: order.deviceId }), JSON.stringify({ status: 'cancelled', deviceReleased: true }), '取消订单并退款', admin.id).run()
  const refund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'cancellation' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (refund) await recordFinancialLedgerEntry(c, { entryType: 'REFUND', amount: -refundAmount, customerId: order.userId, orderId: order.id, sourceType: 'PAYMENT_REFUND', sourceId: refund.id, description: '取消订单全额退款', createdBy: admin.id, metadata: { channel, refundedProcessingFee } })
  return c.redirect(`/admin/orders/${order.id}`, 303)
}

export async function completeBankTransferRefund(c: Context, admin: any, refundId: string): Promise<void> {
  const pending = await c.env.RENT.prepare("SELECT payment_id FROM payment_refunds WHERE id = ? AND type IN ('cancellation', 'early_return') AND refund_method = 'bank_transfer' AND status = 'pending'").bind(refundId).first() as any
  if (!pending) throw new Error('退款记录不存在或已经处理')
  if (await hasOpenPaymentDispute(c, String(pending.payment_id || ''))) throw new Error('该笔付款存在未解决的拒付争议，暂不能放款')
  const result = await c.env.RENT.prepare("UPDATE payment_refunds SET status = 'succeeded', processed_by = ?, created_at = CURRENT_TIMESTAMP WHERE id = ? AND type IN ('cancellation', 'early_return') AND refund_method = 'bank_transfer' AND status = 'pending'").bind(admin.id, refundId).run()
  if (!result.meta?.changes) throw new Error('退款记录不存在或已经处理')
}
