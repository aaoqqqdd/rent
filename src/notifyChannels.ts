/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 通知渠道配置：邮件发送（Resend / Brevo / MailerSend 三选一）+ 通用推送 Webhook。
// 密钥用 SETTINGS_ENCRYPTION_KEY 加密后存 systemSettings 表，
// 与 stripe.ts / emailConfig.ts 完全同一套做法。运行期通过 resolveEmailCredentials
// 取当前生效的邮件服务商凭据（后台配置优先，回落到 env），sendTransactionalEmail
// 统一发信入口，dispatchChannelAlert 把一条告警广播到已启用的推送渠道，
// 尽力而为、绝不抛错。

import type { Context } from 'hono'
import { getSystemSettings } from './settings/systemSettings'

export type EmailProvider = 'resend' | 'brevo' | 'mailersend'
const EMAIL_PROVIDERS: EmailProvider[] = ['resend', 'brevo', 'mailersend']

type StoredChannelConfig = {
  emailProvider?: EmailProvider
  resendApiKey?: string
  resendFrom?: string
  brevoApiKey?: string
  brevoFrom?: string
  mailersendApiKey?: string
  mailersendFrom?: string
  webhookEnabled?: boolean
  webhookUrl?: string
}

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
  const [iv, data] = value.split('.')
  if (!iv || !data) throw new Error('通知渠道配置已损坏')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await key(c), decode(data))
  return new TextDecoder().decode(plain)
}

async function readStored(c: Context): Promise<StoredChannelConfig> {
  const cached = (c as any).__notifyChannelConfig as StoredChannelConfig | undefined
  if (cached) return cached
  let value: StoredChannelConfig = {}
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'notificationChannels'").first() as any
    if (row?.value) value = JSON.parse(row.value) as StoredChannelConfig
  } catch { value = {} }
  ;(c as any).__notifyChannelConfig = value
  return value
}

async function safeDecrypt(c: Context, value: string | undefined): Promise<string> {
  if (!value) return ''
  try { return await decrypt(c, value) } catch { return '' }
}

const mask = (value: string) => value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : ''
const maskUrl = (value: string) => {
  if (!value) return ''
  try { const u = new URL(value); return `${u.protocol}//${u.host}/…${value.slice(-6)}` } catch { return `…${value.slice(-6)}` }
}

export async function getNotifyChannelsSummary(c: Context) {
  const stored = await readStored(c)
  const [resendApiKey, brevoApiKey, mailersendApiKey, webhookUrl] = await Promise.all([
    safeDecrypt(c, stored.resendApiKey),
    safeDecrypt(c, stored.brevoApiKey),
    safeDecrypt(c, stored.mailersendApiKey),
    safeDecrypt(c, stored.webhookUrl),
  ])
  const envResend = String((c.env as any).RESEND_API_KEY || '').trim()
  const activeProvider = stored.emailProvider || 'resend'
  return {
    emailProvider: activeProvider,
    resend: {
      from: stored.resendFrom || '',
      apiKeyMasked: mask(resendApiKey),
      configured: Boolean(resendApiKey || envResend),
      usingEnvFallback: !resendApiKey && Boolean(envResend),
    },
    brevo: {
      from: stored.brevoFrom || '',
      apiKeyMasked: mask(brevoApiKey),
      configured: Boolean(brevoApiKey),
    },
    mailersend: {
      from: stored.mailersendFrom || '',
      apiKeyMasked: mask(mailersendApiKey),
      configured: Boolean(mailersendApiKey),
    },
    webhook: {
      enabled: Boolean(stored.webhookEnabled),
      urlMasked: maskUrl(webhookUrl),
      configured: Boolean(webhookUrl),
    },
  }
}

