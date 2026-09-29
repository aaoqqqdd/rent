/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

const PREFIX = 'enc:v1:'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  return new Uint8Array(Array.from(binary, char => char.charCodeAt(0)))
}

async function encryptionKey(c: Context): Promise<CryptoKey> {
  const master = String((c.env as any).SETTINGS_ENCRYPTION_KEY || '')
  if (!master) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY，无法安全保存敏感数据')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export async function encryptSecret(c: Context, value: unknown): Promise<string> {
  const plain = String(value ?? '')
  if (!plain || isEncryptedSecret(plain)) return plain
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(c),
    new TextEncoder().encode(plain),
  )
  return `${PREFIX}${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`
}

export async function decryptSecret(c: Context, value: unknown): Promise<string> {
  const stored = String(value ?? '')
  if (!stored || !isEncryptedSecret(stored)) return stored
  const [iv, ciphertext] = stored.slice(PREFIX.length).split('.')
  if (!iv || !ciphertext) throw new Error('敏感数据密文格式无效')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await encryptionKey(c),
    base64ToBytes(ciphertext),
  )
  return new TextDecoder().decode(plain)
}
