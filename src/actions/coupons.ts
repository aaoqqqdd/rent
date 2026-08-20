/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import { nanoid } from 'nanoid'
import { recordFinancialLedgerEntry } from '../site'

export interface CouponDeviceLike {
  id: string
  brand?: string | null
  name?: string | null
  model?: string | null
  cpu?: string | null
  ram?: string | null
  storage?: string | null
  gpu?: string | null
  os?: string | null
  description?: string | null
}

function buildDeviceText(device: CouponDeviceLike): string {
  return [device.name, device.brand, device.model, device.cpu, device.ram, device.storage, device.gpu, device.os, device.description]
    .filter(Boolean).join(' ').toLowerCase()
}

// Read-only lookup shared by the preview endpoints and every checkout path.
// rentAmount must be the discountable rental-fee subtotal (never deposit/delivery/insurance).
export async function findEligibleCoupon(c: Context, code: string, device: CouponDeviceLike, rentAmount: number): Promise<any> {
  const normalized = String(code || '').trim().toUpperCase().slice(0, 40)
  if (!normalized) throw new Error('请输入优惠码')
  const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(normalized).first() as any
  if (!coupon) throw new Error('优惠码无效、已过期或已达到使用次数上限')
  const deviceText = buildDeviceText(device)
  const deviceMatches = !coupon.device_id || String(coupon.device_id) === String(device.id)
  const brandMatches = !coupon.brand || String(device.brand || '').trim().toLowerCase() === String(coupon.brand).trim().toLowerCase()
  const configMatches = !coupon.config_keyword || deviceText.includes(String(coupon.config_keyword).trim().toLowerCase())
  if (!deviceMatches || !brandMatches || !configMatches) throw new Error('该优惠码不适用于当前设备')
  if (coupon.minimum_order_amount && rentAmount < Number(coupon.minimum_order_amount)) {
    throw new Error(`订单金额未达到该优惠码要求的最低消费 AUD$${Number(coupon.minimum_order_amount).toFixed(2)}`)
  }
  return coupon
}

export function calculateCouponDiscount(coupon: any, rentAmount: number): number {
  let discount = coupon.discount_type === 'percent' ? rentAmount * Number(coupon.discount_value) / 100 : Number(coupon.discount_value)
  if (coupon.max_discount_amount) discount = Math.min(discount, Number(coupon.max_discount_amount))
  return Math.min(rentAmount, Math.max(0, Number(discount.toFixed(2))))
}

// Only call once the real customer identity is known (not the staff placeholder
// used while a contract is awaiting signature).
export async function checkCustomerCouponEligibility(c: Context, coupon: any, customerId: string): Promise<void> {
  if (coupon.new_customer_only) {
    const existingPaidOrder = await c.env.RENT.prepare("SELECT id FROM orders WHERE userId = ? AND payment_status = 'PAID' LIMIT 1").bind(customerId).first()
    if (existingPaidOrder) throw new Error('该优惠码仅限新客户使用')
  }
  if (coupon.max_uses_per_customer) {
    const used = await c.env.RENT.prepare("SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND customer_id = ? AND status IN ('RESERVED', 'REDEEMED')").bind(coupon.id, customerId).first() as any
    if (Number(used?.count || 0) >= Number(coupon.max_uses_per_customer)) throw new Error('您已达到该优惠码的最多使用次数')
  }
}

// Atomically claims a usage slot, records the RESERVED redemption, snapshots the
// coupon onto the order (so later coupon edits never change historical orders),
// and writes the matching ledger entry. Throws if the slot was claimed concurrently.
export async function reserveCouponForOrder(c: Context, params: { coupon: any; customerId: string; orderId: string; discountAmount: number }): Promise<{ redemptionId: string }> {
  const { coupon, customerId, orderId, discountAmount } = params
  const claimed = await c.env.RENT.prepare("UPDATE coupons SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses)").bind(coupon.id).run()
  if (!claimed.meta?.changes) throw new Error('优惠码刚刚达到使用次数上限，请重新提交')
  const redemptionId = `cr-${nanoid(12)}`
  const couponCode = String(coupon.code).toUpperCase()
  await c.env.RENT.prepare("INSERT INTO coupon_redemptions (id, coupon_id, coupon_code, customer_id, order_id, discount_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'RESERVED')").bind(redemptionId, coupon.id, couponCode, customerId, orderId, discountAmount).run()
  const snapshot = { code: couponCode, discountType: coupon.discount_type, discountValue: Number(coupon.discount_value), discountAmount }
  await c.env.RENT.prepare('UPDATE orders SET coupon_id = ?, coupon_code = ?, discount_amount = ?, coupon_snapshot = ? WHERE id = ?').bind(coupon.id, couponCode, discountAmount, JSON.stringify(snapshot), orderId).run()
  await recordFinancialLedgerEntry(c, { entryType: 'COUPON_DISCOUNT', amount: -discountAmount, customerId, orderId, sourceType: 'COUPON_REDEMPTION', sourceId: redemptionId, description: `优惠码 ${couponCode} 折扣`, createdBy: customerId, metadata: { couponId: coupon.id, status: 'RESERVED' } })
  return { redemptionId }
}

// Releases a RESERVED or REDEEMED redemption back (RELEASED / REVERSED respectively),
// restoring the usage slot unless the coupon has restore_on_cancellation = false.
// Safe to call on orders with no coupon at all (no-op).
export async function releaseCouponForOrder(c: Context, orderId: string): Promise<void> {
  const redemption = await c.env.RENT.prepare("SELECT * FROM coupon_redemptions WHERE order_id = ? AND status IN ('RESERVED', 'REDEEMED')").bind(orderId).first() as any
  if (!redemption) return
  const nextStatus = redemption.status === 'REDEEMED' ? 'REVERSED' : 'RELEASED'
  const released = await c.env.RENT.prepare("UPDATE coupon_redemptions SET status = ?, cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('RESERVED', 'REDEEMED')").bind(nextStatus, redemption.id).run()
  if (!released.meta?.changes) return
  const coupon = await c.env.RENT.prepare('SELECT id, restore_on_cancellation FROM coupons WHERE id = ?').bind(redemption.coupon_id).first() as any
  if (coupon && Number(coupon.restore_on_cancellation) !== 0) {
    await c.env.RENT.prepare('UPDATE coupons SET used_count = MAX(0, used_count - 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(redemption.coupon_id).run()
  }
  await recordFinancialLedgerEntry(c, { entryType: 'COUPON_DISCOUNT', amount: Number(redemption.discount_amount || 0), customerId: redemption.customer_id, orderId, sourceType: 'COUPON_REDEMPTION', sourceId: redemption.id, description: `优惠码 ${redemption.coupon_code} 使用已撤销`, createdBy: null, metadata: { couponId: redemption.coupon_id, status: nextStatus } })
}

// Clears a preview-only coupon (never reserved) from an order, restoring the
// full pre-discount total. Used when a coupon applied at contract-creation time
// turns out to be ineligible for the real customer once they sign.
export async function clearPreviewCouponFromOrder(c: Context, orderId: string, discountAmount: number): Promise<void> {
  await c.env.RENT.prepare("UPDATE orders SET coupon_code = NULL, discount_amount = 0, totalAmount = totalAmount + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(discountAmount, orderId).run()
}
