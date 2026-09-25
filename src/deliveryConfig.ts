/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

type StoredDeliveryConfig = {
  apiToken?: string
  customerApiKey?: string
  webhookSecret?: string
  webhookUrl?: string
  adminToken?: string
  apiBaseUrl?: string
  pickupAddress?: string
  pickupContactName?: string
  pickupEmail?: string
  pickupPhone?: string
  pickupNotes?: string
  deliverySpeed?: string
  vehicleType?: string
  packageType?: string
}

export type DeliveryRuntimeConfig = {
  apiToken: string
  customerApiKey: string
  webhookSecret: string
  webhookUrl: string
  adminToken: string
  apiBaseUrl: string
  pickupAddress: string
  pickupContactName: string
  pickupEmail: string
  pickupPhone: string
  pickupNotes: string
  deliverySpeed: string
  vehicleType: string
  packageType: string
}

const MAX_SECRET_LENGTH = 500

const encode = (bytes: Uint8Array) => { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary) }
const decode = (value: string) => new Uint8Array(Array.from(atob(value), char => char.charCodeAt(0)))

async function key(c: Context): Promise<CryptoKey> {
  const master = String((c.env as any).SETTINGS_ENCRYPTION_KEY || '')
  if (!master) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt(c: Context, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(c), new TextEncoder().encode(value))
  return `${encode(iv)}.${encode(new Uint8Array(data))}`
}

async function decrypt(c: Context, value: string): Promise<string> {
  const [iv, data] = String(value || '').split('.')
  if (!iv || !data) throw new Error('配送配置已损坏')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await key(c), decode(data))
  return new TextDecoder().decode(plain)
}

async function readStoredConfig(c: Context): Promise<StoredDeliveryConfig> {
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'deliveryConfig'").first() as any
    return row?.value ? JSON.parse(row.value) as StoredDeliveryConfig : {}
  } catch {
    return {}
  }
}

