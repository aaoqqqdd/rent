/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

export interface CloudinaryEnv {
  CLOUDINARY_CLOUD_NAME?: string
  CLOUDINARY_API_KEY?: string
  CLOUDINARY_API_SECRET?: string
}

export interface CloudinaryUploadOptions {
  watermark?: boolean
}

type StoredCloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export const MAX_CLOUDINARY_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isUploadFile(value: unknown): value is File {
  return Boolean(value && typeof value === 'object' && typeof (value as File).arrayBuffer === 'function' && typeof (value as File).type === 'string')
}

function getUploadFiles(value: unknown): File[] {
  if (Array.isArray(value)) return value.filter(isUploadFile).filter(file => file.size > 0)
  return isUploadFile(value) && value.size > 0 ? [value] : []
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha1(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value)))
}

function melbourneDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value || '0000'
  const month = parts.find(part => part.type === 'month')?.value || '00'
  const day = parts.find(part => part.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

function buildWatermarkTransformation(publicId: string): string {
  const watermark = `UPLOAD_${melbourneDate()}_ID_${publicId.slice(0, 12).toUpperCase()}`
  // Incoming transformations are applied before Cloudinary stores the asset,
  // so the URL returned below points to the watermarked asset itself.
  return `co_rgb:ffffff,b_rgb:000000,l_text:Arial_20_bold:${watermark}/fl_layer_apply,g_south_east,x_16,y_16`
}

function requireCloudinaryEnv(env: CloudinaryEnv): Required<CloudinaryEnv> {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '').trim()
  const apiKey = String(env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '').trim()
  if (!cloudName || !apiKey || !apiSecret) throw new Error('图片上传服务尚未配置，请联系管理员')
  return { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret }
}

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
  const [iv, ciphertext] = value.split('.')
  if (!iv || !ciphertext) throw new Error('Cloudinary 配置已损坏')
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await encryptionKey(c), base64ToBytes(ciphertext))
  return new TextDecoder().decode(decrypted)
}

async function readStoredConfig(c: Context): Promise<StoredCloudinaryConfig | null> {
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'cloudinaryConfig'").first() as any
    if (!row?.value) return null
    const parsed = JSON.parse(row.value) as StoredCloudinaryConfig
    if (!parsed.cloudName || !parsed.apiKey || !parsed.apiSecret) return null
    return parsed
  } catch {
    return null
  }
}

function mask(value: string, prefix = 4, suffix = 4): string {
  if (!value) return ''
  if (value.length <= prefix + suffix) return '••••'
  return `${value.slice(0, prefix)}••••${value.slice(-suffix)}`
}

/** 后台设置页展示用；没有后台配置时兼容旧的 Wrangler Secrets。 */
export async function getCloudinaryConfigSummary(c: Context) {
  const env = {
    cloudName: String((c.env as any).CLOUDINARY_CLOUD_NAME || '').trim(),
    apiKey: String((c.env as any).CLOUDINARY_API_KEY || '').trim(),
    apiSecret: String((c.env as any).CLOUDINARY_API_SECRET || '').trim(),
  }
  const stored = await readStoredConfig(c)
  if (stored) {
    try {
      const apiKey = await decrypt(c, stored.apiKey)
      const apiSecret = await decrypt(c, stored.apiSecret)
      return {
        configured: Boolean(stored.cloudName && apiKey && apiSecret),
        usingEnvFallback: false,
        cloudName: stored.cloudName,
        apiKeyMasked: mask(apiKey),
        apiSecretMasked: mask(apiSecret, 3, 3),
      }
    } catch {
      // If the encryption key changed, let the existing environment fallback work.
    }
  }
  return {
    configured: Boolean(env.cloudName && env.apiKey && env.apiSecret),
    usingEnvFallback: Boolean(env.cloudName || env.apiKey || env.apiSecret),
    cloudName: env.cloudName,
    apiKeyMasked: mask(env.apiKey),
    apiSecretMasked: '',
  }
}

