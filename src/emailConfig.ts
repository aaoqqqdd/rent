import type { Context } from 'hono'

type StoredEmailConfig = { host: string; port: number; user: string; password: string; from: string; encryption: 'starttls' | 'ssl' | 'none' }

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

async function read(c: Context): Promise<StoredEmailConfig | null> {
  const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'emailTransport'").first() as any
  if (!row?.value) return null
  try { return JSON.parse(row.value) as StoredEmailConfig } catch { return null }
}

export async function getEmailConfigSummary(c: Context) {
  const stored = await read(c)
  if (!stored) return { configured: false, host: '', port: 587, user: '', from: '', encryption: 'starttls', passwordMasked: '' }
  let password = ''
  try { password = await decrypt(c, stored.password) } catch { return { configured: false, host: stored.host, port: stored.port, user: stored.user, from: stored.from, encryption: stored.encryption, passwordMasked: '' } }
  return { configured: Boolean(stored.host && stored.user && password && stored.from), host: stored.host, port: stored.port, user: stored.user, from: stored.from, encryption: stored.encryption, passwordMasked: `${password.slice(0, 4)}••••${password.slice(-4)}` }
}

export async function saveEmailConfig(c: Context, input: Record<string, any>) {
  if (input.clear === true) { await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'emailTransport'").run(); return }
  const current = await read(c)
  const passwordPlain = String(input.password || '').trim()
  const password = passwordPlain ? await encrypt(c, passwordPlain) : current?.password
  const host = String(input.host || current?.host || '').trim()
  const port = Math.min(65535, Math.max(1, Number(input.port || current?.port || 587)))
  const user = String(input.user || current?.user || '').trim()
  const from = String(input.from || current?.from || '').trim()
  const encryption = ['starttls', 'ssl', 'none'].includes(input.encryption) ? input.encryption : (current?.encryption || 'starttls')
  if (!host || !user || !password || !from) throw new Error('请完整填写 SMTP 主机、用户名、密码和发件邮箱')
  await c.env.RENT.prepare("INSERT INTO systemSettings (key, value, updatedAt) VALUES ('emailTransport', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP").bind(JSON.stringify({ host, port, user, password, from, encryption })).run()
}

export async function getEmailRuntimeConfig(c: Context) {
  const stored = await read(c)
  if (!stored) throw new Error('管理员尚未配置 SMTP')
  return { ...stored, password: await decrypt(c, stored.password) }
}
