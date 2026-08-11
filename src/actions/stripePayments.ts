/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { ensureOrderNumber, getOrderById, getSystemSettings, loadSystemSettingsFromDB, issueInvoice, issueCreditNote } from '../site'
import { stripeRequest, verifyStripeWebhook } from '../stripe'

function cents(value: number): number {
  return Math.round(Number(value) * 100)
}

export const STRIPE_PROCESSING_FEE_RATE = 0.025

export function stripePaymentAmounts(orderTotal: number): { baseCents: number; feeCents: number; chargedCents: number } {
  const baseCents = cents(orderTotal)
  const feeCents = Math.round(baseCents * STRIPE_PROCESSING_FEE_RATE)
  return { baseCents, feeCents, chargedCents: baseCents + feeCents }
}

export function stripeCheckoutItems(order: any): Array<{ name: string; amountCents: number }> {
  const totalCents = cents(order.totalAmount)
  const depositCents = cents(order.depositAmount || 0)
  if (depositCents < 0 || depositCents > totalCents) throw new Error('订单押金金额无效')
  const rentalCents = totalCents - depositCents
  const period = Number(order.rentalPeriod ?? order.rental_period ?? 0)
  const rentalLabel = period > 0
    ? `设备租金（${period} 天，${order.startDate} 至 ${order.endDate}）`
    : `设备租金（${order.startDate} 至 ${order.endDate}）`
  const feeCents = stripePaymentAmounts(order.totalAmount).feeCents
  return [
    { name: rentalLabel, amountCents: rentalCents },
    { name: '设备押金', amountCents: depositCents },
    { name: 'Stripe 支付手续费（2.5%）', amountCents: feeCents },
  ].filter(item => item.amountCents > 0)
}

export function refundableDepositFee(refundAmount: number, payment: any): number {
  if (payment?.payment_method !== 'card' || Number(payment?.processing_fee || 0) <= 0) return 0
  return Math.round(cents(refundAmount) * STRIPE_PROCESSING_FEE_RATE) / 100
}

function melbourneDate(): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export async function createStripeCheckout(c: Context, user: any, orderId: string): Promise<Response> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.stripe) return c.text('Stripe 支付当前未启用', 400)
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) return c.text('订单不存在或无权访问', 404)
  if (order.status !== 'pending_payment') return c.text('该订单当前不能支付', 409)

  const { baseCents, feeCents, chargedCents } = stripePaymentAmounts(order.totalAmount)
  if (!Number.isInteger(baseCents) || baseCents <= 0) return c.text('订单金额无效', 400)
  const origin = new URL(c.req.url).origin
  const params = new URLSearchParams({
    mode: 'payment',
    customer_email: user.email,
    success_url: `${origin}/payment/result?orderId=${encodeURIComponent(order.id)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/payment/result?orderId=${encodeURIComponent(order.id)}&cancelled=1`,
    'metadata[order_id]': order.id,
    'metadata[customer_id]': user.id,
    'metadata[rental_amount]': String(cents(order.totalAmount - order.depositAmount)),
    'metadata[deposit_amount]': String(cents(order.depositAmount)),
    'metadata[processing_fee]': String(feeCents),
    'payment_intent_data[metadata][order_id]': order.id,
  })
  stripeCheckoutItems(order).forEach((item, index) => {
    params.set(`line_items[${index}][price_data][currency]`, 'aud')
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.amountCents))
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name)
    params.set(`line_items[${index}][quantity]`, '1')
  })
  const session = await stripeRequest(c, 'checkout/sessions', params, `checkout-v2-${order.id}-${nanoid(12)}`)
  if (!session.id || !session.url) return c.text('Stripe 未返回有效支付链接', 502)

  const existing = await c.env.RENT.prepare("SELECT id FROM payments WHERE rental_id = ? AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (existing) {
    await c.env.RENT.prepare("UPDATE payments SET stripe_checkout_session_id = ?, amount = ?, processing_fee = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(session.id, chargedCents / 100, feeCents / 100, existing.id).run()
  } else {
    await c.env.RENT.prepare(`
      INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, processing_fee, currency, status, stripe_checkout_session_id)
      VALUES (?, ?, ?, 'card', ?, ?, ?, ?, 'AUD', 'pending', ?)
    `).bind(`p-${nanoid(12)}`, order.id, user.id, chargedCents / 100, order.depositAmount, order.totalAmount - order.depositAmount, feeCents / 100, session.id).run()
  }
  return c.redirect(session.url, 303)
}

