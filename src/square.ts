/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

type SquareEnvironment = 'sandbox' | 'production'
type SquareStoredConfig = {
  applicationId: string
  locationId: string
  accessToken: string
  webhookSignatureKey?: string
  webhookUrl?: string
  environment: SquareEnvironment
}

const SQUARE_VERSION = '2026-08-19'

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
  const masterKey = String((c.env as any).SETTINGS_ENCRYPTION_KEY || '')
  if (!masterKey) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterKey))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt(c: Context, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(c), new TextEncoder().encode(value))
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

async function decrypt(c: Context, value: string): Promise<string> {
  const [iv, ciphertext] = String(value || '').split('.')
  if (!iv || !ciphertext) throw new Error('Square 配置已损坏')
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await encryptionKey(c), base64ToBytes(ciphertext))
  return new TextDecoder().decode(decrypted)
}

async function readStoredConfig(c: Context): Promise<SquareStoredConfig | null> {
  const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'squareConfig'").first() as any
  if (!row?.value) return null
  try { return JSON.parse(row.value) as SquareStoredConfig } catch { return null }
}

function mask(value: string, start = 6, end = 4): string {
  if (!value) return ''
  return `${value.slice(0, start)}••••${value.slice(-end)}`
}

export async function getSquareConfigSummary(c: Context) {
  const stored = await readStoredConfig(c)
  if (!stored) return { configured: false, applicationId: '', locationId: '', accessTokenMasked: '', webhookSignatureKeyMasked: '', environment: 'sandbox', webhookUrl: '' }
  let accessToken = ''
  let webhookSignatureKey = ''
  try {
    accessToken = await decrypt(c, stored.accessToken)
    webhookSignatureKey = stored.webhookSignatureKey ? await decrypt(c, stored.webhookSignatureKey) : ''
  } catch {
    return { configured: false, applicationId: stored.applicationId || '', locationId: stored.locationId || '', accessTokenMasked: '', webhookSignatureKeyMasked: '', environment: stored.environment || 'sandbox', webhookUrl: stored.webhookUrl || '' }
  }
  return {
    configured: Boolean(stored.applicationId && stored.locationId && accessToken),
    applicationId: stored.applicationId || '',
    locationId: stored.locationId || '',
    accessTokenMasked: mask(accessToken, 8, 4),
    webhookSignatureKeyMasked: mask(webhookSignatureKey, 6, 4),
    environment: stored.environment || 'sandbox',
    webhookUrl: stored.webhookUrl || '',
  }
}

