/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// @ts-nocheck
import { Hono } from 'hono'
import * as pages from './pages/index'
import * as actions from './actions/index'
import {
  renderNotFound,
  renderForbidden,
  renderServerError,
  renderUnauthorized,
  renderBadGateway,
  renderServiceUnavailable
} from './pages/public/notFound'
import {
  verifyUserCredentials,
  findUserBySession,
  getDeviceById,
  updateUser,
  verifyPassword,
  insertUser,
  insertDevice,
  updateDevice,
  deleteDevice,
  getOrdersAsync,
  getDevicesAsync,
  getStaffDashboardData,
  hashPassword,
  findUserByEmail,
  findUserByReferralCode,
  getUserById,
  createWithdrawalRequest,
  generateReferralCode,
  getOrderById,
  insertOrder,
  updateOrderStatus,
  hasDeviceBookingConflict,
  canTransitionOrder,
  validateHostedImageUrls,
  enforceRateLimit,
  sanitizeRichHtml,
  renderSiteVariables,
  renderContractVariables,
  updateDeviceStatus,
  recordDeviceLifecycle,
  releaseDeviceIfUnbooked,
  getContractById,
  getContractByOrderId,
  updateContractTemplate,
  CONTRACT_OPERATIONAL_FIELDS,
  CONTRACT_SIGNED_FIELDS,
  issueInvoice,
  ensureOrderNumber,
  generateReferenceNumber,
  createAuthSession,
  deleteAuthSession,
  buildLayout,
  getSystemSettings,
  loadSystemSettingsFromDB,
  updateSystemSettings,
  combinePersonName,
  isStrongPassword,
  generateUniqueUserId,
  isContractExpired,
  getUsers,
  getAccessLevel
  , createNotification
  , getNotifications
  , createDueDateNotifications
  , sanitizePlainText
  , renderNotificationMarkdown
  , renderFlexibleContent
  , renderEmailNotificationHtml
  , ensureNotificationsTable
  , getContractBySignToken
  , enqueueRentalUserDeletion
  , recordExternalRentalFlow
  , lockReferralRelationship
  , createAuditLog
  , recordFinancialLedgerEntry
} from './site'
import { nanoid } from 'nanoid'
import { getStripeConfigSummary } from './stripe'
import { getEmailConfigSummary } from './emailConfig'
import { notifyAgreementUpdate } from './actions/admin/saveSettings'
import { createStripeCheckout, handleStripeWebhook, refundDeposit, cancelAndRefund, refundUnusedRentalDays, completeBankTransferRefund } from './actions/stripePayments'
import { getAudCnyRate, roundCnyUp } from './rmbExchange'
import siteStyles from './styles.css'

function parseFormBody(body: string | null | undefined): Record<string, string> {
  const form: Record<string, string> = {}
  if (!body) return form

  const params = new URLSearchParams(body)
  for (const [key, value] of params.entries()) {
    form[key] = value
  }

  return form
}

async function sendLoggedEmail(c: any, input: { eventType: string, recipient: string, key: string, subject: string, text: string, html?: string, orderId?: string, templateId?: string }): Promise<{ ok: boolean }> {
  const claimed = await c.env.RENT.prepare("INSERT OR IGNORE INTO email_events (id, event_type, recipient, order_id, template_id, idempotency_key, status, subject, text_body, html_body, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?, 'SENDING', ?, ?, ?, CURRENT_TIMESTAMP)").bind(`email-${nanoid(12)}`, input.eventType, input.recipient, input.orderId || null, input.templateId || null, input.key, input.subject, input.text, input.html || null).run() as any
  if (!claimed.meta?.changes) return { ok: true }
  const apiKey = String(c.env.RESEND_API_KEY || '').trim(); const from = String(c.env.EMAIL_FROM || getSystemSettings().companyDetails.email || '').trim()
  if (!apiKey || !from) { await c.env.RENT.prepare("UPDATE email_events SET status = 'FAILED', retry_count = retry_count + 1, error_message = 'Email transport is not configured' WHERE idempotency_key = ?").bind(input.key).run(); return { ok: false } }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [input.recipient], subject: input.subject, text: input.text, html: input.html }) })
    const result = await response.json().catch(() => ({})) as any
    await c.env.RENT.prepare("UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, retry_count = CASE WHEN ? THEN retry_count ELSE retry_count + 1 END, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE idempotency_key = ?").bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status), response.ok ? 1 : 0, response.ok ? 1 : 0, input.key).run()
    return { ok: response.ok }
  } catch (error: any) { await c.env.RENT.prepare("UPDATE email_events SET status = 'FAILED', retry_count = retry_count + 1, error_message = ? WHERE idempotency_key = ?").bind(String(error?.message || error).slice(0, 500), input.key).run(); return { ok: false } }
}

async function sendPaymentReviewEmail(c: any, customer: any, subject: string, message: string, orderId: string): Promise<void> {
  const email = String(customer?.email || '').trim()
  const apiKey = String((c.env as any).RESEND_API_KEY || '').trim()
  const from = String((c.env as any).EMAIL_FROM || getSystemSettings().companyDetails.email || '').trim()
  if (!apiKey || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
  try {
    const key = `payment-review:${orderId}:${email}:${subject}`
    const claimed = await c.env.RENT.prepare("INSERT OR IGNORE INTO email_events (id, event_type, recipient, order_id, idempotency_key, status) VALUES (?, 'PAYMENT_REVIEW', ?, ?, ?, 'PENDING')").bind(`email-${nanoid(12)}`, email, orderId, key).run() as any
    if (!claimed.meta?.changes) return
    const html = renderEmailNotificationHtml(subject, `<p>${sanitizePlainText(message, 1000)}</p><p><a href="${new URL(`/customer/orders/${encodeURIComponent(orderId)}`, c.req.url).toString()}">查看订单详情</a></p>`, getSystemSettings().companyDetails.name)
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject, text: message, html }) })
    const result = await response.json().catch(() => ({})) as any
    await c.env.RENT.prepare("UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE idempotency_key = ?").bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status), response.ok ? 1 : 0, key).run()
  } catch (error: any) { console.error('Payment review email failed:', error) }
}

async function ensureDeviceCommandTables(db: any): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS device_commands (
    id TEXT PRIMARY KEY NOT NULL, device_id TEXT NOT NULL, command_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, claimed_at TEXT, completed_at TEXT
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS device_command_results (
    id TEXT PRIMARY KEY NOT NULL, command_id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0, result_code TEXT NOT NULL, result_message TEXT,
    executed_at TEXT NOT NULL, reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_device_commands_poll ON device_commands(device_id, status, expires_at, created_at)').run()
}

function requestHost(c: any): string {
  return String(c.req.header('Host') || '').split(':')[0].trim().toLowerCase()
}

function isCustomerLoginHost(c: any): boolean {
  return requestHost(c) === 'test-rent.ydnw6zt6vj.workers.dev'
}

function shouldShowTestAccounts(c: any): boolean {
  return String(c.env.SHOW_TEST_ACCOUNTS || '').toLowerCase() === 'true' && isCustomerLoginHost(c)
}

async function getTableColumns(c: any, tableName: string): Promise<string[]> {
  const allowedTables = new Set(['users', 'commission_withdrawals'])
  if (!allowedTables.has(tableName)) throw new Error('Unsupported table name')
  const result = await c.env.RENT.prepare(`PRAGMA table_info(${tableName})`).all() as any
  return (result.results || []).map((column: any) => column.name)
}

const app = new Hono()

app.get('/styles.css', (c) => {
  c.header('Content-Type', 'text/css; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  c.header('X-Content-Type-Options', 'nosniff')
  return c.body(siteStyles)
})

app.get('/api/system-status', async (c) => {
  const startedAt = Date.now()
  try {
    await c.env.RENT.prepare('SELECT 1 AS ok').first()
    const recent = await c.env.RENT.prepare("SELECT COUNT(*) AS total FROM error_logs WHERE error_level IN ('ERROR', 'CRITICAL') AND datetime(created_at) >= datetime('now', '-10 minutes')").first() as any
    const errors = Number(recent?.total || 0)
    const latency = Date.now() - startedAt
    const delayed = latency >= 1000
    return c.json({ status: errors ? 'degraded' : delayed ? 'delayed' : 'healthy', label: errors ? '异常' : delayed ? '延迟' : '正常', checkedAt: new Date().toISOString() }, 200, { 'Cache-Control': 'no-store' })
  } catch (error: any) {
    console.error('System status check failed:', error?.message || error)
    return c.json({ status: 'down', label: '错误' }, 503, { 'Cache-Control': 'no-store' })
  }
})

app.get('/downloads/RentDeviceAgent-Setup.exe', async (c) => {
  return c.redirect('https://github.com/aaoqqqdd/rent-app/releases/latest/download/RentDeviceAgent-Setup.exe', 302)
})

app.get('/downloads/RentDeviceAgent.exe', async (c) => {
  return c.redirect('https://github.com/aaoqqqdd/rent-app/releases/latest/download/RentDeviceAgent-x64.exe', 302)
})

app.get('/api/device-agent/update', (c) => c.json({
  version: '0.6.2',
  downloadUrl: 'https://github.com/aaoqqqdd/rent-app/releases/latest/download/RentDeviceAgent-x64.exe'
}))

app.get('/api/device-agent/software-terms', async (c) => {
  const settings = await loadSystemSettingsFromDB(c)
  const metadata = settings.legalMetadata.software
  return c.json({ content: settings.softwareTerms, version: metadata.version, lastUpdatedDate: metadata.lastUpdatedDate })
})

let loginAttemptsSchemaReady: Promise<void> | null = null

async function ensureLoginAttemptsSchema(c: any): Promise<void> {
  if (!loginAttemptsSchemaReady) {
    loginAttemptsSchemaReady = (async () => {
      await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        account TEXT NOT NULL,
        attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run()
      await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(ip_address, account, attempted_at)').run()
    })()
  }
  try {
    await loginAttemptsSchemaReady
  } catch (error) {
    loginAttemptsSchemaReady = null
    throw error
  }
}

async function ensureLoginHistorySchema(c: any): Promise<void> {
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    account TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC)').run()
}

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return error
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error
      ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack }
      : error.cause
  }
}

app.use('*', async (c, next) => {
  // 静态资源不需要鉴权，避免每次加载 CSS 都额外查询 D1 会话表。
  if (c.req.path === '/styles.css') return next()
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (user) {
    c.set('user', user)
  }
  await next()
})

app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/notifications')) {
    try {
      await ensureNotificationsTable(c)
    } catch (error: any) {
      console.error('Failed to ensure notifications table exists:', error?.message || error)
    }
  }
  await next()
})

app.use('*', async (c, next) => {
  const user = c.get('user') as any
  if (user?.accountType === 'guest' && user.role === 'CUSTOMER') {
    const expiresAt = user.guestExpiresAt || user.guest_expires_at
    const melbourneToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const expiresDate = expiresAt ? String(expiresAt).slice(0, 10) : ''
    if (expiresDate && expiresDate < melbourneToday) {
      await c.env.RENT.prepare("UPDATE users SET account_type = 'deleted_guest', status = 'inactive', email = 'deleted-guest-' || id || '@invalid.local', phone = NULL, bsb = NULL, account_number = NULL, password_hash = 'disabled', password_salt = 'disabled', guest_order_id = NULL, guest_expires_at = NULL, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_type = 'guest'").bind(user.id).run()
      await deleteAuthSession(c, c.req.header('cookie') ?? null)
      return c.redirect('/login?error=guest_expired')
    }
    const path = c.req.path
    const allowedExact = new Set(['/customer/guest', '/customer/guest/upgrade', '/logout', '/payment/result', '/notifications', '/notifications/unread'])
    const orderMatch = path.match(/^\/customer\/orders\/([^/]+)(?:\/(?:stripe\/checkout|bank-transfer-proof))?$/)
    const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoice$/)
    if (orderMatch && orderMatch[1] !== user.guestOrderId) return c.html(renderForbidden(), 403)
    if (invoiceMatch && invoiceMatch[1] !== user.guestOrderId) return c.html(renderForbidden(), 403)
    const permitted = allowedExact.has(path) || path.startsWith('/notifications/') || Boolean(orderMatch) || Boolean(invoiceMatch) || path.startsWith('/contract/view/') || path.startsWith('/contract/print/') || path.endsWith('/invoice/print') || path === '/styles.css'
    if (!permitted && path.startsWith('/customer/')) return c.redirect('/customer/guest')
  }
  await next()
})

app.use('*', async (c, next) => {
  const contentLength = Number(c.req.header('Content-Length') || 0)
  const maxBody = c.req.path === '/webhooks/stripe' ? 512 * 1024 : 128 * 1024
  if (contentLength > maxBody) return c.text('Request body too large', 413)
  if (c.req.method === 'POST' && c.req.path !== '/webhooks/stripe') {
    const origin = c.req.header('Origin')
    const fetchSite = c.req.header('Sec-Fetch-Site')
    if ((origin && new URL(origin).host !== new URL(c.req.url).host) || fetchSite === 'cross-site') return c.text('Invalid request origin', 403)
  }
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  const rateRule = c.req.path === '/register' && c.req.method === 'POST' ? ['register', 5, 3600] as const
    : c.req.path === '/forgot-password' && c.req.method === 'POST' ? ['forgot', 5, 3600] as const
      : c.req.path === '/contract/sign' ? ['contract-sign', 60, 900] as const
        : /^\/customer\/orders\/[^/]+\/stripe\/checkout$/.test(c.req.path) ? ['stripe-checkout', 10, 600] as const
          : /^\/customer\/orders\/[^/]+\/bank-transfer-proof$/.test(c.req.path) ? ['bank-proof', 10, 3600] as const
            : c.req.path.startsWith('/api/address/') ? ['address-search', 120, 60] as const : null
  const agentRegistrationRule = c.req.path === '/api/device-agent/register' && c.req.method === 'POST'
    ? ['device-agent-register', 10, 900] as const
    : null
  const activeRateRule = rateRule || agentRegistrationRule
  if (activeRateRule && !await enforceRateLimit(c, activeRateRule[0], ip, activeRateRule[1], activeRateRule[2])) return c.text('请求过于频繁，请稍后再试', 429)
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Cross-Origin-Resource-Policy', 'same-origin')
  if (new URL(c.req.url).protocol === 'https:') c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'")
});

app.use('*', async (c, next) => {
  try {
    await next()
  } catch (error) {
    console.error('Server Error:', errorDetails(error))
    return c.html(renderServerError(), 500)
  }
})

app.notFound((c) => {
  return c.html(renderNotFound(), 404)
})

app.onError((error, c) => {
  console.error('Unhandled Application Error:', errorDetails(error))
  const statusCode = error.status || 500
  switch (statusCode) {
    case 401:
      return c.html(renderUnauthorized(), 401)
    case 403:
      return c.html(renderForbidden(), 403)
    case 404:
      return c.html(renderNotFound(), 404)
    case 502:
      return c.html(renderBadGateway(), 502)
    case 503:
      return c.html(renderServiceUnavailable(), 503)
    default:
      return c.html(renderServerError(), 500)
  }
})



app.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role === 'CUSTOMER') return c.redirect(user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard')
  if (user.role === 'STAFF') return c.redirect('/staff/dashboard')
  return c.redirect('/admin/dashboard')
})

app.get('/login', async (c) => {
  const user = c.get('user')
  if (user) {
    return c.redirect('/')
  }
  const deletedMessage = c.req.query('deletion_requested') === '1' ? '账户删除申请已提交，进入 7 天冷静期；您已退出登录。7 天内重新登录可取消删除。' : undefined
  const message = c.req.query('reset') === '1' ? '密码已重置，请使用新密码登录。' : deletedMessage
  return c.html(pages.renderLogin(message, shouldShowTestAccounts(c)))
})

app.post('/login', async (c) => {
  const form = await c.req.parseBody()
  const account = form.account?.trim()
  const password = form.password?.trim()
  if (!account || !password) {
    return c.html(pages.renderLogin('请输入账号和密码', shouldShowTestAccounts(c)))
  }
  const loginIp = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim().slice(0, 64)
  const normalizedAccount = String(account).toLowerCase().slice(0, 254)
  await ensureLoginAttemptsSchema(c)
  await ensureLoginHistorySchema(c)
  const recentFailures = await c.env.RENT.prepare("SELECT COUNT(*) count, MAX(attempted_at) latest FROM login_attempts WHERE ip_address = ? AND account = ? AND attempted_at > datetime('now', '-30 minutes')").bind(loginIp, normalizedAccount).first() as any
  const failureCount = Number(recentFailures?.count || 0)
  if (failureCount >= 3 && recentFailures?.latest) {
    const lockMinutes = Math.min(60, failureCount === 3 ? 1 : failureCount + 2)
    const elapsedSeconds = Math.floor((Date.now() - new Date(`${recentFailures.latest}Z`).getTime()) / 1000)
    const remainingSeconds = lockMinutes * 60 - elapsedSeconds
    if (remainingSeconds > 0) {
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return c.html(pages.renderLogin(`登录失败次数过多，请 ${remainingMinutes} 分钟后再试`, shouldShowTestAccounts(c)), 429)
    }
  }
  const user = await verifyUserCredentials(c, account, password)
  if (!user) {
    await c.env.RENT.prepare('INSERT INTO login_history (user_id, account, ip_address, user_agent, status) VALUES (NULL, ?, ?, ?, \'failure\')').bind(normalizedAccount, loginIp, c.req.header('User-Agent') || '').run()
    await c.env.RENT.prepare('INSERT INTO login_attempts (ip_address, account) VALUES (?, ?)').bind(loginIp, normalizedAccount).run()
    return c.html(pages.renderLogin('账号或密码错误', shouldShowTestAccounts(c)))
  }
  // 冷静期内登录视为撤销删除申请。
  if ((user as any).deletion_scheduled_at || (user as any).deletionScheduledAt) {
    try {
      await c.env.RENT.prepare('UPDATE users SET deletion_requested_at = NULL, deletion_scheduled_at = NULL WHERE id = ?').bind(user.id).run()
    } catch (_) { }
  }
  await c.env.RENT.prepare("INSERT INTO login_history (user_id, account, ip_address, user_agent, status) VALUES (?, ?, ?, ?, 'success')").bind(user.id, normalizedAccount, loginIp, c.req.header('User-Agent') || '').run()
  await c.env.RENT.prepare('DELETE FROM login_attempts WHERE ip_address = ? AND account = ?').bind(loginIp, normalizedAccount).run()
  const response = c.redirect(user.role === 'CUSTOMER'
    ? (user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard')
    : user.role === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard')
  const session = await createAuthSession(c, user.id, form.remember === 'on')
  let cookieOptions = `session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}`;
  if (new URL(c.req.url).protocol === 'https:') cookieOptions += '; Secure'
  response.headers.set('Set-Cookie', cookieOptions)
  return response
})

app.get('/register', async (c) => {
  const user = c.get('user')
  if (user) {
    return c.redirect('/')
  }
  const referralCode = String(c.req.query('ref') || '').trim().toUpperCase().slice(0, 10)
  return c.html(pages.renderRegister(undefined, String((c.env as any).TURNSTILE_SITE_KEY || ''), referralCode))
})

app.get('/ref/:code', async (c) => {
  const code = String(c.req.param('code') || '').trim().toUpperCase()
  if (!code || !await findUserByReferralCode(c, code)) return c.redirect('/register?error=invalid_referral')
  const response = c.redirect(`/register?ref=${encodeURIComponent(code)}`)
  response.headers.append('Set-Cookie', `referral_code=${encodeURIComponent(code)}; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${new URL(c.req.url).protocol === 'https:' ? '; Secure' : ''}`)
  return response
})

async function ensureEmailVerificationSchema(c: any) {
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS email_verifications (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, verified_at TEXT)`).run()
}

async function sendEmailVerification(c: any, user: any) {
  await ensureEmailVerificationSchema(c)
  const token = nanoid(48)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const eventKey = `email-verification:${user.id}:${tokenHash}`
  await c.env.RENT.prepare('INSERT INTO email_verifications (id, user_id, email, token_hash, sent_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(nanoid(), user.id, user.email, tokenHash, now.toISOString(), expiresAt).run()
  const claimed = await c.env.RENT.prepare("INSERT OR IGNORE INTO email_events (id, event_type, recipient, idempotency_key, status) VALUES (?, 'EMAIL_VERIFICATION', ?, ?, 'PENDING')").bind(`email-${nanoid(12)}`, user.email, eventKey).run() as any
  if (!claimed.meta?.changes) return
  const apiKey = String((c.env as any).RESEND_API_KEY || '')
  const from = String((c.env as any).EMAIL_FROM || '')
  if (!apiKey || !from) { await c.env.RENT.prepare("UPDATE email_events SET status = 'SKIPPED', error_message = 'Email transport is not configured' WHERE idempotency_key = ?").bind(eventKey).run(); return }
  const verifyUrl = `${new URL(c.req.url).origin}/verify-email?token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [user.email], subject: '验证您的邮箱 - PC Rental', text: `您好 ${user.name}，请在 24 小时内打开以下链接验证邮箱：\n${verifyUrl}` }) })
  const result = await response.json().catch(() => ({})) as any
  await c.env.RENT.prepare("UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE idempotency_key = ?").bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status), response.ok ? 1 : 0, eventKey).run()
}

app.get(['/terms', '/user-terms'], async (c) => {
  const settings = await loadSystemSettingsFromDB(c)
  const currentUser = c.get('user')
  const content = renderSiteVariables(settings.userTerms, currentUser)
  return c.html(buildLayout('用户协议', `<div class="panel contract-section"><div class="section-title"><h2>用户协议</h2><span class="section-note mono">LEGAL / USER TERMS</span></div>${content}<p style="margin-top:24px"><a class="button button-secondary" href="/register">返回注册</a></p></div>`, currentUser))
})

for (const [path, title, key, code] of [
  ['/service-terms', '服务条款', 'serviceTerms', 'LEGAL / SERVICE TERMS'],
  ['/privacy', '隐私政策', 'privacyPolicy', 'LEGAL / PRIVACY'],
  ['/software-terms', '软件使用协议', 'softwareTerms', 'LEGAL / SOFTWARE'],
  ['/refund-policy', '退款政策', 'copyrightNotice', 'LEGAL / REFUND POLICY'],
  ['/copyright', '退款政策', 'copyrightNotice', 'LEGAL / REFUND POLICY'],
] as const) {
  app.get(path, async (c) => {
    const settings = await loadSystemSettingsFromDB(c)
    const currentUser = c.get('user')
    const metadataKey = key === 'copyrightNotice' ? 'copyright' : key === 'softwareTerms' ? 'software' : path === '/terms' || path === '/user-terms' ? 'user' : path === '/service-terms' ? 'service' : 'privacy'
    const metadata = settings.legalMetadata[metadataKey]
    const content = renderSiteVariables(settings[key], currentUser, {
      ...(metadataKey === 'user' ? { user_agreement_version: metadata.version, user_agreement_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'service' ? { service_terms_version: metadata.version, service_terms_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'privacy' ? { privacy_policy_version: metadata.version, privacy_policy_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'software' ? { software_terms_version: metadata.version, software_terms_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'copyright' ? { refund_policy_version: metadata.version, refund_policy_last_updated_date: metadata.lastUpdatedDate, last_updated_date: metadata.lastUpdatedDate } : {}),
    })
    return c.html(buildLayout(title, `<article class="panel legal-document"><div class="section-title"><div><p class="section-code">${code}</p><h2>${title}</h2></div></div><div class="legal-document__content">${content}</div></article>`, currentUser))
  })
}

app.post('/register', async (c) => {
  const form = await c.req.parseBody()
  const { firstName, lastName, email, password, passwordConfirm, referrer, countryCode, phone } = form
  const cookieReferral = (c.req.header('cookie') || '').match(/(?:^|;\s*)referral_code=([^;]+)/)?.[1] || ''
  const suppliedReferral = decodeURIComponent(String(referrer || cookieReferral || '')).trim().toUpperCase().slice(0, 10)
  const renderRegistrationError = (message: string) => pages.renderRegister(message, String((c.env as any).TURNSTILE_SITE_KEY || ''), suppliedReferral)
  const turnstileToken = String(form['cf-turnstile-response'] || '')
  const turnstileSecret = String((c.env as any).TURNSTILE_SECRET_KEY || '')
  if (!turnstileSecret || !turnstileToken) return c.html(renderRegistrationError('请先完成人机验证。'), 400)
  const turnstileResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken, remoteip: c.req.header('CF-Connecting-IP') }) }).then(r => r.json()).catch(() => ({ success: false })) as any
  if (!turnstileResult.success) return c.html(renderRegistrationError('人机验证失败，请重试。'), 400)
  const name = combinePersonName(firstName, lastName)

  if (!String(firstName || '').trim() || !String(lastName || '').trim() || !email?.trim() || !password?.trim() || !passwordConfirm?.trim() || !phone?.trim()) {
    return c.html(renderRegistrationError('请输入完整注册信息'))
  }
  if (password !== passwordConfirm) {
    return c.html(renderRegistrationError('两次输入密码不一致'))
  }
  if (!isStrongPassword(password)) return c.html(renderRegistrationError('密码至少需要 8 位，并同时包含字母、数字和符号'))

  // 检查邮箱是否已存在
  const existingUser = await findUserByEmail(c, email)
  if (existingUser) {
    return c.html(renderRegistrationError('该电子邮箱已被注册'))
  }

  // 处理推荐人
  let referrerId = null;
  if (suppliedReferral) {
    const referrerUser = await findUserByReferralCode(c, suppliedReferral)
    if (referrerUser) {
      referrerId = referrerUser.id;
    } else {
      return c.html(renderRegistrationError('无效的推荐码'))
    }
  }

  const newUserId = await generateUniqueUserId(c, 'CUSTOMER')
  const fullPhone = `${countryCode}${phone}`
  const newUser = {
    id: newUserId,
    name,
    email: email.trim(),
    phone: fullPhone,
    passwordHash: await hashPassword(password),
    role: 'CUSTOMER' as const,
    balance: 0,
    commissionBalance: 0,
    referrerId: referrerId,
    createdAt: new Date().toISOString(),
    status: 'active' as const
  }

  await insertUser(c, newUser)
  await lockReferralRelationship(c, referrerId, newUserId, suppliedReferral)
  // 协议确认记录独立保存，不写入协议正文或合同内容。
  for (const [column, definition] of [
    ['user_agreement_accepted', 'INTEGER NOT NULL DEFAULT 0'],
    ['user_agreement_version', 'TEXT'],
    ['user_agreement_accepted_at', 'TEXT'],
    ['user_agreement_accepted_ip', 'TEXT'],
    ['privacy_policy_version', 'TEXT'],
    ['privacy_policy_accepted_at', 'TEXT'],
    ['privacy_policy_accepted', 'INTEGER NOT NULL DEFAULT 0'],
    ['service_terms_accepted', 'INTEGER NOT NULL DEFAULT 0'],
    ['service_terms_version', 'TEXT'],
    ['service_terms_accepted_at', 'TEXT'],
    ['service_terms_accepted_ip', 'TEXT'],
    ['refund_policy_accepted', 'INTEGER NOT NULL DEFAULT 0'],
    ['refund_policy_version', 'TEXT'],
    ['refund_policy_accepted_at', 'TEXT'],
    ['refund_policy_accepted_ip', 'TEXT'],
  ] as const) {
    try { await c.env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} ${definition}`).run() } catch (_) { }
  }
  const acceptedAt = new Date().toISOString()
  const acceptedIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0].trim() || null
  await c.env.RENT.prepare(`UPDATE users SET user_agreement_accepted = 1, user_agreement_version = ?, user_agreement_accepted_at = ?, user_agreement_accepted_ip = ?, service_terms_accepted = 1, service_terms_version = ?, service_terms_accepted_at = ?, service_terms_accepted_ip = ?, privacy_policy_accepted = 1, privacy_policy_version = ?, privacy_policy_accepted_at = ?, privacy_policy_accepted_ip = ?, refund_policy_accepted = 1, refund_policy_version = ?, refund_policy_accepted_at = ?, refund_policy_accepted_ip = ? WHERE id = ?`)
    .bind('1.0', acceptedAt, acceptedIp, '1.0', acceptedAt, acceptedIp, '1.0', acceptedAt, acceptedIp, '1.0', acceptedAt, acceptedIp, newUserId).run()

  // 注册验证邮件的发送由独立接口处理，服务端统一限制 60 秒内只能发送一次。
  await sendEmailVerification(c, newUser)

  // 自动登录
  await loadSystemSettingsFromDB(c)
  const response = c.redirect(getSystemSettings().registrationSettings?.requireEmailVerification
    ? `/verify-email/pending?email=${encodeURIComponent(newUser.email)}`
    : '/customer/dashboard')
  if (!getSystemSettings().registrationSettings?.requireEmailVerification) {
    const session = await createAuthSession(c, newUserId)
    response.headers.set('Set-Cookie', `session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${new URL(c.req.url).protocol === 'https:' ? '; Secure' : ''}`)
  }

  return response
})

app.get('/verify-email/pending', async (c) => {
  const email = String(c.req.query('email') || '')
  const body = `<div class="panel" style="max-width:560px;margin:40px auto"><h2>请验证您的邮箱</h2><p>验证邮件已发送至 <strong>${email.replace(/[<>]/g, '')}</strong>，请打开邮件中的链接完成验证。</p><form method="post" action="/register/resend-verification"><input type="hidden" name="email" value="${email.replace(/"/g, '&quot;')}"><button class="button" id="resendVerification" type="submit" disabled>60 秒后可重新发送</button></form><p class="form-text">如果没有收到邮件，请检查垃圾邮件文件夹。</p><script>let s=60,b=document.getElementById('resendVerification');const t=setInterval(()=>{s--;b.textContent=s>0?s+' 秒后可重新发送':'重新发送验证邮件';if(s<=0){b.disabled=false;clearInterval(t)}},1000)</script></div>`
  return c.html(buildLayout('验证邮箱', body))
})

