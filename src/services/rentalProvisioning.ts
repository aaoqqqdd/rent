/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 外部租赁付款入账，以及把「创建 / 删除 Windows 租赁账户」排入设备命令队列。
// 依赖 ledger（余额流水 / 财务台账）。

import type { Context } from 'hono'
import { recordBalanceTransaction, recordFinancialLedgerEntry } from './ledger'

export async function recordExternalRentalFlow(c: Context, userId: string, amount: number, method: string, createdBy?: string | null, orderId?: string): Promise<void> {
  const value = Number(amount || 0)
  if (value <= 0) return
  const balance = Number(((await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first() as any)?.balance || 0))
  await recordBalanceTransaction(c, userId, value, 'rental_payment_credit', `${method}租赁付款入账`, createdBy, balance)
  await recordBalanceTransaction(c, userId, -value, 'rental_payment_debit', `${method}租赁付款扣款`, createdBy, balance)
  if (orderId) await recordFinancialLedgerEntry(c, { entryType: 'PAYMENT', amount: value, customerId: userId, orderId, sourceType: 'ORDER_PAYMENT', sourceId: orderId, description: `${method}租赁付款`, createdBy, metadata: { method } })
}

export async function enqueueRentalUserCreation(c: Context, order: any): Promise<void> {
  const contract = await c.env.RENT.prepare('SELECT id, contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
  if (!contract?.contract_data) return
  let data: any = {}
  try { data = JSON.parse(contract.contract_data) } catch (_) { }
  const password = String(data.windows_password || '')
  if (!password || data.windows_account_created) return
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS device_commands (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, command_type TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, claimed_at TEXT, completed_at TEXT, expires_at TEXT NOT NULL)`).run()
  const username = String(data.windows_username || order.customer?.name || 'RentalUser')
  await c.env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'CREATE_RENTAL_USER', ?, NULL, datetime('now', '+7 days'))").bind(`cmd-${crypto.randomUUID()}`, order.deviceId || order.device_id, JSON.stringify({ username, password })).run()
  data.windows_account_created = true
  await c.env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(data), contract.id).run()
}

export async function enqueueRentalUserDeletion(c: Context, order: any): Promise<void> {
  const contract = await c.env.RENT.prepare('SELECT id, contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
  if (!contract?.contract_data) return
  let data: any = {}
  try { data = JSON.parse(contract.contract_data) } catch (_) { }
  if (data.windows_account_deleted) return
  const username = String(data.windows_username || order.customer?.name || 'RentalUser')
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS device_commands (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, command_type TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, claimed_at TEXT, completed_at TEXT, expires_at TEXT NOT NULL)`).run()
  await c.env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'DELETE_RENTAL_USER', ?, NULL, datetime('now', '+30 days'))").bind(`cmd-${crypto.randomUUID()}`, order.deviceId || order.device_id, JSON.stringify({ username })).run()
  data.windows_account_deleted = true
  await c.env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(data), contract.id).run()
}