export async function saveNotifyChannels(c: Context, input: Record<string, any>): Promise<void> {
  if (input?.clear === true) {
    await c.env.RENT.prepare("DELETE FROM systemSettings WHERE key = 'notificationChannels'").run()
    ;(c as any).__notifyChannelConfig = undefined
    return
  }
  const current = await readStored(c)
  const next: StoredChannelConfig = { ...current }

  // 邮件服务商选择
  if (input.emailProvider !== undefined) {
    const provider = String(input.emailProvider || '').trim() as EmailProvider
    if (provider && !EMAIL_PROVIDERS.includes(provider)) throw new Error('未知的邮件服务商')
    next.emailProvider = provider || undefined
  }

  // Resend
  const resendKeyPlain = String(input.resendApiKey || '').trim()
  if (resendKeyPlain) next.resendApiKey = await encrypt(c, resendKeyPlain)
  if (input.resendClear === true) next.resendApiKey = undefined
  if (input.resendFrom !== undefined) {
    const from = String(input.resendFrom || '').trim().slice(0, 200)
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && !/<[^\s@]+@[^\s@]+\.[^\s@]+>/.test(from)) throw new Error('Resend 发件邮箱格式不正确')
    next.resendFrom = from || undefined
  }

  // Brevo（原 Sendinblue）
  const brevoKeyPlain = String(input.brevoApiKey || '').trim()
  if (brevoKeyPlain) next.brevoApiKey = await encrypt(c, brevoKeyPlain)
  if (input.brevoClear === true) next.brevoApiKey = undefined
  if (input.brevoFrom !== undefined) {
    const from = String(input.brevoFrom || '').trim().slice(0, 200)
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && !/<[^\s@]+@[^\s@]+\.[^\s@]+>/.test(from)) throw new Error('Brevo 发件邮箱格式不正确')
    next.brevoFrom = from || undefined
  }

  // MailerSend
  const mailersendKeyPlain = String(input.mailersendApiKey || '').trim()
  if (mailersendKeyPlain) next.mailersendApiKey = await encrypt(c, mailersendKeyPlain)
  if (input.mailersendClear === true) next.mailersendApiKey = undefined
  if (input.mailersendFrom !== undefined) {
    const from = String(input.mailersendFrom || '').trim().slice(0, 200)
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && !/<[^\s@]+@[^\s@]+\.[^\s@]+>/.test(from)) throw new Error('MailerSend 发件邮箱格式不正确')
    next.mailersendFrom = from || undefined
  }

  // 通用 Webhook
  next.webhookEnabled = Boolean(input.webhookEnabled)
  const webhookPlain = String(input.webhookUrl || '').trim()
  if (webhookPlain) {
    if (!/^https:\/\//i.test(webhookPlain)) throw new Error('Webhook 地址必须是 HTTPS')
    next.webhookUrl = await encrypt(c, webhookPlain.slice(0, 500))
  }
  if (input.webhookClear === true) { next.webhookUrl = undefined; next.webhookEnabled = false }
  if (next.webhookEnabled && !next.webhookUrl) throw new Error('启用通用 Webhook 前请填写 Webhook 地址')

  await c.env.RENT.prepare(
    "INSERT INTO systemSettings (key, value, updatedAt) VALUES ('notificationChannels', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updatedAt = CURRENT_TIMESTAMP"
  ).bind(JSON.stringify(next)).run()
  ;(c as any).__notifyChannelConfig = next
}

// 邮件凭据：后台已配置的服务商优先（未显式选择时按 resend → brevo → mailersend
// 顺序取第一个已配置的），resend 再回落到 env（RESEND_API_KEY / EMAIL_FROM），
// 发件人最后回落到公司邮箱。任何一步失败都不抛错，只当作未配置处理。
export async function resolveEmailCredentials(c: Context): Promise<{ provider: EmailProvider; apiKey: string; from: string }> {
  let stored: StoredChannelConfig = {}
  try { stored = await readStored(c) } catch { /* fall through to env */ }

  const candidates: EmailProvider[] = stored.emailProvider ? [stored.emailProvider] : EMAIL_PROVIDERS
  for (const provider of candidates) {
    if (provider === 'resend') {
      const apiKey = await safeDecrypt(c, stored.resendApiKey)
      if (apiKey) return { provider, apiKey, from: await resolveFrom(c, stored.resendFrom) }
    } else if (provider === 'brevo') {
      const apiKey = await safeDecrypt(c, stored.brevoApiKey)
      if (apiKey) return { provider, apiKey, from: await resolveFrom(c, stored.brevoFrom) }
    } else if (provider === 'mailersend') {
      const apiKey = await safeDecrypt(c, stored.mailersendApiKey)
      if (apiKey) return { provider, apiKey, from: await resolveFrom(c, stored.mailersendFrom) }
    }
  }

  // 未保存任何后台凭据：回落到 env（仅 Resend 支持这种部署方式）。
  const envApiKey = String((c.env as any).RESEND_API_KEY || '').trim()
  if (envApiKey) return { provider: 'resend', apiKey: envApiKey, from: await resolveFrom(c, String((c.env as any).EMAIL_FROM || '').trim()) }

  return { provider: stored.emailProvider || 'resend', apiKey: '', from: await resolveFrom(c, '') }
}

async function resolveFrom(c: Context, configured: string | undefined): Promise<string> {
  if (configured) return configured
  const envFrom = String((c.env as any).EMAIL_FROM || '').trim()
  if (envFrom) return envFrom
  try { return String(getSystemSettings().companyDetails.email || '').trim() } catch { return '' }
}

export interface OutgoingEmail { to: string | string[]; subject: string; text: string; html?: string }
export interface EmailSendResult { ok: boolean; id: string | null; error: string | null }

