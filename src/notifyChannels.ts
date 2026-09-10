/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 通知渠道配置：Resend 邮件 API Key + 若干推送渠道（Telegram / Server酱·PushPlus /
// 通用 Webhook）。密钥用 SETTINGS_ENCRYPTION_KEY 加密后存 systemSettings 表，
// 与 stripe.ts / emailConfig.ts 完全同一套做法。运行期通过 resolveResendCredentials
// 取邮件凭据（后台配置优先，回落到 env），dispatchChannelAlert 把一条告警广播到
// 所有已启用的推送渠道，尽力而为、绝不抛错。

import type { Context } from 'hono'
import { getSystemSettings } from './settings/systemSettings'

type StoredChannelConfig = {
  resendApiKey?: string
  resendFrom?: string
  telegramEnabled?: boolean
  telegramBotToken?: string
  telegramChatId?: string
  serverChanEnabled?: boolean
  serverChanSendKey?: string
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
  const [resendApiKey, telegramBotToken, serverChanSendKey, webhookUrl] = await Promise.all([
    safeDecrypt(c, stored.resendApiKey),
    safeDecrypt(c, stored.telegramBotToken),
    safeDecrypt(c, stored.serverChanSendKey),
    safeDecrypt(c, stored.webhookUrl),
  ])
  const envResend = String((c.env as any).RESEND_API_KEY || '').trim()
  return {
    resend: {
      from: stored.resendFrom || '',
      apiKeyMasked: mask(resendApiKey),
      configured: Boolean(resendApiKey || envResend),
      usingEnvFallback: !resendApiKey && Boolean(envResend),
    },
    telegram: {
      enabled: Boolean(stored.telegramEnabled),
      chatId: stored.telegramChatId || '',
      botTokenMasked: mask(telegramBotToken),
      configured: Boolean(telegramBotToken && stored.telegramChatId),
    },
    serverChan: {
      enabled: Boolean(stored.serverChanEnabled),
      sendKeyMasked: mask(serverChanSendKey),
      configured: Boolean(serverChanSendKey),
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

  // Resend 邮件 API
  const resendKeyPlain = String(input.resendApiKey || '').trim()
  if (resendKeyPlain) next.resendApiKey = await encrypt(c, resendKeyPlain)
  if (input.resendClear === true) next.resendApiKey = undefined
  if (input.resendFrom !== undefined) {
    const from = String(input.resendFrom || '').trim().slice(0, 200)
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && !/<[^\s@]+@[^\s@]+\.[^\s@]+>/.test(from)) throw new Error('Resend 发件邮箱格式不正确')
    next.resendFrom = from || undefined
  }

  // Telegram
  next.telegramEnabled = Boolean(input.telegramEnabled)
  const tgTokenPlain = String(input.telegramBotToken || '').trim()
  if (tgTokenPlain) {
    if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(tgTokenPlain)) throw new Error('Telegram Bot Token 格式不正确')
    next.telegramBotToken = await encrypt(c, tgTokenPlain)
  }
  if (input.telegramChatId !== undefined) next.telegramChatId = String(input.telegramChatId || '').trim().slice(0, 64) || undefined
  if (input.telegramClear === true) { next.telegramBotToken = undefined; next.telegramChatId = undefined; next.telegramEnabled = false }
  if (next.telegramEnabled && !(next.telegramBotToken && next.telegramChatId)) throw new Error('启用 Telegram 前请填写 Bot Token 和 Chat ID')

  // Server酱 / PushPlus
  next.serverChanEnabled = Boolean(input.serverChanEnabled)
  const scKeyPlain = String(input.serverChanSendKey || '').trim()
  if (scKeyPlain) next.serverChanSendKey = await encrypt(c, scKeyPlain)
  if (input.serverChanClear === true) { next.serverChanSendKey = undefined; next.serverChanEnabled = false }
  if (next.serverChanEnabled && !next.serverChanSendKey) throw new Error('启用 Server酱 / PushPlus 前请填写 SendKey / token')

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

// 邮件凭据：后台配置优先，回落到 env（RESEND_API_KEY / EMAIL_FROM），
// 发件人再回落到公司邮箱。任何一步失败都不抛错，只当作未配置处理。
export async function resolveResendCredentials(c: Context): Promise<{ apiKey: string; from: string }> {
  let apiKey = ''
  let from = ''
  try {
    const stored = await readStored(c)
    apiKey = await safeDecrypt(c, stored.resendApiKey)
    from = String(stored.resendFrom || '').trim()
  } catch { /* fall through to env */ }
  if (!apiKey) apiKey = String((c.env as any).RESEND_API_KEY || '').trim()
  if (!from) from = String((c.env as any).EMAIL_FROM || '').trim()
  if (!from) { try { from = String(getSystemSettings().companyDetails.email || '').trim() } catch { /* ignore */ } }
  return { apiKey, from }
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
  const anyEnabled = stored.telegramEnabled || stored.serverChanEnabled || stored.webhookEnabled
  if (!anyEnabled && !options.force) return []

  if (!options.force) {
    const sent: Set<string> = (c as any).__channelAlertSent ||= new Set()
    const dedupeKey = `${alert.title} ${alert.message}`
    if (sent.has(dedupeKey)) return []
    sent.add(dedupeKey)
  }

  const results: ChannelDeliveryResult[] = []
  const tasks: Promise<void>[] = []

  if (stored.telegramEnabled || options.force) {
    tasks.push((async () => {
      try {
        const token = await safeDecrypt(c, stored.telegramBotToken)
        const chatId = stored.telegramChatId || ''
        if (!token || !chatId) { results.push({ channel: 'telegram', ok: false, detail: '未配置 Bot Token / Chat ID' }); return }
        const body = alert.url ? `${alert.title}\n${alert.message}\n${alert.url}` : `${alert.title}\n${alert.message}`
        const response = await withTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: true }),
        })
        results.push({ channel: 'telegram', ok: response.ok, detail: response.ok ? '已发送' : `HTTP ${response.status}` })
      } catch (error: any) { results.push({ channel: 'telegram', ok: false, detail: String(error?.message || error).slice(0, 160) }) }
    })())
  }

  if (stored.serverChanEnabled || options.force) {
    tasks.push((async () => {
      try {
        const sendKey = await safeDecrypt(c, stored.serverChanSendKey)
        if (!sendKey) { results.push({ channel: 'serverChan', ok: false, detail: '未配置 SendKey' }); return }
        const desp = alert.url ? `${alert.message}\n\n${alert.url}` : alert.message
        const isPushPlus = /^[0-9a-f]{32}$/i.test(sendKey)
        const response = isPushPlus
          ? await withTimeout('https://www.pushplus.plus/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sendKey, title: alert.title, content: desp }) })
          : await withTimeout(`https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ title: alert.title, desp }).toString() })
        const data = await response.json().catch(() => ({})) as any
        const ok = response.ok && (data?.code === 0 || data?.code === '0' || data?.data || data?.errno === 0 || typeof data?.code === 'undefined')
        results.push({ channel: 'serverChan', ok, detail: ok ? '已发送' : String(data?.message || data?.msg || `HTTP ${response.status}`).slice(0, 160) })
      } catch (error: any) { results.push({ channel: 'serverChan', ok: false, detail: String(error?.message || error).slice(0, 160) }) }
    })())
  }

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
