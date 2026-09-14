/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { ensureOrderNumber, getOrderById, getSystemSettings, issueInvoice, loadSystemSettingsFromDB, claimWebhookEvent, markWebhookFailed, markWebhookProcessed, logError } from '../site'
import { getSquareRuntimeConfig, squareRequest, syncSquareCustomerProfile, verifySquareWebhook } from '../square'
import { getStripePublishableKey, stripeRequest } from '../stripe'
import { balancePriceAdjustmentSettlementStatements, getOrderPriceAdjustmentSummary } from './stripePayments'

function cents(value: number): number { return Math.max(0, Math.round(Number(value || 0) * 100)) }

function squarePaymentAmounts(baseAmount: number): { base: number; fee: number; total: number } {
  const base = Number(Math.max(0, baseAmount).toFixed(2))
  const feeRate = Math.min(1, Math.max(0, Number(getSystemSettings().paymentMethods.squareProcessingFeeRate ?? 0.022)))
  const fee = Number((base * feeRate).toFixed(2))
  return { base, fee, total: Number((base + fee).toFixed(2)) }
}

function orderPayableAmount(order: any): number {
  return Math.max(0, Number((Number(order.totalAmount ?? order.total_amount ?? 0) - Number(order.depositAmount ?? order.deposit_amount ?? 0)).toFixed(2)))
}

function squareOrderPaymentAmounts(order: any): { rentalAmount: number; fee: number; total: number } {
  const amounts = squarePaymentAmounts(orderPayableAmount(order))
  return { rentalAmount: amounts.base, fee: amounts.fee, total: amounts.total }
}

async function ensureSquareEnabled(c: Context): Promise<void> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.square) throw new Error('礼品卡支付当前未启用')
}

async function ensureStripeEnabled(c: Context): Promise<void> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.stripe) throw new Error('礼品卡余额不足，且 Stripe 支付当前未启用')
}

async function completeSquarePayment(c: Context, paymentId: string, expectedCents: number): Promise<any> {
  let payment = await squareRequest(c, `/v2/payments/${encodeURIComponent(paymentId)}`, undefined, 'GET')
  const status = String(payment?.status || '').toUpperCase()
  if (status === 'COMPLETED') {
    const returned = squareAmount(payment)
    if (returned.amount !== expectedCents || returned.currency !== 'AUD') throw new Error('已完成付款的金额或币种不匹配')
    return payment
  }
  if (status !== 'APPROVED') throw new Error('礼品卡授权状态无效，无法完成扣款')
  payment = await squareRequest(c, `/v2/payments/${encodeURIComponent(paymentId)}/complete`, {}, 'POST')
  if (String(payment?.status || '').toUpperCase() !== 'COMPLETED') throw new Error('礼品卡扣款尚未完成')
  const returned = squareAmount(payment)
  if (returned.amount !== expectedCents || returned.currency !== 'AUD') throw new Error('Square 完成付款的金额或币种不匹配')
  return payment
}

export async function completeSquareGiftCardPayment(c: Context, paymentId: string, expectedCents: number): Promise<any> {
  await ensureSquareEnabled(c)
  if (!paymentId || !Number.isInteger(expectedCents) || expectedCents <= 0) throw new Error('礼品卡付款参数无效')
  return completeSquarePayment(c, paymentId, expectedCents)
}

async function createOrReuseStripeRemainder(c: Context, options: {
  existingIntentId?: string
  amountCents: number
  customerId?: string
  receiptEmail?: string
  idempotencyKey: string
  metadata: Record<string, string>
  description: string
}): Promise<any> {
  await ensureStripeEnabled(c)
  if (options.amountCents <= 0) throw new Error('Stripe 剩余支付金额无效')
  if (options.existingIntentId) {
    const existing = await stripeRequest(c, `payment_intents/${encodeURIComponent(options.existingIntentId)}`).catch(() => null)
    if (existing?.status === 'succeeded') return existing
    if (existing?.client_secret && ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(String(existing.status))) return existing
  }
  const params = new URLSearchParams({
    amount: String(options.amountCents),
    currency: 'aud',
    'automatic_payment_methods[enabled]': 'true',
    description: options.description,
  })
  if (options.customerId) params.set('customer', options.customerId)
  if (options.receiptEmail) params.set('receipt_email', options.receiptEmail)
  Object.entries(options.metadata).forEach(([key, value]) => params.set(`metadata[${key}]`, value))
  const intent = await stripeRequest(c, 'payment_intents', params, options.idempotencyKey)
  if (!intent?.client_secret) throw new Error('Stripe 未返回剩余金额支付凭据')
  return intent
}

