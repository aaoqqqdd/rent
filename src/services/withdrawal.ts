/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 佣金提现：FIFO 消耗 AVAILABLE 推荐奖励，跨额那笔拆分；D1 无事务，用一条带
// 条件的原子 UPDATE 预留佣金余额，其余写操作打包成 batch，失败则补偿回滚。
// 仅依赖 db/client + nanoid。

import type { Context } from 'hono'
import { nanoid } from 'nanoid'
import { getDB, getTableColumns as getCachedTableColumns } from '../db/client'

async function getTableColumns(c: Context, tableName: string): Promise<string[]> {
  const allowedTables = new Set(['commission_withdrawals'])
  if (!allowedTables.has(tableName)) throw new Error('Unsupported table name')
  return Array.from(await getCachedTableColumns(getDB(c), tableName))
}

export interface WithdrawableReward { id: string; amount: number }
export interface WithdrawalPlan {
  eligible: boolean
  fullyConsumedIds: string[]
  // The boundary reward that only partly covers the request: mark it withdrawn
  // for `withdrawnAmount` and leave a residual AVAILABLE reward for the rest.
  split?: { id: string; withdrawnAmount: number; residualAmount: number }
  total: number
  shortfall: number
}

// FIFO 选出足以覆盖提现额的 AVAILABLE 推荐奖励。金额按分计算避免浮点误差；跨越提现
// 额的那一笔奖励会被拆分，不整笔吞掉，避免"余额还在但没有可提现奖励"的死角。
export function planWithdrawalConsumption(rewards: WithdrawableReward[], amount: number): WithdrawalPlan {
  const targetC = Math.round(Number(amount) * 100)
  let accC = 0
  const fullyConsumedIds: string[] = []
  let split: WithdrawalPlan['split']
  for (const r of rewards) {
    if (accC >= targetC) break
    const c = Math.round(Number(r.amount || 0) * 100)
    if (c <= 0) continue
    if (accC + c <= targetC) {
      fullyConsumedIds.push(r.id)
      accC += c
    } else {
      const withdrawnC = targetC - accC
      split = { id: r.id, withdrawnAmount: withdrawnC / 100, residualAmount: (c - withdrawnC) / 100 }
      accC = targetC
      break
    }
  }
  const totalC = rewards.reduce((s, r) => s + Math.max(0, Math.round(Number(r.amount || 0) * 100)), 0)
  return { eligible: accC >= targetC, fullyConsumedIds, split, total: totalC / 100, shortfall: Math.max(0, targetC - totalC) / 100 }
}