app.post('/register/resend-verification', async (c) => {
  const form = await c.req.parseBody()
  const email = String(form.email || '').trim().toLowerCase()
  if (!email) return c.text('请输入邮箱地址', 400)
  await ensureEmailVerificationSchema(c)
  const user = await findUserByEmail(c, email)
  if (!user) return c.text('如果该邮箱已注册，验证邮件将发送到您的邮箱。', 200)
  const latest = await c.env.RENT.prepare("SELECT sent_at FROM email_verifications WHERE user_id = ? ORDER BY sent_at DESC LIMIT 1").bind(user.id).first() as any
  if (latest?.sent_at && Date.now() - new Date(String(latest.sent_at).replace(' ', 'T') + 'Z').getTime() < 60000) return c.text('验证邮件已发送，请 60 秒后再试。', 429)
  await sendEmailVerification(c, user)
  return c.text('验证邮件已重新发送，请查收。', 200)
})

app.get('/verify-email', async (c) => {
  const token = String(c.req.query('token') || '')
  if (!token) return c.html(buildLayout('邮箱验证', '<div class="panel"><h2>验证链接无效</h2><p>请使用邮件中的完整链接。</p></div>'), 400)
  await ensureEmailVerificationSchema(c)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const row = await c.env.RENT.prepare("SELECT * FROM email_verifications WHERE token_hash = ? AND verified_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY sent_at DESC LIMIT 1").bind(tokenHash).first() as any
  if (!row) return c.html(buildLayout('邮箱验证', '<div class="panel"><h2>验证链接已失效</h2><p>请重新发送验证邮件。</p></div>'), 400)
  await c.env.RENT.prepare('UPDATE email_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run()
  return c.html(buildLayout('邮箱验证', '<div class="panel"><h2>邮箱验证成功</h2><p>您的邮箱已验证，可以登录账户。</p><p><a class="button" href="/login">前往登录</a></p></div>'))
})

app.get('/forgot-password', async (c) => {
  return c.html(pages.renderForgotPassword())
})

app.post('/forgot-password', async (c) => {
  const form = await c.req.parseBody()
  const email = String(form.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.html(pages.renderForgotPassword('请输入有效的邮箱地址'), 400)
  const user = await findUserByEmail(c, email)
  if (user) {
    const token = nanoid(48)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const tokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
    await c.env.RENT.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').bind(user.id).run()
    await c.env.RENT.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime(\'now\', \'+30 minutes\'))').bind(`reset-${nanoid(12)}`, user.id, tokenHash).run()
    const apiKey = String((c.env as any).RESEND_API_KEY || '').trim()
    const from = String((c.env as any).EMAIL_FROM || getSystemSettings().companyDetails.email || '').trim()
    if (apiKey && from) {
      const resetUrl = `${new URL(c.req.url).origin}/reset-password?token=${encodeURIComponent(token)}`
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: '重置您的登录密码 - PC Rental', text: `您好 ${user.name || ''}，请在 30 分钟内打开以下链接重置密码：\n${resetUrl}` }) }).catch(error => console.error('Password reset email failed:', error))
    }
  }
  return c.html(pages.renderForgotPassword('如果该邮箱已注册，重置链接将发送到您的邮箱。'))
})

app.get('/reset-password', async (c) => {
  const token = String(c.req.query('token') || '').trim()
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return c.html(buildLayout('重置密码', '<div class="panel"><h2>重置链接无效</h2><p>请重新申请密码重置链接。</p></div>'), 400)
  return c.html(pages.renderResetPassword(token))
})

app.post('/reset-password', async (c) => {
  const form = await c.req.parseBody()
  const token = String(form.token || '').trim()
  const password = String(form.password || '').trim()
  const passwordConfirm = String(form.passwordConfirm || '').trim()
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return c.html(buildLayout('重置密码', '<div class="panel"><h2>重置链接无效</h2><p>请重新申请密码重置链接。</p></div>'), 400)
  if (password !== passwordConfirm) return c.html(pages.renderResetPassword(token, '两次输入的密码不一致'), 400)
  if (!isStrongPassword(password)) return c.html(pages.renderResetPassword(token, '密码至少需要 8 位，并同时包含字母、数字和符号'), 400)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  const reset = await c.env.RENT.prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1").bind(tokenHash).first() as any
  if (!reset) return c.html(buildLayout('重置密码', '<div class="panel"><h2>重置链接已失效</h2><p>请重新申请密码重置链接。</p></div>'), 400)
  await updateUser(c, reset.user_id, { password })
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL').bind(reset.id),
    c.env.RENT.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(reset.user_id),
  ])
  return c.redirect('/login?reset=1')
})

const logout = async (c: any) => {
  await deleteAuthSession(c, c.req.header('cookie') ?? null)
  const response = c.redirect('/')
  response.headers.set('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return response
}
app.post('/logout', logout)
app.get('/logout', logout)

app.get('/customer/dashboard', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role !== 'CUSTOMER') {
    return c.html(renderForbidden(), 403)
  }
  const orders = await getOrdersAsync(c)
  const devices = await getDevicesAsync(c)
  await ensureNotificationsTable(c)
  const announcementPageSize = 10
  const announcementPageCount = Math.max(1, Math.ceil(Number(((await c.env.RENT.prepare("SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND type = 'announcement' AND deleted_at IS NULL").bind(user.id).first()) as any)?.count || 0) / announcementPageSize))
  const requestedAnnouncementPage = Math.max(1, Number(c.req.query('announcementPage') || 1) || 1)
  const announcementPage = Math.min(requestedAnnouncementPage, announcementPageCount)
  const announcements = (await c.env.RENT.prepare("SELECT id, title, message, created_at FROM notifications WHERE recipient_id = ? AND type = 'announcement' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(user.id, announcementPageSize, (announcementPage - 1) * announcementPageSize).all()).results || []
  return c.html(pages.renderCustomerDashboard(user, orders, devices, { items: announcements, page: announcementPage, pageCount: announcementPageCount }))
})

app.get('/customer/balance', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType === 'guest') return c.redirect('/login')
  return c.html(await pages.renderCustomerBalance(c, user))
})

app.get('/customer/balance/top-up', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType === 'guest') return c.redirect('/login')
  await loadSystemSettingsFromDB(c)
  const pending = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE user_id = ? AND status = 'awaiting_transfer' ORDER BY created_at DESC LIMIT 1").bind(user.id).first()
  return c.html(pages.renderCustomerBalanceTopUp(c, user, '', pending))
})

app.get('/api/payment/aud-cny', async (c) => {
  const amount = Number(c.req.query('amount') || 0)
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return c.json({ error: '金额无效' }, 400)
  try { const rate = await getAudCnyRate(); return c.json({ rate, cnyAmount: roundCnyUp(amount, rate) }) } catch (error: any) { return c.json({ error: error.message || '汇率暂不可用' }, 503) }
})

app.post('/customer/balance/top-up', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType === 'guest') return c.html(renderForbidden(), 403)
  await loadSystemSettingsFromDB(c)
  const form = await c.req.parseBody()
  const amountText = String(form.amount || '').trim().replace(/,/g, '')
  const amount = Number(amountText)
  const method = String(form.method || 'card')
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount < 1 || amount > 10000) return c.html(pages.renderCustomerBalanceTopUp(c, user, '请输入 1 至 10,000 AUD 的有效充值金额。'), 400)
  if (!['card', 'bank_transfer', 'alipay', 'wechat'].includes(method)) return c.html(pages.renderCustomerBalanceTopUp(c, user, '请选择有效的充值方式。'), 400)
  if (method === 'card' && !getSystemSettings().paymentMethods.stripe) return c.html(pages.renderCustomerBalanceTopUp(c, user, '信用卡充值当前未启用。'), 400)
  if (['alipay', 'wechat'].includes(method) && (!(getSystemSettings().paymentMethods as any)[method] || !getSystemSettings().rmbPayment[`${method}QrUrl`])) return c.text('该人民币支付方式当前未启用', 400)
  const rmbRate = ['alipay', 'wechat'].includes(method) ? await getAudCnyRate().catch(() => null) : null
  if (['alipay', 'wechat'].includes(method) && !rmbRate) return c.text('暂时无法获取实时汇率，请稍后重试', 503)
  const id = `topup-${nanoid(12)}`
  await c.env.RENT.prepare("INSERT INTO balance_topups (id, user_id, amount, payment_method, cny_amount, status) VALUES (?, ?, ?, ?, ?, 'pending')").bind(id, user.id, Number(amount.toFixed(2)), method, rmbRate ? roundCnyUp(amount, rmbRate) : null).run()
  if (['bank_transfer', 'alipay', 'wechat'].includes(method)) {
    await c.env.RENT.prepare("UPDATE balance_topups SET status = 'awaiting_transfer' WHERE id = ?").bind(id).run()
    return c.redirect('/customer/balance/top-up')
  }
  try {
    const { createBalanceTopUpCheckout } = await import('./actions/stripePayments')
    return await createBalanceTopUpCheckout(c, user, id)
  } catch (error: any) {
    await c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed' WHERE id = ?").bind(id).run()
    return c.html(pages.renderCustomerBalanceTopUp(c, user, error.message || '无法创建信用卡支付'), 502)
  }
})

app.post('/customer/balance/top-up/transfer', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody(); const id = String(form.id || ''); const reference = String(form.reference || '').trim()
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND user_id = ? AND status = 'awaiting_transfer'").bind(id, user.id).first() as any
  if (!topup || !reference) return c.text('充值记录或 Reference 无效', 400)
  let imageUrl = ''
  if (form.imageUrl) { try { imageUrl = validateHostedImageUrls(form.imageUrl, 1)[0] } catch (error: any) { return c.text(error.message, 400) } }
  await c.env.RENT.prepare("UPDATE balance_topups SET reference = ?, note = ?, proof_image_url = ?, status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reference, String(form.note || '').trim(), imageUrl || null, id).run()
  return c.redirect('/customer/balance')
})

app.post('/customer/balance/top-up/cancel', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType === 'guest') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const id = String(form.id || '').trim()
  const next = String(form.next || '') === 'balance' ? '/customer/balance' : '/customer/balance/top-up'
  const result = await c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed', note = CASE WHEN note IS NULL OR note = '' THEN '客户已取消待付款充值' ELSE note || '；客户已取消待付款充值' END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'awaiting_transfer'").bind(id, user.id).run()
  if (!result.meta?.changes) return c.redirect('/customer/balance/top-up')
  return c.redirect(next)
})

app.post('/admin/users/:id/balance-adjust', async (c) => {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const target = await getUserById(c, c.req.param('id'))
  if (!target) return c.text('用户不存在', 404)
  const form = await c.req.parseBody()
  const amount = Number(String(form.amount || '').trim())
  const reason = String(form.reason || '').trim()
  if (!Number.isFinite(amount) || amount === 0) return c.text('余额变动金额必须不为 0', 400)
  if (!reason) return c.text('管理员调整余额必须填写原因', 400)
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS balance_transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()
  const result = await c.env.RENT.prepare('UPDATE users SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ROUND(balance + ?, 2) >= 0 RETURNING balance').bind(amount, target.id, amount).first() as any
  if (!result) return c.text('扣减后余额不能小于 0，或余额已被其他操作更新，请重试', 409)
  const next = Number(result.balance)
  await c.env.RENT.prepare('INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`bt-${crypto.randomUUID()}`, target.id, amount, next, amount > 0 ? 'admin_credit' : 'admin_debit', reason, admin.id).run()
  return c.redirect(`/admin/users/${target.id}`)
})

app.get('/admin/users/:id/identity', async (c) => {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const target = await getUserById(c, c.req.param('id'))
  if (!target || target.role !== 'CUSTOMER') return c.text('客户不存在', 404)
  const { results = [] } = await c.env.RENT.prepare('SELECT status, verification_method, document_last4, rejection_reason, verified_at, created_at FROM identity_verification_records WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20').bind(target.id).all() as any
  const history = results.map((row: any) => `<tr><td>${sanitizePlainText(row.status, 30)}</td><td>${sanitizePlainText(row.verification_method || '—', 80)}</td><td>${row.document_last4 ? `****${sanitizePlainText(row.document_last4, 4)}` : '—'}</td><td>${sanitizePlainText(row.rejection_reason || '—', 500)}</td><td>${sanitizePlainText(row.verified_at || row.created_at, 40)}</td></tr>`).join('') || '<tr><td colspan="5">暂无身份验证记录</td></tr>'
  const body = `<div class="panel"><div class="section-title"><div><h2>身份验证 · ${sanitizePlainText(target.name, 100)}</h2><p>仅保存证件末四位；完整证件资料不在系统页面或日志中显示。</p></div><a class="button button-secondary" href="/admin/users/${encodeURIComponent(target.id)}">返回客户</a></div><form method="post" action="/admin/users/${encodeURIComponent(target.id)}/identity-status" class="form-grid"><label>状态<select class="form-control" name="status" required><option value="PENDING">待审核</option><option value="VERIFIED">已验证</option><option value="REJECTED">已拒绝</option><option value="EXPIRED">已过期</option><option value="NOT_REQUIRED">无需验证</option></select></label><label>验证方式<input class="form-control" name="method" maxlength="80" placeholder="例如：人工核验"></label><label>证件末四位<input class="form-control" name="documentLast4" inputmode="numeric" maxlength="4"></label><label style="grid-column:1/-1">拒绝原因（拒绝时必填）<textarea class="form-control" name="rejectionReason" maxlength="500"></textarea></label><button class="button button-primary">保存身份验证</button></form><div class="table-wrapper"><table><thead><tr><th>状态</th><th>方式</th><th>证件</th><th>原因</th><th>时间</th></tr></thead><tbody>${history}</tbody></table></div></div>`
  return c.html(buildLayout('身份验证', body, admin))
})

app.post('/admin/users/:id/identity-status', async (c) => {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const target = await getUserById(c, c.req.param('id'))
  if (!target || target.role !== 'CUSTOMER') return c.text('客户不存在', 404)
  const form = await c.req.parseBody()
  const status = String(form.status || '')
  const last4 = String(form.documentLast4 || '').replace(/\D/g, '').slice(-4)
  const method = String(form.method || '').trim().slice(0, 80)
  const rejectionReason = String(form.rejectionReason || '').trim().slice(0, 500)
  if (!['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) return c.text('身份验证状态无效', 400)
  if (status === 'REJECTED' && !rejectionReason) return c.text('拒绝身份验证必须填写原因', 400)
  const legacyStatus = status === 'REJECTED' ? 'FAILED' : status
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE users SET identity_status = ?, identity_document_last4 = ?, identity_verified_at = CASE WHEN ? = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE identity_verified_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(legacyStatus, last4 || null, status, target.id),
    c.env.RENT.prepare('INSERT INTO identity_verification_records (id, customer_id, status, verification_method, document_last4, rejection_reason, verified_by, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = \'VERIFIED\' THEN CURRENT_TIMESTAMP END)').bind(`ivr-${nanoid(12)}`, target.id, status, method || null, last4 || null, rejectionReason || null, admin.id, status),
  ])
  await createAuditLog(c, { actor: admin, action: 'IDENTITY_STATUS_UPDATED', targetType: 'USER', targetId: target.id, before: { status: (target as any).identityStatus }, after: { status, documentLast4: last4 ? `****${last4}` : null, method }, reason: rejectionReason || undefined })
  return c.redirect(`/admin/users/${target.id}`, 303)
})

app.post('/admin/balance-topups/:id/approve', async (c) => {
  const admin = c.get('user'); if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND status = 'submitted'").bind(c.req.param('id')).first() as any
  if (!topup) return c.text('充值记录不存在或已处理', 409)
  const claimed = await c.env.RENT.prepare("UPDATE balance_topups SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'submitted'").bind(topup.id).run()
  if (!claimed.meta?.changes) return c.text('充值记录已被其他管理员处理', 409)
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE users SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(Number(topup.amount), topup.user_id),
    c.env.RENT.prepare("INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) SELECT ?, ?, ?, ROUND(balance, 2), 'top_up_transfer', ?, ? FROM users WHERE id = ?").bind(`bt-${nanoid(12)}`, topup.user_id, topup.amount, `银行转账充值（${topup.reference || '无 Reference'}）`, admin.id, topup.user_id),
  ])
  await createAuditLog(c, { actor: admin, action: 'BALANCE_TOPUP_APPROVED', targetType: 'BALANCE_TOPUP', targetId: topup.id, after: { amount: topup.amount, userId: topup.user_id } })
  return c.redirect('/admin/exceptions')
})

app.post('/admin/balance-topups/:id/reject', async (c) => {
  const admin = c.get('user'); if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const result = await c.env.RENT.prepare("UPDATE balance_topups SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'submitted'").bind(c.req.param('id')).run()
  if (!result.meta?.changes) return c.text('充值记录不存在或已处理', 409)
  return c.redirect('/admin/exceptions')
})

app.get('/customer/guest', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType !== 'guest') return c.redirect('/login')
  return c.html(await pages.renderGuestAccount(c, user))
})
app.get('/customer/guest/upgrade', async (c) => {
  const user = c.get('user')
  if (!user || user.accountType !== 'guest') return c.redirect('/login')
  return c.html(await pages.renderGuestAccount(c, user, '', 'error', true))
})

app.post('/customer/guest/upgrade', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType !== 'guest') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const password = String(form.newPassword || '')
  const confirmation = String(form.confirmPassword || '')
  if (!isStrongPassword(password)) return c.html(await pages.renderGuestAccount(c, user, '新密码至少需要 8 位，并同时包含字母、数字和符号。'))
  if (password !== confirmation) return c.html(await pages.renderGuestAccount(c, user, '两次输入的新密码不一致。'))
  await updateUser(c, user.id, { password, accountType: 'formal', guestOrderId: null, guestExpiresAt: null })
  return c.redirect('/customer/dashboard?upgraded=1')
})

app.get('/customer/orders', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role !== 'CUSTOMER') {
    return c.html(renderForbidden(), 403)
  }
  return c.html(await pages.renderCustomerOrders(c, user))
})

app.get('/customer/orders/:id', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role !== 'CUSTOMER') {
    return c.html(renderForbidden(), 403)
  }
  await loadSystemSettingsFromDB(c)
  const message = c.req.query('success') || c.req.query('error')
  return c.html(await pages.renderCustomerOrderDetail(c, user, c.req.param('id'), message, c.req.query('success') ? 'success' : 'error'))
})

app.post('/customer/orders/:id/time-slots', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id')) as any
  if (!order || order.userId !== user.id || !['paid', 'pending_pickup'].includes(String(order.status))) return c.redirect(`/customer/orders/${c.req.param('id')}`)
  const form = await c.req.parseBody()
  const delivery = String(order.deliveryMethod || order.delivery_method || 'Pickup') === 'Delivery'
  const allowed = delivery ? ['delivery_morning', 'delivery_afternoon'] : ['morning_service', 'morning', 'afternoon', 'evening_service']
  const pickup = String(form.pickupTimeSlot || ''), returned = String(form.returnTimeSlot || '')
  if (!allowed.includes(pickup) || !allowed.includes(returned)) return c.redirect(`/customer/orders/${order.id}?error=${encodeURIComponent('预约时段无效')}`)
  const oldFee = Number(order.serviceFee || order.service_fee || 0)
  const rent = Math.max(0, Number(order.totalAmount) - Number(order.depositAmount || 0) - oldFee)
  const chargeable = delivery ? 0 : [pickup, returned].filter(slot => ['morning_service', 'evening_service'].includes(slot)).length
  const requestedFee = Number((rent * 0.1 * chargeable).toFixed(2))
  const additionalFee = Math.max(0, requestedFee - oldFee)
  const newFee = oldFee + additionalFee
  await c.env.RENT.prepare('UPDATE orders SET pickupTimeSlot = ?, returnTimeSlot = ?, serviceFee = ?, totalAmount = totalAmount + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(pickup, returned, newFee, additionalFee, order.id).run()
  await c.env.RENT.prepare('INSERT INTO order_time_change_history (id, order_id, changed_by, previous_pickup_slot, previous_return_slot, pickup_slot, return_slot, additional_service_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(`otc-${nanoid(12)}`, order.id, user.id, order.pickupTimeSlot || null, order.returnTimeSlot || null, pickup, returned, additionalFee).run()
  await c.env.RENT.prepare("INSERT INTO order_change_history (id, order_id, change_type, before_json, after_json, reason, changed_by) VALUES (?, ?, 'PRICE_ADJUSTMENT', ?, ?, ?, ?)").bind(`och-${nanoid(12)}`, order.id, JSON.stringify({ pickupTimeSlot: order.pickupTimeSlot, returnTimeSlot: order.returnTimeSlot, serviceFee: oldFee, totalAmount: order.totalAmount }), JSON.stringify({ pickupTimeSlot: pickup, returnTimeSlot: returned, serviceFee: newFee, totalAmount: Number(order.totalAmount) + additionalFee }), '客户修改取还时段', user.id).run()
  const message = additionalFee > 0 ? `预约时间已更新，新增服务费 ${additionalFee.toFixed(2)} AUD；已收取的服务费不退款。` : '预约时间已更新；已收取的服务费不退款。'
  return c.redirect(`/customer/orders/${order.id}?success=${encodeURIComponent(message)}`)
})

app.post('/customer/orders/:id/early-return', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.userId !== user.id) return c.html(renderForbidden(), 403)
  if (order.status !== 'active') return c.redirect(`/customer/orders/${order.id}?error=${encodeURIComponent('当前订单不能申请提前归还')}`)
  const customer = await getUserById(c, user.id)
  if (order.early_return_requested_at) return c.redirect(`/customer/orders/${order.id}?error=${encodeURIComponent('提前归还申请已提交，请等待工作人员或管理员审批')}`)
  await c.env.RENT.prepare('UPDATE orders SET early_return_requested_at = CURRENT_TIMESTAMP, early_return_requested_by = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = ?').bind(user.id, order.id, 'active').run()
  const admins = (await getUsers(c)).filter((account: any) => account.role === 'ADMIN' && account.status !== 'inactive')
  const recipients = [...(customer?.staffId ? [customer.staffId] : []), ...admins.map((admin: any) => admin.id)].filter((id, index, all) => all.indexOf(id) === index)
  await Promise.all(recipients.map(recipientId => createNotification(c, { recipientId, type: 'early_return_request', title: '客户申请提前归还', message: `${customer?.name || '客户'} 已申请订单 ${order.orderNo || order.id} 提前归还，请审批。`, orderId: order.id })))
  return c.redirect(`/customer/orders/${order.id}?success=${encodeURIComponent('已提交提前归还申请，等待绑定员工或管理员审批')}`)
})

app.post('/staff/orders/:orderId/early-return/approve', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId')) as any
  if (!order || order.status !== 'active' || !order.early_return_requested_at) return c.text('没有待审批的提前归还申请', 409)
  const customer = await getUserById(c, order.userId)
  if (user.role === 'STAFF' && customer?.staffId !== user.id) return c.html(renderForbidden(), 403)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE orders SET early_return_approved_at = CURRENT_TIMESTAMP, early_return_approved_by = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active' AND early_return_requested_at IS NOT NULL").bind(user.id, order.id),
    c.env.RENT.prepare('INSERT INTO rental_status_history (id, rental_id, old_status, new_status, trigger_type, triggered_by, reason) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`rsh-${nanoid(16)}`, order.id, order.rental_status || 'ACTIVE', 'RETURN_PENDING', 'MANUAL', user.id, '提前归还申请已批准')
  ])
  await updateOrderStatus(c, order.id, 'pending_return')
  await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'early_return_approved', title: '提前归还申请已批准', message: `订单 ${order.orderNo || order.id} 的提前归还申请已批准，请按通知安排归还设备。`, orderId: order.id })
  return c.redirect(`/staff/orders/${order.id}`)
})

app.post('/customer/orders/:id/returned', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.userId !== user.id) return c.html(renderForbidden(), 403)
  if (order.status !== 'active') return c.redirect(`/customer/orders/${order.id}?error=${encodeURIComponent('当前订单不能提交已归还通知')}`)
  await updateOrderStatus(c, order.id, 'pending_return')
  const customer = await getUserById(c, user.id)
  const admins = (await getUsers(c)).filter((account: any) => account.role === 'ADMIN' && account.status !== 'inactive')
  await Promise.all(admins.map((admin: any) => createNotification(c, { recipientId: admin.id, type: 'returned_review', title: '客户已归还设备，等待审核', message: `${customer?.name || '客户'} 已提交订单 ${order.orderNo || order.id} 的已归还通知，请审核并安排验机。`, orderId: order.id })))
  return c.redirect(`/customer/orders/${order.id}?success=${encodeURIComponent('已通知管理员，等待审核验机')}`)
})

