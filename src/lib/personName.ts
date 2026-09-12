/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { sanitizePlainText } from './html'

export function splitPersonName(value: unknown): { firstName: string; lastName: string } {
  const name = sanitizePlainText(value, 200).trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length > 1) return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' }
  if (/^[\p{Script=Han}]{2,}$/u.test(name)) return { firstName: name.slice(1), lastName: name.slice(0, 1) }
  return { firstName: name, lastName: '' }
}

export function combinePersonName(firstName: unknown, lastName: unknown): string {
  const first = sanitizePlainText(firstName, 100).trim()
  const last = sanitizePlainText(lastName, 100).trim()
  const combined = `${first}${last}`
  // Chinese names are entered as separate 名 / 姓 fields in some forms, but
  // Chinese text should not be displayed with an artificial space between the
  // two parts. Keep the space for Western names such as "John Smith".
  if (first && last && /^[\p{Script=Han}]+$/u.test(combined)) return combined
  return `${first} ${last}`.trim()
}

export function getAvatarInitials(name: unknown): string {
  const value = sanitizePlainText(name, 200).trim()
  if (!value) return '?'
  const compactValue = value.replace(/\s+/g, '')
  if (/^[\p{Script=Han}]+$/u.test(compactValue)) {
    return compactValue.slice(0, 1)
  }
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return Array.from(parts[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  return `${Array.from(parts[0])[0] || ''}${Array.from(parts.at(-1) || '')[0] || ''}`.toUpperCase()
}