export async function createWithdrawalRequest(
  c: Context,
  userId: string,
  amount: number,
  withdrawMethod: 'balance' | 'bank_transfer',
  bankDetails?: { bsb?: string; accountNumber?: string; accountName?: string }
): Promise<{ success: boolean; message: string }> {
  const db = getDB(c)

  const normalizedAmount = Number(amount)

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { success: false, message: '请输入正确的提现金额，金额必须大于 0' }
  }

  if (withdrawMethod === 'bank_transfer' && (!Number.isInteger(normalizedAmount) || normalizedAmount < 100)) {
    return { success: false, message: '银行转账提现金额必须大于 100 且为整数' }
  }

  // D1 doesn't allow raw BEGIN/COMMIT; do all reads first, reserve the commission
  // with one guarded atomic UPDATE, then apply the rest as a single batch and
  // compensate (re-credit) if that batch fails.
  const user = await db.prepare('SELECT commission_balance FROM users WHERE id = ?').bind(userId).first() as any
  if (!user) return { success: false, message: '用户不存在' }
  const currentCommissionBalance = Number(user.commission_balance ?? 0)
  if (currentCommissionBalance < normalizedAmount) {
    return { success: false, message: '提现金额不能超过可提现余额' }
  }

  // 唯一账本 referral_rewards：可提现 = 未被其它提现划走的 AVAILABLE 奖励。
  const availableRewards = await db.prepare(`
    SELECT id, reward_amount AS amount
    FROM referral_rewards
    WHERE customer_id = ? AND status = 'AVAILABLE' AND withdrawn_at IS NULL
    ORDER BY COALESCE(available_at, created_at) ASC, created_at ASC
  `).bind(userId).all() as any
  const plan = planWithdrawalConsumption(
    (availableRewards.results || []).map((r: any) => ({ id: String(r.id), amount: Number(r.amount || 0) })),
    normalizedAmount,
  )
  if (!plan.eligible) {
    return { success: false, message: '可提现的推荐奖励不足，请稍后再试' }
  }

  const withdrawalId = `w-${nanoid(8)}`
  const consumeWithdrawalId = withdrawMethod === 'bank_transfer' ? withdrawalId : null

  // Reserve: only proceeds if the balance is still there (guards double-spend).
  const reserved = await db.prepare(
    'UPDATE users SET commission_balance = ROUND(commission_balance - ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND commission_balance >= ? RETURNING commission_balance',
  ).bind(normalizedAmount, userId, normalizedAmount).first()
  if (!reserved) return { success: false, message: '可提现余额已变化，请刷新后重试' }

  try {
    const writes = plan.fullyConsumedIds.map(id => db.prepare(
      'UPDATE referral_rewards SET withdrawn_at = CURRENT_TIMESTAMP, withdrawal_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND withdrawn_at IS NULL',
    ).bind(consumeWithdrawalId, id))
    if (plan.split) {
      // Boundary reward: shrink the original to the residual, add a withdrawn
      // sibling row for the consumed portion (same referral/order lineage).
      writes.push(
        db.prepare('UPDATE referral_rewards SET reward_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND withdrawn_at IS NULL').bind(plan.split.residualAmount, plan.split.id),
        db.prepare(`INSERT INTO referral_rewards (id, reward_number, referral_id, customer_id, order_id, reward_type, reward_amount, currency, status, available_at, withdrawn_at, withdrawal_id, reason, created_at, updated_at)
          SELECT ?, ?, referral_id, customer_id, order_id, reward_type, ?, currency, 'AVAILABLE', available_at, CURRENT_TIMESTAMP, ?, '提现拆分', created_at, CURRENT_TIMESTAMP FROM referral_rewards WHERE id = ?`)
          .bind(`rrw-${nanoid(14)}`, `RRW-SPLIT-${nanoid(10)}`, plan.split.withdrawnAmount, consumeWithdrawalId, plan.split.id),
      )
    }

    if (withdrawMethod === 'balance') {
      writes.push(db.prepare('UPDATE users SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(normalizedAmount, userId))
      await db.batch(writes)
      return { success: true, message: '提现成功！金额已划入您的账户余额' }
    }

    const withdrawalColumns = await getTableColumns(c, 'commission_withdrawals')
    const accountNumberColumn = withdrawalColumns.includes('account_number') ? 'account_number' : withdrawalColumns.includes('accountNumber') ? 'accountNumber' : null
    const accountNameColumn = withdrawalColumns.includes('account_name') ? 'account_name' : withdrawalColumns.includes('accountName') ? 'accountName' : null
    const bsbColumn = withdrawalColumns.includes('bsb') ? 'bsb' : null

    const insertColumns = ['id', 'user_id', 'amount']
    const insertValues: any[] = [withdrawalId, userId, normalizedAmount]
    if (bsbColumn) { insertColumns.push(bsbColumn); insertValues.push(bankDetails?.bsb ?? null) }
    if (accountNumberColumn) { insertColumns.push(accountNumberColumn); insertValues.push(bankDetails?.accountNumber ?? null) }
    if (accountNameColumn) { insertColumns.push(accountNameColumn); insertValues.push(bankDetails?.accountName ?? null) }
    insertColumns.push('status'); insertValues.push('pending')

    const placeholders = insertColumns.map(() => '?').join(', ')
    writes.push(db.prepare(`INSERT INTO commission_withdrawals (${insertColumns.join(', ')}) VALUES (${placeholders})`).bind(...insertValues))
    await db.batch(writes)
    return { success: true, message: '提现申请已提交，预计2个工作日处理' }
  } catch (error) {
    // Reservation went through but the rest failed — put the commission back.
    await db.prepare('UPDATE users SET commission_balance = ROUND(commission_balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(normalizedAmount, userId).run().catch(() => {})
    console.error('Withdrawal failed after commission was reserved (refunded):', error)
    return { success: false, message: '提现失败，请稍后重试' }
  }
}