// 统一发信入口：按当前生效的邮件服务商拼装请求并发送，返回值统一归一化为
// { ok, id, error }，调用方不需要关心具体服务商的响应格式。
export async function sendTransactionalEmail(c: Context, email: OutgoingEmail): Promise<EmailSendResult> {
  const { provider, apiKey, from } = await resolveEmailCredentials(c)
  if (!apiKey || !from) return { ok: false, id: null, error: 'Email transport is not configured' }
  const recipients = Array.isArray(email.to) ? email.to : [email.to]

  try {
    if (provider === 'brevo') {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: parseFromAddress(from), to: recipients.map((address) => ({ email: address })), subject: email.subject, textContent: email.text, htmlContent: email.html || undefined }),
      })
      const result = await response.json().catch(() => ({})) as any
      return { ok: response.ok, id: result?.messageId || null, error: response.ok ? null : String(result?.message || response.status) }
    }
    if (provider === 'mailersend') {
      const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ from: parseFromAddress(from), to: recipients.map((address) => ({ email: address })), subject: email.subject, text: email.text, html: email.html || undefined }),
      })
      const messageId = response.headers.get('x-message-id')
      const ok = response.status === 202 || response.ok
      let error: string | null = null
      if (!ok) { const result = await response.json().catch(() => ({})) as any; error = String(result?.message || response.status) }
      return { ok, id: messageId, error }
    }
    // 默认 Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject: email.subject, text: email.text, html: email.html || undefined }),
    })
    const result = await response.json().catch(() => ({})) as any
    return { ok: response.ok, id: result?.id || null, error: response.ok ? null : String(result?.message || response.status) }
  } catch (error: any) {
    return { ok: false, id: null, error: String(error?.message || error).slice(0, 500) }
  }
}

// Brevo / MailerSend 的 sender/from 字段需要 { email, name? } 结构；
// 我们的配置沿用 Resend 惯用的 "Name <email>" 或纯邮箱写法，这里统一拆解。
function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^(.*?)<([^<>]+)>$/)
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '')
    return name ? { email: match[2].trim(), name } : { email: match[2].trim() }
  }
  return { email: from.trim() }
}

export interface ChannelAlert { title: string; message: string; url?: string }
export type ChannelDeliveryResult = { channel: string; ok: boolean; detail: string }

// 按主机名精确匹配（等于该域名或它的子域），而不是子串包含——既避免
// hooks.slack.com.evil.com 之类误判，也让 CodeQL 的 URL 消毒规则满意。
function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function buildWebhookBody(url: string, alert: ChannelAlert): string {
  const text = alert.url ? `${alert.title}\n${alert.message}\n${alert.url}` : `${alert.title}\n${alert.message}`
  let hostname = ''
  try { hostname = new URL(url).hostname.toLowerCase() } catch { /* ignore */ }
  if (hostMatches(hostname, 'discord.com') || hostMatches(hostname, 'discordapp.com')) return JSON.stringify({ content: text.slice(0, 1900) })
  if (hostMatches(hostname, 'slack.com')) return JSON.stringify({ text })
  if (hostMatches(hostname, 'dingtalk.com')) return JSON.stringify({ msgtype: 'text', text: { content: text } })
  if (hostMatches(hostname, 'feishu.cn') || hostMatches(hostname, 'larksuite.com')) return JSON.stringify({ msg_type: 'text', content: { text } })
  return JSON.stringify({ title: alert.title, message: alert.message, url: alert.url || '', text })
}

async function withTimeout(input: string, init: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try { return await fetch(input, { ...init, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

// 把一条告警广播到所有已启用的推送渠道。同一请求内按 title|message 去重，
// 这样「给每个管理员各发一条站内信」的循环只会触发一次外呼。
export async function dispatchChannelAlert(c: Context, alert: ChannelAlert, options: { force?: boolean } = {}): Promise<ChannelDeliveryResult[]> {
  const stored = await readStored(c)
  const anyEnabled = stored.webhookEnabled
  if (!anyEnabled && !options.force) return []

  if (!options.force) {
    const sent: Set<string> = (c as any).__channelAlertSent ||= new Set()
    const dedupeKey = `${alert.title} ${alert.message}`
    if (sent.has(dedupeKey)) return []
    sent.add(dedupeKey)
  }

  const results: ChannelDeliveryResult[] = []
  const tasks: Promise<void>[] = []

  if (stored.webhookEnabled || options.force) {
    tasks.push((async () => {
      try {
        const url = await safeDecrypt(c, stored.webhookUrl)
        if (!url) { results.push({ channel: 'webhook', ok: false, detail: '未配置 Webhook 地址' }); return }
        const response = await withTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: buildWebhookBody(url, alert) })
        results.push({ channel: 'webhook', ok: response.ok, detail: response.ok ? '已发送' : `HTTP ${response.status}` })
      } catch (error: any) { results.push({ channel: 'webhook', ok: false, detail: String(error?.message || error).slice(0, 160) }) }
    })())
  }

  await Promise.all(tasks)
  return results
}
