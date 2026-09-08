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
