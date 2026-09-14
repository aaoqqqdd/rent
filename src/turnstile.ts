/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

// Cloudflare Turnstile 的密钥优先从后台「系统设置」读取（保存在 systemSettings
// 表的 turnstileConfig 键）；未在后台配置时回退到环境变量 TURNSTILE_SITE_KEY /
// TURNSTILE_SECRET_KEY，保持旧部署不受影响。site key 可公开，明文保存；secret
// key 用 SETTINGS_ENCRYPTION_KEY 加密后保存。

type StoredTurnstileConfig = { siteKey: string; secretKey: string }

const encode = (bytes: Uint8Array) => { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary) }
const decode = (value: string) => new Uint8Array(Array.from(atob(value), char => char.charCodeAt(0)))

async function key(c: Context): Promise<CryptoKey> {
  const master = String((c.env as any).SETTINGS_ENCRYPTION_KEY || '')
  if (!master) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt(c: Context, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(c), new TextEncoder().encode(value))
  return `${encode(iv)}.${encode(new Uint8Array(data))}`
}

async function decrypt(c: Context, value: string) {
  const [iv, data] = value.split('.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await key(c), decode(data))
  return new TextDecoder().decode(plain)
}

async function read(c: Context): Promise<StoredTurnstileConfig | null> {
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'turnstileConfig'").first() as any
    if (!row?.value) return null
    return JSON.parse(row.value) as StoredTurnstileConfig
  } catch {
    // Missing table / parse failure / DB blip: fall back to environment variables.
    // /register is a public page and must not 500 over an optional lookup.
    return null
  }
}

/** 后台系统设置页展示用：是否已配置、site key 明文、secret key 掩码、以及是否走环境变量回退。 */
export async function getTurnstileConfigSummary(c: Context) {
  const envSiteKey = String((c.env as any).TURNSTILE_SITE_KEY || '').trim()
  const envSecretKey = String((c.env as any).TURNSTILE_SECRET_KEY || '').trim()
  const stored = await read(c)
  if (!stored) {
    return {
      configured: Boolean(envSiteKey && envSecretKey),
      usingEnvFallback: Boolean(envSiteKey || envSecretKey),
      siteKey: envSiteKey,
      secretKeyMasked: '',
    }
  }
  let secretKey = ''
  try { secretKey = stored.secretKey ? await decrypt(c, stored.secretKey) : '' } catch { secretKey = '' }
  return {
    configured: Boolean(stored.siteKey && secretKey),
    usingEnvFallback: false,
    siteKey: stored.siteKey || '',
    secretKeyMasked: secretKey ? `${secretKey.slice(0, 4)}••••${secretKey.slice(-4)}` : '',
  }
}

export async function saveTurnstileConfig(c: Context, input: Record<string, any>) {
  if (input.clear === true) {
    await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'turnstileConfig'").run()
    return
  }
  const current = await read(c)
  const siteKey = String(input.siteKey ?? current?.siteKey ?? '').trim()
  const secretKeyPlain = String(input.secretKey || '').trim()
  const secretKey = secretKeyPlain ? await encrypt(c, secretKeyPlain) : current?.secretKey
  if (!siteKey || !secretKey) throw new Error('请完整填写 Turnstile Site Key 和 Secret Key')
  await c.env.RENT.prepare("INSERT INTO systemSettings (key, value, updatedAt) VALUES ('turnstileConfig', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP")
    .bind(JSON.stringify({ siteKey, secretKey })).run()
}

/** 运行时使用：优先后台配置，其次环境变量。未配置时返回空字符串而不抛错，由调用方决定如何处理。 */
export async function getTurnstileRuntimeConfig(c: Context): Promise<{ siteKey: string; secretKey: string }> {
  const stored = await read(c)
  if (stored?.siteKey && stored?.secretKey) {
    try {
      return { siteKey: stored.siteKey, secretKey: await decrypt(c, stored.secretKey) }
    } catch {
      // 解密失败（换了 SETTINGS_ENCRYPTION_KEY 等）时回退到环境变量。
    }
  }
  return {
    siteKey: String((c.env as any).TURNSTILE_SITE_KEY || '').trim(),
    secretKey: String((c.env as any).TURNSTILE_SECRET_KEY || '').trim(),
  }
}

/** 注册页初始化 widget 只需要可公开的 site key。 */
export async function getTurnstileSiteKey(c: Context): Promise<string> {
  return (await getTurnstileRuntimeConfig(c)).siteKey
}
