/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 余额流水 + 财务台账。金额进出的唯一写入口，其它服务（推荐奖励、外部租赁付款、
// 开票 / 退款）都经由这里落 financial_ledger_entries。仅依赖 nanoid。

import type { Context } from 'hono'
import { nanoid } from 'nanoid'

export async function recordBalanceTransaction(c: Context, userId: string, amount: number, type: string, reason: string, createdBy?: string | null, balanceAfter?: number): Promise<void> {
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS balance_transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()
  const current = balanceAfter ?? Number(((await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first() as any)?.balance || 0))
  const id = `bt-${crypto.randomUUID()}`
  const value = Number(amount.toFixed(2))
  await c.env.RENT.prepare('INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, userId, value, Number(current.toFixed(2)), type, reason, createdBy || null).run()
  await recordFinancialLedgerEntry(c, { entryType: 'BALANCE', amount: value, customerId: userId, sourceType: 'BALANCE_TRANSACTION', sourceId: id, description: reason, createdBy, metadata: { type, balanceAfter: Number(current.toFixed(2)) } })
}

export async function recordFinancialLedgerEntry(c: Context, input: { entryType: 'PAYMENT' | 'REFUND' | 'BALANCE' | 'REFERRAL_REWARD' | 'COUPON_DISCOUNT'; amount: number; customerId?: string | null; orderId?: string | null; sourceType: string; sourceId: string; description: string; createdBy?: string | null; metadata?: unknown }): Promise<void> {
  if (!Number.isFinite(input.amount)) throw new Error('财务流水金额无效')
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO financial_ledger_entries (id, entry_number, entry_type, amount, customer_id, order_id, source_type, source_id, description, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(`fle-${nanoid(16)}`, `FLE-${nanoid(12).toUpperCase()}`, input.entryType, Number(input.amount.toFixed(2)), input.customerId || null, input.orderId || null, input.sourceType, input.sourceId, input.description, JSON.stringify(input.metadata || {}), input.createdBy || null).run()
}
