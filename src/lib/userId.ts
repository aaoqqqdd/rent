/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { customAlphabet } from 'nanoid'

export async function generateReferralCode(length: number = 6): Promise<string> {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const generate = customAlphabet(alphabet, length)
  return generate()
}

export function generateUserId(role: 'ADMIN' | 'STAFF' | 'CUSTOMER', accountType: 'formal' | 'guest' = 'formal'): string {
  const prefix = accountType === 'guest' ? 'VS' : role === 'ADMIN' ? 'AD' : role === 'STAFF' ? 'ST' : 'US'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `${prefix}-${Array.from(bytes, byte => String(byte % 10)).join('')}`
}