function notificationPreview(message: unknown, limit = 120): string {
  const plain = String(message || '').replace(/[#*_`>\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim()
  return sanitizePlainText(plain.length > limit ? `${plain.slice(0, limit)}…` : plain, limit + 1)
}

function notificationPlainText(value: unknown): string {
  return sanitizePlainText(String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#>*`_~-]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim(), 10000)
}

app.get('/notifications', async (c) => {
  const user = c.get('user')
  if (!user) return c.redirect('/login')
  await ensureNotificationsTable(c)
  const allNotifications = (await getNotifications(c, user.id)).filter((item: any) => item.type !== 'announcement')
  const pageSize = 10
  const requestedPage = Math.max(1, Number(c.req.query('page') || 1) || 1)
  const pageCount = Math.max(1, Math.ceil(allNotifications.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const pageNotifications = allNotifications.slice((page - 1) * pageSize, page * pageSize)
  const notifications = pageNotifications
  // 通告历史单独放在 /admin/announcements，通知中心只显示收件通知。
  const sentAnnouncements: any[] = []
  const recipients = user.role === 'ADMIN' || user.role === 'STAFF' ? (await getUsers(c)).filter((account: any) => (user.role === 'ADMIN' ? ['CUSTOMER', 'STAFF'].includes(account.role) : account.role === 'CUSTOMER' && account.staffId === user.id) && account.status !== 'inactive') : []
  if (user.role === 'ADMIN' || user.role === 'STAFF') await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  const emailTemplates = user.role === 'ADMIN' || user.role === 'STAFF' ? ((await c.env.RENT.prepare("SELECT id, name FROM email_templates WHERE enabled = 1 ORDER BY name").all()).results || []) as any[] : []
  const emailTemplateOptions = `<option value="custom">自定义通知</option>${emailTemplates.map((item: any) => `<option value="${sanitizePlainText(item.id, 120)}">使用模板：${sanitizePlainText(item.name, 120)}</option>`).join('')}`
  const recipientOptions = recipients.map((account: any) => `<option value="${sanitizePlainText(account.id, 120)}">${sanitizePlainText(account.name || account.email, 120)} · ${sanitizePlainText(account.email, 160)}</option>`).join('')
  const body = `<div class="panel"><div class="section-title"><h2>通知中心</h2><span class="section-note">订单和归还提醒</span></div>${user.role === 'ADMIN' ? `<form method="post" action="/notifications/announcement" class="panel notification-compose"><h3>发布通告</h3><p class="form-text">通告会发送给所有活跃员工和客户，并在他们登录后显示。</p><div class="form-group"><label class="form-label" for="announcementTitle">通告标题</label><input class="form-control" id="announcementTitle" name="title" maxlength="120" required></div><div class="form-group"><label class="form-label" for="announcementMessage">通告内容（支持 Markdown）</label><textarea class="form-control markdown-editor" id="announcementMessage" name="message" maxlength="2000" required></textarea></div><button class="button button-primary" type="submit">发布通告</button></form>` : ''}${user.role === 'ADMIN' || user.role === 'STAFF' ? `<form method="post" action="/notifications/send" class="panel notification-compose"><h3>发送通知</h3><div class="form-group"><label class="form-label" for="notificationRecipient">收件人（可多选）</label><input class="form-control recipient-search" id="notificationRecipientSearch" type="search" placeholder="搜索姓名或邮箱…" autocomplete="off"><div class="recipient-picker-actions"><button type="button" class="button button-sm button-secondary" id="selectVisibleRecipients">全选当前结果</button><button type="button" class="button button-sm button-secondary" id="clearRecipients">清空选择</button><span id="recipientCount" class="section-note">已选 0 人</span></div><select class="form-control recipient-select" id="notificationRecipient" name="recipientId" multiple size="7" required>${recipientOptions}</select><small class="form-text">可搜索后全选当前结果，也可以按住 Command（Mac）或 Ctrl（Windows）逐个选择。</small></div><div class="form-group"><label class="form-label" for="notificationTitle">标题</label><input class="form-control" id="notificationTitle" name="title" maxlength="120" required></div><div class="form-group"><label class="form-label" for="notificationMessage">内容（支持 Markdown）</label><textarea class="form-control markdown-editor" id="notificationMessage" name="message" maxlength="1000" required></textarea></div><button class="button button-primary" type="submit">发送通知</button></form><script>(()=>{const search=document.getElementById('notificationRecipientSearch'),select=document.getElementById('notificationRecipient'),count=document.getElementById('recipientCount');if(!search||!select)return;const update=()=>{const query=search.value.trim().toLowerCase();Array.from(select.options).forEach(option=>{option.hidden=Boolean(query&&!option.textContent.toLowerCase().includes(query));});count.textContent='已选 '+Array.from(select.selectedOptions).length+' 人';};search.addEventListener('input',update);select.addEventListener('change',update);document.getElementById('selectVisibleRecipients')?.addEventListener('click',()=>{Array.from(select.options).forEach(option=>{if(!option.hidden)option.selected=true;});update();});document.getElementById('clearRecipients')?.addEventListener('click',()=>{Array.from(select.options).forEach(option=>option.selected=false);update();});update();})();</script>` : ''}${user.role === 'ADMIN' && sentAnnouncements.length ? `<section class="panel"><h3>已发布通告历史</h3><div class="notification-list">${sentAnnouncements.map((item: any) => `<article class="notification-item"><div><strong>${sanitizePlainText(item.title, 120)}</strong><div class="notification-message">${renderNotificationMarkdown(item.message)}</div><small>${item.created_at}</small></div><form method="post" action="/notifications/announcements/${item.id}/delete" onsubmit="return confirm('确定删除这条通告及其历史记录吗？')"><button class="button button-sm button-danger" type="submit">删除</button></form></article>`).join('')}</div></section>` : ''}${notifications.length ? `<div class="notification-list">${notifications.map((item: any) => `<article class="notification-item ${item.read_at ? '' : 'is-unread'}"><div><strong>${item.title}</strong><div class="notification-message">${renderNotificationMarkdown(item.message)}</div><small>${item.created_at}</small></div>${item.order_id ? `<a class="button button-sm button-secondary" href="${user.role === 'ADMIN' ? `/admin/orders/${item.order_id}` : user.role === 'STAFF' ? `/staff/orders/${item.order_id}` : `/customer/orders/${item.order_id}`}" >查看订单</a>` : ''}</article>`).join('')}</div>` : '<p class="empty-state">暂无通知</p>'}</div>`
  const pagination = pageCount > 1 ? `<nav class="pagination" aria-label="通知分页">${Array.from({ length: pageCount }, (_, index) => `<a class="button button-sm ${index + 1 === page ? 'button-primary' : 'button-secondary'}" href="/notifications?page=${index + 1}">${index + 1}</a>`).join('')}</nav>` : ''
  const bodyWithTemplateChoice = body.replace('<div class="form-group"><label class="form-label" for="notificationTitle">标题</label>', `<div class="form-group"><label class="form-label" for="notificationTemplate">发送内容</label><select class="form-control" id="notificationTemplate" name="templateId">${emailTemplateOptions}</select></div><div class="form-group"><label class="form-label" for="notificationTitle">标题</label>`)
  const bodyWithArchiveLink = user.role === 'ADMIN' ? bodyWithTemplateChoice.replace('<h3>发布通告</h3>', '<div class="section-title"><h3>发布通告</h3><a class="link-button" href="/admin/announcements">历史通告 →</a></div>') : bodyWithTemplateChoice
  return c.html(buildLayout('通知中心', bodyWithArchiveLink + pagination, user))
})

app.get('/admin/notifications', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  await ensureNotificationsTable(c)
  const notifications = (await getNotifications(c, user.id)).filter((item: any) => item.type !== 'announcement')
  const body = `<div class="page-header"><div><p class="section-code">ADMIN INBOX</p><h2>管理员通知中心</h2><p>这里显示充值、退款、付款审核和其他系统业务通知。</p></div><a class="button button-secondary" href="/notifications">发布通知</a></div><section class="panel"><div class="section-title"><h3>业务通知</h3><span class="section-note">共 ${notifications.length} 条</span></div>${notifications.length ? `<div class="admin-notification-cards">${notifications.map((item: any) => `<a class="admin-notification-card ${item.read_at ? '' : 'is-unread'}" href="/notifications/${encodeURIComponent(item.id)}"><span class="admin-notification-card__type">${sanitizePlainText(item.type || 'SYSTEM', 40)}</span><div class="admin-notification-card__content"><strong>${sanitizePlainText(item.title, 200)}</strong><p>${sanitizePlainText(notificationPlainText(item.message), 180)}</p><small>${sanitizePlainText(item.created_at, 80)}</small></div><b aria-hidden="true">→</b></a>`).join('')}</div>` : '<p class="empty-state">暂无业务通知</p>'}</section>`
  return c.html(buildLayout('管理员通知中心', body, user))
})

app.get('/admin/announcements', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  await ensureNotificationsTable(c)
  const result = await c.env.RENT.prepare("SELECT MIN(id) AS id, title, message, created_at, COUNT(*) AS recipient_count FROM notifications WHERE sender_id = ? AND type = 'announcement' AND deleted_at IS NULL GROUP BY title, message, created_at ORDER BY created_at DESC").bind(user.id).all() as any
  const esc = (value: unknown) => sanitizePlainText(value, 500).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const body = `<div class="page-header"><div><p class="section-code">ANNOUNCEMENT ARCHIVE</p><h2>历史公告</h2><p>编辑已发布公告后，所有收件人会同步更新。</p></div><a class="button button-secondary" href="/notifications">返回通知中心</a></div><div class="announcement-archive">${(result.results || []).map((item: any) => `<form class="panel announcement-archive__item" method="post" action="/admin/announcements/${encodeURIComponent(item.id)}"><div class="section-title"><div><h3>${esc(item.title)}</h3><small>${esc(item.created_at)} · 已发送 ${item.recipient_count} 人</small></div></div><label class="form-label">标题</label><input class="form-control" name="title" value="${esc(item.title)}" maxlength="120" required><label class="form-label">内容</label><textarea class="form-control" name="message" rows="5" maxlength="2000" required>${esc(item.message)}</textarea><button class="button button-primary" type="submit">保存公告</button></form>`).join('') || '<p class="empty-state">暂无历史公告</p>'}</div>`
  return c.html(buildLayout('历史公告 - 电脑租赁管理系统', body, user))
})

app.post('/admin/announcements/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const title = String(form.title || '').trim().slice(0, 120)
  const message = String(form.message || '').trim().slice(0, 2000)
  if (!title || !message) return c.text('公告标题和内容不能为空', 400)
  await ensureNotificationsTable(c)
  const source = await c.env.RENT.prepare('SELECT title, message, created_at FROM notifications WHERE id = ? AND sender_id = ? AND type = \'announcement\'').bind(c.req.param('id'), user.id).first() as any
  if (!source) return c.text('公告不存在', 404)
  await c.env.RENT.prepare('UPDATE notifications SET title = ?, message = ? WHERE sender_id = ? AND type = \'announcement\' AND title = ? AND message = ? AND created_at = ?').bind(title, message, user.id, source.title, source.message, source.created_at).run()
  return c.redirect('/admin/announcements')
})

app.get('/admin/email-templates', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(await pages.renderAdminEmailTemplates(c, user))
})

app.post('/admin/email-templates', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const name = String(form.name || '').trim().slice(0, 80)
  const subject = String(form.subject || '').trim().slice(0, 200)
  const body = String(form.body || '').trim().slice(0, 10000)
  if (!name || !subject || !body) return c.text('模板名称、主题和正文不能为空', 400)
  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#f0a35b'").run() } catch (_) { }
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'").run() } catch (_) { }
  const format = 'html'
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(form.theme_color || '')) ? String(form.theme_color) : '#71818d'
  await c.env.RENT.prepare('INSERT INTO email_templates (id, name, subject, body, format, theme_color) VALUES (?, ?, ?, ?, ?, ?)').bind(`custom_${nanoid(12)}`, name, subject, body, format, themeColor).run()
  return c.redirect('/admin/email-templates')
})

app.post('/admin/email-templates/send', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const template = form.templateId && String(form.templateId) !== 'custom'
    ? await c.env.RENT.prepare('SELECT subject, body, theme_color FROM email_templates WHERE id = ? AND enabled = 1').bind(String(form.templateId)).first() as any
    : { subject: String(form.subject || '').trim().slice(0, 200), body: String(form.body || '').trim().slice(0, 20000), theme_color: '#71818d' }
  const to = String(form.to || '').trim().toLowerCase()
  const channel = ['site', 'email', 'both'].includes(String(form.channel)) ? String(form.channel) : 'email'
  const recipientId = String(form.recipientId || '').trim()
  if (!template || !template.subject || !template.body || (['site', 'both'].includes(channel) && !recipientId)) return c.text('请输入通知标题、正文并选择收件人', 400)
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(form)) {
    if (/^[a-z_]+$/.test(key)) vars[key] = String(value || '')
  }
  if (recipientId) {
    const recipient = await getUserById(c, recipientId)
    if (recipient) {
      vars.customer_name = vars.customer_name || String(recipient.name || '')
      vars.customer_email = vars.customer_email || String(recipient.email || '')
      if (!to && ['email', 'both'].includes(channel)) form.to = vars.customer_email
    }
  }
  const mailTo = String(form.to || to).trim().toLowerCase()
  if (['email', 'both'].includes(channel) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailTo)) return c.text('邮件收件邮箱无效', 400)
  const companyDetails = getSystemSettings().companyDetails || {}
  vars.company_name = vars.company_name || String(companyDetails.name || 'PC Rental')
  vars.company_email = vars.company_email || String(companyDetails.email || '')
  const fill = (value: string) => value.replace(/\{([a-z_]+)\}/g, (_: string, key: string) => vars[key] ?? '')
  if (['site', 'both'].includes(channel)) await createNotification(c, { recipientId, senderId: user.id, type: 'manual', title: notificationPlainText(fill(template.subject)), message: fill(template.body) })
  if (['email', 'both'].includes(channel)) {
    const apiKey = (c.env as any).RESEND_API_KEY
    const from = (c.env as any).EMAIL_FROM || getSystemSettings().companyDetails.email
    if (!apiKey || !from) return c.text('尚未配置邮件服务：请设置 RESEND_API_KEY 和 EMAIL_FROM', 503)
    const filledBody = fill(template.body)
    const html = renderEmailNotificationHtml(fill(template.subject), filledBody, vars.company_name, template.theme_color || '#71818d')
    const sent = await sendLoggedEmail(c, { eventType: 'TEMPLATE', recipient: mailTo, key: `template:${String(form.templateId || 'custom')}:${mailTo}:${JSON.stringify(vars)}`, subject: fill(template.subject), text: filledBody, html, templateId: String(form.templateId || '') || undefined })
    if (!sent.ok) return c.text('邮件发送失败或邮件服务尚未配置', 502)
  }
  return c.redirect('/admin/email-templates')
})

app.post('/admin/email-templates/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const subject = String(form.subject || '').trim().slice(0, 200)
  const body = String(form.body || '').trim().slice(0, 10000)
  if (!subject || !body) return c.text('邮件主题和正文不能为空', 400)
  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'").run() } catch (_) { }
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#f0a35b'").run() } catch (_) { }
  const format = 'html'
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(form.theme_color || '')) ? String(form.theme_color) : '#71818d'
  await c.env.RENT.prepare('UPDATE email_templates SET subject = ?, body = ?, format = ?, theme_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(subject, body, format, themeColor, c.req.param('id')).run()
  return c.redirect('/admin/email-templates')
})

app.post('/admin/email-templates/:id/delete', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const id = c.req.param('id')
  if (!id.startsWith('custom_')) return c.text('内置模板不能删除', 400)
  await c.env.RENT.prepare('DELETE FROM email_templates WHERE id = ?').bind(id).run()
  return c.redirect('/admin/email-templates')
})

app.get('/notifications/:id', async (c) => {
  const user = c.get('user')
  if (!user) return c.redirect('/login')
  const item = await c.env.RENT.prepare('SELECT * FROM notifications WHERE id = ? AND recipient_id = ? AND deleted_at IS NULL').bind(c.req.param('id'), user.id).first() as any
  if (!item) return c.html(renderNotFound(), 404)
  await c.env.RENT.prepare('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND recipient_id = ?').bind(item.id, user.id).run()
  const body = `<div class="panel notification-detail"><div class="section-title"><div><p class="section-code">NOTIFICATION DETAIL</p><h2>${sanitizePlainText(item.title, 200)}</h2><small>${sanitizePlainText(item.created_at, 80)}</small></div><a class="button button-secondary" href="/notifications">返回通知中心</a></div><div class="notification-message">${renderNotificationMarkdown(item.message)}</div></div>`
  return c.html(buildLayout('通知详情', body, user))
})

app.get('/notifications/announcements', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ announcements: [] }, 401)
  await ensureNotificationsTable(c)
  const result = await c.env.RENT.prepare("SELECT id, title, message, created_at FROM notifications WHERE recipient_id = ? AND type = 'announcement' AND read_at IS NULL ORDER BY created_at DESC LIMIT 5").bind(user.id).all()
  return c.json({ announcements: (result.results || []).map((item: any) => ({ ...item, message_html: renderFlexibleContent(item.message) })) })
})

app.get('/notifications/unread', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ notifications: [] }, 401)
  await ensureNotificationsTable(c)
  const query = 'SELECT id, type, title, message, order_id, created_at FROM notifications WHERE recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10'
  let result: any
  try {
    result = await c.env.RENT.prepare(query).bind(user.id).all()
  } catch (error: any) {
    if (String(error.message).includes('no such table: notifications')) {
      await ensureNotificationsTable(c)
      result = await c.env.RENT.prepare(query).bind(user.id).all()
    } else {
      throw error
    }
  }
  return c.json({ notifications: (result.results || []).map((item: any) => ({ ...item, message_html: renderFlexibleContent(item.message) })) })
})

app.get('/notifications/recent', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ notifications: [], unreadCount: 0 }, 401)
  const result = await c.env.RENT.prepare("SELECT id, type, title, message, order_id, created_at, read_at FROM notifications WHERE recipient_id = ? AND type != 'announcement' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10").bind(user.id).all() as any
  const unread = await c.env.RENT.prepare("SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND type != 'announcement' AND deleted_at IS NULL AND read_at IS NULL").bind(user.id).first() as any
  return c.json({ notifications: result.results || [], unreadCount: Number(unread?.count || 0) })
})

app.post('/notifications/announcements/:id/dismiss', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ ok: false }, 401)
  await ensureNotificationsTable(c)
  await c.env.RENT.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND type = 'announcement'").bind(c.req.param('id'), user.id).run()
  return c.json({ ok: true })
})

app.post('/notifications/:id/dismiss', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ ok: false }, 401)
  await ensureNotificationsTable(c)
  await c.env.RENT.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND deleted_at IS NULL').bind(c.req.param('id'), user.id).run()
  return c.json({ ok: true })
})

app.post('/notifications/announcements/:id/delete', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  await ensureNotificationsTable(c)
  await c.env.RENT.prepare("UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND type = 'announcement' AND title = (SELECT title FROM notifications WHERE id = ? AND sender_id = ?) AND message = (SELECT message FROM notifications WHERE id = ? AND sender_id = ?) AND created_at = (SELECT created_at FROM notifications WHERE id = ? AND sender_id = ?)").bind(user.id, c.req.param('id'), user.id, c.req.param('id'), user.id, c.req.param('id'), user.id).run()
  return c.redirect('/notifications')
})

app.post('/notifications/announcement', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const title = String(form.title || '').trim().slice(0, 120)
  const message = String(form.message || '').trim().slice(0, 2000)
  if (!title || !message) return c.text('通告标题和内容不能为空', 400)
  const recipients = (await getUsers(c)).filter((account: any) => ['CUSTOMER', 'STAFF'].includes(account.role) && account.status !== 'inactive')
  await Promise.all(recipients.map((recipient: any) => createNotification(c, { recipientId: recipient.id, senderId: user.id, type: 'announcement', title, message })))
  return c.redirect('/notifications')
})

app.post('/notifications/send', async (c) => {
  const user = c.get('user')
  if (!user || !['ADMIN', 'STAFF'].includes(user.role)) return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const rawRecipientIds = form.recipientId ?? form['recipientId[]']
  const recipientIds = (Array.isArray(rawRecipientIds) ? rawRecipientIds : [rawRecipientIds])
    .map((value: unknown) => String(value || '').trim())
    .filter(Boolean)
  const templateId = String(form.templateId || 'custom').trim()
  let title = String(form.title || '').trim().slice(0, 120)
  let message = String(form.message || '').trim().slice(0, 1000)
  if (templateId !== 'custom') {
    const template = await c.env.RENT.prepare('SELECT subject, body FROM email_templates WHERE id = ? AND enabled = 1').bind(templateId).first() as any
    if (!template) return c.text('通知模板不存在或已停用', 400)
    title = String(template.subject || '').trim().slice(0, 120)
    message = String(template.body || '').trim().slice(0, 1000)
  }
  const allowedRecipients = (await getUsers(c)).filter((recipient: any) =>
    recipientIds.includes(recipient.id) &&
    ['CUSTOMER', 'STAFF'].includes(recipient.role) &&
    recipient.status !== 'inactive' &&
    (user.role !== 'STAFF' || (recipient.role === 'CUSTOMER' && recipient.staffId === user.id))
  )
  if (!recipientIds.length || allowedRecipients.length !== new Set(recipientIds).size || !title || !message) return c.text('收件人或通知内容无效', 400)
  await Promise.all(allowedRecipients.map((recipient: any) => createNotification(c, { recipientId: recipient.id, senderId: user.id, type: 'manual', title, message })))
  return c.redirect('/notifications')
})

app.get('/customer/devices', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  return c.html(await pages.renderCustomerDevices(c, user))
})

app.get('/customer/rent/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user))
})

app.post('/customer/rent/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const device = await getDeviceById(c, c.req.param('id'))
  await loadSystemSettingsFromDB(c)
  const rentalRules = getSystemSettings().rentalRules
  const deviceUnavailable = new Set(((await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?').bind(c.req.param('id')).all()).results || []).map((row: any) => row.unavailable_date))
  const form = await c.req.parseBody()
  const startDate = String(form.startDate || '')
  const endDate = String(form.endDate || '')
  const deliveryMethod = String(form.deliveryMethod || 'Pickup') === 'Delivery' ? 'Delivery' : 'Pickup'
  const deliveryAddress = String(form.deliveryAddress || '').trim().slice(0, 1000)
  const rentalNote = String(form.rentalNote || '').trim().slice(0, 500)
  const couponCode = String(form.couponCode || '').trim().toUpperCase().slice(0, 40)
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const rentalPeriod = Math.ceil((end.getTime() - start.getTime()) / 86400000)
  const unavailable = new Set(rentalRules.unavailableDates)
  let blockedDate = ''
  for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) { if (unavailable.has(day.toISOString().slice(0, 10))) { blockedDate = day.toISOString().slice(0, 10); break } }
  if (!blockedDate) for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) { if (deviceUnavailable.has(day.toISOString().slice(0, 10))) { blockedDate = day.toISOString().slice(0, 10); break } }
  if (!device || device.status !== 'available' || !startDate || !endDate || (deliveryMethod === 'Delivery' && !deliveryAddress) || !Number.isFinite(start.getTime()) || start >= end || rentalPeriod < rentalRules.minimumRentalDays || blockedDate || await hasDeviceBookingConflict(c, device?.id || '', startDate, endDate, undefined, rentalRules.bufferDays)) {
    return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '请选择可用设备和正确的租赁日期'))
  }
  const rentAmount = rentalPeriod * device.pricePerDay
  let discountAmount = 0
  let appliedCouponCode: string | null = null
  let couponId: string | null = null
  if (couponCode) {
    const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(couponCode).first() as any
    if (!coupon) return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '优惠码无效、已过期或已达到使用次数上限'), 400)
    const deviceText = [device.name, device.brand, device.model, device.cpu, device.ram, device.storage, device.gpu, device.os, device.description].filter(Boolean).join(' ').toLowerCase()
    const deviceMatches = !coupon.device_id || String(coupon.device_id) === String(device.id)
    const brandMatches = !coupon.brand || String(device.brand || '').trim().toLowerCase() === String(coupon.brand).trim().toLowerCase()
    const configMatches = !coupon.config_keyword || deviceText.includes(String(coupon.config_keyword).trim().toLowerCase())
    if (!deviceMatches || !brandMatches || !configMatches) return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '该优惠码不适用于当前设备'), 400)
    discountAmount = coupon.discount_type === 'percent' ? rentAmount * Number(coupon.discount_value) / 100 : Number(coupon.discount_value)
    discountAmount = Math.min(rentAmount, Math.max(0, Number(discountAmount.toFixed(2))))
    appliedCouponCode = String(coupon.code).toUpperCase()
    couponId = String(coupon.id)
  }
  const orderId = `o-${nanoid(8)}`
  await insertOrder(c, {
    id: orderId, orderNo: null, userId: user.id,
    deviceId: device.id, startDate, endDate, rentalPeriod, status: 'pending_approval',
    paymentMethod: 'bank_transfer', totalAmount: rentAmount + device.depositAmount - discountAmount,
    depositAmount: device.depositAmount, dailyRate: device.pricePerDay, contractId: '', signedAt: null, pickupLocation: deliveryMethod === 'Pickup' ? '到店自取' : deliveryAddress, returnLocation: '到店归还',
    deliveryMethod, deliveryFee: 0, rentalNote, couponCode: appliedCouponCode, discountAmount,
    createdAt: new Date().toISOString()
  } as any)
  if (couponCode) {
    const claimed = await c.env.RENT.prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses)').bind(couponId).run()
    if (!claimed.meta?.changes) {
      await c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run()
      return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '优惠码刚刚达到使用上限，请重新提交订单'), 409)
    }
    const redemptionId = `cr-${nanoid(12)}`
    await c.env.RENT.prepare("INSERT INTO coupon_redemptions (id, coupon_id, coupon_code, customer_id, order_id, discount_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'RESERVED')").bind(redemptionId, couponId, appliedCouponCode, user.id, orderId, discountAmount).run()
    await c.env.RENT.prepare('UPDATE orders SET coupon_id = ?, coupon_snapshot = ? WHERE id = ?').bind(couponId, JSON.stringify({ code: appliedCouponCode, discountAmount }), orderId).run()
    await recordFinancialLedgerEntry(c, { entryType: 'COUPON_DISCOUNT', amount: -discountAmount, customerId: user.id, orderId, sourceType: 'COUPON_REDEMPTION', sourceId: redemptionId, description: `优惠码 ${appliedCouponCode} 折扣`, createdBy: user.id, metadata: { couponId, status: 'RESERVED' } })
  }
  const customer = await getUserById(c, user.id)
  const recipients = customer?.staffId ? [customer.staffId] : (await getUsers(c)).filter((account: any) => account.role === 'ADMIN' && account.status !== 'inactive').map((account: any) => account.id)
  await Promise.all(recipients.map((recipientId: string) => createNotification(c, { recipientId, type: 'rental_application', title: deliveryMethod === 'Delivery' ? '新租赁申请及配送确认' : '新租赁申请待审核', message: `${customer?.name || '客户'} 申请租赁 ${device.name}（${startDate} 至 ${endDate}）${deliveryMethod === 'Delivery' ? `，需要配送至：${deliveryAddress}，运费请确认` : '，客户选择到店自取'}。${rentalNote ? `备注：${rentalNote}` : ''}`, orderId: orderId })))
  return c.redirect(`/customer/orders/${orderId}`)
})

app.post('/customer/orders/:id/windows-password', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.userId !== user.id) return c.text('订单不存在', 404)
  const password = String((await c.req.parseBody()).windowsPassword || '')
  if (!isStrongPassword(password)) return c.redirect(`/customer/orders/${encodeURIComponent(order.id)}?error=Windows密码格式无效`)
  const contract = await getContractByOrderId(c, order.id)
  if (!contract) return c.text('合同不存在', 409)
  await ensureDeviceCommandTables(c.env.RENT)
  const data = typeof contract.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : { ...(contract.contract_data || {}) }
  data.windows_password = password
  await c.env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(data), contract.id).run()
  if (['paid', 'active'].includes(String(order.status))) await c.env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'UPDATE_RENTAL_USER', ?, ?, datetime('now', '+24 hours'))").bind(`cmd-${nanoid(12)}`, order.deviceId, JSON.stringify({ username: data.windows_username || user.name, password }), user.id).run()
  return c.redirect(`/customer/orders/${encodeURIComponent(order.id)}?success=Windows密码已更新`)
})

