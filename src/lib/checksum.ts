/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 常数时间字符串比较，避免通过响应时间泄露 token / 签名前缀。
// 取两个字符串里较长的长度作为循环次数，短的一方按 0 补位：这样「长度相同但首字符
// 不同」与「长度不同」两条路径耗时一致，不会因为提前 return 暴露长度信息。
export function timingSafeEqualStr(a: string, b: string): boolean {
  const x = String(a ?? '')
  const y = String(b ?? '')
  let diff = x.length ^ y.length
  const length = Math.max(x.length, y.length)
  for (let i = 0; i < length; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0)
  return diff === 0
}
