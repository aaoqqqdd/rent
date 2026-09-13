/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 客户与推荐风险的统一数据采集层。评分规则在 domain/riskFlags.ts，
// 这里只负责从 D1 取当前数据，保证每次业务操作都会得到最新结果。

import type { Context } from 'hono'
import {
  calculateCustomerRiskAssessment,
  calculateReferralRiskAssessment,
} from '../domain/riskFlags'
import type {
  CustomerRiskAssessment,
  CustomerRiskFacts,
  ReferralRiskAssessment,
  ReferralRiskFacts,
  RiskFlagLike,
} from '../domain/riskFlags'

export async function getCustomerRiskAssessment(c: Context, customerId: string): Promise<CustomerRiskAssessment> {
  const [account, orderStats, paymentStats, refundStats, damageStats, flags] = await Promise.all([
    c.env.RENT.prepare("SELECT balance, identity_status FROM users WHERE id = ? AND role = 'CUSTOMER'").bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT
      SUM(CASE WHEN status = 'overdue' OR handover_overdue = 1 THEN 1 ELSE 0 END) AS overdue_orders,
      SUM(CASE WHEN status IN ('overdue', 'suspended') THEN 1 ELSE 0 END) AS not_returned_orders,
      SUM(CASE WHEN deposit_deduction_amount > 0 THEN 1 ELSE 0 END) AS deposit_deduction_orders
      FROM orders WHERE userId = ?`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_payments,
      SUM(CASE WHEN status IN ('paid', 'refunded') THEN COALESCE(amount, 0) ELSE 0 END) AS paid_amount
      FROM payments WHERE customer_id = ?`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COALESCE(SUM(refund_amount), 0) AS refunded_amount
      FROM payment_refunds
      WHERE status = 'succeeded' AND order_id IN (SELECT id FROM orders WHERE userId = ?)`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS customer_damage_cases
      FROM damage_cases
      WHERE liability_status = 'CUSTOMER'
        AND order_id IN (SELECT id FROM orders WHERE userId = ?)`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT flag_type, severity, status, expires_at
      FROM risk_flags
      WHERE customer_id = ? AND status = 'ACTIVE'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC`).bind(customerId).all(),
  ])

  if (!account) {
    return { score: 100, level: 'CRITICAL', blocked: true, reasons: ['客户资料不存在'], blockingFlag: null }
  }

  const facts: CustomerRiskFacts = {
    balance: Number(account.balance || 0),
    identityStatus: account.identity_status,
    failedPaymentCount: Number(paymentStats?.failed_payments || 0),
    overdueOrderCount: Number(orderStats?.overdue_orders || 0),
    notReturnedOrderCount: Number(orderStats?.not_returned_orders || 0),
    customerDamageCaseCount: Number(damageStats?.customer_damage_cases || 0),
    depositDeductionOrderCount: Number(orderStats?.deposit_deduction_orders || 0),
    paidAmount: Number(paymentStats?.paid_amount || 0),
    refundedAmount: Number(refundStats?.refunded_amount || 0),
    activeFlags: (flags.results || []) as RiskFlagLike[],
  }
  return calculateCustomerRiskAssessment(facts)
}

function daysSince(value: unknown): number {
  const timestamp = new Date(String(value || '')).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, (Date.now() - timestamp) / 86400000)
}

export async function getReferralRiskAssessment(c: Context, customerId: string): Promise<ReferralRiskAssessment> {
  const [customerRisk, account, referralStats, duplicateIdentity, repeatedDevice] = await Promise.all([
    getCustomerRiskAssessment(c, customerId),
    c.env.RENT.prepare('SELECT created_at, identity_document_last4 FROM users WHERE id = ? AND role = \'CUSTOMER\'').bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS referral_count
      FROM referrals
      WHERE referrer_customer_id = ? AND status NOT IN ('CANCELLED', 'INVALID')`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS duplicate_identity_count
      FROM users other
      JOIN users current ON current.id = ?
      WHERE other.role = 'CUSTOMER' AND other.id <> current.id
        AND current.identity_document_last4 IS NOT NULL
        AND current.identity_document_last4 <> ''
        AND other.identity_document_last4 = current.identity_document_last4`).bind(customerId).first() as Promise<any>,
    // 只比较设备，不比较 IP。设备重复是风险信号，不能单独认定欺诈。
    c.env.RENT.prepare(`SELECT COUNT(DISTINCT referrer_order.deviceId) AS repeated_device_count
      FROM orders referrer_order
      JOIN referrals r ON r.referrer_customer_id = referrer_order.userId
      JOIN orders referee_order ON referee_order.userId = r.referee_customer_id
        AND referee_order.deviceId = referrer_order.deviceId
      WHERE referrer_order.userId = ?
        AND referrer_order.deviceId IS NOT NULL
        AND referrer_order.deviceId <> ''`).bind(customerId).first() as Promise<any>,
  ])

  const facts: ReferralRiskFacts = {
    customerRiskScore: customerRisk.score,
    customerRiskBlocked: customerRisk.blocked,
    accountAgeDays: daysSince(account?.created_at),
    referralCount: Number(referralStats?.referral_count || 0),
    duplicateIdentityCount: Number(duplicateIdentity?.duplicate_identity_count || 0),
    repeatedDeviceCount: Number(repeatedDevice?.repeated_device_count || 0),
  }
  return calculateReferralRiskAssessment(facts)
}
