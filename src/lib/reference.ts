/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { customAlphabet } from 'nanoid'

const referenceCode = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

export function generateReferenceNumber(prefix: 'OD' | 'CTR' | 'TXN' | 'INV' | 'RCP' | 'RFD' | 'CN', at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${prefix}-${values.year}${values.month}${values.day}-${referenceCode()}`
}

export function generateContractNumber(at = new Date()): string {
  return generateReferenceNumber('CTR', at)
}

// 订单号形如 OD-YYYYMMDD-XXXXXX，拆成 { date: 'YYYYMMDD', code: 'XXXXXX' } 用于 /staff/orders/:date/:code 这类路由。
export function splitOrderNo(orderNo: string | null | undefined): { date: string, code: string } | null {
  if (!orderNo) return null
  const match = /^OD-(\d{8})-([0-9A-Z]{6})$/.exec(orderNo.toUpperCase())
  if (!match) return null
  return { date: match[1], code: match[2] }
}

export function staffOrderPath(order: { id: string, orderNo?: string | null }): string {
  const split = splitOrderNo(order.orderNo)
  return split ? `/staff/orders/${split.date}/${split.code}` : `/staff/orders/${order.id}`
}
