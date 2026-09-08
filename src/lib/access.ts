/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN'
export type AccessLevel = 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'ADMIN'

export function getAccessLevel(user: any): AccessLevel {
  const value = String(user?.accessLevel ?? user?.access_level ?? user?.role ?? 'CUSTOMER').toUpperCase()
  return ['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'].includes(value) ? value as AccessLevel : 'CUSTOMER'
}

export function canManageUser(actor: any, target: any): boolean {
  const actorLevel = getAccessLevel(actor)
  const targetLevel = getAccessLevel(target)
  return actorLevel === 'ADMIN' || (actorLevel === 'MANAGER' && targetLevel === 'STAFF')
}

export function canUseAccountBalance(user: any): boolean {
  const role = String(user?.role || '').trim().toUpperCase()
  const accountType = String(user?.accountType ?? user?.account_type ?? 'formal').trim().toLowerCase()
  return Boolean(user && role === 'CUSTOMER' && accountType === 'formal')
}
