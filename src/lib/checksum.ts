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

// 轻量校验和（FNV-1a 32 位十六进制），用于给离线快照留一个可比对指纹。
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