function approvedSquareCents(squarePayment: any): number {
  return Number(squarePayment?.approved_money?.amount ?? squarePayment?.amount_money?.amount ?? 0)
}

function stripeRemainderResult(c: Context, intent: any, amountCents: number, returnShape = true): Promise<any> {
  return getStripePublishableKey(c).then(publishableKey => returnShape ? {
    status: 'partial',
    remainingAmountCents: amountCents,
    clientSecret: String(intent.client_secret || ''),
    publishableKey,
  } : null)
}

export async function getSquareGiftCardConfigForOrder(c: Context, user: any, orderId: string) {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (String(order.paymentProvider || '') !== 'square') throw new Error('该订单未选择礼品卡支付')
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')
  const config = await getSquareRuntimeConfig(c)
  const payment = await c.env.RENT.prepare("SELECT status, square_paid_amount FROM payments WHERE rental_id = ? AND payment_provider = 'square' AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  const targetCents = cents(squareOrderPaymentAmounts(order).total)
  return { applicationId: config.applicationId, locationId: config.locationId, environment: config.environment, amountCents: targetCents, alreadyPaid: payment?.status === 'paid' && cents(Number(payment?.square_paid_amount || 0)) >= targetCents }
}

async function finalizeSquarePayment(c: Context, order: any, paymentId: string, squarePayment: any): Promise<void> {
  const transactionId = String(squarePayment.id || squarePayment.receipt_number || `SQ-${nanoid(10)}`)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', square_payment_id = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND payment_provider = 'square'").bind(String(squarePayment.id || ''), transactionId, paymentId),
    ...(Number(order.depositAmount ?? order.deposit_amount ?? 0) > 0 && String(order.deposit_status || '').toUpperCase() === 'PENDING' ? [] : [c.env.RENT.prepare("UPDATE orders SET status = 'paid', order_status = 'CONFIRMED', payment_status = 'PAID', rental_status = 'READY_FOR_PICKUP', paymentMethod = 'card', payment_provider = 'square', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id)]),
  ])
  await ensureOrderNumber(c, order.id).catch(error => logError(c, 'WARNING', 'ensureOrderNumber failed after Square payment', error, { orderId: order.id }))
  // 与 Stripe 侧同一个教训：开票失败绝不能只有 console.error——那样订单已经
  // paid，发票却永久缺失，而且没有任何可查询记录。
  await issueInvoice(c, order.id).catch(error => logError(c, 'CRITICAL', 'Square invoice issue failed', error, { orderId: order.id }))
}

function squareAmount(squarePayment: any): { amount: number; currency: string } {
  return {
    amount: Number(squarePayment?.amount_money?.amount ?? 0),
    currency: String(squarePayment?.amount_money?.currency || '').toUpperCase(),
  }
}

async function finalizeSquareBalanceTopUp(c: Context, topup: any, squarePayment: any): Promise<void> {
  const transactionId = String(squarePayment.id || squarePayment.receipt_number || `SQ-${nanoid(10)}`)
  const balanceTransactionId = `bt-${topup.id}`
  // All three statements are in one D1 batch. The NOT EXISTS guard makes a
  // synchronous response and a later webhook unable to credit the wallet twice.
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE balance_topups SET status = 'paid', transaction_id = ?, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(transactionId, topup.id),
    c.env.RENT.prepare("UPDATE users SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND NOT EXISTS (SELECT 1 FROM balance_transactions WHERE id = ?)").bind(Number(topup.amount), topup.user_id, balanceTransactionId),
    c.env.RENT.prepare("INSERT OR IGNORE INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) SELECT ?, ?, ?, ROUND(balance, 2), 'top_up_card', ?, NULL FROM users WHERE id = ?").bind(balanceTransactionId, topup.user_id, topup.amount, '礼品卡充值', topup.user_id),
  ])
}