app.get('/staff/dashboard', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
    return c.html(renderForbidden(), 403)
  }
  const dashboardData = await getStaffDashboardData(c, user.role === 'ADMIN' ? undefined : user.id)
  return c.html(pages.renderStaffDashboard(user, dashboardData))
})

app.get('/staff/profile', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'STAFF') return c.redirect('/login')
  return c.html(buildLayout('编辑个人信息', `<div class="panel"><h2>编辑个人信息</h2><form method="post" action="/staff/profile"><label class="form-label" for="profile-name">姓名</label><input class="form-control" id="profile-name" name="name" value="${sanitizePlainText(user.name, 120)}" required><label class="form-label" for="profile-phone">电话</label><input class="form-control" id="profile-phone" name="phone" value="${sanitizePlainText(user.phone || '', 40)}"><button class="button button-primary" type="submit" style="margin-top:16px">保存</button></form></div>`, user))
})

app.post('/staff/profile', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'STAFF') return c.redirect('/login')
  const form = await c.req.parseBody()
  await updateUser(c, user.id, { name: String(form.name || user.name).trim().slice(0, 120), phone: String(form.phone || '').trim().slice(0, 40) })
  return c.redirect('/staff/profile')
})

app.get('/staff/customers', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  return c.html(await pages.renderStaffCustomers(c, user, c.req.query('searchTerm') || ''))
})

app.get('/staff/customers/new', (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  return c.html(pages.renderStaffCustomerNew(user))
})

app.post('/staff/customers/new', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  const form = await c.req.parseBody()
  const name = combinePersonName(form.firstName, form.lastName)
  const email = String(form.email || '').trim().toLowerCase()
  const password = String(form.password || '')
  if (!String(form.firstName || '').trim() || !String(form.lastName || '').trim() || !email) return c.html(pages.renderStaffCustomerNew(user, '请完整填写名、姓和邮箱'), 400)
  if (!isStrongPassword(password)) return c.html(pages.renderStaffCustomerNew(user, '密码至少需要 8 位，并同时包含字母、数字和符号'), 400)
  if (await findUserByEmail(c, email)) return c.html(pages.renderStaffCustomerNew(user, '该邮箱已被使用'), 409)
  const customer = await insertUser(c, { id: await generateUniqueUserId(c, 'CUSTOMER'), name, email, phone: String(form.phone || '').trim(), password, role: 'CUSTOMER', status: 'active', staffId: user.id, balance: 0, commissionBalance: 0, createdAt: new Date().toISOString() })
  return c.redirect(`/staff/customers/${customer.id}`)
})

app.get('/staff/customers/:id/edit', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  return c.html(await pages.renderStaffCustomerEdit(c, user, c.req.param('id')))
})

app.post('/staff/customers/:id/edit', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  const customerId = c.req.param('id')
  const customer = await getUserById(c, customerId)
  if (!customer || customer.role !== 'CUSTOMER' || (user.role !== 'ADMIN' && customer.staffId !== user.id)) return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const name = combinePersonName(form.firstName, form.lastName)
  if (!String(form.firstName || '').trim() || !String(form.lastName || '').trim()) return c.html(await pages.renderStaffCustomerEdit(c, user, customerId, '请分别填写名和姓'), 400)
  await updateUser(c, customerId, { name, phone: String(form.phone || ''), bsb: String(form.bsb || ''), account: String(form.account || ''), ...(user.role === 'ADMIN' ? { balance: Number(form.balance || 0) } : {}) })
  return c.redirect(`/staff/customers/${customerId}`)
})

app.get('/staff/customers/:id', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  return c.html(await pages.renderStaffCustomerDetail(c, user, c.req.param('id')))
})

app.get('/staff/orders', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  return c.html(await pages.renderStaffOrders(c, user, c.req.query('searchTerm') || ''))
})

app.use('/staff/orders/*', async (c, next) => {
  const user = c.get('user')
  const orderId = c.req.path.split('/')[3]
  if (user?.role === 'STAFF' && orderId && !['pending', 'ongoing'].includes(orderId)) {
    const order = await getOrderById(c, orderId)
    const customer = order ? await getUserById(c, order.userId) : null
    if (!order || customer?.staffId !== user.id) return c.html(renderForbidden(), 403)
  }
  await next()
})

app.get('/staff/orders/pending', async (c) => {
  return c.redirect('/staff/orders/ongoing', 301)
})

app.get('/staff/orders/ongoing', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderStaffOrdersOngoing(c, user))
})

app.get('/staff/orders/:id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  await loadSystemSettingsFromDB(c)
  return c.html(await pages.renderStaffOrderDetail(c, user, c.req.param('id')))
})

// 绑定员工可暂停自己负责客户的租赁；其他员工不能越权操作。
app.post('/staff/orders/:orderId/suspend', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  const customer = order ? await getUserById(c, order.userId) : null
  if (!order || (user.role === 'STAFF' && customer?.staffId !== user.id)) return c.html(renderForbidden(), 403)
  if (!['active', 'extended', 'overdue'].includes(String(order.status)) || !canTransitionOrder(order.status, 'suspended')) return c.text('当前订单状态不能暂停', 409)
  await updateOrderStatus(c, order.id, 'suspended')
  await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'rental_suspended', title: '租赁已暂停', message: `您的订单 ${order.orderNo || order.id} 已由${user.name || '工作人员'}暂停。`, orderId: order.id })
  return c.redirect(`/staff/orders/${order.id}`)
})

// 员工操作 - 已付款订单完成取货后进入租赁中
app.get('/staff/orders/:orderId/handover', async (c) => {
  const user = c.get('user') as any
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  const customer = order ? await getUserById(c, order.userId) : null
  if (!order || !['paid', 'pending_pickup'].includes(String(order.status)) || (user.role === 'STAFF' && customer?.staffId !== user.id)) return c.html(renderForbidden(), 403)
  const device = await getDeviceById(c, order.deviceId)
  const body = `<div class="page-header"><div><p class="section-code">HANDOVER RECORD</p><h2>交付设备</h2><p>确认设备、配件和客户确认后，订单才会进入租赁中。</p></div><a class="button button-secondary" href="/staff/orders/${encodeURIComponent(order.id)}">返回订单</a></div><form class="panel" method="post" action="/staff/orders/${encodeURIComponent(order.id)}/pickup" data-site-confirm="确认交付记录无误并开始租赁？"><div class="grid grid-2"><div><label class="form-label">设备</label><input class="form-control" value="${sanitizePlainText(device?.name || order.deviceId, 160)}" readonly></div><div><label class="form-label" for="deviceSerialNumber">设备序列号</label><input class="form-control" id="deviceSerialNumber" name="deviceSerialNumber" value="${sanitizePlainText(device?.serialNumber || '', 160)}" required></div></div><div class="form-group"><label class="form-label" for="accessories">交付配件</label><textarea class="form-control" id="accessories" name="accessories" maxlength="1000" required placeholder="例如：电源适配器、充电线、电脑包"></textarea></div><div class="form-group"><label class="form-label" for="conditionNotes">设备状态与备注</label><textarea class="form-control" id="conditionNotes" name="conditionNotes" maxlength="2000" required placeholder="例如：外观正常，屏幕无划痕，电池状态正常"></textarea></div><label class="form-check"><input type="checkbox" name="customerConfirmed" value="1" required> 客户已当场确认设备序列号、配件及状态</label><div class="form-group"><label class="form-label" for="customerConfirmationName">客户确认姓名</label><input class="form-control" id="customerConfirmationName" name="customerConfirmationName" maxlength="120" value="${sanitizePlainText(customer?.name || '', 120)}" required></div><button class="button button-primary" type="submit">保存交付记录并开始租赁</button></form>`
  return c.html(buildLayout('交付设备 - 电脑租赁管理系统', body, user))
})

app.post('/staff/orders/:orderId/pickup', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }
  const orderId = c.req.param('orderId')
  const pickupOrder = await getOrderById(c, orderId)
  if (!pickupOrder || !['paid', 'pending_pickup'].includes(String(pickupOrder.status))) return c.json({ success: false, message: '只有待取货订单可以确认交付' }, 409)
  const customer = await getUserById(c, pickupOrder.userId)
  if (user.role === 'STAFF' && customer?.staffId !== user.id) return c.html(renderForbidden(), 403)
  const device = await getDeviceById(c, pickupOrder.deviceId)
  const form = await c.req.parseBody()
  const serialNumber = sanitizePlainText(String(form.deviceSerialNumber || ''), 160).trim()
  const accessories = sanitizePlainText(String(form.accessories || ''), 1000).trim()
  const conditionNotes = sanitizePlainText(String(form.conditionNotes || ''), 2000).trim()
  const confirmationName = sanitizePlainText(String(form.customerConfirmationName || ''), 120).trim()
  const wantsJson = c.req.header('Accept')?.includes('application/json')
  const missing = [!serialNumber && '设备序列号', !accessories && '交付配件', !conditionNotes && '设备状态与备注', form.customerConfirmed !== '1' && '客户核对确认', !confirmationName && '客户确认姓名'].filter(Boolean)
  if (missing.length) return wantsJson ? c.json({ success: false, message: `请填写：${missing.join('、')}` }, 400) : c.text(`请填写：${missing.join('、')}`, 400)
  if (serialNumber !== String(device?.serialNumber || '')) return wantsJson ? c.json({ success: false, message: '设备序列号与订单设备不一致' }, 409) : c.text('设备序列号与订单设备不一致', 409)
  await updateOrderStatus(c, orderId, 'active')
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE orders SET handover_completed_at = CURRENT_TIMESTAMP, handover_by = ?, handover_overdue = 0, possible_handover = 0 WHERE id = ?').bind(user.id, orderId),
    c.env.RENT.prepare('INSERT INTO rental_status_history (id, rental_id, old_status, new_status, trigger_type, triggered_by, reason) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`rsh-${nanoid(16)}`, orderId, pickupOrder.rental_status || 'READY_FOR_PICKUP', 'ACTIVE', 'MANUAL', user.id, '员工确认设备已交付'),
    c.env.RENT.prepare("INSERT INTO order_fulfillment_records (id, order_id, record_type, device_serial_number, accessories_json, condition_snapshot_json, customer_confirmed, customer_confirmation_name, recorded_by) VALUES (?, ?, 'HANDOVER', ?, ?, ?, 1, ?, ?)").bind(`handover-${nanoid(12)}`, orderId, serialNumber, JSON.stringify(accessories.split(/[\n,，]/).map(item => item.trim()).filter(Boolean)), JSON.stringify({ notes: conditionNotes }), confirmationName, user.id),
  ])
  await recordDeviceLifecycle(c, pickupOrder.deviceId, 'RENTED', { orderId, reason: '工作人员确认设备已交付', changedBy: user.id })
  await createAuditLog(c, { actor: user, action: 'HANDOVER_COMPLETED', targetType: 'ORDER', targetId: orderId, before: { status: pickupOrder.status, rentalStatus: pickupOrder.rental_status }, after: { status: 'active', rentalStatus: 'ACTIVE', deviceSerialNumber: serialNumber, customerConfirmed: true }, reason: conditionNotes })
  return wantsJson ? c.json({ success: true, redirect: `/staff/orders/${orderId}` }) : c.redirect(`/staff/orders/${orderId}`)
})

// 新增：员工操作 - 标记订单为已归还
app.post('/staff/orders/:orderId/return', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }
  return c.json({ success: false, message: '请先完成归还验机', inspectionUrl: `/staff/orders/${c.req.param('orderId')}/inspection` }, 409)
})

app.post('/staff/orders/:orderId/approve', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  const customer = order ? await getUserById(c, order.userId) : null
  if (user.role === 'STAFF' && customer?.staffId !== user.id) return c.html(renderForbidden(), 403)
  await loadSystemSettingsFromDB(c)
  if (!order || !canTransitionOrder(order.status, 'approved') || await hasDeviceBookingConflict(c, order.deviceId, order.startDate, order.endDate, order.id, getSystemSettings().rentalRules.bufferDays)) return c.text('订单状态无效或设备档期冲突', 409)
  await updateOrderStatus(c, order.id, 'approved')
  await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'rental_application_approved', title: '租赁申请已审核', message: `您的设备租赁申请已由${user.name || '工作人员'}审核通过${Number((order as any).deliveryFee || 0) > 0 ? `，配送费用为 ${Number((order as any).deliveryFee).toFixed(2)} AUD` : ''}。`, orderId: order.id })
  return c.redirect(`/staff/orders/${c.req.param('orderId')}`)
})

app.post('/staff/orders/:orderId/reject', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  const customer = order ? await getUserById(c, order.userId) : null
  if (user.role === 'STAFF' && customer?.staffId !== user.id) return c.html(renderForbidden(), 403)
  if (order) {
    await updateOrderStatus(c, order.id, 'cancelled')
    await updateDeviceStatus(c, order.deviceId, 'available')
    await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'rental_application_rejected', title: '租赁申请未通过', message: `您的设备租赁申请已由${user.name || '工作人员'}拒绝，请联系工作人员了解详情。`, orderId: order.id })
  }
  return c.redirect(`/staff/orders/${c.req.param('orderId')}`)
})

app.post('/staff/orders/:orderId/mark-paid', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.html(renderForbidden(), 403)
  return c.text('银行转账必须由管理员审核客户提交的 Reference', 409)
})

app.post('/staff/orders/:orderId/complete', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.html(renderForbidden(), 403)
  return c.text('请通过归还验机流程完成订单', 409)
})

app.get('/staff/orders/:orderId/inspection', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (order) {
    await c.env.RENT.prepare('UPDATE devices SET inspection_requested_at = CURRENT_TIMESTAMP WHERE id = ?').bind(order.deviceId).run()
    await recordDeviceLifecycle(c, order.deviceId, 'INSPECTION', { orderId: order.id, reason: '已进入归还验机', changedBy: user.id })
  }
  return c.html(await pages.renderStaffInspection(c, user, c.req.param('orderId')))
})

app.post('/staff/orders/:orderId/inspection', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (!order || !['active', 'pending_return'].includes(order.status)) return c.text('当前订单不能验机', 409)
  const form = await c.req.parseBody()
  const allowedCheck = new Set(['正常', '异常', '未测试'])
  const checks: Record<string, string> = {}
  for (const [input, field] of [['screenCondition', 'screen_condition'], ['keyboardCondition', 'keyboard_condition'], ['trackpadCondition', 'trackpad_condition'], ['bodyCondition', 'body_condition'], ['cameraCondition', 'camera_condition'], ['wifiCondition', 'wifi_condition'], ['powerTest', 'power_test']]) {
    const value = String(form[input] || '')
    if (!allowedCheck.has(value)) return c.text(`${input} 检查结果无效`, 400)
    checks[field] = value
  }
  const replacementCost = Number(form.replacementCost || 0)
  const batteryCycles = form.batteryCycles ? Number(form.batteryCycles) : null
  if (!Number.isFinite(replacementCost) || replacementCost < 0 || (batteryCycles !== null && (!Number.isInteger(batteryCycles) || batteryCycles < 0))) return c.text('费用或电池循环次数无效', 400)
  const damageDescription = String(form.damageDescription || '').trim().slice(0, 2000)
  const now = new Date().toISOString()
  const contract = await c.env.RENT.prepare('SELECT id FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
  if (!contract) return c.text('订单缺少合同', 409)
  const beforeInspection = await c.env.RENT.prepare("SELECT snapshot_json FROM device_inspections WHERE device_id = ? AND inspection_type = 'before_rental' ORDER BY created_at DESC LIMIT 1").bind(order.deviceId).first() as any
  let inspectionSnapshot: Record<string, any> = {}
  try { inspectionSnapshot = JSON.parse(beforeInspection?.snapshot_json || '{}') } catch (_) { }
  let damagePhotos = ''
  if (String(form.damagePhotos || '').trim()) {
    try { damagePhotos = validateHostedImageUrls(form.damagePhotos).join('\n') } catch (error: any) { return c.text(error.message, 400) }
  }
  if (damageDescription && !damagePhotos) return c.text('记录损坏时必须提供至少一张损坏照片链接', 400)
  try {
    await refundUnusedRentalDays(c, user, order, now.slice(0, 10))
  } catch (error: any) {
    return c.text(error.message || '未使用租金退款失败，订单暂未完成', 502)
  }
  Object.assign(inspectionSnapshot, checks, { batteryCycles, batteryHealth: String(form.batteryHealth || '').trim().slice(0, 100), damageDescription, damagePhotos, replacementCost: replacementCost.toFixed(2), returnDate: now.slice(0, 10), inspectionBy: user.name || user.id })
  const inspectionId = `inspection-${nanoid(12)}`
  const returnDevice = await getDeviceById(c, order.deviceId)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE orders SET status = 'completed', order_status = 'COMPLETED', payment_status = COALESCE(payment_status, 'PAID'), rental_status = 'COMPLETED', return_received_at = COALESCE(return_received_at, CURRENT_TIMESTAMP), return_received_by = COALESCE(return_received_by, ?), updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id, order.id),
    c.env.RENT.prepare("INSERT INTO rental_status_history (id, rental_id, old_status, new_status, trigger_type, triggered_by, reason) VALUES (?, ?, ?, 'RETURNED', 'MANUAL', ?, ?), (?, ?, 'RETURNED', 'COMPLETED', 'SYSTEM', ?, ?)").bind(`rsh-${nanoid(16)}`, order.id, order.rental_status || 'RETURN_PENDING', user.id, '工作人员收到设备并开始归还验机', `rsh-${nanoid(16)}`, order.id, user.id, '归还验机完成，订单结算完成'),
    c.env.RENT.prepare('INSERT INTO device_inspections (id, device_id, rental_id, inspection_type, snapshot_json, differences_json) VALUES (?, ?, ?, \'after_return\', ?, ?)').bind(inspectionId, order.deviceId, order.id, JSON.stringify(inspectionSnapshot), JSON.stringify({})),
    c.env.RENT.prepare("INSERT OR IGNORE INTO order_fulfillment_records (id, order_id, record_type, device_serial_number, accessories_json, condition_snapshot_json, notes, recorded_by) VALUES (?, ?, 'RETURN', ?, '[]', ?, ?, ?)").bind(`return-${nanoid(12)}`, order.id, String(returnDevice?.serialNumber || ''), JSON.stringify(inspectionSnapshot), damageDescription || null, user.id),
    ...(damageDescription ? [c.env.RENT.prepare("INSERT INTO damage_cases (id, order_id, device_id, description, photo_urls, estimated_cost_cents, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(`damage-${nanoid(12)}`, order.id, order.deviceId, damageDescription, damagePhotos, Math.round(replacementCost * 100), user.id)] : []),
  ])
  await recordDeviceLifecycle(c, order.deviceId, damageDescription ? 'DAMAGED' : 'RETURNED', { orderId: order.id, reason: damageDescription || '归还验机完成', changedBy: user.id })
  await createAuditLog(c, { actor: user, action: damageDescription ? 'RETURN_INSPECTION_COMPLETED_WITH_DAMAGE' : 'RETURN_INSPECTION_COMPLETED', targetType: 'ORDER', targetId: order.id, before: { status: order.status, rentalStatus: order.rental_status }, after: { status: 'completed', rentalStatus: 'COMPLETED', inspectionId, damageReported: Boolean(damageDescription) }, reason: damageDescription || '归还验机完成' })
  return c.redirect(`/staff/orders/${order.id}`)
})

app.post('/customer/orders/:orderId/inspection-dispute', async (c) => {
  const user = c.get('user') as any
  if (!user || user.role !== 'CUSTOMER') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (!order || order.userId !== user.id) return c.html(renderForbidden(), 403)
  const deduction = await c.env.RENT.prepare("SELECT deduction_amount FROM payment_refunds WHERE order_id = ? AND type = 'deposit' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (Number(deduction?.deduction_amount || 0) <= 0) return c.text('未发生押金扣除，不能提交验机异议', 409)
  const form = await c.req.parseBody()
  const message = sanitizePlainText(String(form.message || ''), 2000).trim()
  if (!message) return c.text('请填写异议内容', 400)
  await c.env.RENT.prepare('INSERT INTO inspection_disputes (id, order_id, customer_id, message) VALUES (?, ?, ?, ?)').bind(`idp-${nanoid(12)}`, order.id, user.id, message).run()
  return c.redirect(`/customer/orders/${order.id}`)
})

app.post('/staff/orders/:orderId/cancel', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (order) {
    await updateOrderStatus(c, order.id, 'cancelled')
    await updateDeviceStatus(c, order.deviceId, 'available')
  }
  return c.redirect(`/staff/orders/${c.req.param('orderId')}`)
})

app.get('/staff/contracts', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  const status = c.req.query('status');
  const searchTerm = c.req.query('searchTerm');
  return c.html(await pages.renderStaffContracts(c, user, status, undefined, undefined, searchTerm))
})

app.get('/staff/rentals/tracking', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  // 获取查询参数中的status和searchTerm
  const status = c.req.query('status')
  const searchTerm = c.req.query('searchTerm')
  return c.html(await pages.renderStaffRentalsTracking(c, user, status, searchTerm))
})

app.get('/staff/devices', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.html(await pages.renderStaffDevices(c, user))
})

app.get('/staff/devices/new', (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.html(pages.renderStaffDeviceNew(user))
})

app.post('/staff/devices/new', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const name = String(form.name || '').trim()
  const model = String(form.model || '').trim()
  const serialNumber = String(form.serialNumber || '').trim()
  const pricePerDay = Number(form.dailyRate)
  const status = String(form.status || 'available') as any
  if (!name || !model || !serialNumber || !Number.isFinite(pricePerDay) || pricePerDay < 0 || !['available', 'rented', 'maintenance', 'retired'].includes(status)) return c.html(pages.renderStaffDeviceNew(user, '请填写完整有效的设备资料'), 400)
  const device = await insertDevice(c, { name, model, serialNumber, pricePerDay, depositAmount: 0, status, description: '' })
  return c.redirect(`/staff/devices/${device.id}`)
})

app.get('/staff/devices/:id/edit', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.html(await pages.renderStaffDeviceEdit(c, user, c.req.param('id')))
})

app.post('/staff/devices/:id/edit', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const pricePerDay = Number(form.dailyRate)
  const status = String(form.status || 'available')
  if (!String(form.name || '').trim() || !String(form.model || '').trim() || !String(form.serialNumber || '').trim() || !Number.isFinite(pricePerDay) || pricePerDay < 0 || !['available', 'rented', 'maintenance', 'retired'].includes(status)) return c.html(await pages.renderStaffDeviceEdit(c, user, c.req.param('id'), '请填写完整有效的设备资料'), 400)
  await updateDevice(c, c.req.param('id'), { name: String(form.name), model: String(form.model), serialNumber: String(form.serialNumber), pricePerDay, status: status as any })
  return c.redirect(`/staff/devices/${c.req.param('id')}`)
})

app.get('/staff/devices/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.html(await pages.renderStaffDeviceDetail(c, user, c.req.param('id')))
})

