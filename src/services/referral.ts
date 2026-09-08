/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 推荐计划：关系锁定、防环、随订单状态推进的资格 / 奖励流转、结算发放与撤销。
// 依赖 ledger（财务台账）、audit（logError）、settings（结算天数 / 佣金比例）。

import type { Context } from 'hono'
import { generateReferenceNumber } from '../lib/reference'
import { getSystemSettings } from '../settings/systemSettings'
import { logError } from './audit'
import { recordFinancialLedgerEntry } from './ledger'

import { nanoid } from 'nanoid'

export async function ensureReferralProgram(c: Context): Promise<void> {
  await c.env.RENT.batch([
    c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS referral_codes (id TEXT PRIMARY KEY NOT NULL, customer_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, disabled_at TEXT)`),
    c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY NOT NULL, referral_number TEXT NOT NULL UNIQUE, referrer_customer_id TEXT NOT NULL, referee_customer_id TEXT NOT NULL UNIQUE, referral_code_id TEXT, status TEXT NOT NULL DEFAULT 'REGISTERED', attributed_at TEXT, registered_at TEXT, qualifying_order_id TEXT, qualified_at TEXT, rewarded_at TEXT, invalidated_at TEXT, invalid_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS referral_rewards (id TEXT PRIMARY KEY NOT NULL, reward_number TEXT NOT NULL UNIQUE, referral_id TEXT NOT NULL, customer_id TEXT NOT NULL, order_id TEXT, reward_type TEXT NOT NULL DEFAULT 'ACCOUNT_BALANCE', reward_amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AUD', status TEXT NOT NULL DEFAULT 'PENDING', available_at TEXT, issued_at TEXT, cancelled_at TEXT, balance_transaction_id TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS referral_audit_logs (id TEXT PRIMARY KEY NOT NULL, referral_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT, reason TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
  ])
}

// Walks the chain of referrers backward from referrerId; if refereeId shows up
// anywhere in that ancestry, linking referrerId -> refereeId would close a
// cycle (direct A<->B, or a longer A->B->C->A chain). Each person can only
// ever be a referee once (unique constraint), so the ancestor chain has no
// branching and this loop terminates quickly; the hop cap is just a safety
// net against corrupt data forming an unexpected loop.
async function wouldCreateReferralCycle(c: Context, referrerId: string, refereeId: string): Promise<boolean> {
  let current = referrerId
  for (let hop = 0; hop < 50; hop++) {
    if (current === refereeId) return true
    const row = await c.env.RENT.prepare('SELECT referrer_customer_id FROM referrals WHERE referee_customer_id = ?').bind(current).first() as any
    if (!row?.referrer_customer_id) return false
    current = String(row.referrer_customer_id)
  }
  return true
}

export async function lockReferralRelationship(c: Context, referrerId: string | null | undefined, refereeId: string, code?: string | null): Promise<void> {
  if (!referrerId) return
  await ensureReferralProgram(c)
  if (referrerId === refereeId) {
    await logError(c, 'INFO', 'Self-referral attempt blocked', undefined, { referrerId, refereeId })
    return
  }
  if (await wouldCreateReferralCycle(c, referrerId, refereeId)) {
    await logError(c, 'WARNING', 'Circular referral attempt blocked', undefined, { referrerId, refereeId })
    return
  }
  const referrer = await c.env.RENT.prepare('SELECT referral_code FROM users WHERE id = ?').bind(referrerId).first() as any
  if (!referrer) return
  const referralCode = String(code || referrer.referral_code || '').trim().toUpperCase()
  let codeRow: any = null
  if (referralCode) {
    await c.env.RENT.prepare("INSERT OR IGNORE INTO referral_codes (id, customer_id, code, status) VALUES (?, ?, ?, 'ACTIVE')").bind(`rfc-${nanoid(16)}`, referrerId, referralCode).run()
    codeRow = await c.env.RENT.prepare("SELECT id FROM referral_codes WHERE code = ? AND status = 'ACTIVE'").bind(referralCode).first()
  }
  if (await c.env.RENT.prepare('SELECT id FROM referrals WHERE referee_customer_id = ?').bind(refereeId).first()) return
  const id = `ref-${nanoid(16)}`
  await c.env.RENT.batch([
    c.env.RENT.prepare("INSERT INTO referrals (id, referral_number, referrer_customer_id, referee_customer_id, referral_code_id, status, attributed_at, registered_at) VALUES (?, ?, ?, ?, ?, 'REGISTERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(id, generateReferenceNumber('RFD').replace(/^RFD-/, 'REF-'), referrerId, refereeId, codeRow?.id || null),
    c.env.RENT.prepare("INSERT INTO referral_audit_logs (id, referral_id, action, metadata) VALUES (?, ?, 'REGISTERED', ?)").bind(`rfa-${nanoid(16)}`, id, JSON.stringify({ source: 'registration' })),
  ])
}

export async function syncReferralOrderState(c: Context, orderId: string, rentalStatus: string): Promise<void> {
  if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(rentalStatus)) return
  await ensureReferralProgram(c)
  const order = await c.env.RENT.prepare('SELECT id, userId, payment_status, totalAmount, depositAmount FROM orders WHERE id = ?').bind(orderId).first() as any
  if (!order) return
  const referral = await c.env.RENT.prepare("SELECT id FROM referrals WHERE referee_customer_id = ? AND status IN ('REGISTERED','QUALIFYING','QUALIFIED')").bind(order.userId).first() as any
  if (!referral) return
  if (rentalStatus === 'CANCELLED') {
    await c.env.RENT.prepare("UPDATE referrals SET status = 'CANCELLED', invalid_reason = 'ORDER_CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(referral.id).run()
    await revokeReferralRewardForOrder(c, orderId, '订单已取消')
  } else if (order.payment_status === 'PAID' && rentalStatus === 'ACTIVE') {
    await c.env.RENT.prepare("UPDATE referrals SET status = 'QUALIFYING', qualifying_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId, referral.id).run()
  } else if (order.payment_status === 'PAID' && rentalStatus === 'COMPLETED') {
    const rentAmount = Math.max(0, Number(order.totalAmount || 0) - Number(order.depositAmount || 0))
    const rate = Math.min(100, Math.max(0, Number(getSystemSettings().referralSettings.defaultRate || 0))) / 100
    const rewardAmount = Number((rentAmount * rate).toFixed(2))
    await c.env.RENT.batch([
      c.env.RENT.prepare("UPDATE referrals SET status = 'QUALIFIED', qualifying_order_id = ?, qualified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId, referral.id),
      c.env.RENT.prepare("INSERT OR IGNORE INTO referral_rewards (id, reward_number, referral_id, customer_id, order_id, reward_amount, status, reason) SELECT ?, ?, r.id, r.referrer_customer_id, ?, ?, 'PENDING', '订单已完成，等待结算期满后发放' FROM referrals r WHERE r.id = ?").bind(`rrw-${nanoid(16)}`, generateReferenceNumber('RFD').replace(/^RFD-/, 'RRW-'), orderId, rewardAmount, referral.id),
    ])
  }
}

// Reverses a reward that hasn't been paid out yet (PENDING) or claws back one
// that already was (AVAILABLE, credited to commission_balance). Safe to call
// on orders with no reward at all (no-op). Idempotent: a second call finds
// the reward already CANCELLED and does nothing further. Uses 'CANCELLED'
// (not e.g. 'REVOKED') to match the status values allowed by the CHECK
// constraint in migrations/0079_referral_program.sql.
export async function revokeReferralRewardForOrder(c: Context, orderId: string, reason: string): Promise<void> {
  const reward = await c.env.RENT.prepare("SELECT id, customer_id, reward_amount, status, referral_id FROM referral_rewards WHERE order_id = ? AND status IN ('PENDING','AVAILABLE')").bind(orderId).first() as any
  if (!reward) return
  const wasAvailable = reward.status === 'AVAILABLE'
  const result = await c.env.RENT.prepare("UPDATE referral_rewards SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PENDING','AVAILABLE')").bind(reason, reward.id).run() as any
  if (!Number(result.meta?.changes ?? result.changes ?? 0)) return
  if (wasAvailable) {
    await c.env.RENT.prepare('UPDATE users SET commission_balance = MAX(0, commission_balance - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(reward.reward_amount, reward.customer_id).run()
    await recordFinancialLedgerEntry(c, { entryType: 'REFERRAL_REWARD', amount: -Number(reward.reward_amount), customerId: reward.customer_id, sourceType: 'REFERRAL_REWARD', sourceId: reward.id, description: `推荐奖励撤销：${reason}`, createdBy: null })
  }
  await c.env.RENT.prepare("INSERT INTO referral_audit_logs (id, referral_id, action, reason, metadata) VALUES (?, ?, 'REWARD_REVOKED', ?, ?)").bind(`rfa-${nanoid(16)}`, reward.referral_id, reason, JSON.stringify({ rewardId: reward.id, amount: reward.reward_amount })).run()
}

// Moves rewards from PENDING to AVAILABLE once the qualifying order has
// cleared the settlement/chargeback window (referralSettings.settlementPeriod
// days past qualification), skipping any order with an open Stripe dispute.
// Flips one PENDING reward to AVAILABLE and credits the referrer's commission
// balance. Shared by the scheduled settlement job and the admin "release now"
// override. Returns false if the reward wasn't PENDING (already handled).
async function markReferralRewardAvailable(c: Context, reward: { id: string; customer_id: string; reward_amount: number; referral_id: string }, actorId?: string | null): Promise<boolean> {
  const claimed = await c.env.RENT.prepare("UPDATE referral_rewards SET status = 'AVAILABLE', available_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING'").bind(reward.id).run() as any
  if (!Number(claimed.meta?.changes ?? claimed.changes ?? 0)) return false
  await c.env.RENT.prepare('UPDATE users SET commission_balance = commission_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(reward.reward_amount, reward.customer_id).run()
  await recordFinancialLedgerEntry(c, { entryType: 'REFERRAL_REWARD', amount: Number(reward.reward_amount), customerId: reward.customer_id, sourceType: 'REFERRAL_REWARD', sourceId: reward.id, description: '推荐奖励结算到账', createdBy: actorId || null })
  await c.env.RENT.prepare("INSERT INTO referral_audit_logs (id, referral_id, action, actor_id, metadata) VALUES (?, ?, 'REWARD_RELEASED', ?, ?)").bind(`rfa-${nanoid(16)}`, reward.referral_id, actorId || null, JSON.stringify({ rewardId: reward.id, amount: reward.reward_amount })).run()
  return true
}

export async function releaseQualifiedReferralRewards(c: Context): Promise<number> {
  const settlementDays = Math.max(1, Math.floor(Number(getSystemSettings().referralSettings.settlementPeriod || 30)))
  const rows = (await c.env.RENT.prepare(`
    SELECT rw.id, rw.customer_id, rw.reward_amount, rw.referral_id
    FROM referral_rewards rw
    JOIN referrals r ON r.id = rw.referral_id
    WHERE rw.status = 'PENDING'
      AND r.status = 'QUALIFIED'
      AND r.qualified_at IS NOT NULL
      AND datetime(r.qualified_at) <= datetime('now', ?)
      AND NOT EXISTS (
        SELECT 1 FROM payment_disputes pd
        JOIN payments p ON p.id = pd.payment_id
        WHERE p.rental_id = r.qualifying_order_id AND pd.status IN ('DISPUTE_OPENED', 'DISPUTE_UNDER_REVIEW')
      )
  `).bind(`-${settlementDays} days`).all()).results || []
  let released = 0
  for (const row of rows as any[]) {
    if (await markReferralRewardAvailable(c, row)) released++
  }
  return released
}

// Admin override: release a specific reward immediately, bypassing the
// settlement-period wait (but not the open-dispute rule, callers should check
// separately if they want to warn the admin about that).
export async function releaseReferralRewardNow(c: Context, rewardId: string, actorId: string): Promise<boolean> {
  const reward = await c.env.RENT.prepare("SELECT id, customer_id, reward_amount, referral_id FROM referral_rewards WHERE id = ? AND status = 'PENDING'").bind(rewardId).first() as any
  if (!reward) return false
  return markReferralRewardAvailable(c, reward, actorId)
}
