/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

const PBKDF2_ITERATIONS = 100000

// 生成一个随机的盐值
function generateSalt(length: number = 16): string {
  const randomBytes = new Uint8Array(length)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const iterations = PBKDF2_ITERATIONS
  const salt = generateSalt()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
  const hash = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
  return `pbkdf2$${iterations}$${salt}$${hash}`
}

export function isStrongPassword(password: unknown): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/.test(String(password ?? ''))
}

export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const alphabet = upper + lower + digits
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const password = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    ...Array.from(bytes.slice(3), byte => alphabet[byte % alphabet.length]),
  ]
  // Fisher-Yates shuffle so the required character classes are not fixed in position.
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[index] % (index + 1)
      ;[password[index], password[swapIndex]] = [password[swapIndex], password[index]]
  }
  return password.join('')
}

// Windows 租赁账户密码需要在设备代理和客户订单详情中重复读取，
// 因此不走网站登录密码的哈希流程；它只保存在受保护的合同数据中。
// 使用 8 位随机密码，并避免固定字符位置和模运算偏差。
export function generateWindowsPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*_-+=?'
  const alphabet = upper + lower + digits + symbols
  const randomIndex = (max: number): number => {
    const limit = Math.floor(256 / max) * max
    const bytes = new Uint8Array(1)
    do { crypto.getRandomValues(bytes) } while (bytes[0] >= limit)
    return bytes[0] % max
  }
  const password = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ]
  while (password.length < 8) password.push(alphabet[randomIndex(alphabet.length)])
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1)
    ;[password[index], password[swapIndex]] = [password[swapIndex], password[index]]
  }
  return password.join('')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    const [, iterationText, salt, expected] = storedHash.split('$')
    const iterations = Number(iterationText)
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS || !salt || !expected) return false
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
    const actual = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual.length !== expected.length) return false
    let difference = 0
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
    return difference === 0
  }
  const parts = storedHash.split('$')
  if (parts.length !== 2) {
    // 如果存储的哈希值格式不正确，则验证失败
    return false
  }
  const salt = parts[0]
  const hash = parts[1]

  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt) // 使用存储的盐值和用户输入的密码进行哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const newHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

  return newHash === hash // 比较新生成的哈希值与存储的哈希值
}