app.post('/staff/devices/:id/agent-setup', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const randomValue = new Uint32Array(1)
  crypto.getRandomValues(randomValue)
  const code = String(100000 + (randomValue[0] % 900000))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  const hash = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
  await c.env.RENT.prepare(`UPDATE devices SET agent_setup_code_hash = ?, agent_setup_code_expires_at = datetime(CURRENT_TIMESTAMP, '+15 minutes'), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).bind(hash, c.req.param('id')).run()
  return c.redirect(`/staff/devices/${c.req.param('id')}?agentSetupCode=${code}`)
})



app.get('/staff/contracts/new', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderNewContractPage(c, user))
})

app.get('/staff/inspections', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  return c.html(await pages.renderInspectionRecords(c, user))
})

app.get('/staff/inspections/device/:deviceId', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  return c.html(await pages.renderInspectionDevice(c, user, c.req.param('deviceId'), c.req.query('page') || '1'))
})

app.get('/admin/inspections', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.html(await pages.renderInspectionRecords(c, user))
})

app.get('/staff/inspections/:id/edit', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  return c.html(await pages.renderInspectionEdit(c, user, c.req.param('id')))
})

app.post('/staff/inspections/:id/edit', async (c) => {
  const user = c.get('user') as any
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.html(renderForbidden(), 403)
  const record = await c.env.RENT.prepare('SELECT snapshot_json FROM device_inspections WHERE id = ?').bind(c.req.param('id')).first() as any
  if (!record) return c.html(renderNotFound(), 404)
  const form = await c.req.parseBody()
  let snapshot: any = {}
  try { snapshot = JSON.parse(String(record.snapshot_json || '{}')) } catch (_) { }
  const editableFields = ['screen', 'keyboard', 'touchpad', 'body', 'camera', 'wifi', 'power', 'batteryCycles', 'batteryHealth', 'damageDescription', 'inspectionNotes']
  for (const field of editableFields) if (form[field] !== undefined) snapshot[field] = String(form[field] || '').trim().slice(0, 500)
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || JSON.stringify(snapshot).length > 20000) return c.text('验机记录内容无效', 400)
  await c.env.RENT.prepare('UPDATE device_inspections SET snapshot_json = ?, edited_by = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify(snapshot), user.id, c.req.param('id')).run()
  return c.redirect('/staff/inspections')
})

app.post('/staff/contracts/create', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  const form = await c.req.parseBody()
  return actions.handleCreateContractAction(c, user, form)
})

app.get('/staff/contracts/:id/progress', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  const contract = await getContractById(c, c.req.param('id'))
  if (!contract || (user.role !== 'ADMIN' && (contract.createdBy || contract.created_by) !== user.id)) return c.html(renderForbidden(), 403)
  if (contract.status !== 'pending_sign' || isContractExpired(contract)) return c.redirect('/staff/contracts')
  return c.html(await pages.renderStaffContractProgress(c, user, contract.id))
})

app.get('/staff/contracts/:id/data', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  const contract = await getContractById(c, c.req.param('id'))
  if (!contract || (user.role !== 'ADMIN' && (contract.createdBy || contract.created_by) !== user.id)) return c.html(renderForbidden(), 403)
  if (isContractExpired(contract) || ['completed', 'cancelled'].includes(contract.status)) return c.html(renderForbidden(), 403)
  return c.html(await pages.renderAdminContractData(c, user, contract.id))
})

app.post('/staff/contracts/:id/data', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.redirect('/login')
  const contract = await getContractById(c, c.req.param('id'))
  if (!contract || (user.role !== 'ADMIN' && (contract.createdBy || contract.created_by) !== user.id)) return c.html(renderForbidden(), 403)
  if (isContractExpired(contract) || ['completed', 'cancelled'].includes(contract.status)) return c.html(renderForbidden(), 403)
  const form = parseFormBody(await c.req.text())
  const allowed = new Set(CONTRACT_OPERATIONAL_FIELDS.map(([name]) => name))
  const existing = typeof contract.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : (contract.contract_data || {})
  // 已签署字段直接忽略，不报错；签署记录始终保持原值。
  const submitted = Object.entries(form).filter(([name]) => allowed.has(name as any) && !(contract.status === 'signed' && CONTRACT_SIGNED_FIELDS.has(name))).map(([name, value]) => [name, String(value).trim().slice(0, 4000)])
  const submittedData = Object.fromEntries(submitted)
  if (submittedData.damage_photos) {
    try { submittedData.damage_photos = validateHostedImageUrls(submittedData.damage_photos).join('\n') } catch (error: any) { return c.text(error.message, 400) }
  }
  await c.env.RENT.prepare('UPDATE contracts SET contract_data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify({ ...existing, ...submittedData }), contract.id).run()
  return c.redirect(`/staff/contracts/${contract.id}/data`)
})

app.post('/staff/contract/:id/cancel', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return actions.handleCancelContractAction(c)
})

app.get('/staff/contract/view', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderStaffContractView(c, user, c.req.query('orderId') || ''))
})

app.get('/contract/sign', async (c) => {
  const token = c.req.query('token') || c.req.query('number') || '';
  const step = Number(c.req.query('step') || '1');
  const error = c.req.query('error');
  return c.html(await pages.renderContractSignPage(c, token, step, error));
});

app.get('/api/coupons/rental-preview', async (c) => {
  const deviceId = String(c.req.query('deviceId') || '').trim()
  const days = Number(c.req.query('days') || 0)
  const code = String(c.req.query('code') || '').trim().toUpperCase().slice(0, 40)
  if (!deviceId || !code || !Number.isInteger(days) || days < 1 || days > 365) return c.json({ ok: false, message: '请先选择有效租期并输入优惠码' }, 400)
  const device = await getDeviceById(c, deviceId) as any
  if (!device) return c.json({ ok: false, message: '设备不存在' }, 404)
  const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(code).first() as any
  if (!coupon) return c.json({ ok: false, message: '优惠码无效、已过期或已达到使用次数上限' })
  const deviceText = `${device.name || ''} ${device.brand || ''} ${device.model || ''}`.toLowerCase()
  if ((coupon.device_id && String(coupon.device_id) !== String(device.id)) || (coupon.brand && String(device.brand || '').trim().toLowerCase() !== String(coupon.brand).trim().toLowerCase()) || (coupon.config_keyword && !deviceText.includes(String(coupon.config_keyword).trim().toLowerCase()))) return c.json({ ok: false, message: '该优惠码不适用于当前设备' })
  const rent = Number((days * Number(device.pricePerDay || device.dailyRate || 0)).toFixed(2))
  const discount = Math.min(rent, Math.max(0, Number((coupon.discount_type === 'percent' ? rent * Number(coupon.discount_value) / 100 : coupon.discount_value).toFixed(2))))
  const deposit = Number(device.depositAmount || 0)
  return c.json({ ok: true, rent, discount, deposit, total: Number((rent + deposit - discount).toFixed(2)), message: `已优惠 AUD$${discount.toFixed(2)}` })
})

app.get('/api/contract-sign/coupon-preview', async (c) => {
  const token = c.req.query('token') || c.req.query('number') || ''
  const code = String(c.req.query('code') || '').trim().toUpperCase().slice(0, 40)
  if (!token || !code) return c.json({ ok: true, discount: 0, total: null, message: '' })
  const contract = await getContractBySignToken(c, token) as any
  if (!contract) return c.json({ ok: false, message: '合同链接无效或已过期' }, 404)
  const order = await getOrderById(c, contract.rentalId || contract.rental_id) as any
  if (!order) return c.json({ ok: false, message: '订单不存在' }, 404)
  const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(code).first() as any
  if (!coupon) return c.json({ ok: false, message: '优惠码无效、已过期或已达到使用次数上限' })
  const device = await getDeviceById(c, order.deviceId || order.device_id) as any
  const deviceText = `${device?.name || ''} ${device?.brand || ''} ${device?.model || ''}`.toLowerCase()
  if ((coupon.device_id && String(coupon.device_id) !== String(device?.id)) || (coupon.brand && String(device?.brand || '').trim().toLowerCase() !== String(coupon.brand).trim().toLowerCase()) || (coupon.config_keyword && !deviceText.includes(String(coupon.config_keyword).trim().toLowerCase()))) return c.json({ ok: false, message: '该优惠码不适用于当前设备' })
  const deposit = Number(order.depositAmount || order.deposit_amount || 0)
  const delivery = Number(order.deliveryFee || order.delivery_fee || 0)
  const base = Number(order.totalAmount || order.total_amount || 0)
  const rentAmount = Math.max(0, base - deposit - delivery)
  const discount = Math.min(rentAmount, Math.max(0, Number((coupon.discount_type === 'percent' ? rentAmount * Number(coupon.discount_value) / 100 : coupon.discount_value).toFixed(2))))
  return c.json({ ok: true, discount, total: Number((base - discount).toFixed(2)), message: `已优惠 AUD$${discount.toFixed(2)}` })
})

app.post('/contract/sign', async (c) => {
  const token = c.req.query('token') || c.req.query('number') || '';
  const step = Number(c.req.query('step') || '1');
  const form = await c.req.parseBody();
  return actions.handleSignContractStep(c, token, step, form);
});

app.post('/admin/contracts/template', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') {
    return c.json({ success: false, error: '无权限保存合同模板' }, 403)
  }

  try {
    const contentType = c.req.header('content-type') || ''
    const payload = contentType.includes('application/json')
      ? JSON.parse(await c.req.text() || '{}')
      : await c.req.parseBody()
    const updatedTemplate = await updateContractTemplate(c, {
      id: payload.id || 'default',
      name: payload.name || '标准租赁合同模板',
      content: payload.content || '',
    })
    const metadata = getSystemSettings().legalMetadata || {}
    const lastUpdatedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.lastUpdatedDate || '')) ? String(payload.lastUpdatedDate) : new Date().toISOString().slice(0, 10)
    await updateSystemSettings(c, { legalMetadata: { ...metadata, contract: { version: String(payload.version || '1.0').trim().slice(0, 30) || '1.0', lastUpdatedDate } } } as any)
    return contentType.includes('application/json') ? c.json({ success: true, template: updatedTemplate }) : c.redirect('/admin/templates/contract')
  } catch (error: any) {
    console.error('Failed to save contract template:', error?.stack || error)
    return c.json({ success: false, error: error?.message || '合同模板保存失败' }, 500)
  }
});

app.get('/contract/view/:id', async (c) => {
  const user = c.get('user') as any
  if (user && c.req.query('from') !== 'order') {
    const contract = await getContractById(c, c.req.param('id'))
    const order = contract ? await getOrderById(c, contract.rentalId) : null
    if (order && (user.role === 'ADMIN' || user.role === 'STAFF' || order.userId === user.id)) {
      const orderPath = user.role === 'ADMIN' ? `/admin/orders/${order.id}` : user.role === 'STAFF' ? `/staff/orders/${order.id}` : `/customer/orders/${order.id}`
      return c.redirect(orderPath)
    }
  }
  return c.html(await pages.renderContractView(c, c.req.param('id'), c.get('user')))
})

app.get('/contract/print/:id', async (c) => {
  const user = c.get('user') as any
  if (!user) return c.redirect(`/login?redirect=${encodeURIComponent(`/contract/print/${c.req.param('id')}`)}`)
  return c.html(await pages.renderContractView(c, c.req.param('id'), user, true))
})

app.get('/payment/result', async (c) => {
  const orderId = c.req.query('orderId') || ''
  const cancelled = c.req.query('cancelled') === '1'
  const user = c.get('user') as any
  if (user?.accountType === 'guest' && orderId !== user.guestOrderId) return c.html(renderForbidden(), 403)
  return c.html(await pages.renderPaymentResult(c, orderId, user, cancelled))
})

app.get('/orders/:id/invoice', async (c) => {
  const user = c.get('user')
  if (!user) return c.redirect('/login')
  return c.html(await pages.renderInvoice(c, user, c.req.param('id')))
})

app.get('/orders/:id/invoice/print', async (c) => {
  const user = c.get('user')
  if (!user) return c.redirect(`/login?redirect=${encodeURIComponent(`/orders/${c.req.param('id')}/invoice/print`)}`)
  return c.html(await pages.renderInvoice(c, user, c.req.param('id'), true))
})

app.post('/customer/orders/:id/stripe/checkout', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.html(renderForbidden(), 403)
  try {
    return await createStripeCheckout(c, user, c.req.param('id'))
  } catch (error: any) {
    return c.text(error.message || '无法创建 Stripe 支付', 502)
  }
})

app.post('/customer/orders/:id/bank-transfer-proof', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.userId !== user.id || order.status !== 'pending_payment' || !['bank_transfer', 'alipay', 'wechat'].includes(String(order.paymentMethod))) return c.text('订单不能提交付款凭证', 409)
  const form = await c.req.parseBody()
  const reference = String(form.referenceNumber || '').trim().slice(0, 100)
  const note = String(form.note || '').trim().slice(0, 500)
  let proofImageUrl = ''
  try { proofImageUrl = validateHostedImageUrls(form.imageUrl, 1)[0] } catch (error: any) { return c.text(error.message, 400) }
  if (!reference) return c.text('请填写付款 Reference', 400)
  const payment = await c.env.RENT.prepare("SELECT id FROM payments WHERE rental_id = ? AND payment_method = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(order.id, order.paymentMethod).first() as any
  if (!payment) return c.text('未找到待审核的转账付款记录', 409)
  await c.env.RENT.prepare("UPDATE payment_proofs SET status = 'superseded' WHERE payment_id = ? AND status = 'submitted'").bind(payment.id).run()
  await c.env.RENT.prepare("INSERT INTO payment_proofs (id, payment_id, reference_number, note, image_url, status) VALUES (?, ?, ?, ?, ?, 'submitted')").bind(`proof-${nanoid(12)}`, payment.id, reference, note || null, proofImageUrl).run()
  const admins = (await c.env.RENT.prepare("SELECT id FROM users WHERE role = 'ADMIN' AND status = 'active'").all()).results || []
  await Promise.all((admins as any[]).map(admin => createNotification(c, { recipientId: admin.id, type: 'payment_review_submitted', title: '新的付款凭证待审核', message: `客户已提交订单 ${order.orderNo || order.id} 的${order.paymentMethod === 'bank_transfer' ? '银行转账' : order.paymentMethod === 'alipay' ? '支付宝' : '微信'}付款凭证，请及时审核。`, orderId: order.id })))
  return c.redirect(`/customer/orders/${order.id}`)
})

app.post('/webhooks/stripe', async (c) => {
  try {
    return await handleStripeWebhook(c)
  } catch (error: any) {
    // Stripe retries non-2xx events. Keep the endpoint healthy when a
    // post-processing/database error occurs; the event is logged for repair.
    console.error('Stripe webhook processing failed:', error?.message || error)
    return c.json({ received: true, accepted: true }, 200)
  }
})

app.get('/customer/rentals', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerRentals(c, user))
})

app.get('/customer/profile', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerProfile(c, user))
})

app.post('/customer/profile', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  const form = await c.req.parseBody()
  const name = form.name?.trim() || user.name
  const countryCode = form.countryCode?.toString() ?? '+61'
  const localPhone = form.phone?.toString().trim() ?? ''
  const phone = localPhone ? `${countryCode}${localPhone}` : ''
  const bsb = form.bsb?.trim() || user.bsb || ''
  const account = form.account?.trim() || user.account || ''

  const dataToUpdate: any = {
    name,
    phone,
    bsb,
    account
  }

  const updatedUser = await updateUser(c, user.id, dataToUpdate)

  return c.html(await pages.renderCustomerProfile(c, updatedUser, '个人信息已更新', 'success'))
})

app.post('/customer/profile/delete-account', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const form = await c.req.parseBody()
  if (form.confirmDelete !== 'on') return c.html(await pages.renderCustomerProfile(c, user, '请先确认永久删除账户及余额清零事项。', 'error'), 400)
  for (const column of ['deletion_requested_at', 'deletion_scheduled_at']) {
    try { await c.env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run() } catch (_) { }
  }
  const requestedAt = new Date()
  const scheduledAt = new Date(requestedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  await c.env.RENT.prepare("UPDATE users SET deletion_requested_at = ?, deletion_scheduled_at = ? WHERE id = ? AND role = 'CUSTOMER' AND status = 'active'").bind(requestedAt.toISOString(), scheduledAt.toISOString(), user.id).run()
  await deleteAuthSession(c, c.req.header('cookie') ?? null)
  const response = c.redirect('/login?deletion_requested=1')
  response.headers.set('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return response
})

app.get('/customer/referral', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerReferral(c, user))
})

app.get('/customer/referral/withdraw', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerReferral(c, user))
})



app.post('/customer/referral/withdraw', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }

  const form = await c.req.parseBody()
  const amount = Number(form.amount)
  const withdrawMethod = (form.withdrawMethod as string | undefined)?.trim() === 'bank_transfer' ? 'bank_transfer' : 'balance'

  if (!Number.isFinite(amount) || amount <= 0) {
    return c.html(await pages.renderCustomerReferral(c, user, '请输入正确的提现金额，金额必须大于 0'))
  }

  if (withdrawMethod === 'bank_transfer' && (!Number.isInteger(amount) || amount < 100)) {
    return c.html(await pages.renderCustomerReferral(c, user, '银行转账提现金额必须大于 100 且为整数'))
  }

  const result = await createWithdrawalRequest(c, user.id, amount, withdrawMethod, {
    bsb: form.bsb?.toString(),
    accountNumber: (form.account_number || form.account || form.accountNumber)?.toString(),
    accountName: (form.account_name || form.accountName)?.toString(),
  })

  return c.html(await pages.renderCustomerReferral(c, user, result.message, result.success ? 'success' : 'error'))
})

app.post('/customer/referral/join', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }

  const currentUser = await getUserById(c, user.id)
  if (!currentUser) return c.redirect('/login')
  if (currentUser.referralCode) {
    return c.html(await pages.renderCustomerReferral(c, currentUser, '您已加入推荐计划，无需重复加入', 'info'))
  }

  const newReferralCode = await generateReferralCode()
  const result = await c.env.RENT.prepare("UPDATE users SET referral_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (referral_code IS NULL OR referral_code = '')")
    .bind(newReferralCode, user.id).run()
  const updatedUser = await getUserById(c, user.id)
  const joinedNow = Number(result.meta?.changes || 0) > 0

  return c.html(await pages.renderCustomerReferral(c, updatedUser || currentUser, joinedNow ? '恭喜您成功加入推荐计划！您的推荐码已生成。' : '您已加入推荐计划，无需重复加入', joinedNow ? 'success' : 'info'))
})

app.post('/customer/referral/leave', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }

  if (!user.referralCode) {
    return c.html(await pages.renderCustomerReferral(c, user, '您还未加入推荐计划', 'info'))
  }

  const updatedUser = await updateUser(c, user.id, { referralCode: null })

  return c.html(await pages.renderCustomerReferral(c, updatedUser || user, '您已成功退出推荐计划，推荐码已失效。', 'success'))
})

app.get('/customer/security', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, account TEXT NOT NULL, ip_address TEXT NOT NULL, user_agent TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()
  const records = (await c.env.RENT.prepare('SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').bind(user.id).all()).results as any[]
  return c.html(await pages.renderCustomerSecurity(c, user, undefined, undefined, records))
})

app.post('/customer/security', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  const currentPassword = form.currentPassword?.trim()
  const newPassword = form.newPassword?.trim()
  const confirmPassword = (form.confirmPassword || form.confirmNewPassword)?.trim()
  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.html(await pages.renderCustomerSecurity(c, user, '请输入完整密码信息'))
  }

  const verifiedUser = await verifyUserCredentials(c, user.email, currentPassword)
  if (!verifiedUser || verifiedUser.id !== user.id) {
    return c.html(await pages.renderCustomerSecurity(c, user, '当前密码不正确'))
  }
  if (newPassword !== confirmPassword) {
    return c.html(await pages.renderCustomerSecurity(c, user, '两次输入的新密码不一致'))
  }
  if (!isStrongPassword(newPassword)) return c.html(await pages.renderCustomerSecurity(c, user, '新密码至少需要 8 位，并同时包含字母、数字和符号'))
  await updateUser(c, user.id, { password: newPassword })
  await c.env.RENT.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id).run()
  const session = await createAuthSession(c, user.id)
  const response = c.html(await pages.renderCustomerSecurity(c, user, '密码已更新，其他设备已退出登录', 'success'))
  response.headers.set('Set-Cookie', `session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${new URL(c.req.url).protocol === 'https:' ? '; Secure' : ''}`)
  return response
})

app.get('/admin/dashboard', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const { getOrdersAsync, getDevicesAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  const users = await getUsers(c)
  const devices = await getDevicesAsync(c)
  return c.html(pages.renderAdminDashboard(user, orders, users, devices))
})

app.get('/admin/exceptions', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const [topups, proofs, overdueOrders, offlineDevices, heldDeposits, damageCases] = await Promise.all([
    c.env.RENT.prepare("SELECT bt.id, bt.user_id, bt.amount, bt.payment_method, bt.reference, bt.note, u.name AS user_name FROM balance_topups bt LEFT JOIN users u ON u.id = bt.user_id WHERE bt.status = 'submitted' ORDER BY bt.updated_at ASC LIMIT 50").all(),
    c.env.RENT.prepare("SELECT pp.id, pp.payment_id, p.rental_id, pp.reference_number, pp.uploaded_at, o.orderNo FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id LEFT JOIN orders o ON o.id = p.rental_id WHERE pp.status = 'submitted' ORDER BY pp.uploaded_at ASC LIMIT 50").all(),
    c.env.RENT.prepare("SELECT id, orderNo, endDate FROM orders WHERE status IN ('active', 'extended', 'overdue', 'pending_return') AND endDate < ? ORDER BY endDate ASC LIMIT 50").bind(new Date().toISOString().slice(0, 10)).all(),
    c.env.RENT.prepare("SELECT id, name, agent_status FROM devices WHERE agent_token_hash IS NOT NULL AND agent_status = 'offline' ORDER BY updatedAt ASC LIMIT 50").all(),
    c.env.RENT.prepare("SELECT id, orderNo, depositAmount FROM orders WHERE deposit_status = 'HELD' AND status IN ('returned', 'completed') ORDER BY updatedAt ASC LIMIT 50").all(),
    c.env.RENT.prepare("SELECT id, order_id, description FROM damage_cases WHERE status IN ('OPEN', 'PENDING', 'UNDER_REVIEW') ORDER BY created_at ASC LIMIT 50").all(),
  ]) as any[]
  const sections = [
    ['待审核充值', topups.results, '/admin/exceptions', (item: any) => `<strong>${sanitizePlainText(item.user_name || item.user_id, 100)}</strong> · ${sanitizePlainText(item.payment_method, 30)} · AUD$${Number(item.amount).toFixed(2)}<div class="record-actions"><form method="post" action="/admin/balance-topups/${encodeURIComponent(item.id)}/approve" data-site-confirm="确认通过这笔充值并立即入账吗？"><button class="button button-sm button-primary">通过并入账</button></form><form method="post" action="/admin/balance-topups/${encodeURIComponent(item.id)}/reject" data-site-confirm="确认驳回这笔充值吗？"><button class="button button-sm button-danger">驳回</button></form></div>`],
    ['待审核付款凭证', proofs.results, '/admin/exceptions', (item: any) => `<strong>订单 ${sanitizePlainText(item.orderNo || item.rental_id, 50)}</strong> · ${sanitizePlainText(item.reference_number || '无 Reference', 100)}<div class="record-actions"><form method="post" action="/admin/orders/${encodeURIComponent(item.rental_id)}/transfer-proof/approve" data-site-confirm="确认付款凭证无误并通过吗？"><button class="button button-sm button-primary">审核通过</button></form><form method="post" action="/admin/orders/${encodeURIComponent(item.rental_id)}/transfer-proof/reject"><input class="form-control" name="reason" maxlength="300" required placeholder="驳回原因"><button class="button button-sm button-danger">驳回</button></form></div>`],
    ['逾期或待归还订单', overdueOrders.results, '/admin/orders', (item: any) => `${item.orderNo || item.id} · 应归还 ${item.endDate}`],
    ['离线设备', offlineDevices.results, '/admin/devices', (item: any) => `${item.name} · 设备端离线`],
    ['待结算押金', heldDeposits.results, '/admin/refunds', (item: any) => `${item.orderNo || item.id} · AUD$${Number(item.depositAmount).toFixed(2)}`],
    ['待审核损坏记录', damageCases.results, '/admin/inspections', (item: any) => `订单 ${item.order_id} · ${item.description || '待补充损坏说明'}`],
  ] as const
  const body = `<div class="page-header"><div><p class="section-code">EXCEPTION QUEUE</p><h2>异常任务中心</h2><p>按最早发生时间处理付款、归还、设备和押金异常；所有充值与转账审核均在此完成。</p></div></div><div class="stats-grid">${sections.map(([name, items]) => `<div class="stat-card ${items.length ? 'warning' : ''}"><h3>${name}</h3><div class="value">${items.length}</div></div>`).join('')}</div>${sections.map(([name, items, href, label]) => `<section class="panel" style="margin-top:20px"><div class="section-title"><h3>${name}</h3>${href !== '/admin/exceptions' ? `<a class="button button-sm button-secondary" href="${href}">前往处理</a>` : ''}</div>${items.length ? `<ul class="notification-list">${items.map(item => `<li>${label(item)}</li>`).join('')}</ul>` : '<p class="empty-state">暂无待处理事项。</p>'}</section>`).join('')}`
  return c.html(buildLayout('异常任务中心', body, admin))
})

app.get('/manager/staff', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!manager || getAccessLevel(manager) !== 'MANAGER') return c.redirect('/login')
  const staff = (await getUsers(c)).filter(account => getAccessLevel(account) === 'STAFF')
  const rows = staff.map(account => `<tr><td>${sanitizePlainText(account.name, 100)}</td><td>${sanitizePlainText(account.email, 254)}</td><td>${sanitizePlainText(account.accountStatus || account.status, 30)}</td><td><a class="link-button" href="/manager/staff/${encodeURIComponent(account.id)}/edit">编辑</a></td></tr>`).join('') || '<tr><td colspan="4">暂无 Staff 员工</td></tr>'
  return c.html(buildLayout('Staff 管理', `<div class="panel"><div class="section-title"><div><h2>Staff 管理</h2><p>Manager 只能管理 Staff 员工资料与账户状态。</p></div></div><table><thead><tr><th>姓名</th><th>邮箱</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, manager))
})

app.get('/manager/email-events', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || !['MANAGER', 'ADMIN'].includes(getAccessLevel(user))) return c.html(renderForbidden(), 403)
  const { results = [] } = await c.env.RENT.prepare('SELECT id, event_type, recipient, status, retry_count, max_attempts, error_message, sent_at, created_at FROM email_events ORDER BY created_at DESC LIMIT 100').all() as any
  const rows = results.map((event: any) => `<tr><td>${sanitizePlainText(event.event_type, 40)}</td><td>${sanitizePlainText(event.recipient, 254)}</td><td>${sanitizePlainText(event.status, 20)}</td><td>${event.retry_count}/${event.max_attempts}</td><td>${sanitizePlainText(event.error_message || '—', 200)}</td><td>${sanitizePlainText(event.sent_at || event.created_at, 40)}</td><td>${event.status !== 'SENT' && Number(event.retry_count) < Number(event.max_attempts) ? `<form method="post" action="/manager/email-events/${encodeURIComponent(event.id)}/retry" data-site-confirm="确认重新发送该邮件吗？"><button class="button button-sm button-primary">重新发送</button></form>` : '—'}</td></tr>`).join('') || '<tr><td colspan="7">暂无邮件事件</td></tr>'
  return c.html(buildLayout('邮件发送记录', `<div class="panel"><div class="section-title"><div><h2>邮件发送记录</h2><p>失败邮件可在最大重试次数内由 Manager 或 Admin 手动重发。</p></div></div><div class="table-wrapper"><table><thead><tr><th>事件</th><th>收件人</th><th>状态</th><th>尝试</th><th>失败原因</th><th>时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>`, user))
})

app.post('/manager/email-events/:id/retry', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || !['MANAGER', 'ADMIN'].includes(getAccessLevel(user))) return c.html(renderForbidden(), 403)
  const event = await c.env.RENT.prepare("SELECT * FROM email_events WHERE id = ? AND status <> 'SENT' AND retry_count < max_attempts").bind(c.req.param('id')).first() as any
  if (!event) return c.text('邮件事件不存在、已发送或已超过最大重试次数', 409)
  const apiKey = String((c.env as any).RESEND_API_KEY || '').trim(); const from = String((c.env as any).EMAIL_FROM || getSystemSettings().companyDetails.email || '').trim()
  if (!apiKey || !from) return c.text('邮件服务尚未配置', 503)
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [event.recipient], subject: event.subject, text: event.text_body, html: event.html_body || undefined }) })
  const result = await response.json().catch(() => ({})) as any
  await c.env.RENT.prepare("UPDATE email_events SET status = ?, provider_message_id = ?, error_message = ?, retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP, sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE id = ?").bind(response.ok ? 'SENT' : 'FAILED', result.id || null, response.ok ? null : String(result.message || response.status), response.ok ? 1 : 0, event.id).run()
  await createAuditLog(c, { actor: user, action: 'EMAIL_EVENT_RETRIED', targetType: 'EMAIL_EVENT', targetId: event.id, after: { status: response.ok ? 'SENT' : 'FAILED' } })
  return c.redirect('/manager/email-events', 303)
})

app.get('/manager/staff/:id/edit', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  const target = await getUserById(c, c.req.param('id'))
  if (!manager || getAccessLevel(manager) !== 'MANAGER' || !target || getAccessLevel(target) !== 'STAFF') return c.html(renderForbidden(), 403)
  return c.html(buildLayout('编辑 Staff', `<div class="panel"><h2>编辑 Staff</h2><form method="post" action="/manager/staff/${encodeURIComponent(target.id)}/edit"><label class="form-label">姓名</label><input class="form-control" name="name" value="${sanitizePlainText(target.name, 100)}" required maxlength="100"><label class="form-label">电话</label><input class="form-control" name="phone" value="${sanitizePlainText(target.phone, 40)}" maxlength="40"><label class="form-label">账户状态</label><select class="form-control" name="accountStatus"><option value="active" ${target.status === 'active' ? 'selected' : ''}>正常</option><option value="inactive" ${target.status !== 'active' ? 'selected' : ''}>停用</option></select><div class="record-actions"><button class="button button-primary">保存</button><a class="button button-secondary" href="/manager/staff">取消</a></div></form></div>`, manager))
})

app.post('/manager/staff/:id/edit', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  const target = await getUserById(c, c.req.param('id'))
  if (!manager || getAccessLevel(manager) !== 'MANAGER' || !target || getAccessLevel(target) !== 'STAFF') return c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const accountStatus = String(form.accountStatus || 'active')
  if (!['active', 'inactive'].includes(accountStatus) || !String(form.name || '').trim()) return c.redirect(`/manager/staff/${encodeURIComponent(target.id)}/edit`)
  await updateUser(c, target.id, { name: String(form.name), phone: String(form.phone || ''), accountStatus, status: accountStatus })
  return c.redirect('/manager/staff')
})

app.get('/admin/calendar', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(await pages.renderAdminDeviceCalendar(c, user))
})

app.get('/admin/users', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const html = await pages.renderAdminUsers(user, c)
  return c.html(html)
})

app.get('/admin/users/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminUserNew(user))
})

app.post('/admin/users/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const form = await c.req.parseBody()
  const name = combinePersonName(form.firstName, form.lastName)
  const email = String(form.email || '').trim().toLowerCase()
  const password = String(form.password || '')
  const role = String(form.role || 'CUSTOMER')
  const status = String(form.status || 'active')
  if (!String(form.firstName || '').trim() || !String(form.lastName || '').trim() || !email || !isStrongPassword(password) || !['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'].includes(role) || !['active', 'inactive'].includes(status)) return c.html(pages.renderAdminUserNew(user), 400)
  if (await findUserByEmail(c, email)) return c.html(pages.renderAdminUserNew(user), 409)
  const created = await insertUser(c, { id: await generateUniqueUserId(c, role === 'MANAGER' ? 'STAFF' : role as 'ADMIN' | 'STAFF' | 'CUSTOMER'), name, email, password, role: role === 'MANAGER' ? 'STAFF' : role, accessLevel: role, status, accountStatus: status, balance: 0, commissionBalance: 0, createdAt: new Date().toISOString() })
  await createAuditLog(c, { actor: user, action: 'USER_CREATED', targetType: 'USER', targetId: created.id, after: { role, status } })
  return c.redirect('/admin/users')
})