export async function handleStripeWebhook(c: Context): Promise<Response> {
  const rawBody = await c.req.text()
  let event: any
  try {
    event = await verifyStripeWebhook(c, rawBody, c.req.header('stripe-signature'))
  } catch (error: any) {
    return c.text(error.message || 'Webhook 签名无效', 400)
  }

  const processed = await c.env.RENT.prepare('SELECT event_id FROM stripe_webhook_events WHERE event_id = ?').bind(event.id).first()
  if (processed) return c.json({ received: true, duplicate: true })

  const session = event.data?.object
  const statements: any[] = []
  let paidOrderId = ''
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const orderId = String(session?.metadata?.order_id || '')
    const customerId = String(session?.metadata?.customer_id || '')
    const order = await getOrderById(c, orderId)
    paidOrderId = orderId
    const payment = await c.env.RENT.prepare('SELECT rental_id, customer_id, amount, processing_fee FROM payments WHERE stripe_checkout_session_id = ?').bind(session.id).first() as any
    const expected = order ? stripePaymentAmounts(order.totalAmount) : null
    if (!order || !payment || !expected || payment.rental_id !== order.id || payment.customer_id !== customerId || cents(payment.amount) !== expected.chargedCents || cents(payment.processing_fee) !== expected.feeCents || order.userId !== customerId || String(session.currency).toLowerCase() !== 'aud' || Number(session.amount_total) !== expected.chargedCents || session.payment_status !== 'paid') {
      return c.text('Stripe 支付数据与订单不匹配', 400)
    }
    statements.push(
      c.env.RENT.prepare(`UPDATE payments SET status = 'paid', stripe_payment_intent_id = ?, transaction_id = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE stripe_checkout_session_id = ?`)
        .bind(String(session.payment_intent || ''), String(session.payment_intent || ''), session.id),
      c.env.RENT.prepare("UPDATE orders SET status = 'paid', paymentMethod = 'card', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
    )
  } else if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    const failedOrderId = String(session?.metadata?.order_id || '')
    statements.push(
      c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_checkout_session_id = ? AND status = 'pending'").bind(session.id),
    )
  }
  statements.push(c.env.RENT.prepare('INSERT INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)').bind(event.id, event.type))
  try {
    await c.env.RENT.batch(statements)
  } catch (error: any) {
    if (String(error.message).includes('UNIQUE')) return c.json({ received: true, duplicate: true })
    throw error
  }

  const response = c.json({ received: true })
  if (paidOrderId) {
    try {
      await ensureOrderNumber(c, paidOrderId, String(session.payment_intent || session.id || ''))
      await issueInvoice(c, paidOrderId)
    } catch (error: any) {
      console.error('Stripe webhook post-processing failed:', error?.message || error)
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
    INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AUD', 'paid', CURRENT_TIMESTAMP)
  `).bind(paymentId, order.id, order.userId, method, order.totalAmount, order.depositAmount, order.totalAmount - order.depositAmount).run()
  return c.env.RENT.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first()
}

function refundChannel(order: any, payment: any): 'balance' | 'stripe' | 'bank_transfer' | 'unavailable' {
  if ((order.refundMethod ?? 'balance') !== 'original') return 'balance'
  if (payment.payment_method === 'card') return payment.stripe_payment_intent_id ? 'stripe' : 'unavailable'
  if (payment.payment_method === 'bank_transfer') return 'bank_transfer'
  return 'balance'
}

export async function refundDeposit(c: Context, admin: any, orderId: string, form: Record<string, any>): Promise<Response> {
  const order = await getOrderById(c, orderId)
  if (!order) return c.text('订单不存在', 404)
  if (order.status !== 'completed') return c.text('只有已归还并完成的订单才能处理押金', 409)
  const existingRefund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded'").bind(order.id).first()
  if (existingRefund) return c.text('该订单的押金已经处理', 409)
  const payment = await paidPayment(c, order)

  const refundText = String(form.refundAmount ?? '').trim()
  const refundAmount = Number(refundText)
  const depositAmount = Number(order.depositAmount)
  if (!/^\d+(\.\d{1,2})?$/.test(refundText) || !Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > Number(order.totalAmount)) return c.text('退款金额无效：不能高于订单总额', 400)
  // The administrator may refund damage/settlement amounts above the deposit,
  // but never more than the order principal.
  const deductionAmount = Number(Math.max(0, depositAmount - refundAmount).toFixed(2))
  const refundedProcessingFee = refundableDepositFee(refundAmount, payment)
  const totalRefundAmount = Number((refundAmount + refundedProcessingFee).toFixed(2))
  const reason = String(form.deductionReason || '').trim()
  if (deductionAmount > 0 && !reason) return c.text('扣除押金时必须填写原因', 400)

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
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, order_id, payment_id, type, refundable_amount, refund_amount, refunded_processing_fee, deduction_amount, deduction_reason, stripe_refund_id, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name) VALUES (?, ?, ?, 'deposit', ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)`)
      .bind(`rf-${nanoid(12)}`, order.id, payment.id, depositAmount, refundAmount, refundedProcessingFee, deductionAmount, reason || null, stripeRefundId, admin.id, channel, channel === 'bank_transfer' ? order.refundBsb : null, channel === 'bank_transfer' ? order.refundAccountNumber : null, channel === 'bank_transfer' ? order.refundAccountName : null),
    ...(totalRefundAmount > 0 && channel === 'balance' ? [c.env.RENT.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(totalRefundAmount, order.userId)] : []),
    c.env.RENT.prepare("UPDATE devices SET status = 'available' WHERE id = ?").bind(order.deviceId),
  ])
  if (refundAmount > 0) await issueCreditNote(c, order.id, refundAmount, refundedProcessingFee)
  return c.redirect(`/admin/orders/${order.id}`, 303)
}

