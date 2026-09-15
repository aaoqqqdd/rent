/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import {
  claimWebhookEvent,
  createNotification,
  getSystemSettings,
  loadSystemSettingsFromDB,
  markWebhookFailed,
  markWebhookProcessed,
} from '../../site'
import { getTallyFormId, verifyTallyFeedbackToken } from '../../lib/tally'

type TallyField = { label?: unknown; type?: unknown; value?: unknown }

function normalizedLabel(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function readField(fields: TallyField[], names: string[]): string {
  const accepted = new Set(names.map(normalizedLabel))
  const field = fields.find(item => accepted.has(normalizedLabel(item.label)))
  return typeof field?.value === 'string' || typeof field?.value === 'number' ? String(field.value).trim() : ''
}

async function verifyTallySignature(secret: string, rawBody: string, receivedSignature: string): Promise<boolean> {
  const signature = receivedSignature.replace(/^sha256=/i, '').trim()
  if (!secret || !signature) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - signature.length % 4) % 4)), character => character.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(rawBody))
  } catch (_) {
    return false
  }
}

function feedbackRewardSettings() {
  const settings = getSystemSettings().feedbackRewards
  return {
    ...settings,
    rewardType: ['BALANCE', 'COUPON', 'GIFT_CARD'].includes(String(settings.rewardType)) ? settings.rewardType : 'BALANCE',
    balanceAmount: Math.min(10000, Math.max(0, Number(settings.balanceAmount) || 0)),
    couponDiscountType: settings.couponDiscountType === 'percent' ? 'percent' : 'fixed',
    couponDiscountValue: Math.min(10000, Math.max(0, Number(settings.couponDiscountValue) || 0)),
    couponExpiresDays: Math.min(365, Math.max(1, Math.floor(Number(settings.couponExpiresDays) || 30))),
  }
}

function rewardDescription(rewardType: string, data: Record<string, unknown>): string {
  if (rewardType === 'BALANCE') return `账户余额 AUD$${Number(data.amount || 0).toFixed(2)}`
  if (rewardType === 'COUPON') return `优惠码 ${String(data.code || '')}（${data.discountType === 'percent' ? `${data.discountValue}%` : `AUD$${Number(data.discountValue || 0).toFixed(2)}`}）`
  return `${String(data.brand || '礼品卡')} 兑换码 ${String(data.code || '')}`
}