app.get('/admin/users/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminUserDetail(c, user, c.req.param('id')))
})

app.get('/admin/users/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminUserEdit(c, user, c.req.param('id')))
})

app.post('/admin/users/:id/clear-login-lock', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const target = await c.env.RENT.prepare('SELECT email, role FROM users WHERE id = ?').bind(c.req.param('id')).first() as any
  if (target?.email && target.role !== 'ADMIN') {
    await c.env.RENT.prepare('DELETE FROM login_attempts WHERE account = ?').bind(String(target.email).toLowerCase()).run()
  }
  return c.redirect(`/admin/users/${encodeURIComponent(c.req.param('id'))}`)
})

app.post('/admin/users/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const targetUserId = c.req.param('id')
  const form = await c.req.parseBody()
  const targetUser = await getUserById(c, targetUserId)
  if (!targetUser) return c.html(renderNotFound(), 404)
  const requestedLevel = String(form.role || getAccessLevel(targetUser))
  const role = requestedLevel === 'MANAGER' ? 'STAFF' : requestedLevel
  const accountStatus = String(form.accountStatus || 'active')
  const staffId = String(form.staffId || '').trim()
  if (!['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'].includes(requestedLevel) || !['active', 'banned', 'inactive', 'departed'].includes(accountStatus)) {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '账户角色或状态无效'), 400)
  }
  if (accountStatus === 'departed' && role !== 'STAFF') {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '“已离职”状态仅适用于员工账户'), 400)
  }
  if (targetUserId === user.id && (requestedLevel !== 'ADMIN' || accountStatus !== 'active')) {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '不能停用、封禁或降低当前登录管理员自己的权限'), 400)
  }
  if (role === 'CUSTOMER' && staffId) {
    const assignedStaff = await getUserById(c, staffId)
    const assignedStatus = assignedStaff?.accountStatus ?? assignedStaff?.account_status ?? (assignedStaff?.status === 'active' ? 'active' : 'inactive')
    if (!assignedStaff || assignedStaff.role !== 'STAFF' || assignedStaff.status !== 'active' || assignedStatus !== 'active') {
      return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '只能绑定用户管理中状态正常的现有员工'), 400)
    }
  }

  const dataToUpdate: any = {
    name: combinePersonName(form.firstName, form.lastName),
    phone: form.phone?.toString() || '',
    bsb: form.bsb?.toString() || '',
    accountNumber: form.account_number?.toString() || '',
    balance: parseFloat(form.balance?.toString() || '0'),
    role,
    accessLevel: requestedLevel,
    accountStatus,
    status: accountStatus === 'active' ? 'active' : 'inactive',
    staffId: role === 'CUSTOMER' ? (staffId || null) : null,
  }

  if (!dataToUpdate.name || !String(form.firstName || '').trim() || !String(form.lastName || '').trim()) {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '请分别填写名和姓'), 400)
  }

  // 如果提供了密码，更新密码
  if (form.password && form.password.toString().length > 0) {
    if (!isStrongPassword(form.password.toString())) return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '新密码至少需要 8 位，并同时包含字母、数字和符号'), 400)
    dataToUpdate.password = form.password.toString()
  }

  await updateUser(c, targetUserId, dataToUpdate)
  await createAuditLog(c, { actor: user, action: 'USER_UPDATED', targetType: 'USER', targetId: targetUserId, before: { role: getAccessLevel(targetUser), status: targetUser.accountStatus ?? targetUser.status }, after: { role: requestedLevel, status: accountStatus } })
  return c.redirect(`/admin/users/${targetUserId}`)
})

app.get('/admin/refunds', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminRefunds(c, user))
})

app.get('/admin/withdrawals', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminWithdrawals(c, user))
})

app.get('/admin/payment-reviews', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.redirect('/admin/exceptions', 302)
})

app.post('/admin/withdrawals/:id/status', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }

  const withdrawalId = c.req.param('id')
  const form = await c.req.parseBody()
  const status = String(form.status || 'pending')

  if (!['completed', 'rejected', 'approved'].includes(status)) {
    return c.redirect('/admin/withdrawals')
  }

  await c.env.RENT.prepare(`
    UPDATE commission_withdrawals
    SET status = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, user.id, withdrawalId).run();

  return c.redirect('/admin/withdrawals')
})

app.get('/admin/contracts/signing-status', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.redirect('/admin/contracts?status=pending')
})

app.get('/admin/contracts/archive', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.redirect('/admin/contracts?status=completed')
})

app.get('/admin/orders/export', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }

  const url = new URL(c.req.url)
  const userIdFilter = url.searchParams.get('userId') || ''
  const statusFilter = url.searchParams.get('status') || 'all'
  const searchTerm = (url.searchParams.get('search') || '').trim()
  const dateFrom = (url.searchParams.get('dateFrom') || '').trim()
  const dateTo = (url.searchParams.get('dateTo') || '').trim()

  const filteredOrders = await pages.getFilteredAdminOrders(c, {
    userId: userIdFilter,
    status: statusFilter,
    search: searchTerm,
    dateFrom,
    dateTo,
  })

  const csvRows = [
    ['订单号', '客户', '邮箱', '设备', '总金额', '状态', '租期', '下单日期'],
    ...filteredOrders.map((order: any) => {
      const totalAmount = order.total_amount || order.totalAmount || 0
      const startDate = order.start_date || order.startDate || '-'
      const endDate = order.end_date || order.endDate || '-'
      const createdAt = order.created_at || order.createdAt || '-'
      return [
        order.id || '',
        order.customer?.name || '未知用户',
        order.customer?.email || '',
        order.device?.name || '未知设备',
        String(totalAmount),
        order.status || '',
        `${startDate} ~ ${endDate}`,
        createdAt,
      ]
    })
  ]

  const escapeCsvValue = (value: any) => {
    let text = String(value ?? '')
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const csv = csvRows.map(row => row.map(escapeCsvValue).join(',')).join('\n')

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`)
  return c.body(csv)
})

app.get('/admin/orders', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminOrders(c, user))
})

app.get('/admin/contracts', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderStaffContracts(c, user, c.req.query('status'), undefined, undefined, c.req.query('searchTerm'), c.req.query('staffId')))
})


app.get('/admin/contracts/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminContractDetail(c, user, c.req.param('id')))
})

app.get('/admin/contracts/:id/data', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(await pages.renderAdminContractData(c, user, c.req.param('id')))
})

app.post('/admin/contracts/:id/data', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const contract = await getContractById(c, c.req.param('id'))
  if (!contract) return c.notFound()
  const form = parseFormBody(await c.req.text())
  const allowed = new Set(CONTRACT_OPERATIONAL_FIELDS.map(([name]) => name))
  const existing = typeof contract.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : (contract.contract_data || {})
  // 已签署字段直接忽略，不报错；签署记录始终保持原值。
  const submitted = Object.entries(form).filter(([name]) => allowed.has(name as any) && !(contract.status === 'signed' && CONTRACT_SIGNED_FIELDS.has(name))).map(([name, value]) => [name, String(value).trim().slice(0, 4000)])
  const submittedData = Object.fromEntries(submitted)
  if (submittedData.damage_photos) {
    try { submittedData.damage_photos = validateHostedImageUrls(submittedData.damage_photos).join('\n') } catch (error: any) { return c.text(error.message, 400) }
  }
  for (const name of ['delivery_fee', 'discount', 'replacement_cost', 'repair_cost', 'battery_cycles', 'insurance_fee']) {
    const value = submittedData[name]
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) return c.text(`${name} 必须是非负数字`, 400)
  }
  const allowedOptions: Record<string, string[]> = { delivery_method: ['', 'Pickup', 'Delivery'], return_status: ['', 'Returned', 'Overdue', 'Damaged'], collection_required: ['', '否', '是'], power_test: ['', '通过', '失败'], insurance_selected: ['', '否', '是'], waiver_signed: ['', '否', '是'], jurisdiction: ['', 'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] }
  for (const [name, options] of Object.entries(allowedOptions)) if (!options.includes(submittedData[name] || '')) return c.text(`${name} 的值无效`, 400)
  const data = { ...existing, ...submittedData }
  await c.env.RENT.prepare('UPDATE contracts SET contract_data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify(data), contract.id).run()
  return c.redirect(`/admin/contracts/${contract.id}`)
})

app.get('/admin/orders/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminOrderDetail(c, user, c.req.param('id')))
})

app.post('/admin/orders/:id/changes', async (c) => {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id')) as any
  if (!order || ['completed', 'cancelled'].includes(order.status)) return c.text('订单不存在或已结束，不能修改', 409)
  const form = await c.req.parseBody()
  const type = String(form.changeType || '')
  const reason = String(form.reason || '').trim().slice(0, 500)
  if (!reason) return c.text('订单修改必须填写原因', 400)
  const before = { deviceId: order.deviceId, startDate: order.startDate, endDate: order.endDate, totalAmount: order.totalAmount, depositAmount: order.depositAmount }
  let after: any = { ...before }
  if (type === 'EXTENSION') {
    const endDate = String(form.endDate || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate <= order.startDate) return c.text('新的归还日期无效', 400)
    if (await hasDeviceBookingConflict(c, order.deviceId, order.startDate, endDate, order.id)) return c.text('延期与后续预约冲突', 409)
    after.endDate = endDate
  } else if (type === 'DEVICE_SWAP') {
    const deviceId = String(form.deviceId || '')
    if (!deviceId || deviceId === order.deviceId) return c.text('请选择不同的替换设备', 400)
    if (await hasDeviceBookingConflict(c, deviceId, order.startDate, order.endDate, order.id)) return c.text('替换设备在该租期不可用', 409)
    const device = await getDeviceById(c, deviceId)
    if (!device || ['maintenance', 'retired'].includes(String(device.status))) return c.text('替换设备不可用', 409)
    after.deviceId = deviceId
  } else if (type === 'PRICE_ADJUSTMENT') {
    const totalAmount = Number(form.totalAmount); const depositAmount = Number(form.depositAmount)
    if (!Number.isFinite(totalAmount) || !Number.isFinite(depositAmount) || totalAmount < depositAmount || depositAmount < 0) return c.text('价格或押金无效', 400)
    after.totalAmount = Number(totalAmount.toFixed(2)); after.depositAmount = Number(depositAmount.toFixed(2))
  } else return c.text('不支持的订单修改类型', 400)
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE orders SET deviceId = ?, endDate = ?, totalAmount = ?, depositAmount = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(after.deviceId, after.endDate, after.totalAmount, after.depositAmount, order.id),
    c.env.RENT.prepare('INSERT INTO order_change_history (id, order_id, change_type, before_json, after_json, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`och-${nanoid(12)}`, order.id, type, JSON.stringify(before), JSON.stringify(after), reason, admin.id),
  ])
  if (type === 'DEVICE_SWAP') { await releaseDeviceIfUnbooked(c, order.deviceId); await recordDeviceLifecycle(c, after.deviceId, 'RESERVED', { orderId: order.id, reason: '订单换机', changedBy: admin.id }) }
  await createAuditLog(c, { actor: admin, action: 'ORDER_CHANGED', targetType: 'ORDER', targetId: order.id, before, after, reason })
  return c.redirect(`/admin/orders/${order.id}`, 303)
})

app.post('/admin/orders/:id/update', async (c) => {
  const wantsJson = c.req.header('accept')?.includes('application/json') || c.req.header('x-requested-with') === 'XMLHttpRequest'
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return wantsJson ? c.json({ ok: false, error: '登录已失效或没有管理员权限' }, 403) : c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const status = String(form.status || '')
  const force = String(form.force || '') === '1'
  const order = await getOrderById(c, c.req.param('id'))
  const editableStatuses = ['suspended', 'cancelled']
  if (!order || !editableStatuses.includes(status) || !canTransitionOrder(order.status, status)) return wantsJson ? c.json({ ok: false, error: '不允许的订单状态转换，请刷新页面查看最新状态' }, 409) : c.text('不允许的订单状态转换', 409)
  if (status === 'cancelled' && order.status === 'paid') {
    const response = await cancelAndRefund(c, user, order.id)
    if (response.status >= 400) return wantsJson ? c.json({ ok: false, error: await response.text() }, response.status as any) : response
    return wantsJson ? c.json({ ok: true, refunded: true }) : response
  }
  if (status === 'completed') {
    const contract = await c.env.RENT.prepare('SELECT contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
    if (!JSON.parse(contract?.contract_data || '{}').inspection_date && !force) return wantsJson ? c.json({ ok: false, error: '完成订单前必须提交归还验机' }, 409) : c.text('完成订单前必须提交归还验机', 409)
  }
  await updateOrderStatus(c, order.id, status)
  if (status === 'completed') await enqueueRentalUserDeletion(c, order)
  if (status === 'cancelled' || status === 'completed') await releaseDeviceIfUnbooked(c, order.deviceId)
  if (status === 'paid') await ensureOrderNumber(c, order.id)
  if (wantsJson) return c.json({ ok: true })
  return c.redirect(`/admin/orders/${c.req.param('id')}`)
})

app.post('/admin/orders/:id/transfer-proof/approve', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.status !== 'pending_payment' || !['bank_transfer', 'alipay', 'wechat'].includes(String(order.paymentMethod))) return c.text('订单状态不允许审核', 409)
  const proof = await c.env.RENT.prepare("SELECT pp.id, pp.payment_id, pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND pp.status = 'submitted' ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() as any
  if (!proof) return c.text('没有待审核的转账信息', 409)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE payment_proofs SET status = 'approved', verified_at = CURRENT_TIMESTAMP, verified_by = ? WHERE id = ? AND status = 'submitted'").bind(user.id, proof.id),
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', transaction_id = COALESCE(transaction_id, ?), paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(generateReferenceNumber('TXN'), proof.payment_id),
    c.env.RENT.prepare("UPDATE orders SET status = 'paid', order_status = 'CONFIRMED', payment_status = 'PAID', rental_status = 'READY_FOR_PICKUP', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
  ])
  await recordDeviceLifecycle(c, order.deviceId, 'RESERVED', { orderId: order.id, reason: '付款凭证审核通过', changedBy: user.id })
  await ensureOrderNumber(c, order.id, String(proof.reference_number || proof.payment_id || ''))
  await recordExternalRentalFlow(c, order.userId, Number(order.totalAmount), '银行转账', user.id, order.id)
  await issueInvoice(c, order.id)
  // Bank-transfer approval is a completed payment event too: enqueue the
  // Windows rental-user creation immediately instead of waiting for the cron.
  const contract = await c.env.RENT.prepare('SELECT id, contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
  if (contract?.contract_data) {
    let contractData: any = {}
    try { contractData = JSON.parse(contract.contract_data) } catch (_) { }
    const password = String(contractData.windows_password || '')
    const username = String(contractData.windows_username || order.customer?.name || 'RentalUser')
    if (password && !contractData.windows_account_created) {
      await ensureDeviceCommandTables(c.env.RENT)
      await c.env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'CREATE_RENTAL_USER', ?, NULL, datetime('now', '+7 days'))").bind(`cmd-${nanoid(12)}`, order.deviceId, JSON.stringify({ username, password })).run()
      contractData.windows_account_created = true
      await c.env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(contractData), contract.id).run()
    }
  }
  const customer = await getUserById(c, order.userId) as any
  const title = '付款审核已通过'
  const message = `您的订单 ${order.orderNo || order.id} 付款凭证已审核通过，订单已确认。`
  await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'payment_approved', title, message, orderId: order.id })
  await sendPaymentReviewEmail(c, customer, title, message, order.id)
  await createAuditLog(c, { actor: user, action: 'PAYMENT_PROOF_APPROVED', targetType: 'PAYMENT_PROOF', targetId: proof.id, after: { orderId: order.id, reference: proof.reference_number } })
  return c.redirect('/admin/exceptions')
})

app.post('/admin/orders/:id/transfer-proof/reject', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const reason = String((await c.req.parseBody()).reason || '').trim().slice(0, 300)
  if (!reason) return c.text('请填写驳回原因', 400)
  const order = await getOrderById(c, c.req.param('id')) as any
  if (!order) return c.text('订单不存在', 404)
  await c.env.RENT.prepare("UPDATE payment_proofs SET status = 'rejected', rejection_reason = ?, rejected_at = CURRENT_TIMESTAMP, rejected_by = ? WHERE id = (SELECT pp.id FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND pp.status = 'submitted' ORDER BY pp.uploaded_at DESC LIMIT 1)").bind(reason, user.id, order.id).run()
  const customer = await getUserById(c, order.userId) as any
  const title = '付款审核未通过'
  const message = `您的订单 ${order.orderNo || order.id} 付款凭证未通过审核。原因：${reason}。请重新提交正确的付款凭证。`
  await createNotification(c, { recipientId: order.userId, senderId: user.id, type: 'payment_rejected', title, message, orderId: order.id })
  await sendPaymentReviewEmail(c, customer, title, message, order.id)
  await createAuditLog(c, { actor: user, action: 'PAYMENT_PROOF_REJECTED', targetType: 'ORDER', targetId: order.id, reason })
  return c.redirect('/admin/exceptions')
})

app.post('/admin/orders/bulk-update', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }

  const form = await c.req.parseBody()
  const targetStatus = String(form.status || '')
  const selectedIds = Array.isArray(form.orderIds) ? form.orderIds.map(String) : form.orderIds ? [String(form.orderIds)] : []

  if (!['suspended', 'cancelled'].includes(targetStatus) || selectedIds.length === 0) {
    return c.redirect('/admin/orders')
  }

  const selectedOrders = await Promise.all(selectedIds.map(orderId => getOrderById(c, orderId)))
  const validOrders = selectedOrders.filter((order): order is NonNullable<typeof order> => Boolean(order && canTransitionOrder(order.status, targetStatus)))
  if (!validOrders.length) return c.text('所选订单没有可以执行该状态转换的订单', 409)
  if (targetStatus === 'completed') return c.text('完成订单必须逐笔执行归还验机', 409)
  for (const order of validOrders) {
    if (targetStatus === 'cancelled' && order.status === 'paid') {
      const response = await cancelAndRefund(c, user, order.id)
      if (response.status >= 400) return c.text(await response.text(), response.status as any)
    } else {
      await updateOrderStatus(c, order.id, targetStatus)
      if (targetStatus === 'cancelled') await releaseDeviceIfUnbooked(c, order.deviceId)
    }
  }

  const skipped = selectedOrders.length - validOrders.length
  return c.redirect(`/admin/orders?success=${encodeURIComponent(`已更新 ${validOrders.length} 条订单${skipped ? `，跳过 ${skipped} 条不适用订单` : ''}`)}`)
})

app.post('/admin/orders/:id/refund', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  return c.text('此退款入口已停用，请选择“处理押金”或“取消并全额退款”', 410)
})

app.post('/admin/orders/:id/deposit-refund', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const settlement = await c.env.RENT.prepare("SELECT * FROM deposit_settlements WHERE order_id = ? ORDER BY requested_at DESC LIMIT 1").bind(c.req.param('id')).first() as any
  if (!settlement || settlement.status !== 'APPROVED') return c.text('押金结算须先由 Manager 审批通过', 409)
  try {
    const form = await c.req.parseBody()
    if (Number(form.refundAmount) !== Number(settlement.refund_amount) || String(form.deductionCategory || '') !== String(settlement.deduction_category || '') || String(form.deductionReason || '').trim() !== String(settlement.deduction_reason || '')) return c.text('执行金额或扣款说明必须与已批准的结算单一致', 409)
    const response = await refundDeposit(c, user, c.req.param('id'), form)
    if (response.status < 400) {
      await c.env.RENT.prepare("UPDATE deposit_settlements SET status = 'EXECUTED', executed_by = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'APPROVED'").bind(user.id, settlement.id).run()
      await createAuditLog(c, { actor: user, action: 'DEPOSIT_SETTLEMENT_EXECUTED', targetType: 'DEPOSIT_SETTLEMENT', targetId: settlement.id, before: { status: 'APPROVED' }, after: { status: 'EXECUTED' } })
    }
    return response
  } catch (error: any) {
    return c.text(error.message || '押金退款失败', 502)
  }
})

app.post('/admin/orders/:id/deposit-settlements', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id'))
  if (!order) return c.text('订单不存在', 404)
  if (order.status !== 'completed') return c.text('只有已归还并完成的订单才能提交押金结算', 409)
  const existing = await c.env.RENT.prepare("SELECT id FROM deposit_settlements WHERE order_id = ? AND status IN ('PENDING_MANAGER_APPROVAL', 'APPROVED', 'EXECUTED')").bind(order.id).first()
  if (existing) return c.text('该订单已有待处理或已完成的押金结算单', 409)
  const form = await c.req.parseBody()
  const refundText = String(form.refundAmount ?? '').trim()
  const refundAmount = Number(refundText)
  const depositAmount = Number(order.depositAmount || 0)
  if (!/^\d+(\.\d{1,2})?$/.test(refundText) || !Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > depositAmount) return c.text('退款金额无效：不能高于押金金额', 400)
  const deductionAmount = Number((depositAmount - refundAmount).toFixed(2))
  const deductionCategory = String(form.deductionCategory || '').trim()
  const deductionReason = String(form.deductionReason || '').trim()
  const refundMethod = String(form.refundMethod || 'balance').trim()
  if (!['balance', 'original', 'bank_transfer'].includes(refundMethod)) return c.text('退款方式无效', 400)
  if (deductionAmount > 0 && !['DAMAGE', 'MISSING_ACCESSORY', 'LATE_FEE', 'DEVICE_NOT_RETURNED', 'OTHER'].includes(deductionCategory)) return c.text('请选择有效的押金扣款类别', 400)
  if (deductionAmount > 0 && !deductionReason) return c.text('扣除押金时必须填写原因', 400)
  const snapshot = { orderId: order.id, orderNo: order.orderNo, customerId: order.userId, depositAmount, refundAmount, deductionAmount, deductionCategory: deductionAmount ? deductionCategory : null, deductionReason: deductionAmount ? deductionReason : null, refundMethod, requestedAt: new Date().toISOString(), requestedBy: user.id }
  const settlementId = `dst-${nanoid(12)}`
  await c.env.RENT.batch([
    c.env.RENT.prepare("INSERT INTO deposit_settlements (id, order_id, deposit_amount, refund_amount, deduction_amount, deduction_category, deduction_reason, refund_method, status, requested_by, reviewed_by, reviewed_at, review_note, settlement_number, document_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, CURRENT_TIMESTAMP, '管理员提交，自动审批通过', ?, ?)").bind(settlementId, order.id, depositAmount, refundAmount, deductionAmount, deductionAmount ? deductionCategory : null, deductionAmount ? deductionReason : null, refundMethod, user.id, user.id, generateReferenceNumber('DST'), JSON.stringify(snapshot)),
    c.env.RENT.prepare("UPDATE orders SET deposit_status = 'REFUND_PENDING' WHERE id = ?").bind(order.id),
  ])
  await createAuditLog(c, { actor: user, action: 'DEPOSIT_SETTLEMENT_AUTO_APPROVED', targetType: 'DEPOSIT_SETTLEMENT', targetId: settlementId, after: { ...snapshot, status: 'APPROVED' }, reason: deductionReason || '管理员提交，自动审批通过' })
  return c.redirect(`/admin/orders/${order.id}`, 303)
})

app.get('/manager/deposit-settlements', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!manager || getAccessLevel(manager) !== 'MANAGER') return c.html(renderForbidden(), 403)
  const { results = [] } = await c.env.RENT.prepare("SELECT ds.*, o.orderNo FROM deposit_settlements ds JOIN orders o ON o.id = ds.order_id WHERE ds.status = 'PENDING_MANAGER_APPROVAL' ORDER BY ds.requested_at ASC").all() as any
  const rows = results.map((item: any) => `<tr><td>${sanitizePlainText(item.settlement_number, 40)}</td><td>${sanitizePlainText(item.orderNo, 40)}</td><td>AUD$ ${Number(item.deposit_amount).toFixed(2)}</td><td>AUD$ ${Number(item.refund_amount).toFixed(2)}</td><td>${item.deduction_amount ? `${sanitizePlainText(item.deduction_category, 40)}：${sanitizePlainText(item.deduction_reason, 300)}` : '无扣款'}</td><td><form method="post" action="/manager/deposit-settlements/${encodeURIComponent(item.id)}/approve" data-site-confirm="确认批准这份押金结算单吗？"><button class="button button-primary">批准</button></form><form method="post" action="/manager/deposit-settlements/${encodeURIComponent(item.id)}/reject" style="margin-top:8px"><input class="form-control" name="note" maxlength="300" required placeholder="驳回原因"><button class="button button-danger" style="margin-top:6px">驳回</button></form></td></tr>`).join('') || '<tr><td colspan="6">暂无待审批押金结算单</td></tr>'
  return c.html(buildLayout('押金结算审批', `<div class="panel"><h2>押金结算审批</h2><p>批准后由管理员执行退款；批准或驳回均会留下审计记录。</p><div class="table-wrapper"><table><thead><tr><th>结算单号</th><th>订单</th><th>押金</th><th>退款</th><th>扣款</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>`, manager))
})

app.post('/manager/deposit-settlements/:id/approve', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!manager || getAccessLevel(manager) !== 'MANAGER') return c.html(renderForbidden(), 403)
  const settlement = await c.env.RENT.prepare("SELECT * FROM deposit_settlements WHERE id = ? AND status = 'PENDING_MANAGER_APPROVAL'").bind(c.req.param('id')).first() as any
  if (!settlement) return c.text('结算单不存在或已处理', 409)
  const result = await c.env.RENT.prepare("UPDATE deposit_settlements SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING_MANAGER_APPROVAL'").bind(manager.id, settlement.id).run() as any
  if (!result.meta?.changes) return c.text('结算单不存在或已处理', 409)
  await createAuditLog(c, { actor: manager, action: 'DEPOSIT_SETTLEMENT_APPROVED', targetType: 'DEPOSIT_SETTLEMENT', targetId: settlement.id, before: { status: settlement.status }, after: { status: 'APPROVED' } })
  return c.redirect('/manager/deposit-settlements')
})

app.post('/manager/deposit-settlements/:id/reject', async (c) => {
  const manager = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!manager || getAccessLevel(manager) !== 'MANAGER') return c.html(renderForbidden(), 403)
  const note = String((await c.req.parseBody()).note || '').trim()
  if (!note) return c.text('驳回必须填写原因', 400)
  const settlement = await c.env.RENT.prepare("SELECT * FROM deposit_settlements WHERE id = ? AND status = 'PENDING_MANAGER_APPROVAL'").bind(c.req.param('id')).first() as any
  if (!settlement) return c.text('结算单不存在或已处理', 409)
  await c.env.RENT.prepare("UPDATE deposit_settlements SET status = 'REJECTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ? WHERE id = ?").bind(manager.id, note, settlement.id).run()
  await createAuditLog(c, { actor: manager, action: 'DEPOSIT_SETTLEMENT_REJECTED', targetType: 'DEPOSIT_SETTLEMENT', targetId: settlement.id, before: { status: settlement.status }, after: { status: 'REJECTED' }, reason: note })
  return c.redirect('/manager/deposit-settlements')
})

app.post('/admin/orders/:id/cancel-and-refund', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  try {
    return await cancelAndRefund(c, user, c.req.param('id'))
  } catch (error: any) {
    return c.text(error.message || '全额退款失败', 502)
  }
})

app.post('/admin/refunds/:id/complete-bank-transfer', async (c) => {
  const admin = c.get('user')
  if (!admin || admin.role !== 'ADMIN') return c.text('无权限', 403)
  try { await completeBankTransferRefund(c, admin, c.req.param('id')); return c.redirect('/admin/refunds') } catch (error: any) { return c.text(error.message || '退款处理失败', 409) }
})