export async function cancelAndRefund(c: Context, admin: any, orderId: string): Promise<Response> {
  const order = await getOrderById(c, orderId)
  if (!order) return c.text('订单不存在', 404)
  const today = melbourneDate()
  if (order.status !== 'paid' || order.startDate <= today) return c.text('只有租赁开始前的已付款订单可以全额取消退款', 409)
  const existingRefund = await c.env.RENT.prepare("SELECT id FROM payment_refunds WHERE order_id = ? AND type = 'cancellation' AND status = 'succeeded'").bind(order.id).first()
  if (existingRefund) return c.text('该订单已经全额退款', 409)
  const payment = await paidPayment(c, order)
  const channel = refundChannel(order, payment)
  if (channel === 'unavailable') return c.text('历史信用卡付款没有 Stripe 交易编号，无法原路退款；请先将退款方式改为余额', 409)
  if (channel === 'bank_transfer' && (!order.refundBsb || !order.refundAccountNumber || !order.refundAccountName)) return c.text('订单缺少银行退款账户信息', 409)

  let stripeRefundId: string | null = null
  if (channel === 'stripe') {
    const params = new URLSearchParams({ payment_intent: payment.stripe_payment_intent_id, amount: String(cents(order.totalAmount)), 'metadata[order_id]': order.id, 'metadata[type]': 'cancellation' })
    const refund = await stripeRequest(c, 'refunds', params, `cancellation-refund-${order.id}`)
    if (refund.status !== 'succeeded') return c.text('Stripe 全额退款尚未成功，请稍后重试', 502)
    stripeRefundId = refund.id
  }

  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT INTO payment_refunds (id, order_id, payment_id, type, refundable_amount, refund_amount, deduction_amount, stripe_refund_id, status, processed_by, refund_method, refund_bsb, refund_account_number, refund_account_name) VALUES (?, ?, ?, 'cancellation', ?, ?, 0, ?, 'succeeded', ?, ?, ?, ?, ?)`)
      .bind(`rf-${nanoid(12)}`, order.id, payment.id, order.totalAmount, order.totalAmount, stripeRefundId, admin.id, channel, channel === 'bank_transfer' ? order.refundBsb : null, channel === 'bank_transfer' ? order.refundAccountNumber : null, channel === 'bank_transfer' ? order.refundAccountName : null),
    ...(channel === 'balance' ? [c.env.RENT.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(order.totalAmount, order.userId)] : []),
    c.env.RENT.prepare("UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id),
    c.env.RENT.prepare("UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
    c.env.RENT.prepare("UPDATE devices SET status = 'available' WHERE id = ?").bind(order.deviceId),
  ])
  await issueCreditNote(c, order.id, order.totalAmount)
  return c.redirect(`/admin/orders/${order.id}`, 303)
}