async function safeDecrypt(c: Context, value: string | undefined): Promise<string> {
  if (!value) return ''
  try { return await decrypt(c, value) } catch { return '' }
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

function defaultWebhookUrl(c: Context): string {
  const origin = clean((c.env as any).PUBLIC_WEB_ORIGIN, 300) || 'https://rent-web.ydnw6zt6vj.workers.dev'
  return `${origin.replace(/\/$/, '')}/api/delivery/webhooks/zoom2u`
}

function mask(value: string): string {
  return value ? `${value.slice(0, 6)}••••${value.slice(-4)}` : ''
}

export async function getDeliveryRuntimeConfig(c: Context): Promise<DeliveryRuntimeConfig> {
  const stored = await readStoredConfig(c)
  const [apiToken, customerApiKey, webhookSecret, adminToken] = await Promise.all([
    safeDecrypt(c, stored.apiToken), safeDecrypt(c, stored.customerApiKey), safeDecrypt(c, stored.webhookSecret), safeDecrypt(c, stored.adminToken),
  ])
  return {
    apiToken: apiToken || clean((c.env as any).ZOOM2U_API_TOKEN, MAX_SECRET_LENGTH),
    customerApiKey,
    webhookSecret: webhookSecret || clean((c.env as any).ZOOM2U_WEBHOOK_SECRET, MAX_SECRET_LENGTH),
    webhookUrl: clean(stored.webhookUrl, 500) || defaultWebhookUrl(c),
    adminToken: adminToken || clean((c.env as any).DELIVERY_ADMIN_TOKEN, MAX_SECRET_LENGTH),
    apiBaseUrl: clean(stored.apiBaseUrl || (c.env as any).ZOOM2U_API_BASE_URL || 'https://api.zoom2u.com', 180).replace(/\/$/, ''),
    pickupAddress: clean(stored.pickupAddress || (c.env as any).ZOOM2U_PICKUP_ADDRESS, 300),
    pickupContactName: clean(stored.pickupContactName || (c.env as any).ZOOM2U_PICKUP_CONTACT_NAME, 120),
    pickupEmail: clean(stored.pickupEmail || (c.env as any).ZOOM2U_PICKUP_EMAIL, 160),
    pickupPhone: clean(stored.pickupPhone || (c.env as any).ZOOM2U_PICKUP_PHONE, 80),
    pickupNotes: clean(stored.pickupNotes || (c.env as any).ZOOM2U_PICKUP_NOTES, 300),
    deliverySpeed: clean(stored.deliverySpeed || (c.env as any).ZOOM2U_DELIVERY_SPEED || 'Same day', 32),
    vehicleType: clean(stored.vehicleType || (c.env as any).ZOOM2U_VEHICLE_TYPE || 'Car', 16),
    packageType: clean(stored.packageType || (c.env as any).ZOOM2U_PACKAGE_TYPE || 'Box', 16),
  }
}

export async function getDeliveryConfigSummary(c: Context) {
  const stored = await readStoredConfig(c)
  const [apiToken, customerApiKey, webhookSecret, adminToken] = await Promise.all([
    safeDecrypt(c, stored.apiToken), safeDecrypt(c, stored.customerApiKey), safeDecrypt(c, stored.webhookSecret), safeDecrypt(c, stored.adminToken),
  ])
  return {
    configured: Boolean(apiToken || clean((c.env as any).ZOOM2U_API_TOKEN, MAX_SECRET_LENGTH)),
    customerApiKeyConfigured: Boolean(customerApiKey),
    adminConfigured: Boolean(adminToken || clean((c.env as any).DELIVERY_ADMIN_TOKEN, MAX_SECRET_LENGTH)),
    webhookConfigured: Boolean(webhookSecret || clean((c.env as any).ZOOM2U_WEBHOOK_SECRET, MAX_SECRET_LENGTH)),
    apiTokenMasked: mask(apiToken),
    customerApiKeyMasked: mask(customerApiKey),
    webhookSecretMasked: mask(webhookSecret),
    adminTokenMasked: mask(adminToken),
    webhookUrl: clean(stored.webhookUrl, 500) || defaultWebhookUrl(c),
    usingEnvFallback: !apiToken && Boolean(clean((c.env as any).ZOOM2U_API_TOKEN, MAX_SECRET_LENGTH)),
    apiBaseUrl: clean(stored.apiBaseUrl || (c.env as any).ZOOM2U_API_BASE_URL || 'https://api.zoom2u.com', 180),
    pickupAddress: clean(stored.pickupAddress || (c.env as any).ZOOM2U_PICKUP_ADDRESS, 300),
    pickupContactName: clean(stored.pickupContactName || (c.env as any).ZOOM2U_PICKUP_CONTACT_NAME, 120),
    pickupEmail: clean(stored.pickupEmail || (c.env as any).ZOOM2U_PICKUP_EMAIL, 160),
    pickupPhone: clean(stored.pickupPhone || (c.env as any).ZOOM2U_PICKUP_PHONE, 80),
    pickupNotes: clean(stored.pickupNotes || (c.env as any).ZOOM2U_PICKUP_NOTES, 300),
    deliverySpeed: clean(stored.deliverySpeed || (c.env as any).ZOOM2U_DELIVERY_SPEED || 'Same day', 32),
    vehicleType: clean(stored.vehicleType || (c.env as any).ZOOM2U_VEHICLE_TYPE || 'Car', 16),
    packageType: clean(stored.packageType || (c.env as any).ZOOM2U_PACKAGE_TYPE || 'Box', 16),
  }
}

export async function saveDeliveryConfig(c: Context, input: Record<string, any>): Promise<void> {
  if (input.clear === true) {
    await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'deliveryConfig'").run()
    return
  }
  const current = await readStoredConfig(c)
  const apiTokenPlain = clean(input.apiToken, MAX_SECRET_LENGTH)
  const customerApiKeyPlain = clean(input.customerApiKey, MAX_SECRET_LENGTH)
  const webhookSecretPlain = clean(input.webhookSecret, MAX_SECRET_LENGTH)
  const adminTokenPlain = clean(input.adminToken, MAX_SECRET_LENGTH)
  const next: StoredDeliveryConfig = {
    apiToken: apiTokenPlain ? await encrypt(c, apiTokenPlain) : current.apiToken,
    customerApiKey: customerApiKeyPlain ? await encrypt(c, customerApiKeyPlain) : current.customerApiKey,
    webhookSecret: webhookSecretPlain ? await encrypt(c, webhookSecretPlain) : current.webhookSecret,
    adminToken: adminTokenPlain ? await encrypt(c, adminTokenPlain) : current.adminToken,
    webhookUrl: clean(input.webhookUrl ?? current.webhookUrl ?? defaultWebhookUrl(c), 500),
    apiBaseUrl: clean(input.apiBaseUrl ?? current.apiBaseUrl ?? 'https://api.zoom2u.com', 180).replace(/\/$/, ''),
    pickupAddress: clean(input.pickupAddress ?? current.pickupAddress, 300),
    pickupContactName: clean(input.pickupContactName ?? current.pickupContactName, 120),
    pickupEmail: clean(input.pickupEmail ?? current.pickupEmail, 160),
    pickupPhone: clean(input.pickupPhone ?? current.pickupPhone, 80),
    pickupNotes: clean(input.pickupNotes ?? current.pickupNotes, 300),
    deliverySpeed: ['Same day', '3 hour', 'VIP'].includes(String(input.deliverySpeed)) ? String(input.deliverySpeed) : (current.deliverySpeed || 'Same day'),
    vehicleType: ['Bike', 'Car', 'Van'].includes(String(input.vehicleType)) ? String(input.vehicleType) : (current.vehicleType || 'Car'),
    packageType: ['Documents', 'Bag', 'Box', 'Custom'].includes(String(input.packageType)) ? String(input.packageType) : (current.packageType || 'Box'),
  }
  if (next.pickupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.pickupEmail)) throw new Error('配送取货邮箱格式不正确')
  if (next.apiBaseUrl && !/^https:\/\//i.test(next.apiBaseUrl)) throw new Error('Zoom2u API 地址必须是 HTTPS')
  if (next.webhookUrl && !/^https:\/\//i.test(next.webhookUrl)) throw new Error('Zoom2u Web Hook Url 必须是 HTTPS')
  await c.env.RENT.prepare("INSERT INTO systemSettings (key, value, updatedAt) VALUES ('deliveryConfig', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP").bind(JSON.stringify(next)).run()
}