app.post('/admin/orders/:id/delete', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order) return c.redirect('/admin/orders?error=' + encodeURIComponent('订单不存在或已被删除'))
  if (['paid', 'active', 'completed'].includes(order.status)) {
    return c.redirect('/admin/orders?error=' + encodeURIComponent('只能删除未付款或已取消的订单，请先确认订单状态'))
  }
  await c.env.RENT.prepare('DELETE FROM invoices WHERE order_id = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payment_refunds WHERE order_id = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payment_proofs WHERE payment_id IN (SELECT id FROM payments WHERE rental_id = ?)').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payments WHERE rental_id = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM contracts WHERE orderId = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(order.id).run()
  return c.redirect('/admin/orders?success=' + encodeURIComponent('订单已删除'))
})

app.get('/admin/finance', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const revenueData = await pages.getRevenueData(c)
  return c.html(pages.renderAdminFinance(user, revenueData.orders, revenueData.refunds, revenueData.withdrawals))
})

app.get('/admin/revenue-stats', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(pages.renderAdminRevenueStats(user, await pages.getRevenueData(c)))
})

app.get('/admin/coupons', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const coupons = (await c.env.RENT.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()).results || []
  const devices = (await c.env.RENT.prepare('SELECT id, name, brand, model FROM devices ORDER BY name').all()).results || []
  return c.html(pages.renderAdminCoupons(admin, coupons as any[], devices as any[]))
})

app.get('/admin/device-agent-bindings', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(await pages.renderAdminDeviceAgentBindings(c, user))
})

app.post('/admin/device-agent-bindings/:id/unbind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  await c.env.RENT.prepare("UPDATE devices SET agent_token_hash = NULL, agent_registered_at = NULL, agent_last_seen_at = NULL, agent_last_ip = NULL, agent_hostname = NULL, agent_os_version = NULL, agent_cpu = NULL, agent_memory_mb = NULL, agent_storage_free_bytes = NULL, agent_status = 'unregistered', agent_setup_code_hash = NULL, agent_setup_code_expires_at = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(c.req.param('id')).run()
  return c.redirect('/admin/device-agent-bindings')
})

app.get('/admin/devices', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const { getDevicesAsync } = await import('./site')
  const devices = await getDevicesAsync(c)
  return c.html(pages.renderAdminDevices(user, devices))
})

app.get('/admin/devices/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDeviceNew(user))
})

async function generateAssetTag(c: any, brand: string): Promise<string> {
  const letters = String(brand || '').normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const fallback = Array.from(String(brand || '').trim()).slice(0, 2).join('').toUpperCase()
  const code = (letters.slice(0, 2) || fallback || 'DV').padEnd(2, 'X').slice(0, 2)
  const prefix = `RT-${code}-`
  const rows = (await c.env.RENT.prepare("SELECT asset_tag FROM devices WHERE asset_tag LIKE ? ORDER BY asset_tag DESC").bind(`${prefix}%`).all()).results || []
  const used = new Set(rows.map((row: any) => String(row.asset_tag || '')))
  let sequence = rows.reduce((max: number, row: any) => {
    const match = String(row.asset_tag || '').match(new RegExp(`^${prefix}(\\d{6})$`))
    return Math.max(max, match ? Number(match[1]) : 0)
  }, 0) + 1
  let candidate = `${prefix}${String(sequence).padStart(6, '0')}`
  while (used.has(candidate)) candidate = `${prefix}${String(++sequence).padStart(6, '0')}`
  return candidate
}

app.post('/admin/devices/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  if (![form.name, form.brand, form.model, form.serialNumber].every(value => value?.trim())) return c.text('请完整填写设备名称、品牌、型号和序列号', 400)
  if (!Number.isFinite(Number(form.pricePerDay)) || Number(form.pricePerDay) < 0 || !Number.isFinite(Number(form.depositAmount)) || Number(form.depositAmount) < 0) return c.text('日租金和押金必须是有效的非负金额', 400)
  if (!['available', 'rented', 'maintenance', 'retired'].includes(form.status || 'available')) return c.text('设备状态无效', 400)
  if (form.lifecycleStatus && !['RESERVED', 'READY', 'RENTED', 'RETURNED', 'INSPECTION', 'MAINTENANCE', 'DAMAGED', 'RETIRED'].includes(form.lifecycleStatus)) return c.text('设备生命周期状态无效', 400)
  const serialNumber = String(form.serialNumber || '').trim().slice(0, 120)
  const duplicate = await c.env.RENT.prepare('SELECT id FROM devices WHERE serialNumber = ?').bind(serialNumber).first()
  if (duplicate) return c.html(pages.renderAdminDeviceNew(user, '序列号已存在，请检查后重新填写。'), 409)
  const registrationKey = nanoid(48)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(registrationKey))
  const agentTokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  try {
    await insertDevice(c, {
      name: form.name || '',
      brand: form.brand || '',
      model: form.model || '',
      assetTag: String(form.assetTag || '').trim().slice(0, 80) || await generateAssetTag(c, form.brand || ''),
      serialNumber,
      cpu: form.cpu || '',
      ram: form.ram || '',
      storage: form.storage || '',
      gpu: form.gpu || '',
      os: form.os || '',
      pricePerDay: Number(form.pricePerDay) || 0,
      depositAmount: Number(form.depositAmount) || 0,
      status: (form.status as any) || 'available',
      description: form.description || form.remark || '',
      agentTokenHash
    })
  } catch (error: any) {
    if (/UNIQUE constraint failed: devices\.serial(Number|_number)/i.test(String(error?.message || error))) return c.html(pages.renderAdminDeviceNew(user, '序列号已存在，请检查后重新填写。'), 409)
    throw error
  }
  return c.html(pages.renderAdminDeviceNew(user, '设备已成功入库，以下是本次生成的设备注册密钥：', registrationKey))
})

app.get('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const device = await getDeviceById(c, c.req.param('id'))
  if (!device) {
    return c.redirect('/admin/devices')
  }
  const unavailableDates = ((await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ? ORDER BY unavailable_date').bind(device.id).all()).results || []).map((row: any) => row.unavailable_date)
  const lifecycleEvents = (await c.env.RENT.prepare('SELECT previous_status, next_status, reason, changed_by, created_at FROM device_lifecycle_events WHERE device_id = ? ORDER BY created_at DESC LIMIT 8').bind(device.id).all()).results || []
  return c.html(pages.renderAdminDeviceEdit(user, { ...device, unavailableDates, lifecycleEvents }))
})

app.get('/admin/devices/:id/control', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  await ensureDeviceCommandTables(c.env.RENT)
  const device = await getDeviceById(c, c.req.param('id'))
  if (!device) return c.redirect('/admin/devices')
  const commands = (await c.env.RENT.prepare(`SELECT dc.created_at, dc.command_type, dc.status, dcr.result_message FROM device_commands dc LEFT JOIN device_command_results dcr ON dcr.command_id = dc.id WHERE dc.device_id = ? ORDER BY dc.created_at DESC LIMIT 20`).bind(device.id).all()).results || []
  return c.html(pages.renderAdminDeviceControl(user, device, commands as any[]))
})

app.get('/admin/devices/:id/agent-binding-status', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.json({ ok: false }, 401)
  const device = await getDeviceById(c, c.req.param('id')) as any
  if (!device) return c.json({ ok: false }, 404)
  return c.json({ ok: true, bound: Boolean(device.agent_token_hash || device.agentTokenHash) })
})

app.get('/admin/devices/:id/agent-install', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const device = await getDeviceById(c, c.req.param('id')) as any
  if (!device) return c.redirect('/admin/devices')
  if (device.agent_token_hash || device.agentTokenHash) {
    const body = `<div class="page-header"><div><p class="section-code">WINDOWS AGENT</p><h2>Windows 客户端安装信息</h2><p>${sanitizePlainText(device.name, 120)} 已完成客户端绑定。</p></div><a href="/admin/device-agent-bindings" class="button button-secondary">返回绑定设备</a></div><div class="panel"><h3>已绑定</h3><p>此设备已与 Windows 客户端绑定，无需访问码。</p><div class="record-actions"><a class="button button-secondary" href="/admin/device-agent-bindings">返回绑定设备</a><a class="button button-primary" href="/downloads/RentDeviceAgent-Setup.exe">下载 Windows 安装程序（EXE）</a></div></div>`
    return c.html(buildLayout('Windows 客户端安装信息 - 电脑租赁管理系统', body, user))
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  const codeHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const expiresAtMs = Date.parse(expiresAt)
  await c.env.RENT.prepare("UPDATE devices SET agent_token_hash = NULL, agent_registered_at = NULL, agent_last_seen_at = NULL, agent_last_ip = NULL, agent_hostname = NULL, agent_os_version = NULL, agent_cpu = NULL, agent_memory_mb = NULL, agent_storage_free_bytes = NULL, agent_status = 'unregistered', agent_setup_code_hash = ?, agent_setup_code_expires_at = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(codeHash, expiresAt, device.id).run()
  const body = `<div class="page-header"><div><p class="section-code">WINDOWS AGENT</p><h2>Windows 客户端安装信息</h2><p>${sanitizePlainText(device.name, 120)} · 访问码有效 15 分钟且只能使用一次。</p></div><a href="/admin/device-agent-bindings" class="button button-secondary">返回绑定设备</a></div><div class="panel"><h3 id="agent-code-title">6 位 Windows 客户端访问码</h3><p id="agent-code-hint">安装时请输入此访问码。BIOS 序列号会被记录，但不能单独完成绑定。</p><div id="agent-setup-code" style="font-size:42px;letter-spacing:12px;font-weight:700;margin:28px 0;color:var(--accent,#2563eb);"><code>${code}</code></div><div class="record-actions"><button class="button button-primary" type="button" id="copy-agent-code">复制 6 位访问码</button><a class="button button-primary" href="/downloads/RentDeviceAgent-Setup.exe">下载 Windows 安装程序（EXE）</a></div><p id="agent-code-expiry">访问码剩余：<strong id="agent-code-countdown" data-expires-at="${expiresAtMs}">15 分钟</strong>。安装程序会安装到系统目录并注册 Windows Service。</p><p class="page-notification page-notification--warning" id="agent-code-warning">访问码只显示这一次。关闭页面后无法恢复，只能重新生成。绑定成功后访问码立即失效。</p></div><script>(()=>{const b=document.getElementById('copy-agent-code'),c=document.getElementById('agent-code-countdown'),expires=Number(c?.dataset.expiresAt||0),code=document.getElementById('agent-setup-code'),title=document.getElementById('agent-code-title'),hint=document.getElementById('agent-code-hint'),expiry=document.getElementById('agent-code-expiry'),warning=document.getElementById('agent-code-warning');let bound=false;b?.addEventListener('click',async()=>{await navigator.clipboard.writeText('${code}');b.textContent='已复制';setTimeout(()=>{if(!bound)b.textContent='复制 6 位访问码';},1600);});const showBound=()=>{if(bound)return;bound=true;title.textContent='已绑定';hint.textContent='此访问码已被 Windows 客户端成功使用。';code.innerHTML='<strong>已绑定</strong>';code.style.letterSpacing='normal';code.style.fontSize='28px';code.style.color='var(--success,#15803d)';b.disabled=true;b.hidden=true;expiry.hidden=true;warning.hidden=true;};const check=async()=>{try{const r=await fetch('/admin/devices/${encodeURIComponent(device.id)}/agent-binding-status');const data=await r.json();if(data.bound){showBound();return;}}catch{}if(!bound)setTimeout(check,3000);};const tick=()=>{const left=Math.max(0,expires-Date.now());if(!c||bound)return;if(!left){c.textContent='已过期';c.style.color='#b42318';return;}const total=Math.ceil(left/1000),minutes=Math.floor(total/60),seconds=total%60;c.textContent=minutes?minutes+' 分 '+String(seconds).padStart(2,'0')+' 秒':seconds+' 秒';setTimeout(tick,1000);};tick();check();})();</script>`
  return c.html(buildLayout('Windows 客户端安装信息 - 电脑租赁管理系统', body, user))
})

app.post('/api/device-agent/register-legacy', async (c) => {
  const payload = await c.req.json().catch(() => ({})) as any
  const registrationCode = String(payload.registrationCode || '')
  if (!registrationCode) return c.json({ error: 'registrationCode is required' }, 400)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(registrationCode))
  const codeHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const row = await c.env.RENT.prepare("SELECT id, device_id FROM device_registration_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1").bind(codeHash).first() as any
  if (!row) return c.json({ error: 'registration code is invalid, expired, or already used' }, 401)
  const now = new Date().toISOString()
  const result = await c.env.RENT.prepare('UPDATE device_registration_codes SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, row.id).run()
  if (!result.success || !result.meta?.changes) return c.json({ error: 'registration code is already used' }, 409)
  const agentToken = nanoid(48)
  const tokenDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(agentToken))
  const tokenHash = Array.from(new Uint8Array(tokenDigest), byte => byte.toString(16).padStart(2, '0')).join('')
  await c.env.RENT.prepare("UPDATE devices SET agent_token_hash = ?, agent_registered_at = ?, agent_last_seen_at = ?, agent_last_ip = ?, agent_hostname = ?, agent_os_version = ?, agent_cpu = ?, agent_memory_mb = ?, agent_storage_free_bytes = ?, agent_version = ?, agent_status = 'online' WHERE id = ?").bind(tokenHash, now, now, c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '', String(payload.hostname || ''), String(payload.osVersion || ''), String(payload.cpu || ''), Number(payload.memoryMb) || null, Number(payload.storageFreeBytes) || null, String(payload.version || ''), row.device_id).run()
  return c.json({ deviceId: row.device_id, agentToken, heartbeatUrl: new URL('/api/device-agent/heartbeat', c.req.url).toString() })
})

app.post('/admin/devices/:id/commands', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || !['MANAGER', 'ADMIN'].includes(getAccessLevel(user))) return c.redirect('/login')
  await ensureDeviceCommandTables(c.env.RENT)
  const device = await c.env.RENT.prepare('SELECT id FROM devices WHERE id = ?').bind(c.req.param('id')).first()
  if (!device) return c.text('设备不存在', 404)
  const deviceStatus = await c.env.RENT.prepare('SELECT agent_status FROM devices WHERE id = ?').bind(c.req.param('id')).first() as any
  if (String(deviceStatus?.agent_status || '').toLowerCase() !== 'online') return c.text('设备当前不在线，无法执行远程操作', 409)
  const form = await c.req.parseBody()
  // Accept the current field name and the names used by older cached control
  // pages, then normalize it before validating the command.
  const type = String(form.commandType || form.command || form.type || '').trim().toUpperCase()
  const allowed = ['SYNC', 'SHOW_MESSAGE', 'PAUSE_RENTAL', 'RESUME_RENTAL', 'REFRESH_DEVICE_INFO', 'CHECK_UPDATE', 'CREATE_RENTAL_USER', 'UPDATE_RENTAL_USER', 'DELETE_RENTAL_USER', 'LOCK_DEVICE', 'REBOOT', 'DATA_WIPE', 'SYSTEM_RESET', 'REREGISTER_AGENT']
  if (!allowed.includes(type)) return c.text('命令类型无效', 400)
  const highRisk = new Set(['LOCK_DEVICE', 'REBOOT', 'DATA_WIPE', 'SYSTEM_RESET', 'REREGISTER_AGENT'])
  if (highRisk.has(type) && String(form.confirmed || '') !== '1') return c.text('高风险命令必须二次确认', 400)
  const payload = type === 'SHOW_MESSAGE' ? JSON.stringify({ title: String(form.title || '租赁通知').slice(0, 120), message: String(form.message || '').slice(0, 500) }) : '{}'
  if (type === 'SHOW_MESSAGE' && !JSON.parse(payload).message) return c.text('通知内容不能为空', 400)
  // Commands must remain available while a device is briefly offline. The
  // client will claim and complete them as soon as its next poll succeeds.
  const expiryHours = 24
  await c.env.RENT.prepare('INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\', ?))').bind(`cmd-${nanoid(12)}`, c.req.param('id'), type, payload, user.id, `+${expiryHours} hours`).run()
  await createAuditLog(c, { actor: user, action: 'REMOTE_COMMAND_QUEUED', targetType: 'DEVICE', targetId: c.req.param('id'), after: { commandType: type, highRisk: highRisk.has(type) }, reason: highRisk.has(type) ? '已二次确认高风险远程命令' : undefined })
  return c.redirect(`/admin/devices/${encodeURIComponent(c.req.param('id'))}/control?success=命令已发送，设备下次同步时执行`)
})

app.post('/admin/devices/:id/maintenance', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const device = await getDeviceById(c, c.req.param('id'))
  if (!device) return c.text('设备不存在', 404)
  const form = await c.req.parseBody()
  const description = String(form.description || '').trim()
  const type = String(form.type || 'RETURN_PREPARATION').trim().slice(0, 60)
  if (!description) return c.text('维护说明不能为空', 400)
  const id = `mnt-${nanoid(12)}`
  await c.env.RENT.batch([
    c.env.RENT.prepare("INSERT INTO maintenance_records (id, device_id, maintenance_type, status, description, technician, notes, created_by) VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?)").bind(id, device.id, type, description, String(form.technician || '').trim() || null, String(form.notes || '').trim() || null, user.id),
    c.env.RENT.prepare("UPDATE devices SET status = 'maintenance', device_mode = 'maintenance' WHERE id = ?").bind(device.id),
  ])
  await recordDeviceLifecycle(c, device.id, 'MAINTENANCE', { reason: description, changedBy: user.id })
  await createAuditLog(c, { actor: user, action: 'MAINTENANCE_CREATED', targetType: 'MAINTENANCE_RECORD', targetId: id, after: { deviceId: device.id, type, status: 'OPEN' }, reason: description })
  return c.redirect(`/admin/devices/${device.id}/control`, 303)
})

app.post('/admin/maintenance/:id/advance', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const record = await c.env.RENT.prepare("SELECT * FROM maintenance_records WHERE id = ? AND status NOT IN ('COMPLETED','FAILED')").bind(c.req.param('id')).first() as any
  if (!record) return c.text('维护记录不存在或已结束', 409)
  const next = ({ OPEN: 'IN_PROGRESS', IN_PROGRESS: 'DATA_CLEAN', DATA_CLEAN: 'SYSTEM_RESET', SYSTEM_RESET: 'CLIENT_CHECK' } as Record<string, string>)[record.status]
  if (!next) return c.text('维护状态无效', 409)
  await c.env.RENT.prepare("UPDATE maintenance_records SET status = ?, completed_at = CASE WHEN ? = 'COMPLETED' THEN CURRENT_TIMESTAMP END WHERE id = ?").bind(next, next, record.id).run()
  if (next === 'CLIENT_CHECK') await c.env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'CHECK_UPDATE', '{}', ?, datetime('now', '+24 hours'))").bind(`cmd-${nanoid(12)}`, record.device_id, user.id).run()
  await createAuditLog(c, { actor: user, action: 'MAINTENANCE_ADVANCED', targetType: 'MAINTENANCE_RECORD', targetId: record.id, before: { status: record.status }, after: { status: next } })
  return c.redirect(`/admin/devices/${record.device_id}/control`, 303)
})

app.post('/admin/maintenance/:id/checks', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const record = await c.env.RENT.prepare("SELECT * FROM maintenance_records WHERE id = ? AND status IN ('DATA_CLEAN','SYSTEM_RESET','CLIENT_CHECK')").bind(c.req.param('id')).first() as any
  if (!record) return c.text('维护记录不在可验证阶段', 409)
  const form = await c.req.parseBody()
  const checkType = String(form.checkType || '')
  const passed = String(form.passed || '') === '1'
  const allowed = new Set(['DATA_WIPE','SYSTEM_RESET','WINDOWS_BOOT','AGENT_INSTALLED','AGENT_VERSION','DEVICE_SERIAL','DISK_HEALTH','NETWORK','HARDWARE','ACCESSORIES'])
  if (!allowed.has(checkType)) return c.text('维护检查项无效', 400)
  await c.env.RENT.prepare('INSERT INTO maintenance_preparation_checks (id, maintenance_id, check_type, passed, details, verified_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(maintenance_id, check_type) DO UPDATE SET passed = excluded.passed, details = excluded.details, verified_by = excluded.verified_by, verified_at = CURRENT_TIMESTAMP').bind(`mpc-${nanoid(12)}`, record.id, checkType, passed ? 1 : 0, String(form.details || '').trim().slice(0, 1000) || null, user.id).run()
  await createAuditLog(c, { actor: user, action: 'MAINTENANCE_CHECK_RECORDED', targetType: 'MAINTENANCE_RECORD', targetId: record.id, after: { checkType, passed } })
  return c.redirect(`/admin/devices/${record.device_id}/control`, 303)
})

app.post('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  if (![form.name, form.brand, form.model, form.serialNumber].every(value => value?.trim())) return c.text('请完整填写设备名称、品牌、型号和序列号', 400)
  if (!Number.isFinite(Number(form.pricePerDay)) || Number(form.pricePerDay) < 0 || !Number.isFinite(Number(form.depositAmount)) || Number(form.depositAmount) < 0) return c.text('日租金和押金必须是有效的非负金额', 400)
  if (!['available', 'rented', 'maintenance', 'retired'].includes(form.status || 'available')) return c.text('设备状态无效', 400)
  if (form.lifecycleStatus && !['RESERVED', 'READY', 'RENTED', 'RETURNED', 'INSPECTION', 'MAINTENANCE', 'DAMAGED', 'RETIRED'].includes(form.lifecycleStatus)) return c.text('设备生命周期状态无效', 400)
  if (!['unregistered', 'online', 'offline', 'paused'].includes(form.agentStatus || 'unregistered')) return c.text('代理状态无效', 400)
  if (!['normal', 'return', 'maintenance', 'lost'].includes(form.deviceMode || 'normal')) return c.text('客户设备状态无效', 400)
  await updateDevice(c, c.req.param('id'), {
    name: form.name,
    brand: form.brand,
    model: form.model,
    serialNumber: form.serialNumber,
    cpu: form.cpu,
    ram: form.ram,
    storage: form.storage,
    gpu: form.gpu,
    os: form.os,
    pricePerDay: Number(form.pricePerDay),
    depositAmount: Number(form.depositAmount),
    status: form.status as any,
    agentStatus: form.agentStatus as any,
    deviceMode: form.deviceMode as any,
    description: form.description || form.remark
  })
  if (form.lifecycleStatus) await recordDeviceLifecycle(c, c.req.param('id'), form.lifecycleStatus as any, { reason: '管理员手动更新设备生命周期', changedBy: user.id })
  const dates = [...new Set(String(form.unavailableDates || '').split(/[,\s]+/).map(value => value.trim()).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)))]
  await c.env.RENT.prepare('DELETE FROM device_unavailable_dates WHERE device_id = ?').bind(c.req.param('id')).run()
  if (dates.length) await c.env.RENT.batch(dates.map(date => c.env.RENT.prepare('INSERT INTO device_unavailable_dates (device_id, unavailable_date) VALUES (?, ?)').bind(c.req.param('id'), date)))
  return c.redirect(`/admin/devices/${encodeURIComponent(c.req.param('id'))}/edit?success=设备资料已保存`)
})

app.post('/admin/devices/:id/delete', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const deleted = await deleteDevice(c, c.req.param('id'))
  if (!deleted) return c.text('该设备已有订单、租赁或合同记录，已改为退役，历史数据保持不变。', 409)
  return c.redirect('/admin/devices')
})


app.get('/admin/settings', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  await loadSystemSettingsFromDB(c)
  return c.html(pages.renderAdminSettings(user, await getStripeConfigSummary(c), await getEmailConfigSummary(c)))
})

app.post('/admin/coupons', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const code = String(form.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
  const discountType = String(form.discountType || '')
  const discountValue = Number(form.discountValue)
  const maxUses = String(form.maxUses || '').trim() ? Number(form.maxUses) : null
  const deviceId = String(form.deviceId || '').trim() || null
  const brand = String(form.brand || '').trim().slice(0, 120) || null
  const configKeyword = String(form.configKeyword || '').trim().slice(0, 120) || null
  if (!code || !['percent', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100) || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))) return c.redirect('/admin/coupons?error=' + encodeURIComponent('请检查优惠码、折扣值和最多使用次数'))
  try {
    await c.env.RENT.prepare('INSERT INTO coupons (id, code, discount_type, discount_value, max_uses, starts_at, expires_at, created_by, device_id, brand, config_keyword) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(`cp-${nanoid(10)}`, code, discountType, discountValue, maxUses, String(form.startsAt || '').replace('T', ' ') || null, String(form.expiresAt || '').replace('T', ' ') || null, admin.id, deviceId, brand, configKeyword).run()
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return c.redirect('/admin/coupons?error=' + encodeURIComponent('优惠码已存在，请换一个代码'))
    throw error
  }
  return c.redirect('/admin/coupons?success=' + encodeURIComponent('优惠码创建成功'))
})

app.post('/admin/coupons/:id/delete', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  await c.env.RENT.prepare('DELETE FROM coupons WHERE id = ?').bind(c.req.param('id')).run()
  return c.redirect('/admin/coupons?success=' + encodeURIComponent('优惠码已删除'))
})

app.post('/admin/coupons/:id/toggle', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  await c.env.RENT.prepare('UPDATE coupons SET active = CASE active WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(c.req.param('id')).run()
  return c.redirect('/admin/coupons')
})

app.get('/admin/templates', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  return c.html(pages.renderAdminTemplateHub(user))
})

app.get('/admin/templates/preview', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  await loadSystemSettingsFromDB(c)
  return c.redirect('/admin/templates/preview/agreements')
})

app.get('/admin/templates/preview/:previewKind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const previewKind = c.req.param('previewKind')
  if (!['agreements', 'contract'].includes(previewKind)) return c.html(renderNotFound(), 404)
  await loadSystemSettingsFromDB(c)
  return c.html(await pages.renderAdminTemplatePreview(user, c, previewKind))
})

app.get('/admin/templates/:kind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const kind = c.req.param('kind')
  if (kind === 'contract') return c.html(await pages.renderAdminContracts(c, user))
  if (!['user', 'rental', 'service', 'privacy', 'software', 'copyright'].includes(kind)) return c.html(renderNotFound(), 404)
  await loadSystemSettingsFromDB(c)
  const settingKey = ({ user: 'userTerms', rental: 'rentalTerms', service: 'serviceTerms', privacy: 'privacyPolicy', software: 'softwareTerms', copyright: 'copyrightNotice' } as const)[kind as 'user' | 'rental' | 'service' | 'privacy' | 'software' | 'copyright']
  const databaseSetting = await c.env.RENT.prepare('SELECT value FROM systemSettings WHERE key = ?').bind(settingKey).first() as any
  return c.html(pages.renderAdminAgreementEditor(user, kind, databaseSetting?.value !== undefined ? String(databaseSetting.value) : undefined))
})