async function prepareSquarePriceAdjustment(c: Context, user: any, orderId: string): Promise<{ order: any; adjustment: any; amountCents: number }> {
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (['pending_payment', 'completed', 'cancelled'].includes(String(order.status))) throw new Error('该订单当前不能支付差价')
  const summary = await getOrderPriceAdjustmentSummary(c, order)
  if (summary.amountDue <= 0) throw new Error('当前没有待支付差价')
  const amounts = squarePaymentAmounts(summary.amountDue)
  const adjustmentId = String(summary.pendingIncrease?.id || `opa-${nanoid(12)}`)
  if (summary.pendingIncrease) {
    await c.env.RENT.prepare("UPDATE order_price_adjustments SET before_total = ?, after_total = ?, amount = ?, processing_fee = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
      .bind(Number(order.totalAmount) - summary.amountDue, Number(order.totalAmount), summary.amountDue, adjustmentId).run()
  } else {
    await c.env.RENT.prepare("INSERT INTO order_price_adjustments (id, order_id, direction, before_total, after_total, amount, processing_fee, status, created_by) VALUES (?, ?, 'increase', ?, ?, ?, 0, 'pending', ?)")
      .bind(adjustmentId, order.id, Number(order.totalAmount) - summary.amountDue, Number(order.totalAmount), summary.amountDue, user.id).run()
  }
  await c.env.RENT.prepare("UPDATE order_price_adjustments SET processing_fee = ? WHERE id = ? AND status = 'pending'").bind(amounts.fee, adjustmentId).run()
  const adjustment = await c.env.RENT.prepare("SELECT * FROM order_price_adjustments WHERE id = ? AND order_id = ? AND direction = 'increase' AND status = 'pending'").bind(adjustmentId, order.id).first() as any
  if (!adjustment) throw new Error('差价记录创建失败，请刷新后重试')
  return { order, adjustment, amountCents: cents(amounts.total) }
}

export async function getSquareGiftCardConfigForBalanceTopUp(c: Context, user: any, topUpId: string) {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND user_id = ? AND payment_method = 'square' AND status = 'pending'").bind(topUpId, user.id).first() as any
  if (!topup) throw new Error('充值记录不存在或已处理')
  const config = await getSquareRuntimeConfig(c)
  const amounts = squarePaymentAmounts(Number(topup.amount))
  return { applicationId: config.applicationId, locationId: config.locationId, environment: config.environment, amountCents: cents(amounts.total), alreadyPaid: false }
}

export async function createSquareGiftCardBalanceTopUp(c: Context, user: any, topUpId: string, sourceId: string): Promise<{ status: string; alreadyPaid?: boolean; squarePaidAmountCents?: number; remainingAmountCents?: number }> {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const cleanSourceId = String(sourceId || '').trim()
  if (cleanSourceId.length < 10 || cleanSourceId.length > 500) throw new Error('礼品卡支付凭据无效')
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND user_id = ? AND payment_method = 'square' AND status = 'pending'").bind(topUpId, user.id).first() as any
  if (!topup) throw new Error('充值记录不存在或已处理')
  const amounts = squarePaymentAmounts(Number(topup.amount))
  const amountCents = cents(amounts.total)
  if (amountCents <= 0) throw new Error('充值金额无效')
  let squarePayment: any = null
  if (topup.transaction_id) squarePayment = await squareRequest(c, `/v2/payments/${encodeURIComponent(String(topup.transaction_id))}`, undefined, 'GET').catch(() => null)
  if (!squarePayment || ['FAILED', 'CANCELED'].includes(String(squarePayment.status || '').toUpperCase())) {
    const customerId = await syncSquareCustomerProfile(c, user)
    squarePayment = await squareRequest(c, '/v2/payments', {
      source_id: cleanSourceId,
      idempotency_key: `rent-sq-topup-${String(topup.id).slice(0, 32)}`,
      amount_money: { amount: amountCents, currency: 'AUD' },
      accept_partial_authorization: true,
      autocomplete: false,
      location_id: (await getSquareRuntimeConfig(c)).locationId,
      ...(customerId ? { customer_id: customerId } : {}),
      reference_id: String(topup.id),
      note: `账户余额充值 ${topup.id}`,
    })
  }
  const returned = squareAmount(squarePayment)
  if (returned.amount <= 0 || returned.amount > amountCents || returned.currency !== 'AUD') throw new Error('Square 返回的金额或币种与充值记录不一致')
  const approvedCents = approvedSquareCents(squarePayment)
  if (approvedCents <= 0 || approvedCents > amountCents) throw new Error('礼品卡授权金额无效')
  await c.env.RENT.prepare('UPDATE balance_topups SET transaction_id = ?, processing_fee = ?, square_paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'pending\'').bind(String(squarePayment.id || topup.transaction_id || ''), amounts.fee, approvedCents / 100, topup.id).run()
  const status = String(squarePayment.status || '').toUpperCase()
  if (status === 'COMPLETED') {
    if (approvedCents !== amountCents) throw new Error('Square 充值付款未覆盖完整金额')
    await finalizeSquareBalanceTopUp(c, topup, squarePayment)
  }
  else if (['FAILED', 'CANCELED'].includes(status)) {
    await c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(topup.id).run()
    throw new Error('礼品卡充值未完成')
  } else if (approvedCents < amountCents) {
    return { status: 'partial', squarePaidAmountCents: approvedCents, remainingAmountCents: amountCents - approvedCents }
  } else if (status === 'APPROVED') {
    const completed = await completeSquarePayment(c, String(squarePayment.id), amountCents)
    await finalizeSquareBalanceTopUp(c, topup, completed)
  }
  return { status: status.toLowerCase() || 'pending', squarePaidAmountCents: approvedCents }
}

export async function getSquareGiftCardConfigForPriceAdjustment(c: Context, user: any, orderId: string) {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const { order, amountCents } = await prepareSquarePriceAdjustment(c, user, orderId)
  const config = await getSquareRuntimeConfig(c)
  const payment = await c.env.RENT.prepare("SELECT p.status FROM payments p JOIN order_price_adjustments a ON a.payment_id = p.id WHERE a.order_id = ? AND a.direction = 'increase' AND a.status = 'pending' AND p.payment_provider = 'square' ORDER BY p.created_at DESC LIMIT 1").bind(order.id).first() as any
  return { applicationId: config.applicationId, locationId: config.locationId, environment: config.environment, amountCents, alreadyPaid: payment?.status === 'paid' }
}

async function finalizeSquarePriceAdjustment(c: Context, order: any, adjustment: any, payment: any, squarePayment: any): Promise<void> {
  const balanceSettlement = await balancePriceAdjustmentSettlementStatements(c, order, adjustment)
  const statements: any[] = [
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', square_payment_id = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending' AND payment_provider = 'square'").bind(String(squarePayment.id || ''), String(squarePayment.id || ''), payment.id),
    ...(balanceSettlement.length ? balanceSettlement : [c.env.RENT.prepare("UPDATE order_price_adjustments SET status = 'succeeded', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(adjustment.id)]),
  ]
  await c.env.RENT.batch(statements)
}

export async function createSquareGiftCardPriceAdjustmentPayment(c: Context, user: any, orderId: string, sourceId?: string): Promise<{ status: string; alreadyPaid?: boolean }> {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const { order, adjustment, amountCents } = await prepareSquarePriceAdjustment(c, user, orderId)
  const storedGiftCardId = String((order as any).square_gift_card_id || (order as any).squareGiftCardId || '').trim()
  const cleanSourceId = String(sourceId || '').trim()
  const sourceForPayment = storedGiftCardId || cleanSourceId
  if (!sourceForPayment || (!storedGiftCardId && (cleanSourceId.length < 10 || cleanSourceId.length > 500))) throw new Error('礼品卡支付凭据无效')
  const existing = adjustment.payment_id ? await c.env.RENT.prepare("SELECT * FROM payments WHERE id = ? AND status = 'pending' AND payment_provider = 'square'").bind(adjustment.payment_id).first() as any : null
  const paymentId = String(existing?.id || `p-${nanoid(12)}`)
  if (existing) {
    await c.env.RENT.prepare("UPDATE payments SET amount = ?, rental_amount = ?, processing_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(amountCents / 100, Number(adjustment.amount), Number(adjustment.processing_fee || 0), paymentId).run()
  } else {
    await c.env.RENT.batch([
      c.env.RENT.prepare("INSERT INTO payments (id, rental_id, customer_id, payment_method, payment_provider, amount, deposit_amount, rental_amount, processing_fee, currency, status) VALUES (?, ?, ?, 'card', 'square', ?, 0, ?, ?, 'AUD', 'pending')").bind(paymentId, order.id, user.id, amountCents / 100, Number(adjustment.amount), Number(adjustment.processing_fee || 0)),
      c.env.RENT.prepare('UPDATE order_price_adjustments SET payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'pending\'').bind(paymentId, adjustment.id),
    ])
  }
  let squarePayment: any = existing?.square_payment_id
    ? await squareRequest(c, `/v2/payments/${encodeURIComponent(String(existing.square_payment_id))}`, undefined, 'GET').catch(() => null)
    : null
  if (!squarePayment || ['FAILED', 'CANCELED'].includes(String(squarePayment.status || '').toUpperCase())) {
    const customerId = await syncSquareCustomerProfile(c, user)
    squarePayment = await squareRequest(c, '/v2/payments', {
      source_id: sourceForPayment,
      idempotency_key: `rent-sq-adjustment-${String(adjustment.id).slice(0, 32)}`,
      amount_money: { amount: amountCents, currency: 'AUD' },
      accept_partial_authorization: true,
      autocomplete: false,
      location_id: (await getSquareRuntimeConfig(c)).locationId,
      ...(customerId ? { customer_id: customerId } : {}),
      reference_id: String(adjustment.id),
      note: `订单 ${order.orderNo || order.id} 补差价`,
    })
  }
  const returned = squareAmount(squarePayment)
  if (returned.amount <= 0 || returned.amount > amountCents || returned.currency !== 'AUD') throw new Error('Square 返回的金额或币种与差价记录不一致')
  const status = String(squarePayment.status || '').toUpperCase()
  if (status === 'COMPLETED') {
    if (approvedSquareCents(squarePayment) !== amountCents) throw new Error('Square 差价付款未覆盖完整金额')
    await finalizeSquarePriceAdjustment(c, order, adjustment, { ...existing, id: paymentId }, squarePayment)
  }
  else if (['FAILED', 'CANCELED'].includes(status)) {
    await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(paymentId).run()
    throw new Error('礼品卡差价付款未完成')
  } else if (approvedSquareCents(squarePayment) < amountCents) {
    const approvedCents = approvedSquareCents(squarePayment)
    const remainderCents = amountCents - approvedCents
    const intent = await createOrReuseStripeRemainder(c, {
      existingIntentId: existing?.stripe_payment_intent_id ? String(existing.stripe_payment_intent_id) : '',
      amountCents: remainderCents,
      customerId: String(user.stripe_customer_id || user.stripeCustomerId || ''),
      receiptEmail: user.email,
      idempotencyKey: `rent-sq-adjustment-remainder-${String(adjustment.id).slice(0, 32)}`,
      metadata: {
        type: 'price_adjustment',
        adjustment_id: String(adjustment.id),
        customer_id: String(user.id),
        square_split: '1',
        square_payment_id: String(squarePayment.id || ''),
        target_amount: String(amountCents),
        square_approved_amount: String(approvedCents),
        remainder_amount: String(remainderCents),
      },
      description: `订单 ${order.orderNo || order.id}｜礼品卡差额`,
    })
    await c.env.RENT.prepare('UPDATE payments SET stripe_payment_intent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'pending\'').bind(String(intent.id), paymentId).run()
    return await stripeRemainderResult(c, intent, remainderCents)
  } else if (status === 'APPROVED') {
    const completed = await completeSquarePayment(c, String(squarePayment.id), amountCents)
    await finalizeSquarePriceAdjustment(c, order, adjustment, { ...existing, id: paymentId }, completed)
  }
  return { status: status.toLowerCase() || 'pending' }
}

export async function createSquareGiftCardPayment(c: Context, user: any, orderId: string, sourceId?: string): Promise<{ status: string; alreadyPaid?: boolean; squarePaidAmountCents?: number; remainingAmountCents?: number }> {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (String(order.paymentProvider || '') !== 'square') throw new Error('该订单未选择礼品卡支付')
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')
  const storedGiftCardId = String((order as any).square_gift_card_id || (order as any).squareGiftCardId || '').trim()
  const cleanSourceId = String(sourceId || '').trim()
  const sourceForPayment = storedGiftCardId || cleanSourceId
  if (!sourceForPayment || (!storedGiftCardId && (cleanSourceId.length < 10 || cleanSourceId.length > 500))) throw new Error('礼品卡支付凭据无效')
  const amounts = squareOrderPaymentAmounts(order)
  const amountCents = cents(amounts.total)
  if (amountCents <= 0) throw new Error('订单没有可支付的租金金额')
  const existing = await c.env.RENT.prepare("SELECT * FROM payments WHERE rental_id = ? AND payment_provider = 'square' AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (existing?.status === 'paid') return { status: 'paid', alreadyPaid: true }

  const paymentId = String(existing?.id || `p-${nanoid(12)}`)
  if (existing) {
    await c.env.RENT.prepare("UPDATE payments SET amount = ?, rental_amount = ?, processing_fee = ?, square_paid_amount = 0, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(amounts.total, amounts.rentalAmount, amounts.fee, paymentId).run()
  } else {
    await c.env.RENT.prepare("INSERT INTO payments (id, rental_id, customer_id, payment_method, payment_provider, amount, deposit_amount, rental_amount, processing_fee, square_paid_amount, currency, status) VALUES (?, ?, ?, 'card', 'square', ?, 0, ?, ?, 0, 'AUD', 'pending')").bind(paymentId, order.id, user.id, amounts.total, amounts.rentalAmount, amounts.fee).run()
  }

  let squarePayment: any = existing?.square_payment_id
    ? await squareRequest(c, `/v2/payments/${encodeURIComponent(String(existing.square_payment_id))}`, undefined, 'GET').catch(() => null)
    : null
  if (!squarePayment || ['FAILED', 'CANCELED'].includes(String(squarePayment.status || '').toUpperCase())) {
    const customerId = await syncSquareCustomerProfile(c, user)
    squarePayment = await squareRequest(c, '/v2/payments', {
      source_id: sourceForPayment,
      idempotency_key: `rent-sq-${String(order.id).slice(0, 32)}`,
      amount_money: { amount: amountCents, currency: 'AUD' },
      accept_partial_authorization: true,
      autocomplete: false,
      location_id: (await getSquareRuntimeConfig(c)).locationId,
      ...(customerId ? { customer_id: customerId } : {}),
      reference_id: String(order.id),
      note: `设备租赁订单 ${order.orderNo || order.id}`,
    })
  }
  const returnedAmount = Number(squarePayment.amount_money?.amount ?? 0)
  const returnedCurrency = String(squarePayment.amount_money?.currency || '').toUpperCase()
  if (returnedAmount <= 0 || returnedAmount > amountCents || returnedCurrency !== 'AUD') throw new Error('Square 返回的金额或币种与订单不一致')
  const status = String(squarePayment.status || '').toUpperCase()
  const squarePaidAmountCents = approvedSquareCents(squarePayment)
  await c.env.RENT.prepare('UPDATE payments SET square_payment_id = ?, square_paid_amount = ?, transaction_id = COALESCE(transaction_id, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(String(squarePayment.id || ''), squarePaidAmountCents / 100, String(squarePayment.id || ''), paymentId).run()
  if (status === 'COMPLETED') {
    if (approvedSquareCents(squarePayment) !== amountCents) throw new Error('Square 订单付款未覆盖完整金额')
    await finalizeSquarePayment(c, order, paymentId, squarePayment)
  }
  else if (['FAILED', 'CANCELED'].includes(status)) {
    await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(paymentId).run()
    throw new Error('礼品卡付款未完成')
  } else if (approvedSquareCents(squarePayment) < amountCents) {
    const approvedCents = approvedSquareCents(squarePayment)
    return { status: 'partial', squarePaidAmountCents: approvedCents, remainingAmountCents: amountCents - approvedCents }
  } else if (status === 'APPROVED') {
    const completed = await completeSquarePayment(c, String(squarePayment.id), amountCents)
    await finalizeSquarePayment(c, order, paymentId, completed)
  }
  return { status: status.toLowerCase() || 'pending', squarePaidAmountCents: squarePaidAmountCents }
}

export async function handleSquareWebhook(c: Context): Promise<Response> {
  await loadSystemSettingsFromDB(c)
  const body = await c.req.text()
  const event = await verifySquareWebhook(c, body, c.req.header('x-square-hmacsha256-signature'))
  const eventId = String(event.event_id || event.id || '')
  if (!eventId) throw new Error('Square webhook 缺少 event_id')
  const claim = await claimWebhookEvent(c, { provider: 'square', eventId, eventType: String(event.type || '') })
  if (!claim.firstDelivery) return c.json({ received: true, duplicate: true })
  try {
    const paymentData = event.data?.object?.payment || event.data?.object?.payment_updated?.payment || event.data?.object
    const squarePaymentId = String(paymentData?.id || '')
    const payment = squarePaymentId ? await c.env.RENT.prepare("SELECT * FROM payments WHERE square_payment_id = ? AND payment_provider = 'square' LIMIT 1").bind(squarePaymentId).first() as any : null
    const topup = squarePaymentId ? await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE transaction_id = ? AND payment_method = 'square' AND status IN ('pending', 'paid') LIMIT 1").bind(squarePaymentId).first() as any : null
    if (topup) {
      const status = String(paymentData?.status || '').toUpperCase()
      if (status === 'COMPLETED') {
        const returned = squareAmount(paymentData)
        if (returned.amount !== cents(squarePaymentAmounts(Number(topup.amount)).total) || returned.currency !== 'AUD') throw new Error('Square 充值 webhook 金额或币种不匹配')
        if (!topup.stripe_payment_intent_id) await finalizeSquareBalanceTopUp(c, topup, paymentData)
      } else if (['FAILED', 'CANCELED'].includes(status)) {
        if (!topup.stripe_payment_intent_id) await c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(topup.id).run()
      }
    } else if (payment) {
      const order = await getOrderById(c, String(payment.rental_id))
      const status = String(paymentData?.status || '').toUpperCase()
      const adjustment = await c.env.RENT.prepare("SELECT * FROM order_price_adjustments WHERE payment_id = ? AND direction = 'increase' AND status = 'pending'").bind(payment.id).first() as any
      if (order && adjustment && status === 'COMPLETED') {
        const returned = squareAmount(paymentData)
        if (returned.amount !== cents(Number(adjustment.amount) + Number(adjustment.processing_fee || 0)) || returned.currency !== 'AUD') throw new Error('Square 差价 webhook 金额或币种不匹配')
        if (!payment.stripe_payment_intent_id) await finalizeSquarePriceAdjustment(c, order, adjustment, payment, paymentData)
      } else if (order && status === 'COMPLETED' && !payment.stripe_payment_intent_id) await finalizeSquarePayment(c, order, String(payment.id), paymentData)
      else if (['FAILED', 'CANCELED'].includes(status) && !payment.stripe_payment_intent_id) await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id).run()
    }
    await markWebhookProcessed(c, claim.recordId)
    return c.json({ received: true })
  } catch (error: any) {
    await markWebhookFailed(c, claim.recordId, error?.message || String(error))
    throw error
  }
}
