/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

const TALLY_HOSTS = new Set(['tally.so', 'www.tally.so'])

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(normalized)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function normalizeTallyEmbedUrl(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !TALLY_HOSTS.has(url.hostname.toLowerCase())) return ''
    if (!/^\/embed\/[A-Za-z0-9_-]+(?:\/)?$/.test(url.pathname)) return ''
    return url.toString()
  } catch (_) {
    return ''
  }
}

export function getTallyFormId(value: unknown): string {
  const normalized = normalizeTallyEmbedUrl(value)
  if (!normalized) return ''
  return new URL(normalized).pathname.split('/')[2] || ''
}

export function appendTallyQueryParameter(value: string, key: string, parameterValue: string): string {
  const url = new URL(value)
  url.searchParams.set(key, parameterValue)
  return url.toString()
}

export async function createTallyFeedbackToken(secret: string, userId: string, ttlSeconds = 7200): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({ userId, expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds }))
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload)))
  return `${payload}.${base64UrlEncode(signature)}`
}

export async function verifyTallyFeedbackToken(secret: string, token: string): Promise<string> {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature || payload.length > 512 || signature.length > 128) return ''
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, base64UrlDecode(signature), new TextEncoder().encode(payload))
    if (!valid) return ''
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { userId?: string; expiresAt?: number }
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt < Math.floor(Date.now() / 1000)) return ''
    return String(parsed.userId)
  } catch (_) {
    return ''
  }
}