app.post('/admin/templates/:kind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.json({ success: false, error: '无权限保存协议' }, 403)
  const kind = c.req.param('kind')
  if (!['user', 'rental', 'service', 'privacy', 'software', 'copyright'].includes(kind)) return c.json({ success: false, error: '未知的协议类型' }, 404)
  try {
    const contentType = c.req.header('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await c.req.json()
      : await c.req.parseBody()
    const content = sanitizeRichHtml(payload?.content || '')
    if (!String(content).trim()) return c.json({ success: false, error: '协议内容不能为空，请填写后再保存' }, 400)
    await loadSystemSettingsFromDB(c)
    const settingKey = ({ user: 'userTerms', rental: 'rentalTerms', service: 'serviceTerms', privacy: 'privacyPolicy', software: 'softwareTerms', copyright: 'copyrightNotice' } as const)[kind as 'user' | 'rental' | 'service' | 'privacy' | 'software' | 'copyright']
    const metadata = getSystemSettings().legalMetadata || {}
    const lastUpdatedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload?.lastUpdatedDate || '')) ? String(payload.lastUpdatedDate) : new Date().toISOString().slice(0, 10)
    const before = String((getSystemSettings() as any)[settingKey] || '')
    const legalMetadata = { ...metadata, [kind]: { version: String(payload?.version || '1.0').trim().slice(0, 30) || '1.0', lastUpdatedDate } }
    await c.env.RENT.batch([
      c.env.RENT.prepare('INSERT INTO systemSettings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP').bind(settingKey, content),
      c.env.RENT.prepare('INSERT INTO systemSettings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP').bind('legalMetadata', JSON.stringify(legalMetadata)),
    ])
    const saved = await c.env.RENT.prepare('SELECT value FROM systemSettings WHERE key = ?').bind(settingKey).first() as any
    if (String(saved?.value ?? '') !== content) throw new Error('协议保存校验失败，请重试')
    await loadSystemSettingsFromDB(c)
    if (before !== content) await notifyAgreementUpdate(c, [[settingKey, ({ user: '用户协议', rental: '租赁协议', service: '服务条款', privacy: '隐私政策', software: '软件使用协议', copyright: '退款政策' } as any)[kind]]], getSystemSettings().companyDetails)
    return contentType.includes('application/json') ? c.json({ success: true }) : c.redirect(`/admin/templates/${kind}`)
  } catch (error: any) {
    return c.json({ success: false, error: error?.message || '协议保存失败' }, 400)
  }
})

app.post('/admin/template-preview', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.json({ success: false, error: '无权限预览' }, 403)
  try {
    const payload = await c.req.json()
    const kind = String(payload?.kind || '').trim()
    const content = String(payload?.content || '')
    if (!content) return c.json({ success: false, error: '缺少内容' }, 400)
    await loadSystemSettingsFromDB(c)
    let html = ''
    if (kind === 'rental') {
      const sampleContract = {
        id: 'sample-contract',
        rentalId: 'sample-order',
        contractNumber: 'CTR-0001',
        content,
        signedAt: null,
        status: 'pending_sign',
        contract_data: {
          customer_name: '测试客户',
          customer_email: 'test@example.com',
          customer_phone: '0412345678',
          customer_address: '墨尔本 VIC',
          device_name: 'MacBook Pro',
          device_model: 'M2',
          device_sn: 'SN123456',
          pickup_location: '市中心门店',
          return_location: '市中心门店',
          payment_reference: 'REF123456',
        }
      } as any
      const sampleOrder = {
        id: 'sample-order',
        orderNo: 'OD20260806',
        deviceId: 'device-1',
        startDate: '2026-08-10',
        endDate: '2026-08-15',
        rentalPeriod: 5,
        totalAmount: 1500,
        depositAmount: 300,
        dailyRate: 240,
        paymentMethod: 'card',
        status: 'pending_payment',
      } as any
      const sampleDevice = {
        id: 'device-1',
        name: 'MacBook Pro',
        brand: 'Apple',
        model: 'M2',
        serialNumber: 'SN123456',
        cpu: 'M2',
        ram: '16GB',
        storage: '512GB',
        gpu: 'Apple',
        os: 'macOS Ventura',
      } as any
      const sampleCustomer = {
        name: '测试客户',
        email: 'test@example.com',
        phone: '0412345678',
      } as any
      const sampleExtra = {
        payment_date: '2026-08-08',
        payment_reference: 'REF123456',
        contract_url: 'https://example.com/contract/CTR-0001',
        invoice_url: 'https://example.com/invoice/INV-0001',
      }
      html = renderContractVariables(content, sampleContract, sampleOrder, sampleDevice, sampleCustomer, sampleExtra, true)
    } else if (kind === 'contract') {
      const sampleContract = {
        id: 'sample-contract',
        rentalId: 'sample-order',
        contractNumber: 'CTR-0001',
        content,
        signedAt: '2026-08-08T10:00:00.000Z',
        status: 'signed',
        contract_data: {
          customer_name: '测试客户',
          customer_email: 'test@example.com',
          customer_phone: '0412345678',
          customer_address: '墨尔本 VIC',
          device_name: 'MacBook Pro',
          device_model: 'M2',
          device_sn: 'SN123456',
          pickup_location: '市中心门店',
          return_location: '市中心门店',
          payment_reference: 'REF123456',
        }
      } as any
      const sampleOrder = {
        id: 'sample-order',
        orderNo: 'OD20260806',
        deviceId: 'device-1',
        startDate: '2026-08-10',
        endDate: '2026-08-15',
        rentalPeriod: 5,
        totalAmount: 1500,
        depositAmount: 300,
        dailyRate: 240,
        paymentMethod: 'card',
        status: 'completed',
      } as any
      const sampleDevice = {
        id: 'device-1',
        name: 'MacBook Pro',
        brand: 'Apple',
        model: 'M2',
        serialNumber: 'SN123456',
        cpu: 'M2',
        ram: '16GB',
        storage: '512GB',
        gpu: 'Apple',
        os: 'macOS Ventura',
      } as any
      const sampleCustomer = {
        name: '测试客户',
        email: 'test@example.com',
        phone: '0412345678',
      } as any
      const sampleExtra = {
        payment_date: '2026-08-08',
        payment_reference: 'REF123456',
        contract_url: 'https://example.com/contract/CTR-0001',
        invoice_url: 'https://example.com/invoice/INV-0001',
      }
      html = renderContractVariables(content, sampleContract, sampleOrder, sampleDevice, sampleCustomer, sampleExtra, true)
    } else if (kind === 'email') {
      html = renderSiteVariables(content, user, {
        order_no: 'OD20260806',
        contract_number: 'CTR-0001',
        device_name: 'MacBook Pro',
        sign_link: 'https://example.com/sign/abc',
        expire_time: '2026-08-15',
      })
    } else {
      html = renderSiteVariables(content, user)
    }
    return c.json({ success: true, html })
  } catch (error: any) {
    return c.json({ success: false, error: error?.message || '预览失败' }, 400)
  }
})

app.post('/admin/settings/save', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.text('无权限', 403)
  }
  try {
    return await actions.handleSaveAdminSettings(c)
  } catch (error: any) {
    return c.json({ success: false, error: error.message || '保存失败' }, 400)
  }
})

app.get('/api/address/autocomplete', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.json({ error: '无权限查询地址' }, 403)
  const input = String(c.req.query('q') || '').trim().slice(0, 120)
  if (input.length < 3) return c.json({ suggestions: [] })
  const headers = { Accept: 'application/json', 'User-Agent': 'PC-Rental/1.0 address search' }
  const providers = [
    async () => {
      const response = await fetch('https://photon.komoot.io/api/?' + new URLSearchParams({ q: `${input}, Australia`, limit: '6', lang: 'en' }), { headers })
      if (!response.ok) throw new Error(`Photon ${response.status}`)
      const data = await response.json() as any
      return (data.features || []).map((feature: any) => feature.properties || {})
    },
    async () => {
      const response = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: `${input}, Australia`, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'au' }), { headers })
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const data = await response.json() as any[]
      return data.map((item: any) => ({ ...item.address, osm_type: item.osm_type, osm_id: item.osm_id, display_name: item.display_name }))
    },
  ]
  for (const provider of providers) {
    try {
      const items = await provider()
      const suggestions = items.slice(0, 6).map((p: any) => {
        const street = [p.housenumber, p.house_number, p.street, p.road].filter(Boolean).join(' ')
        const text = [street, p.city || p.town || p.suburb || p.locality, p.state, p.postcode].filter(Boolean).join(', ') || String(p.display_name || '')
        const placeId = `${p.osm_type || 'osm'}_${p.osm_id || text}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 300)
        const stateNames: Record<string, string> = { victoria: 'VIC', vic: 'VIC', 'new south wales': 'NSW', nsw: 'NSW', queensland: 'QLD', qld: 'QLD', 'south australia': 'SA', sa: 'SA', 'western australia': 'WA', wa: 'WA', tasmania: 'TAS', tas: 'TAS', 'northern territory': 'NT', nt: 'NT', 'australian capital territory': 'ACT', act: 'ACT' }
        const rawState = String(p.state || '').trim()
        const state = stateNames[rawState.toLowerCase()] || rawState.toUpperCase()
        return { placeId, text, street, suburb: p.city || p.town || p.suburb || p.locality || '', state, postcode: p.postcode || '', formattedAddress: text }
      }).filter((item: any) => item.placeId && item.text)
      if (suggestions.length) return c.json({ suggestions })
    } catch (error: any) {
      console.error('Address provider failed:', error?.message || error)
    }
  }
  return c.json({ error: '地址联想暂时不可用，可手工填写地址' }, 502)
})

app.get('/api/address/details', async (c) => {
  const user = c.get('user')
  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) return c.json({ error: '无权限查询地址' }, 403)
  const apiKey = String(c.env.GOOGLE_MAPS_API_KEY || '')
  if (!apiKey) return c.json({ error: '地址联想尚未配置' }, 503)
  const placeId = String(c.req.query('placeId') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 300)
  const sessionToken = String(c.req.query('session') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  if (!placeId) return c.json({ error: '地址标识无效' }, 400)
  const params = new URLSearchParams({ languageCode: 'en', regionCode: 'AU', ...(sessionToken ? { sessionToken } : {}) })
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params}`, { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'formattedAddress,addressComponents' } })
  if (!response.ok) {
    console.error('Google address details failed:', response.status)
    return c.json({ error: '无法读取地址详情，请手工填写' }, 502)
  }
  const place = await response.json() as any
  const component = (type: string, short = false) => {
    const item = (place.addressComponents || []).find((entry: any) => entry.types?.includes(type))
    return String((short ? item?.shortText : item?.longText) || '')
  }
  const street = [component('street_number'), component('route')].filter(Boolean).join(' ')
  const suburb = component('locality') || component('postal_town') || component('sublocality_level_1')
  return c.json({ formattedAddress: String(place.formattedAddress || ''), street, suburb, state: component('administrative_area_level_1', true), postcode: component('postal_code') })
})


async function hashAgentValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

async function getAgentDevice(c: any): Promise<any | null> {
  const header = String(c.req.header('Authorization') || '')
  if (!header.startsWith('Bearer ')) return null
  return await c.env.RENT.prepare('SELECT * FROM devices WHERE agent_token_hash = ?').bind(await hashAgentValue(header.slice(7).trim())).first()
}

app.post('/api/device-agent/register', async (c) => {
  if (new URL(c.req.url).protocol !== 'https:') return c.json({ ok: false, error: 'HTTPS is required for device registration' }, 400)
  const payload = await c.req.json().catch(() => ({})) as any
  const serialNumber = String(payload.serialNumber || '').trim()
  const setupCode = String(payload.setupCode || '').trim()
  if (!/^\d{6}$/.test(setupCode)) return c.json({ ok: false, error: 'setupCode must be exactly 6 digits' }, 400)
  const setupCodeHash = await hashAgentValue(setupCode)
  const device = await c.env.RENT.prepare('SELECT id, name, serialNumber FROM devices WHERE agent_setup_code_hash = ? AND agent_setup_code_expires_at > CURRENT_TIMESTAMP').bind(setupCodeHash).first() as any
  if (!device) return c.json({ ok: false, error: 'Invalid or expired setup code' }, 401)
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
  const registration = await c.env.RENT.prepare(`UPDATE devices SET agent_token_hash = ?, agent_setup_code_hash = NULL, agent_setup_code_expires_at = NULL, agent_registered_at = CURRENT_TIMESTAMP, agent_status = 'offline', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND agent_setup_code_hash = ? AND agent_setup_code_expires_at > CURRENT_TIMESTAMP`).bind(await hashAgentValue(token), device.id, setupCodeHash).run()
  if (!registration.meta?.changes) return c.json({ ok: false, error: 'Invalid or expired setup code' }, 401)
  return c.json({ ok: true, apiBaseUrl: new URL(c.req.url).origin, deviceId: device.id, serialNumber: device.serialNumber, deviceName: device.name, uniqueCode: device.id, token })
})

app.post('/api/device-agent/heartbeat', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  const payload = await c.req.json().catch(() => ({})) as any
  await c.env.RENT.prepare(`UPDATE devices SET agent_last_seen_at = CURRENT_TIMESTAMP, agent_last_ip = ?, agent_hostname = ?, agent_os_version = ?, agent_cpu = ?, agent_memory_mb = ?, agent_storage_free_bytes = ?, agent_version = ?, agent_detected_serial = ?, agent_status = 'online', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).bind(c.req.header('CF-Connecting-IP') || null, payload.hostname || null, payload.osVersion || null, payload.cpu || null, Number.isFinite(payload.memoryMb) ? payload.memoryMb : null, Number.isFinite(payload.storageFreeBytes) ? payload.storageFreeBytes : null, String(payload.version || ''), String(payload.serialNumber || ''), device.id).run()
  return c.json({ ok: true, deviceId: device.id, deviceMode: device.device_mode || 'normal', remoteLockEnabled: Boolean(device.remote_lock_enabled), lockMessage: device.remote_lock_message || null })
})

app.post('/api/device-agent/inspection', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  const payload = await c.req.json().catch(() => ({})) as any
  const type = ['before_rental', 'after_return', 'automated_health'].includes(payload.inspectionType) ? payload.inspectionType : 'automated_health'
  const snapshot = JSON.stringify(payload.snapshot || {})
  const previous = await c.env.RENT.prepare('SELECT snapshot_json FROM device_inspections WHERE device_id = ? ORDER BY created_at DESC LIMIT 1').bind(device.id).first() as any
  const before = previous ? JSON.parse(previous.snapshot_json || '{}') : {}
  const current = payload.snapshot || {}
  if (type === 'automated_health' && device.inspection_requested_at) {
    const pendingRentalInspection = await c.env.RENT.prepare("SELECT i.id FROM device_inspections i JOIN orders o ON o.id = i.rental_id WHERE i.device_id = ? AND i.inspection_type = 'before_rental' AND o.status = 'draft' ORDER BY i.created_at DESC LIMIT 1").bind(device.id).first() as any
    if (pendingRentalInspection?.id) {
      await c.env.RENT.batch([
        c.env.RENT.prepare('UPDATE device_inspections SET snapshot_json = ?, differences_json = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?').bind(snapshot, JSON.stringify({}), pendingRentalInspection.id),
        c.env.RENT.prepare('UPDATE devices SET inspection_requested_at = NULL WHERE id = ?').bind(device.id),
      ])
      return c.json({ ok: true, inspectionId: pendingRentalInspection.id, updated: true })
    }
  }
  const differences = Object.fromEntries(Object.keys({ ...before, ...current }).filter(key => String(before[key] ?? '') !== String(current[key] ?? '')).map(key => [key, { before: before[key] ?? null, after: current[key] ?? null }]))
  const id = `inspection-${nanoid(12)}`
  if (type === 'automated_health') {
    await c.env.RENT.batch([
      c.env.RENT.prepare("DELETE FROM device_inspections WHERE device_id = ? AND inspection_type = 'automated_health' AND date(created_at) < date('now')").bind(device.id),
      c.env.RENT.prepare('INSERT INTO device_inspections (id, device_id, inspection_type, snapshot_json, differences_json) VALUES (?, ?, ?, ?, ?)').bind(id, device.id, type, snapshot, JSON.stringify(differences)),
    ])
  } else {
    await c.env.RENT.prepare('INSERT INTO device_inspections (id, device_id, inspection_type, snapshot_json, differences_json) VALUES (?, ?, ?, ?, ?)').bind(id, device.id, type, snapshot, JSON.stringify(differences)).run()
  }
  if (type === 'automated_health') await c.env.RENT.prepare('UPDATE devices SET inspection_requested_at = NULL WHERE id = ?').bind(device.id).run()
  if (type === 'automated_health' && Number(current.storageFreeBytes) < 10 * 1024 * 1024 * 1024) await c.env.RENT.prepare("INSERT INTO device_health_alerts (id, device_id, alert_type, severity, message) VALUES (?, ?, 'low_storage', 'warning', ?)").bind(`alert-${nanoid(12)}`, device.id, '设备剩余空间低于 10GB').run()
  return c.json({ ok: true, inspectionId: id, differences })
})

app.get('/api/device-agent/state', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  const rental = await c.env.RENT.prepare(`SELECT o.id, o.startDate AS start_date, o.endDate AS end_date, o.status, COALESCE(o.rental_status, CASE o.status WHEN 'active' THEN 'ACTIVE' WHEN 'paid' THEN 'CONFIRMED' ELSE o.status END) AS rental_status, COALESCE(o.payment_status, CASE WHEN o.status IN ('paid', 'active') THEN 'PAID' ELSE 'UNPAID' END) AS payment_status, u.name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.userId WHERE o.deviceId = ? AND o.status IN ('paid', 'active', 'pending_pickup', 'pending_return') ORDER BY CASE o.status WHEN 'active' THEN 0 WHEN 'pending_return' THEN 1 WHEN 'pending_pickup' THEN 2 ELSE 3 END, o.endDate DESC LIMIT 1`).bind(device.id).first()
  return c.json({ ok: true, serverTime: new Date().toISOString(), inspectionRequested: Boolean(device.inspection_requested_at), deviceId: device.id, deviceStatus: device.agent_status, deviceMode: device.device_mode || 'normal', remoteLockEnabled: Boolean(device.remote_lock_enabled), lockMessage: device.remote_lock_message || null, contractLink: device.contract_link || null, cleanupRequested: Boolean(device.cleanup_requested), cleanupRequestId: device.cleanup_requested_at || null, rental })
})

app.get('/api/device-agent/commands', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  await ensureDeviceCommandTables(c.env.RENT)
  await c.env.RENT.prepare("UPDATE device_commands SET status = 'EXPIRED', completed_at = CURRENT_TIMESTAMP WHERE device_id = ? AND status IN ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'RUNNING') AND datetime(expires_at) <= CURRENT_TIMESTAMP").bind(device.id).run()
  // Return the camelCase contract expected by the Windows client. SQLite column
  // names use snake_case, and System.Text.Json does not translate underscores.
  const commands = (await c.env.RENT.prepare("SELECT id, device_id AS deviceId, command_type AS commandType, payload, status, created_at AS createdAt, expires_at AS expiresAt FROM device_commands WHERE device_id = ? AND status = 'QUEUED' AND datetime(expires_at) > CURRENT_TIMESTAMP ORDER BY created_at ASC LIMIT 10").bind(device.id).all()).results || []
  if (commands.length) await c.env.RENT.prepare(`UPDATE device_commands SET status = 'SENT', sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP) WHERE device_id = ? AND status = 'QUEUED' AND id IN (${commands.map(() => '?').join(',')})`).bind(device.id, ...commands.map((item: any) => item.id)).run()
  return c.json({ ok: true, commands })
})

app.post('/api/device-agent/commands/:id/ack', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  const result = await c.env.RENT.prepare("UPDATE device_commands SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP WHERE id = ? AND device_id = ? AND status = 'SENT'").bind(c.req.param('id'), device.id).run() as any
  if (!result.meta?.changes) return c.json({ ok: false, error: 'Command is not awaiting acknowledgement' }, 409)
  return c.json({ ok: true })
})

app.post('/api/device-agent/commands/:id/start', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  const result = await c.env.RENT.prepare("UPDATE device_commands SET status = 'RUNNING', started_at = CURRENT_TIMESTAMP WHERE id = ? AND device_id = ? AND status IN ('SENT', 'ACKNOWLEDGED')").bind(c.req.param('id'), device.id).run() as any
  if (!result.meta?.changes) return c.json({ ok: false, error: 'Command is not runnable' }, 409)
  return c.json({ ok: true })
})

app.post('/api/device-agent/command-results', async (c) => {
  const device = await getAgentDevice(c)
  if (!device) return c.json({ ok: false, error: 'Invalid device token' }, 401)
  await ensureDeviceCommandTables(c.env.RENT)
  const payload = await c.req.json().catch(() => ({})) as any
  const commandId = String(payload.commandId || '').slice(0, 120)
  const resultCode = String(payload.resultCode || 'FAILED').slice(0, 40)
  if (!commandId || !/^[A-Z0-9_]+$/.test(resultCode)) return c.json({ ok: false, error: 'Invalid command result' }, 400)
  const command = await c.env.RENT.prepare('SELECT id FROM device_commands WHERE id = ? AND device_id = ?').bind(commandId, device.id).first()
  if (!command) return c.json({ ok: false, error: 'Command not found' }, 404)
  const success = Boolean(payload.success)
  const executedAt = String(payload.executedAt || new Date().toISOString()).slice(0, 40)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE device_commands SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ? AND device_id = ? AND status IN ('SENT', 'ACKNOWLEDGED', 'RUNNING')").bind(success ? 'SUCCESS' : 'FAILED', success ? null : String(payload.message || '').slice(0, 500), commandId, device.id),
    c.env.RENT.prepare('INSERT OR IGNORE INTO device_command_results (id, command_id, device_id, success, result_code, result_message, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`result-${nanoid(12)}`, commandId, device.id, success ? 1 : 0, resultCode, String(payload.message || '').slice(0, 500), executedAt),
  ])
  if (success) {
    const maintenance = await c.env.RENT.prepare("SELECT id FROM maintenance_records WHERE device_id = ? AND status = 'CLIENT_CHECK' ORDER BY started_at DESC LIMIT 1").bind(device.id).first() as any
    if (maintenance) {
      const checks = await c.env.RENT.prepare('SELECT COUNT(*) AS total FROM maintenance_preparation_checks WHERE maintenance_id = ? AND passed = 1').bind(maintenance.id).first() as any
      if (Number(checks?.total || 0) === 10) {
        await c.env.RENT.batch([
          c.env.RENT.prepare("UPDATE maintenance_records SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'CLIENT_CHECK'").bind(maintenance.id),
          c.env.RENT.prepare("UPDATE devices SET status = 'available', device_mode = 'normal' WHERE id = ?").bind(device.id),
        ])
        await recordDeviceLifecycle(c, device.id, 'READY', { reason: '维护、数据清除、系统重置与十项设备验证均通过' })
      }
    }
  }
  return c.json({ ok: true })
})

app.get('*', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  return c.html(pages.renderNotFound(user))
})

// Handle scheduled events (cron jobs) for Cloudflare Workers
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    // Create a minimal context object that implements what our cleanup function needs
    const c = {
      env,
      get: (key: string) => undefined,
      set: () => { },
      req: { url: 'https://scheduled-event' },
      // Expose getDB function that the site.ts functions expect
      ...(() => {
        const getDB = () => env.RENT
        return { getDB }
      })()
    } as any

    // Import and run the cleanup function
    const { cleanupExpiredAndCancelledContracts, cleanupExpiredGuestAccounts, cancelExpiredPendingPaymentOrders, notifyOverduePaymentProofs, logError } = await import('./site')
    ctx.waitUntil(
      (async () => {
        try {
          await ensureDeviceCommandTables(env.RENT)
          const handoverRows = (await env.RENT.prepare("SELECT id, rental_status, startDate FROM orders WHERE payment_status = 'PAID' AND rental_status = 'READY_FOR_PICKUP' AND startDate <= date('now')").all()).results || []
          for (const row of handoverRows as any[]) {
            await env.RENT.batch([
              env.RENT.prepare("UPDATE orders SET rental_status = 'HANDOVER_PENDING', handover_overdue = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND rental_status = 'READY_FOR_PICKUP'").bind(row.id),
              env.RENT.prepare("INSERT INTO rental_status_history (id, rental_id, old_status, new_status, trigger_type, reason) VALUES (?, ?, ?, ?, 'SYSTEM', ?)").bind(`rsh-${crypto.randomUUID()}`, row.id, row.rental_status, 'HANDOVER_PENDING', '已到预约取货日期但尚未确认交付')
            ])
          }
          const lifecycleRows = (await env.RENT.prepare(`SELECT o.id, o.deviceId, o.status, o.startDate, o.endDate, c.id AS contract_id, c.contract_data, u.name AS customer_name FROM orders o JOIN contracts c ON c.orderId = o.id LEFT JOIN users u ON u.id = o.userId WHERE o.status IN ('paid', 'active', 'completed') AND c.status IN ('signed', 'completed')`).all()).results || []
          const today = new Date().toISOString().slice(0, 10)
          for (const row of lifecycleRows as any[]) {
            let data: any = {}
            try { data = JSON.parse(row.contract_data || '{}') } catch (_) { }
            if (!data.windows_password) continue
            const username = data.windows_username || row.customer_name || 'RentalUser'
            if (['paid', 'active'].includes(String(row.status)) && String(row.startDate) <= today && !data.windows_account_created) {
              await env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'CREATE_RENTAL_USER', ?, NULL, datetime('now', '+7 days'))").bind(`cmd-${crypto.randomUUID()}`, row.deviceId, JSON.stringify({ username, password: data.windows_password })).run()
              data.windows_account_created = true
              await env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(data), row.contract_id).run()
            }
            if (String(row.status) === 'completed' && !data.windows_account_deleted) {
              await env.RENT.prepare("INSERT INTO device_commands (id, device_id, command_type, payload, created_by, expires_at) VALUES (?, ?, 'DELETE_RENTAL_USER', ?, NULL, datetime('now', '+30 days'))").bind(`cmd-${crypto.randomUUID()}`, row.deviceId, JSON.stringify({ username })).run()
              data.windows_account_deleted = true
              await env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ?').bind(JSON.stringify(data), row.contract_id).run()
            }
          }
          for (const column of ['deletion_requested_at', 'deletion_scheduled_at']) {
            try { await env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run() } catch (_) { }
          }
          const deletedAccountResult = await env.RENT.prepare(`UPDATE users SET name = '删除账户', email = 'deleted-account-' || id || '@invalid.local', phone = NULL, bsb = NULL, account = NULL, account_number = NULL, balance = 0, commission_balance = 0, password_hash = 'disabled', password_salt = 'disabled', referral_code = NULL, referrer_id = NULL, staff_id = NULL, user_agreement_accepted_ip = NULL, status = 'inactive', account_status = 'inactive', deleted_at = CURRENT_TIMESTAMP, deletion_requested_at = NULL, deletion_scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE role = 'CUSTOMER' AND status = 'active' AND deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= CURRENT_TIMESTAMP`).run()
          const deletedCount = await cleanupExpiredAndCancelledContracts(c)
          const expiredGuestCount = await cleanupExpiredGuestAccounts(c)
          const expiredPaymentCount = await cancelExpiredPendingPaymentOrders(c)
          const dueNotificationCount = await createDueDateNotifications(c)
          const overduePaymentNotificationCount = await notifyOverduePaymentProofs(c)
          const expiredInspectionResult = await env.RENT.prepare("DELETE FROM device_inspections WHERE created_at < datetime('now', '-1 year')").run()
          console.log(`Scheduled contract cleanup completed: removed ${deletedCount} expired/cancelled contracts`)
          console.log(`Scheduled account cleanup completed: disabled ${Number(deletedAccountResult.meta?.changes || 0)} accounts`)
          console.log(`Scheduled guest cleanup completed: disabled ${expiredGuestCount} expired guest accounts`)
          console.log(`Scheduled payment cleanup completed: cancelled ${expiredPaymentCount} unpaid orders`)
          console.log(`Scheduled due notifications completed: created ${dueNotificationCount} reminders`)
          console.log(`Scheduled payment review notifications completed: notified ${overduePaymentNotificationCount} proofs`)
          console.log(`Scheduled inspection cleanup completed: removed ${Number(expiredInspectionResult.meta?.changes || 0)} records`)
        } catch (error) {
          await logError(c, 'ERROR', 'Failed to run scheduled contract cleanup', error as Error)
          console.error('Scheduled contract cleanup failed:', error)
        }
      })()
    )
  }
}
