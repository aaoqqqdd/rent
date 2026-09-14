/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { ensureOrderNumber, getOrderById, getSystemSettings, issueInvoice, loadSystemSettingsFromDB, claimWebhookEvent, markWebhookFailed, markWebhookProcessed } from '../site'
import { getSquareRuntimeConfig, squareRequest, syncSquareCustomerProfile, verifySquareWebhook } from '../square'

function cents(value: number): number { return Math.max(0, Math.round(Number(value || 0) * 100)) }

function orderPayableAmount(order: any): number {
  return Math.max(0, Number((Number(order.totalAmount ?? order.total_amount ?? 0) - Number(order.depositAmount ?? order.deposit_amount ?? 0)).toFixed(2)))
}

async function ensureSquareEnabled(c: Context): Promise<void> {
  await loadSystemSettingsFromDB(c)
  if (!getSystemSettings().paymentMethods.square) throw new Error('Square 礼品卡支付当前未启用')
}

export async function getSquareGiftCardConfigForOrder(c: Context, user: any, orderId: string) {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (String(order.paymentProvider || '') !== 'square') throw new Error('该订单未选择 Square 礼品卡支付')
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')
  const config = await getSquareRuntimeConfig(c)
  const payment = await c.env.RENT.prepare("SELECT status FROM payments WHERE rental_id = ? AND payment_provider = 'square' AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  return { applicationId: config.applicationId, locationId: config.locationId, environment: config.environment, amountCents: cents(orderPayableAmount(order)), alreadyPaid: payment?.status === 'paid' }
}

async function finalizeSquarePayment(c: Context, order: any, paymentId: string, squarePayment: any): Promise<void> {
  const transactionId = String(squarePayment.id || squarePayment.receipt_number || `SQ-${nanoid(10)}`)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', square_payment_id = ?, transaction_id = COALESCE(transaction_id, ?), paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND payment_provider = 'square'").bind(String(squarePayment.id || ''), transactionId, paymentId),
    c.env.RENT.prepare("UPDATE orders SET status = 'paid', order_status = 'CONFIRMED', payment_status = 'PAID', rental_status = 'READY_FOR_PICKUP', paymentMethod = 'card', payment_provider = 'square', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
  ])
  await ensureOrderNumber(c, order.id).catch(() => {})
  await issueInvoice(c, order.id).catch(error => console.error(JSON.stringify({ message: 'Square invoice issue failed', error: error instanceof Error ? error.message : String(error), orderId: order.id })))
}

export async function createSquareGiftCardPayment(c: Context, user: any, orderId: string, sourceId: string): Promise<{ status: string; alreadyPaid?: boolean }> {
  await ensureSquareEnabled(c)
  if (user?.role !== 'CUSTOMER') throw new Error('Square 付款必须使用客户资料')
  const cleanSourceId = String(sourceId || '').trim()
  if (cleanSourceId.length < 10 || cleanSourceId.length > 500) throw new Error('Square 礼品卡支付凭据无效')
  const order = await getOrderById(c, orderId)
  if (!order || order.userId !== user.id) throw new Error('订单不存在或无权访问')
  if (String(order.paymentProvider || '') !== 'square') throw new Error('该订单未选择 Square 礼品卡支付')
  if (order.status !== 'pending_payment') throw new Error('该订单当前不能支付')
  const amountCents = cents(orderPayableAmount(order))
  if (amountCents <= 0) throw new Error('订单没有可支付的租金金额')
  const existing = await c.env.RENT.prepare("SELECT * FROM payments WHERE rental_id = ? AND payment_provider = 'square' AND payment_method = 'card' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (existing?.status === 'paid') return { status: 'paid', alreadyPaid: true }

  const paymentId = String(existing?.id || `p-${nanoid(12)}`)
  if (existing) {
    await c.env.RENT.prepare("UPDATE payments SET amount = ?, rental_amount = ?, processing_fee = 0, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(amountCents / 100, amountCents / 100, paymentId).run()
  } else {
    await c.env.RENT.prepare("INSERT INTO payments (id, rental_id, customer_id, payment_method, payment_provider, amount, deposit_amount, rental_amount, processing_fee, currency, status) VALUES (?, ?, ?, 'card', 'square', ?, 0, ?, 0, 'AUD', 'pending')").bind(paymentId, order.id, user.id, amountCents / 100, amountCents / 100).run()
  }

  const customerId = await syncSquareCustomerProfile(c, user)
  const squarePayment = await squareRequest(c, '/v2/payments', {
    source_id: cleanSourceId,
    idempotency_key: `rent-sq-${String(order.id).slice(0, 32)}`,
    amount_money: { amount: amountCents, currency: 'AUD' },
    autocomplete: true,
    location_id: (await getSquareRuntimeConfig(c)).locationId,
    ...(customerId ? { customer_id: customerId } : {}),
    reference_id: String(order.id),
    note: `设备租赁订单 ${order.orderNo || order.id}`,
  })
  const returnedAmount = Number(squarePayment.amount_money?.amount ?? 0)
  const returnedCurrency = String(squarePayment.amount_money?.currency || '').toUpperCase()
  if (returnedAmount !== amountCents || returnedCurrency !== 'AUD') throw new Error('Square 返回的金额或币种与订单不一致')
  const status = String(squarePayment.status || '').toUpperCase()
  await c.env.RENT.prepare('UPDATE payments SET square_payment_id = ?, transaction_id = COALESCE(transaction_id, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(String(squarePayment.id || ''), String(squarePayment.id || ''), paymentId).run()
  if (status === 'COMPLETED') await finalizeSquarePayment(c, order, paymentId, squarePayment)
  else if (['FAILED', 'CANCELED'].includes(status)) {
    await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(paymentId).run()
    throw new Error('Square 礼品卡付款未完成')
  }
  return { status: status.toLowerCase() || 'pending' }
}

export async function handleSquareWebhook(c: Context): Promise<Response> {
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
    if (payment) {
      const order = await getOrderById(c, String(payment.rental_id))
      const status = String(paymentData?.status || '').toUpperCase()
      if (order && status === 'COMPLETED') await finalizeSquarePayment(c, order, String(payment.id), paymentData)
      else if (['FAILED', 'CANCELED'].includes(status)) await c.env.RENT.prepare("UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id).run()
    }
    await markWebhookProcessed(c, claim.recordId)
    return c.json({ received: true })
  } catch (error: any) {
    await markWebhookFailed(c, claim.recordId, error?.message || String(error))
    throw error
  }
}