async function issueBalanceReward(c: Context, rewardId: string, customerId: string, amount: number): Promise<Record<string, unknown>> {
  const db = c.env.RENT
  const transactionId = `bt-${rewardId}`
  const existing = await db.prepare('SELECT amount FROM balance_transactions WHERE id = ?').bind(transactionId).first() as any
  if (existing) return { amount: Number(existing.amount || amount) }
  await db.batch([
    db.prepare('UPDATE users SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(amount, customerId),
    db.prepare(`INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by)
      SELECT ?, id, ?, balance, 'feedback_reward', '完成客户反馈问卷奖励', NULL FROM users WHERE id = ?`).bind(transactionId, amount, customerId),
  ])
  return { amount }
}

async function issueCouponReward(c: Context, rewardId: string, reward: ReturnType<typeof feedbackRewardSettings>): Promise<Record<string, unknown>> {
  const couponId = `cp-${rewardId}`
  const code = `FEEDBACK-${rewardId.replace(/[^A-Za-z0-9]/g, '').slice(-14).toUpperCase()}`
  const expiresAt = new Date(Date.now() + reward.couponExpiresDays * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO coupons (id, code, discount_type, discount_value, max_uses, starts_at, expires_at, created_by, device_id, brand, config_keyword, max_discount_amount, minimum_order_amount, max_uses_per_customer, new_customer_only, stackable, restore_on_cancellation, status, active, applicable_components)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 0, 1, 'ACTIVE', 1, 'RENTAL_FEE')`)
    .bind(couponId, code, reward.couponDiscountType, reward.couponDiscountValue, expiresAt).run()
  const coupon = await c.env.RENT.prepare('SELECT id, code, discount_type, discount_value, expires_at FROM coupons WHERE id = ?').bind(couponId).first() as any
  if (!coupon) throw new Error('反馈奖励优惠码创建失败')
  return { couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, expiresAt: coupon.expires_at, sourceRewardId: rewardId }
}

async function issueGiftCardReward(c: Context, rewardId: string): Promise<Record<string, unknown>> {
  const db = c.env.RENT
  const existing = await db.prepare("SELECT brand, code, amount, currency FROM feedback_gift_cards WHERE feedback_reward_id = ? AND status = 'ISSUED' LIMIT 1").bind(rewardId).first() as any
  if (existing) return { brand: existing.brand, code: existing.code, amount: existing.amount, currency: existing.currency }
  const available = await db.prepare("SELECT id, brand, code, amount, currency FROM feedback_gift_cards WHERE status = 'AVAILABLE' ORDER BY created_at, id LIMIT 1").first() as any
  if (!available) throw new Error('反馈奖励礼品卡库存不足')
  const claimed = await db.prepare("UPDATE feedback_gift_cards SET status = 'ISSUED', feedback_reward_id = ?, issued_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'AVAILABLE'").bind(rewardId, available.id).run() as any
  if (!Number(claimed.meta?.changes ?? claimed.changes ?? 0)) throw new Error('礼品卡库存正在被其他奖励领取，请重试')
  return { giftCardId: available.id, brand: available.brand, code: available.code, amount: available.amount, currency: available.currency }
}

async function issueFeedbackReward(c: Context, payload: any, eventId: string): Promise<{ rewarded: boolean; reason?: string; detail?: string }> {
  await loadSystemSettingsFromDB(c)
  const reward = feedbackRewardSettings()
  if (!reward.enabled) return { rewarded: false, reason: 'reward_disabled' }

  const formId = String(payload.data?.formId || '').trim()
  if (!formId || formId !== getTallyFormId(getSystemSettings().tallyFormUrl)) return { rewarded: false, reason: 'form_not_configured' }

  const fields = Array.isArray(payload.data?.fields) ? payload.data.fields as TallyField[] : []
  const token = readField(fields, ['feedbackToken', '反馈令牌'])
  const customerId = await verifyTallyFeedbackToken(String(c.env.SETTINGS_ENCRYPTION_KEY || ''), token)
  if (!customerId) return { rewarded: false, reason: 'customer_token_missing_or_invalid' }
  const customer = await c.env.RENT.prepare("SELECT id FROM users WHERE id = ? AND role = 'CUSTOMER' AND status = 'active' AND account_type = 'formal'").bind(customerId).first() as any
  if (!customer) return { rewarded: false, reason: 'customer_not_eligible' }

  const responseId = String(payload.data?.responseId || payload.data?.submissionId || '').trim()
  const db = c.env.RENT
  let rewardRecord = await db.prepare('SELECT * FROM feedback_rewards WHERE event_id = ? OR (customer_id = ? AND form_id = ?) LIMIT 1').bind(eventId, customerId, formId).first() as any
  if (rewardRecord?.status === 'ISSUED') return { rewarded: false, reason: 'already_rewarded' }
  if (rewardRecord && rewardRecord.event_id !== eventId) return { rewarded: false, reason: 'customer_already_rewarded' }
  if (!rewardRecord) {
    const rewardId = `fbr-${nanoid(16)}`
    const inserted = await db.prepare(`INSERT OR IGNORE INTO feedback_rewards (id, event_id, response_id, form_id, customer_id, reward_type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`).bind(rewardId, eventId, responseId || null, formId, customerId, reward.rewardType).run() as any
    if (!Number(inserted.meta?.changes ?? inserted.changes ?? 0)) {
      rewardRecord = await db.prepare('SELECT * FROM feedback_rewards WHERE event_id = ? OR (customer_id = ? AND form_id = ?) LIMIT 1').bind(eventId, customerId, formId).first() as any
      if (rewardRecord?.status === 'ISSUED') return { rewarded: false, reason: 'already_rewarded' }
      if (!rewardRecord || rewardRecord.event_id !== eventId) return { rewarded: false, reason: 'customer_already_rewarded' }
    } else {
      rewardRecord = { id: rewardId, event_id: eventId, status: 'PENDING' }
    }
  }

  if (rewardRecord.status === 'PROCESSING') {
    await db.prepare("UPDATE feedback_rewards SET status = 'FAILED', failure_reason = '上一次奖励处理未完成，已允许安全重试', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PROCESSING'").bind(rewardRecord.id).run()
    rewardRecord.status = 'FAILED'
  }
  const locked = await db.prepare("UPDATE feedback_rewards SET status = 'PROCESSING', failure_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PENDING', 'FAILED')").bind(rewardRecord.id).run() as any
  if (!Number(locked.meta?.changes ?? locked.changes ?? 0)) return { rewarded: false, reason: 'reward_processing' }

  try {
    let rewardData: Record<string, unknown>
    if (reward.rewardType === 'BALANCE') {
      if (reward.balanceAmount <= 0) throw new Error('反馈奖励余额必须大于 0')
      rewardData = await issueBalanceReward(c, rewardRecord.id, customerId, Number(reward.balanceAmount.toFixed(2)))
    } else if (reward.rewardType === 'COUPON') {
      if (reward.couponDiscountValue <= 0 || (reward.couponDiscountType === 'percent' && reward.couponDiscountValue > 100)) throw new Error('反馈奖励优惠值无效')
      rewardData = await issueCouponReward(c, rewardRecord.id, reward)
    } else {
      rewardData = await issueGiftCardReward(c, rewardRecord.id)
    }
    await db.prepare('UPDATE feedback_rewards SET status = \'ISSUED\', reward_amount = ?, coupon_id = ?, gift_card_id = ?, reward_data = ?, issued_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(Number(rewardData.amount || rewardData.discountValue || 0) || null, rewardData.couponId || null, rewardData.giftCardId || null, JSON.stringify(rewardData), rewardRecord.id).run()
    await createNotification(c, {
      recipientId: customerId,
      type: 'feedback_reward',
      title: '客户反馈奖励已发放',
      message: `感谢您完成客户反馈问卷！您的奖励是：${rewardDescription(reward.rewardType, rewardData)}。`,
      dedupeKey: `feedback-reward:${rewardRecord.id}`,
    })
    return { rewarded: true, detail: rewardDescription(reward.rewardType, rewardData) }
  } catch (error: any) {
    await db.prepare('UPDATE feedback_rewards SET status = \'FAILED\', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(String(error?.message || error).slice(0, 500), rewardRecord.id).run()
    throw error
  }
}

export async function handleTallyFeedbackWebhook(c: Context): Promise<Response> {
  const rawBody = await c.req.text()
  const secret = String(c.env.TALLY_WEBHOOK_SECRET || '')
  if (!secret) return c.json({ received: false, error: 'webhook_not_configured' }, 503)
  if (!await verifyTallySignature(secret, rawBody, c.req.header('Tally-Signature') || '')) return c.json({ received: false, error: 'invalid_signature' }, 401)

  let payload: any
  try { payload = JSON.parse(rawBody) } catch (_) { return c.json({ received: false, error: 'invalid_json' }, 400) }
  const eventId = String(payload.eventId || payload.data?.responseId || payload.data?.submissionId || '').trim()
  if (!eventId) return c.json({ received: false, error: 'missing_event_id' }, 400)
  if (String(payload.eventType || '') !== 'FORM_RESPONSE') return c.json({ received: true, ignored: true })

  const payloadDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody))
  const payloadHash = Array.from(new Uint8Array(payloadDigest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  const claim = await claimWebhookEvent(c, { provider: 'tally', eventId, eventType: 'FORM_RESPONSE', payloadHash })
  if (!claim.firstDelivery && claim.status === 'PROCESSED') return c.json({ received: true, duplicate: true })
  try {
    const result = await issueFeedbackReward(c, payload, eventId)
    await markWebhookProcessed(c, claim.recordId)
    return c.json({ received: true, ...result })
  } catch (error: any) {
    await markWebhookFailed(c, claim.recordId, error?.message || String(error))
    throw error
  }
}
