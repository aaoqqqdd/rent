/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export function parseCookie(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result
  for (const item of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = item.trim().split('=')
    if (!rawName) continue
    result[rawName] = rawValue.join('=')
  }
  return result
}
