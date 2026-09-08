/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 常数时间字符串比较，避免通过响应时间泄露 token / 签名前缀。
export function timingSafeEqualStr(a: string, b: string): boolean {
  const x = String(a ?? '')
  const y = String(b ?? '')
  let diff = x.length ^ y.length
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i % (y.length || 1))
  return diff === 0
}