export async function saveCloudinaryConfig(c: Context, input: Record<string, any>): Promise<void> {
  if (input.clear === true) {
    await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'cloudinaryConfig'").run()
    return
  }
  const current = await readStoredConfig(c)
  const cloudName = String(input.cloudName ?? current?.cloudName ?? '').trim()
  const apiKeyPlain = String(input.apiKey || '').trim()
  const apiSecretPlain = String(input.apiSecret || '').trim()
  const apiKey = apiKeyPlain ? await encrypt(c, apiKeyPlain) : current?.apiKey
  const apiSecret = apiSecretPlain ? await encrypt(c, apiSecretPlain) : current?.apiSecret
  if (!cloudName || !apiKey || !apiSecret) throw new Error('请完整填写 Cloudinary Cloud Name、API Key 和 API Secret')
  await c.env.RENT.prepare("INSERT INTO systemSettings (key, value, updatedAt) VALUES ('cloudinaryConfig', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP")
    .bind(JSON.stringify({ cloudName, apiKey, apiSecret })).run()
}

/** 运行时使用：优先后台设置，其次兼容 Wrangler Secrets。 */
export async function getCloudinaryRuntimeConfig(c: Context): Promise<CloudinaryEnv> {
  const stored = await readStoredConfig(c)
  if (stored) {
    try {
      return {
        CLOUDINARY_CLOUD_NAME: stored.cloudName,
        CLOUDINARY_API_KEY: await decrypt(c, stored.apiKey),
        CLOUDINARY_API_SECRET: await decrypt(c, stored.apiSecret),
      }
    } catch {
      // Fall through to legacy environment variables if decryption fails.
    }
  }
  return {
    CLOUDINARY_CLOUD_NAME: String((c.env as any).CLOUDINARY_CLOUD_NAME || '').trim(),
    CLOUDINARY_API_KEY: String((c.env as any).CLOUDINARY_API_KEY || '').trim(),
    CLOUDINARY_API_SECRET: String((c.env as any).CLOUDINARY_API_SECRET || '').trim(),
  }
}

export async function uploadCloudinaryImages(value: unknown, env: CloudinaryEnv, folder: string, maxFiles = 5, options: CloudinaryUploadOptions = {}): Promise<string[]> {
  const files = getUploadFiles(value)
  if (!files.length) return []
  if (files.length > maxFiles) throw new Error(`最多上传 ${maxFiles} 张图片`)
  return Promise.all(files.map(file => uploadCloudinaryImage(file, env, folder, options)))
}

export async function uploadCloudinaryImage(value: unknown, env: CloudinaryEnv, folder: string, options: CloudinaryUploadOptions = {}): Promise<string> {
  const files = getUploadFiles(value)
  if (files.length !== 1) throw new Error('请上传一张图片')
  const file = files[0]
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) throw new Error('只支持 JPG、PNG 或 WebP 图片')
  if (file.size > MAX_CLOUDINARY_IMAGE_BYTES) throw new Error('单张图片不能超过 5MB')

  const config = requireCloudinaryEnv(env)
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = crypto.randomUUID().replace(/-/g, '')
  const transformation = options.watermark ? buildWatermarkTransformation(publicId) : ''
  const signedFields = [`folder=${folder}`, `public_id=${publicId}`, `timestamp=${timestamp}`]
  if (transformation) signedFields.push(`transformation=${transformation}`)
  const signature = await sha1(`${signedFields.join('&')}${config.CLOUDINARY_API_SECRET}`)
  const payload = new FormData()
  payload.append('file', file, file.name || `${publicId}.img`)
  payload.append('api_key', config.CLOUDINARY_API_KEY)
  payload.append('timestamp', String(timestamp))
  payload.append('folder', folder)
  payload.append('public_id', publicId)
  if (transformation) payload.append('transformation', transformation)
  payload.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.CLOUDINARY_CLOUD_NAME)}/image/upload`, {
    method: 'POST',
    body: payload,
  })
  const result = await response.json().catch(() => null) as { secure_url?: unknown } | null
  if (!response.ok || typeof result?.secure_url !== 'string' || !result.secure_url.startsWith('https://')) {
    throw new Error('图片上传失败，请稍后重试')
  }
  return result.secure_url
}