export async function saveSquareConfig(c: Context, input: Record<string, any>): Promise<void> {
  if (input.clear === true) {
    await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'squareConfig'").run()
    return
  }
  const current = await readStoredConfig(c)
  const applicationId = String(input.applicationId ?? current?.applicationId ?? '').trim()
  const locationId = String(input.locationId ?? current?.locationId ?? '').trim()
  const accessTokenPlain = String(input.accessToken || '').trim()
  const webhookSignatureKeyPlain = String(input.webhookSignatureKey || '').trim()
  const accessToken = accessTokenPlain ? await encrypt(c, accessTokenPlain) : current?.accessToken
  const webhookSignatureKey = webhookSignatureKeyPlain ? await encrypt(c, webhookSignatureKeyPlain) : current?.webhookSignatureKey
  const environment = input.environment === 'production' ? 'production' : 'sandbox'
  const webhookUrl = String(input.webhookUrl || current?.webhookUrl || '').trim().slice(0, 500)

  if (!applicationId || applicationId.length > 200) throw new Error('Square Application ID 不能为空')
  if (!locationId || locationId.length > 200) throw new Error('Square Location ID 不能为空')
  if (!accessToken) throw new Error('请填写 Square Access Token')
  if (webhookUrl && !/^https:\/\//i.test(webhookUrl)) throw new Error('Square Webhook URL 必须是 HTTPS 地址')

  await c.env.RENT.prepare(`
    INSERT INTO systemSettings (key, value, updatedAt) VALUES ('squareConfig', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP
  `).bind(JSON.stringify({ applicationId, locationId, accessToken, webhookSignatureKey, webhookUrl, environment })).run()
}

export async function getSquareRuntimeConfig(c: Context) {
  const stored = await readStoredConfig(c)
  if (!stored) throw new Error('管理员尚未配置 Square')
  const publicOrigin = String((c.env as any).PUBLIC_WEB_ORIGIN || new URL(c.req.url).origin).replace(/\/$/, '')
  return {
    applicationId: stored.applicationId,
    locationId: stored.locationId,
    accessToken: await decrypt(c, stored.accessToken),
    webhookSignatureKey: stored.webhookSignatureKey ? await decrypt(c, stored.webhookSignatureKey) : '',
    webhookUrl: stored.webhookUrl || `${publicOrigin}/webhooks/square`,
    environment: stored.environment === 'production' ? 'production' as const : 'sandbox' as const,
  }
}

function squareBaseUrl(environment: SquareEnvironment): string {
  return environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com'
}

export async function squareRequest(c: Context, path: string, body?: unknown, method = 'POST'): Promise<any> {
  const config = await getSquareRuntimeConfig(c)
  const response = await fetch(`${squareBaseUrl(config.environment)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/json',
      'Square-Version': SQUARE_VERSION,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as any
  if (!response.ok) {
    const detail = result?.errors?.map((item: any) => item.detail || item.code).filter(Boolean).join('; ')
    throw new Error(detail || 'Square API 请求失败')
  }
  return result
}

function splitName(name: string): { given_name: string, family_name?: string } {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return { given_name: parts.shift() || '客户', ...(parts.length ? { family_name: parts.join(' ') } : {}) }
}

export async function syncSquareCustomerProfile(c: Context, user: any): Promise<string | null> {
  if (String(user?.role || '') !== 'CUSTOMER') return null
  if (!(await getSquareConfigSummary(c)).configured) return null
  const storedId = String(user.square_customer_id || user.squareCustomerId || '')
  let customerId = storedId
  let currentCustomer: any = null
  if (customerId) {
    const current = await squareRequest(c, `/v2/customers/${encodeURIComponent(customerId)}`, undefined, 'GET').catch(() => null)
    currentCustomer = current?.customer || current
    if (!currentCustomer?.id) customerId = ''
  }
  if (!customerId && user.email) {
    const searched = await squareRequest(c, '/v2/customers/search', { query: { filter: { email_address: { exact: String(user.email).trim().toLowerCase() } } }, limit: 10 })
    const match = (searched.customers || []).find((item: any) => String(item.reference_id || '') === String(user.id)) || (searched.customers || [])[0]
    if (match?.id) { customerId = String(match.id); currentCustomer = match }
  }
  const name = splitName(String(user.name || ''))
  if (!customerId) {
    const created = await squareRequest(c, '/v2/customers', {
      idempotency_key: `rent-user-${String(user.id).slice(0, 32)}`,
      ...name,
      email_address: String(user.email || '').trim().toLowerCase(),
      ...(user.phone ? { phone_number: String(user.phone).trim() } : {}),
      reference_id: String(user.id),
    })
    customerId = String(created.customer?.id || created.id || '')
  }
  if (!customerId) throw new Error('Square 客户资料创建失败')
  if (currentCustomer?.version !== undefined) {
    await squareRequest(c, `/v2/customers/${encodeURIComponent(customerId)}`, {
      idempotency_key: `rent-user-update-${String(user.id).slice(0, 27)}`,
      version: Number(currentCustomer.version),
      ...name,
      email_address: String(user.email || '').trim().toLowerCase(),
      ...(user.phone ? { phone_number: String(user.phone).trim() } : {}),
      reference_id: String(user.id),
    }, 'PUT')
  }
  await c.env.RENT.prepare('UPDATE users SET square_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(customerId, user.id).run()
  return customerId
}

export async function syncSquareCatalogItem(c: Context, device: any): Promise<string | null> {
  const summary = await getSquareConfigSummary(c)
  if (!summary.configured) return null
  const existingId = String(device.square_catalog_object_id || device.squareCatalogObjectId || '')
  if (existingId) return existingId
  const itemId = existingId || `#rent-${String(device.id).replace(/[^A-Za-z0-9_-]/g, '-')}`
  const variationId = `${itemId}-variation`
  const name = [device.brand, device.model].filter(Boolean).join(' ') || String(device.name || device.id)
  const result = await squareRequest(c, '/v2/catalog/object', {
    idempotency_key: `rent-device-${String(device.id).slice(0, 32)}`,
    object: {
      type: 'ITEM',
      id: itemId,
      item_data: {
        name: name.slice(0, 255),
        description: String(device.description || device.serialNumber || device.serial_number || '').slice(0, 4096),
        variations: [{
          type: 'ITEM_VARIATION',
          id: variationId,
          item_variation_data: {
            item_id: itemId,
            name: '日租',
            pricing_type: 'FIXED_PRICING',
            price_money: { amount: Math.max(0, Math.round(Number(device.pricePerDay ?? device.price_per_day ?? 0) * 100)), currency: 'AUD' },
          },
        }],
      },
    },
  })
  const catalogId = String(result.catalog_object?.id || existingId || '')
  if (catalogId) await c.env.RENT.prepare('UPDATE devices SET square_catalog_object_id = ? WHERE id = ?').bind(catalogId, device.id).run()
  return catalogId || null
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return mismatch === 0
}

export async function verifySquareWebhook(c: Context, body: string, signatureHeader?: string): Promise<any> {
  const config = await getSquareRuntimeConfig(c)
  const signature = signatureHeader || c.req.header('x-square-hmacsha256-signature') || ''
  if (!config.webhookSignatureKey || !signature) throw new Error('缺少 Square Webhook 签名')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.webhookSignatureKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${config.webhookUrl}${body}`))
  if (!constantTimeEqual(bytesToBase64(new Uint8Array(digest)), signature)) throw new Error('Square Webhook 签名无效')
  return JSON.parse(body)
}
