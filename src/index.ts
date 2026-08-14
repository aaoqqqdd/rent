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
  releaseDeviceIfUnbooked,
  getContractById,
  updateContractTemplate,
  CONTRACT_OPERATIONAL_FIELDS,
  CONTRACT_SIGNED_FIELDS,
  issueInvoice,
  ensureOrderNumber,
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
  getUsers
  , createNotification
  , getNotifications
  , createDueDateNotifications
  , sanitizePlainText
  , renderNotificationMarkdown
  , renderFlexibleContent
  , renderEmailNotificationHtml
  , ensureNotificationsTable
} from './site'
import { nanoid } from 'nanoid'
import { getStripeConfigSummary } from './stripe'
import { getEmailConfigSummary } from './emailConfig'
import { notifyAgreementUpdate } from './actions/admin/saveSettings'
import { createStripeCheckout, handleStripeWebhook, refundDeposit, cancelAndRefund } from './actions/stripePayments'
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
    const allowedExact = new Set(['/customer/guest', '/customer/guest/upgrade', '/logout', '/payment/result'])
    const orderMatch = path.match(/^\/customer\/orders\/([^/]+)(?:\/(?:stripe\/checkout|bank-transfer-proof))?$/)
    const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoice$/)
    if (orderMatch && orderMatch[1] !== user.guestOrderId) return c.html(renderForbidden(), 403)
    if (invoiceMatch && invoiceMatch[1] !== user.guestOrderId) return c.html(renderForbidden(), 403)
    const permitted = allowedExact.has(path) || Boolean(orderMatch) || Boolean(invoiceMatch) || path.startsWith('/contract/view/') || path === '/styles.css'
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
  if (rateRule && !await enforceRateLimit(c, rateRule[0], ip, rateRule[1], rateRule[2])) return c.text('请求过于频繁，请稍后再试', 429)
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
  return c.html(pages.renderLogin(undefined, shouldShowTestAccounts(c)))
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
  if (failureCount > 0 && recentFailures?.latest) {
    const lockMinutes = Math.min(60, failureCount === 1 ? 1 : failureCount === 2 ? 3 : failureCount === 3 ? 5 : failureCount + 2)
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
    } catch (_) {}
  }
  const isDemoAccount = ['u-admin', 'u-staff', 'u-customer'].includes(String(user.id))
  if (isDemoAccount && !isCustomerLoginHost(c)) return c.html(pages.renderLogin('展示账户只能从 test-rent.ydnw6zt6vj.workers.dev 访问。', shouldShowTestAccounts(c)), 403)
  if (user.role === 'CUSTOMER' && !isCustomerLoginHost(c)) return c.html(pages.renderLogin('客户账户只能从测试租赁域名登录。', shouldShowTestAccounts(c)), 403)
  await c.env.RENT.prepare("INSERT INTO login_history (user_id, account, ip_address, user_agent, status) VALUES (?, ?, ?, ?, 'success')").bind(user.id, normalizedAccount, loginIp, c.req.header('User-Agent') || '').run()
  await c.env.RENT.prepare('DELETE FROM login_attempts WHERE ip_address = ? AND account = ?').bind(loginIp, normalizedAccount).run()
  const response = c.redirect(user.role === 'CUSTOMER' ? (user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard') : user.role === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard')
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
  return c.html(pages.renderRegister(undefined, String((c.env as any).TURNSTILE_SITE_KEY || '')))
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
  await c.env.RENT.prepare('INSERT INTO email_verifications (id, user_id, email, token_hash, sent_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(nanoid(), user.id, user.email, tokenHash, now.toISOString(), expiresAt).run()
  const apiKey = String((c.env as any).RESEND_API_KEY || '')
  const from = String((c.env as any).EMAIL_FROM || '')
  if (!apiKey || !from) return
  const verifyUrl = `${new URL(c.req.url).origin}/verify-email?token=${encodeURIComponent(token)}`
  await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [user.email], subject: '验证您的邮箱 - PC Rental', text: `您好 ${user.name}，请在 24 小时内打开以下链接验证邮箱：\n${verifyUrl}` }) })
}

app.get('/terms', async (c) => {
  const settings = await loadSystemSettingsFromDB(c)
  const currentUser = c.get('user')
  const content = renderSiteVariables(settings.userTerms, currentUser)
  return c.html(buildLayout('用户协议', `<div class="panel contract-section"><div class="section-title"><h2>用户协议</h2><span class="section-note mono">LEGAL / USER TERMS</span></div>${content}<p style="margin-top:24px"><a class="button button-secondary" href="/register">返回注册</a></p></div>`, currentUser))
})

for (const [path, title, key, code] of [
  ['/service-terms', '网站服务条款', 'serviceTerms', 'LEGAL / SERVICE TERMS'],
  ['/privacy', '隐私政策', 'privacyPolicy', 'LEGAL / PRIVACY'],
  ['/refund-policy', '退款政策', 'copyrightNotice', 'LEGAL / REFUND POLICY'],
  ['/copyright', '退款政策', 'copyrightNotice', 'LEGAL / REFUND POLICY'],
] as const) {
  app.get(path, async (c) => {
    const settings = await loadSystemSettingsFromDB(c)
    const currentUser = c.get('user')
    const metadataKey = key === 'copyrightNotice' ? 'copyright' : path === '/terms' ? 'user' : path === '/service-terms' ? 'service' : 'privacy'
    const metadata = settings.legalMetadata[metadataKey]
    const content = renderSiteVariables(settings[key], currentUser, {
      ...(metadataKey === 'user' ? { user_agreement_version: metadata.version, user_agreement_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'service' ? { service_terms_version: metadata.version, service_terms_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'privacy' ? { privacy_policy_version: metadata.version, privacy_policy_last_updated_date: metadata.lastUpdatedDate } : {}),
      ...(metadataKey === 'copyright' ? { refund_policy_version: metadata.version, refund_policy_last_updated_date: metadata.lastUpdatedDate, last_updated_date: metadata.lastUpdatedDate } : {}),
    })
    return c.html(buildLayout(title, `<article class="panel legal-document"><div class="section-title"><div><p class="section-code">${code}</p><h2>${title}</h2></div></div><div class="legal-document__content">${content}</div></article>`, currentUser))
  })
}

app.post('/register', async (c) => {
  const form = await c.req.parseBody()
  const { firstName, lastName, email, password, passwordConfirm, referrer, countryCode, phone } = form
  const renderRegistrationError = (message: string) => pages.renderRegister(message, String((c.env as any).TURNSTILE_SITE_KEY || ''))
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
  if (referrer && referrer.trim()) {
    const referrerUser = await findUserByReferralCode(c, referrer)
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
    try { await c.env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} ${definition}`).run() } catch (_) {}
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
  const session = await createAuthSession(c, newUserId)
  response.headers.set('Set-Cookie', `session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${new URL(c.req.url).protocol === 'https:' ? '; Secure' : ''}`)

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
  const email = form.email?.trim()
  if (!email) {
    return c.html(pages.renderForgotPassword('请输入邮箱地址'))
  }
  return c.html(pages.renderForgotPassword('重置链接已发送至您的邮箱，请查收'))
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
  return c.html(pages.renderCustomerDashboard(user, orders, devices))
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

app.post('/customer/balance/top-up', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType === 'guest') return c.html(renderForbidden(), 403)
  await loadSystemSettingsFromDB(c)
  const form = await c.req.parseBody()
  const amount = Number(form.amount)
  const method = String(form.method || '')
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000 || !['card', 'bank_transfer'].includes(method)) return c.html(pages.renderCustomerBalanceTopUp(c, user, '请输入 1 至 10,000 AUD 的有效充值金额。'), 400)
  const id = `topup-${nanoid(12)}`
  await c.env.RENT.prepare("INSERT INTO balance_topups (id, user_id, amount, payment_method, status) VALUES (?, ?, ?, ?, 'pending')").bind(id, user.id, Number(amount.toFixed(2)), method).run()
  if (method === 'bank_transfer') {
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
  await c.env.RENT.prepare("UPDATE balance_topups SET reference = ?, note = ?, status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reference, String(form.note || '').trim(), id).run()
  return c.redirect('/customer/balance')
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
  const current = Number(target.balance || 0)
  const next = Number((current + amount).toFixed(2))
  if (next < 0) return c.text('扣减后余额不能小于 0', 400)
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(next, target.id),
    c.env.RENT.prepare('INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`bt-${crypto.randomUUID()}`, target.id, amount, next, amount > 0 ? 'admin_credit' : 'admin_debit', reason, admin.id),
  ])
  return c.redirect(`/admin/users/${target.id}`)
})

app.post('/admin/balance-topups/:id/approve', async (c) => {
  const admin = c.get('user'); if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const topup = await c.env.RENT.prepare("SELECT * FROM balance_topups WHERE id = ? AND status = 'submitted'").bind(c.req.param('id')).first() as any
  if (!topup) return c.text('充值记录不存在或已处理', 409)
  const current = await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(topup.user_id).first() as any
  const next = Number((Number(current?.balance || 0) + Number(topup.amount)).toFixed(2))
  await c.env.RENT.batch([c.env.RENT.prepare("UPDATE balance_topups SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'submitted'").bind(topup.id), c.env.RENT.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(next, topup.user_id), c.env.RENT.prepare("INSERT INTO balance_transactions (id, user_id, amount, balance_after, type, reason, created_by) VALUES (?, ?, ?, ?, 'top_up_transfer', ?, ?)").bind(`bt-${nanoid(12)}`, topup.user_id, topup.amount, next, `银行转账充值（${topup.reference || '无 Reference'}）`, admin.id)])
  return c.redirect(`/admin/users/${topup.user_id}`)
})

app.get('/customer/guest', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER' || user.accountType !== 'guest') return c.redirect('/login')
  return c.html(await pages.renderGuestAccount(c, user))
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
  const message = c.req.query('success') || c.req.query('error')
  return c.html(await pages.renderCustomerOrderDetail(c, user, c.req.param('id'), message, c.req.query('success') ? 'success' : 'error'))
})

app.post('/customer/orders/:id/early-return', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.userId !== user.id) return c.html(renderForbidden(), 403)
  if (order.status !== 'active') return c.redirect(`/customer/orders/${order.id}?error=${encodeURIComponent('当前订单不能申请提前归还')}`)
  await updateOrderStatus(c, order.id, 'pending_return')
  const customer = await getUserById(c, user.id)
  if (customer?.staffId) await createNotification(c, { recipientId: customer.staffId, type: 'early_return', title: '客户申请提前归还', message: `${customer.name || '客户'} 已申请订单 ${order.orderNo || order.id} 提前归还，请安排验机。`, orderId: order.id })
  return c.redirect(`/customer/orders/${order.id}?success=${encodeURIComponent('已提交提前归还申请，请等待工作人员验机')}`)
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
  // Opening the notification center counts as reading the inbox, so the
  // header badge disappears immediately while the full history remains visible.
  await c.env.RENT.prepare('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE recipient_id = ? AND deleted_at IS NULL').bind(user.id).run()
  const notifications = await getNotifications(c, user.id)
  const sentAnnouncements = user.role === 'ADMIN' ? ((await c.env.RENT.prepare("SELECT MAX(id) AS id, title, message, created_at FROM notifications WHERE sender_id = ? AND type = 'announcement' AND deleted_at IS NULL GROUP BY title, message, created_at ORDER BY created_at DESC LIMIT 100").bind(user.id).all()).results || []) : []
  const recipients = user.role === 'ADMIN' || user.role === 'STAFF' ? (await getUsers(c)).filter((account: any) => (user.role === 'ADMIN' ? ['CUSTOMER', 'STAFF'].includes(account.role) : account.role === 'CUSTOMER' && account.staffId === user.id) && account.status !== 'inactive') : []
  const recipientOptions = recipients.map((account: any) => `<option value="${sanitizePlainText(account.id, 120)}">${sanitizePlainText(account.name || account.email, 120)} · ${sanitizePlainText(account.email, 160)}</option>`).join('')
  const body = `<div class="panel"><div class="section-title"><h2>通知中心</h2><span class="section-note">订单和归还提醒</span></div>${user.role === 'ADMIN' ? `<form method="post" action="/notifications/announcement" class="panel notification-compose"><h3>发布通告</h3><p class="form-text">通告会发送给所有活跃员工和客户，并在他们登录后显示。</p><div class="form-group"><label class="form-label" for="announcementTitle">通告标题</label><input class="form-control" id="announcementTitle" name="title" maxlength="120" required></div><div class="form-group"><label class="form-label" for="announcementMessage">通告内容（支持 Markdown）</label><textarea class="form-control markdown-editor" id="announcementMessage" name="message" maxlength="2000" required></textarea></div><button class="button button-primary" type="submit">发布通告</button></form>` : ''}${user.role === 'ADMIN' || user.role === 'STAFF' ? `<form method="post" action="/notifications/send" class="panel notification-compose"><h3>发送通知</h3><div class="form-group"><label class="form-label" for="notificationRecipient">收件人（可多选）</label><input class="form-control recipient-search" id="notificationRecipientSearch" type="search" placeholder="搜索姓名或邮箱…" autocomplete="off"><div class="recipient-picker-actions"><button type="button" class="button button-sm button-secondary" id="selectVisibleRecipients">全选当前结果</button><button type="button" class="button button-sm button-secondary" id="clearRecipients">清空选择</button><span id="recipientCount" class="section-note">已选 0 人</span></div><select class="form-control recipient-select" id="notificationRecipient" name="recipientId" multiple size="7" required>${recipientOptions}</select><small class="form-text">可搜索后全选当前结果，也可以按住 Command（Mac）或 Ctrl（Windows）逐个选择。</small></div><div class="form-group"><label class="form-label" for="notificationTitle">标题</label><input class="form-control" id="notificationTitle" name="title" maxlength="120" required></div><div class="form-group"><label class="form-label" for="notificationMessage">内容（支持 Markdown）</label><textarea class="form-control markdown-editor" id="notificationMessage" name="message" maxlength="1000" required></textarea></div><button class="button button-primary" type="submit">发送通知</button></form><script>(()=>{const search=document.getElementById('notificationRecipientSearch'),select=document.getElementById('notificationRecipient'),count=document.getElementById('recipientCount');if(!search||!select)return;const update=()=>{const query=search.value.trim().toLowerCase();Array.from(select.options).forEach(option=>{option.hidden=Boolean(query&&!option.textContent.toLowerCase().includes(query));});count.textContent='已选 '+Array.from(select.selectedOptions).length+' 人';};search.addEventListener('input',update);select.addEventListener('change',update);document.getElementById('selectVisibleRecipients')?.addEventListener('click',()=>{Array.from(select.options).forEach(option=>{if(!option.hidden)option.selected=true;});update();});document.getElementById('clearRecipients')?.addEventListener('click',()=>{Array.from(select.options).forEach(option=>option.selected=false);update();});update();})();</script>` : ''}${user.role === 'ADMIN' && sentAnnouncements.length ? `<section class="panel"><h3>已发布通告历史</h3><div class="notification-list">${sentAnnouncements.map((item: any) => `<article class="notification-item"><div><strong>${sanitizePlainText(item.title, 120)}</strong><div class="notification-message">${renderNotificationMarkdown(item.message)}</div><small>${item.created_at}</small></div><form method="post" action="/notifications/announcements/${item.id}/delete" onsubmit="return confirm('确定删除这条通告及其历史记录吗？')"><button class="button button-sm button-danger" type="submit">删除</button></form></article>`).join('')}</div></section>` : ''}${notifications.length ? `<div class="notification-list">${notifications.map((item: any) => `<article class="notification-item ${item.read_at ? '' : 'is-unread'}"><div><strong>${item.title}</strong><div class="notification-message">${renderNotificationMarkdown(item.message)}</div><small>${item.created_at}</small></div>${item.order_id ? `<a class="button button-sm button-secondary" href="${user.role === 'ADMIN' ? `/admin/orders/${item.order_id}` : user.role === 'STAFF' ? `/staff/orders/${item.order_id}` : `/customer/orders/${item.order_id}`}" >查看订单</a>` : ''}</article>`).join('')}</div>` : '<p class="empty-state">暂无通知</p>'}</div>`
  return c.html(buildLayout('通知中心', body, user))
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
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#f0a35b'").run() } catch (_) {}
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'").run() } catch (_) {}
  const format = 'html'
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(form.theme_color || '')) ? String(form.theme_color) : '#71818d'
  await c.env.RENT.prepare('INSERT INTO email_templates (id, name, subject, body, format, theme_color) VALUES (?, ?, ?, ?, ?, ?)').bind(`custom_${nanoid(12)}`, name, subject, body, format, themeColor).run()
  return c.redirect('/admin/email-templates')
})

app.post('/admin/email-templates/send', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const form = await c.req.parseBody()
  const template = form.templateId
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
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [mailTo], subject: fill(template.subject), text: filledBody, html }) })
    if (!response.ok) return c.text(`邮件发送失败：${await response.text()}`, 502)
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
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'").run() } catch (_) {}
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#f0a35b'").run() } catch (_) {}
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
  const title = String(form.title || '').trim().slice(0, 120)
  const message = String(form.message || '').trim().slice(0, 1000)
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
  if (couponCode) {
    const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(couponCode).first() as any
    if (!coupon) return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '优惠码无效、已过期或已达到使用次数上限'), 400)
    discountAmount = coupon.discount_type === 'percent' ? rentAmount * Number(coupon.discount_value) / 100 : Number(coupon.discount_value)
    discountAmount = Math.min(rentAmount, Math.max(0, Number(discountAmount.toFixed(2))))
    appliedCouponCode = String(coupon.code).toUpperCase()
    await c.env.RENT.prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(coupon.id).run()
  }
  const orderId = `o-${nanoid(8)}`
  await insertOrder(c, {
    id: orderId, orderNo: `OD${Date.now()}${nanoid(4).toUpperCase()}`, userId: user.id,
    deviceId: device.id, startDate, endDate, rentalPeriod, status: 'pending_approval',
    paymentMethod: 'bank_transfer', totalAmount: rentAmount + device.depositAmount - discountAmount,
    depositAmount: device.depositAmount, dailyRate: device.pricePerDay, contractId: '', signedAt: null, pickupLocation: deliveryMethod === 'Pickup' ? '到店自取' : deliveryAddress, returnLocation: '到店归还',
    deliveryMethod, deliveryFee: 0, rentalNote, couponCode: appliedCouponCode, discountAmount,
    createdAt: new Date().toISOString()
  } as any)
  const customer = await getUserById(c, user.id)
  const recipients = customer?.staffId ? [customer.staffId] : (await getUsers(c)).filter((account: any) => account.role === 'ADMIN' && account.status !== 'inactive').map((account: any) => account.id)
  await Promise.all(recipients.map((recipientId: string) => createNotification(c, { recipientId, type: 'rental_application', title: deliveryMethod === 'Delivery' ? '新租赁申请及配送确认' : '新租赁申请待审核', message: `${customer?.name || '客户'} 申请租赁 ${device.name}（${startDate} 至 ${endDate}）${deliveryMethod === 'Delivery' ? `，需要配送至：${deliveryAddress}，运费请确认` : '，客户选择到店自取'}。${rentalNote ? `备注：${rentalNote}` : ''}`, orderId: orderId })))
  return c.redirect(`/customer/orders/${orderId}`)
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
  return c.html(await pages.renderStaffOrderDetail(c, user, c.req.param('id')))
})

// 员工操作 - 已付款订单完成取货后进入租赁中
app.post('/staff/orders/:orderId/pickup', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }
  const orderId = c.req.param('orderId')
  const pickupOrder = await getOrderById(c, orderId)
  if (!pickupOrder || pickupOrder.status !== 'paid') return c.json({ success: false, message: '只有已付款订单可以确认取货' }, 409)
  await updateOrderStatus(c, orderId, 'active')
  return c.json({ success: true, message: '订单已进入租赁中' })
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
  const contract = await c.env.RENT.prepare('SELECT id, contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
  if (!contract) return c.text('订单缺少合同', 409)
  const data = JSON.parse(contract.contract_data || '{}')
  let damagePhotos = ''
  if (String(form.damagePhotos || '').trim()) {
    try { damagePhotos = validateHostedImageUrls(form.damagePhotos).join('\n') } catch (error: any) { return c.text(error.message, 400) }
  }
  if (damageDescription && !damagePhotos) return c.text('记录损坏时必须提供至少一张损坏照片链接', 400)
  Object.assign(data, checks, { battery_cycles: batteryCycles ?? '', battery_health: String(form.batteryHealth || '').trim().slice(0, 100), damage_description: damageDescription, damage_photos: damagePhotos, replacement_cost: replacementCost.toFixed(2), return_status: damageDescription ? 'Damaged' : 'Returned', return_date: now.slice(0, 10), inspection_date: now.slice(0, 10), inspection_by: user.name || user.id })
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE contracts SET contract_data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify(data), contract.id),
    c.env.RENT.prepare("UPDATE orders SET status = 'completed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
    c.env.RENT.prepare('UPDATE devices SET status = ? WHERE id = ?').bind(damageDescription ? 'maintenance' : 'available', order.deviceId),
  ])
  return c.redirect(`/staff/orders/${order.id}`)
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
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
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
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.redirect('/login')
  return c.html(await pages.renderStaffDeviceDetail(c, user, c.req.param('id')))
})



app.get('/staff/contracts/new', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderNewContractPage(c, user))
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
  if (!order || order.userId !== user.id || order.status !== 'pending_payment' || order.paymentMethod !== 'bank_transfer') return c.text('订单不能提交转账信息', 409)
  const form = await c.req.parseBody()
  const reference = String(form.referenceNumber || '').trim().slice(0, 100)
  const note = String(form.note || '').trim().slice(0, 500)
  let proofImageUrl = ''
  try { proofImageUrl = validateHostedImageUrls(form.imageUrl, 1)[0] } catch (error: any) { return c.text(error.message, 400) }
  if (!reference) return c.text('请填写银行 Reference', 400)
  const payment = await c.env.RENT.prepare("SELECT id FROM payments WHERE rental_id = ? AND payment_method = 'bank_transfer' AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  if (!payment) return c.text('未找到待审核的转账付款记录', 409)
  await c.env.RENT.prepare("UPDATE payment_proofs SET status = 'superseded' WHERE payment_id = ? AND status = 'submitted'").bind(payment.id).run()
  await c.env.RENT.prepare("INSERT INTO payment_proofs (id, payment_id, reference_number, note, image_url, status) VALUES (?, ?, ?, ?, ?, 'submitted')").bind(`proof-${nanoid(12)}`, payment.id, reference, note || null, proofImageUrl).run()
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
    try { await c.env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run() } catch (_) {}
  }
  const requestedAt = new Date()
  const scheduledAt = new Date(requestedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  await c.env.RENT.prepare('UPDATE users SET deletion_requested_at = ?, deletion_scheduled_at = ? WHERE id = ? AND status = \'active\'')
    .bind(requestedAt.toISOString(), scheduledAt.toISOString(), user.id).run()
  return c.html(await pages.renderCustomerProfile(c, { ...user, deletionScheduledAt: scheduledAt.toISOString() }, '账户已进入 7 天冷静期。期间重新登录即可取消删除。', 'success'))
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
  if (![form.name, form.brand, form.model, form.serialNumber].every(value => value?.trim())) return c.text('请完整填写设备名称、品牌、型号和序列号', 400)
  if (!Number.isFinite(Number(form.pricePerDay)) || Number(form.pricePerDay) < 0 || !Number.isFinite(Number(form.depositAmount)) || Number(form.depositAmount) < 0) return c.text('日租金和押金必须是有效的非负金额', 400)
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
  if (newPassword.length < 10) return c.html(await pages.renderCustomerSecurity(c, user, '新密码至少需要 10 位'))
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
  if (!String(form.firstName || '').trim() || !String(form.lastName || '').trim() || !email || !isStrongPassword(password) || !['CUSTOMER', 'STAFF', 'ADMIN'].includes(role) || !['active', 'inactive'].includes(status)) return c.html(pages.renderAdminUserNew(user), 400)
  if (await findUserByEmail(c, email)) return c.html(pages.renderAdminUserNew(user), 409)
  await insertUser(c, { id: await generateUniqueUserId(c, role as 'ADMIN' | 'STAFF' | 'CUSTOMER'), name, email, password, role, status, accountStatus: status, balance: 0, commissionBalance: 0, createdAt: new Date().toISOString() })
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
  const role = String(form.role || targetUser.role)
  const accountStatus = String(form.accountStatus || 'active')
  const staffId = String(form.staffId || '').trim()
  if (!['CUSTOMER', 'STAFF', 'ADMIN'].includes(role) || !['active', 'banned', 'inactive', 'departed'].includes(accountStatus)) {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '账户角色或状态无效'), 400)
  }
  if (accountStatus === 'departed' && role !== 'STAFF') {
    return c.html(await pages.renderAdminUserEdit(c, user, targetUserId, '“已离职”状态仅适用于员工账户'), 400)
  }
  if (targetUserId === user.id && (role !== 'ADMIN' || accountStatus !== 'active')) {
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

app.post('/admin/orders/:id/update', async (c) => {
  const wantsJson = c.req.header('accept')?.includes('application/json') || c.req.header('x-requested-with') === 'XMLHttpRequest'
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return wantsJson ? c.json({ ok: false, error: '登录已失效或没有管理员权限' }, 403) : c.html(renderForbidden(), 403)
  const form = await c.req.parseBody()
  const status = String(form.status || '')
  const force = String(form.force || '') === '1'
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || !['pending_payment', 'paid', 'active', 'completed', 'cancelled'].includes(status) || !canTransitionOrder(order.status, status)) return wantsJson ? c.json({ ok: false, error: '不允许的订单状态转换，请刷新页面查看最新状态' }, 409) : c.text('不允许的订单状态转换', 409)
  if (status === 'completed') {
    const contract = await c.env.RENT.prepare('SELECT contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
    if (!JSON.parse(contract?.contract_data || '{}').inspection_date && !force) return wantsJson ? c.json({ ok: false, error: '完成订单前必须提交归还验机' }, 409) : c.text('完成订单前必须提交归还验机', 409)
  }
  await updateOrderStatus(c, order.id, status)
  if (status === 'cancelled' || status === 'completed') await releaseDeviceIfUnbooked(c, order.deviceId)
  if (status === 'paid') await ensureOrderNumber(c, order.id)
  if (wantsJson) return c.json({ ok: true })
  return c.redirect(`/admin/orders/${c.req.param('id')}`)
})

app.post('/admin/orders/:id/transfer-proof/approve', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.status !== 'pending_payment' || order.paymentMethod !== 'bank_transfer') return c.text('订单状态不允许审核', 409)
  const proof = await c.env.RENT.prepare("SELECT pp.id, pp.payment_id, pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND pp.status = 'submitted' ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() as any
  if (!proof) return c.text('没有待审核的转账信息', 409)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE payment_proofs SET status = 'approved', verified_at = CURRENT_TIMESTAMP, verified_by = ? WHERE id = ? AND status = 'submitted'").bind(user.id, proof.id),
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(proof.payment_id),
    c.env.RENT.prepare("UPDATE orders SET status = 'paid', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
  ])
  await ensureOrderNumber(c, order.id, String(proof.reference_number || proof.payment_id || ''))
  await issueInvoice(c, order.id)
  return c.redirect(`/admin/orders/${order.id}`)
})

app.post('/admin/orders/:id/transfer-proof/reject', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const reason = String((await c.req.parseBody()).reason || '').trim().slice(0, 300)
  if (!reason) return c.text('请填写驳回原因', 400)
  await c.env.RENT.prepare("UPDATE payment_proofs SET status = 'rejected', rejection_reason = ?, rejected_at = CURRENT_TIMESTAMP, rejected_by = ? WHERE id = (SELECT pp.id FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND pp.status = 'submitted' ORDER BY pp.uploaded_at DESC LIMIT 1)").bind(reason, user.id, c.req.param('id')).run()
  return c.redirect(`/admin/orders/${c.req.param('id')}`)
})

app.post('/admin/orders/bulk-update', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }

  const form = await c.req.parseBody()
  const targetStatus = String(form.status || '')
  const selectedIds = Array.isArray(form.orderIds) ? form.orderIds.map(String) : form.orderIds ? [String(form.orderIds)] : []

  if (!['pending_payment', 'paid', 'active', 'completed', 'cancelled'].includes(targetStatus) || selectedIds.length === 0) {
    return c.redirect('/admin/orders')
  }

  const selectedOrders = await Promise.all(selectedIds.map(orderId => getOrderById(c, orderId)))
  const validOrders = selectedOrders.filter((order): order is NonNullable<typeof order> => Boolean(order && canTransitionOrder(order.status, targetStatus)))
  if (!validOrders.length) return c.text('所选订单没有可以执行该状态转换的订单', 409)
  if (targetStatus === 'completed') return c.text('完成订单必须逐笔执行归还验机', 409)
  await Promise.all(validOrders.map(order => updateOrderStatus(c, order.id, targetStatus)))

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
  try {
    return await refundDeposit(c, user, c.req.param('id'), await c.req.parseBody())
  } catch (error: any) {
    return c.text(error.message || '押金退款失败', 502)
  }
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

app.post('/admin/orders/:id/delete', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order) return c.redirect('/admin/orders?error=' + encodeURIComponent('订单不存在或已被删除'))
  if (['paid', 'active', 'completed'].includes(order.status)) {
    return c.redirect('/admin/orders?error=' + encodeURIComponent('只能删除未付款或已取消的订单，请先确认订单状态'))
  }
  await c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM contracts WHERE orderId = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payments WHERE rental_id = ?').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payment_proofs WHERE payment_id IN (SELECT id FROM payments WHERE rental_id = ?)').bind(order.id).run()
  await c.env.RENT.prepare('DELETE FROM payment_refunds WHERE order_id = ?').bind(order.id).run()
  return c.redirect('/admin/orders?success=' + encodeURIComponent('订单已删除'))
})

app.get('/admin/finance', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const { getOrdersAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  return c.html(pages.renderAdminFinance(user, orders))
})

app.get('/admin/coupons', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  const coupons = (await c.env.RENT.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()).results || []
  return c.html(pages.renderAdminCoupons(admin, coupons as any[]))
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
  await insertDevice(c, {
    name: form.name || '',
    brand: form.brand || '',
    model: form.model || '',
    assetTag: await generateAssetTag(c, form.brand || ''),
    serialNumber: form.serialNumber || '',
    cpu: form.cpu || '',
    ram: form.ram || '',
    storage: form.storage || '',
    gpu: form.gpu || '',
    os: form.os || '',
    pricePerDay: Number(form.pricePerDay) || 0,
    depositAmount: Number(form.depositAmount) || 0,
    status: (form.status as any) || 'available',
    description: form.description || form.remark || ''
  })
  return c.redirect('/admin/devices')
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
  return c.html(pages.renderAdminDeviceEdit(user, { ...device, unavailableDates }))
})

app.post('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  if (!['available', 'rented', 'maintenance', 'retired'].includes(form.status || 'available')) return c.text('设备状态无效', 400)
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
    description: form.description || form.remark
  })
  const dates = [...new Set(String(form.unavailableDates || '').split(/[,\s]+/).map(value => value.trim()).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)))]
  await c.env.RENT.prepare('DELETE FROM device_unavailable_dates WHERE device_id = ?').bind(c.req.param('id')).run()
  if (dates.length) await c.env.RENT.batch(dates.map(date => c.env.RENT.prepare('INSERT INTO device_unavailable_dates (device_id, unavailable_date) VALUES (?, ?)').bind(c.req.param('id'), date)))
  return c.redirect('/admin/devices')
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
  if (!code || !['percent', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100) || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))) return c.redirect('/admin/settings')
  await c.env.RENT.prepare('INSERT INTO coupons (id, code, discount_type, discount_value, max_uses, starts_at, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(`cp-${nanoid(10)}`, code, discountType, discountValue, maxUses, String(form.startsAt || '').replace('T', ' ') || null, String(form.expiresAt || '').replace('T', ' ') || null, admin.id).run()
  return c.redirect('/admin/settings')
})

app.post('/admin/coupons/:id/delete', async (c) => {
  const admin = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!admin || admin.role !== 'ADMIN') return c.redirect('/login')
  await c.env.RENT.prepare('DELETE FROM coupons WHERE id = ?').bind(c.req.param('id')).run()
  return c.redirect('/admin/settings')
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

app.get('/admin/templates/:kind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.redirect('/login')
  const kind = c.req.param('kind')
  if (kind === 'contract') return c.html(await pages.renderAdminContracts(c, user))
  if (!['user', 'rental', 'service', 'privacy', 'copyright'].includes(kind)) return c.html(renderNotFound(), 404)
  await loadSystemSettingsFromDB(c)
  return c.html(pages.renderAdminAgreementEditor(user, kind))
})

app.post('/admin/templates/:kind', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') return c.json({ success: false, error: '无权限保存协议' }, 403)
  const kind = c.req.param('kind')
  if (!['user', 'rental', 'service', 'privacy', 'copyright'].includes(kind)) return c.json({ success: false, error: '未知的协议类型' }, 404)
  try {
    const contentType = c.req.header('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await c.req.json()
      : await c.req.parseBody()
    const content = sanitizeRichHtml(payload?.content || '')
    await loadSystemSettingsFromDB(c)
    const settingKey = ({ user: 'userTerms', rental: 'rentalTerms', service: 'serviceTerms', privacy: 'privacyPolicy', copyright: 'copyrightNotice' } as const)[kind as 'user' | 'rental' | 'service' | 'privacy' | 'copyright']
    const metadata = getSystemSettings().legalMetadata || {}
    const lastUpdatedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload?.lastUpdatedDate || '')) ? String(payload.lastUpdatedDate) : new Date().toISOString().slice(0, 10)
    const before = String((getSystemSettings() as any)[settingKey] || '')
    await updateSystemSettings(c, { [settingKey]: content, legalMetadata: { ...metadata, [kind]: { version: String(payload?.version || '1.0').trim().slice(0, 30) || '1.0', lastUpdatedDate } } } as any)
    if (before !== content) await notifyAgreementUpdate(c, [[settingKey, ({ user: '用户协议', rental: '租赁协议', service: '网站服务条款', privacy: '隐私政策', copyright: '退款政策' } as any)[kind]]], getSystemSettings().companyDetails)
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
    const { cleanupExpiredAndCancelledContracts, cleanupExpiredGuestAccounts, cancelExpiredPendingPaymentOrders, logError } = await import('./site')
    ctx.waitUntil(
      (async () => {
        try {
          for (const column of ['deletion_requested_at', 'deletion_scheduled_at']) {
            try { await env.RENT.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run() } catch (_) {}
          }
          const deletedAccountResult = await env.RENT.prepare(`UPDATE users SET name = '删除账户', email = 'deleted-account-' || id || '@invalid.local', phone = NULL, bsb = NULL, account = NULL, account_number = NULL, balance = 0, commission_balance = 0, password_hash = 'disabled', password_salt = 'disabled', referral_code = NULL, referrer_id = NULL, staff_id = NULL, user_agreement_accepted_ip = NULL, status = 'inactive', account_status = 'inactive', deleted_at = CURRENT_TIMESTAMP, deletion_requested_at = NULL, deletion_scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE role = 'CUSTOMER' AND status = 'active' AND deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= CURRENT_TIMESTAMP`).run()
          const deletedCount = await cleanupExpiredAndCancelledContracts(c)
          const expiredGuestCount = await cleanupExpiredGuestAccounts(c)
          const expiredPaymentCount = await cancelExpiredPendingPaymentOrders(c)
          const dueNotificationCount = await createDueDateNotifications(c)
          console.log(`Scheduled contract cleanup completed: removed ${deletedCount} expired/cancelled contracts`)
          console.log(`Scheduled account cleanup completed: disabled ${Number(deletedAccountResult.meta?.changes || 0)} accounts`)
          console.log(`Scheduled guest cleanup completed: disabled ${expiredGuestCount} expired guest accounts`)
          console.log(`Scheduled payment cleanup completed: cancelled ${expiredPaymentCount} unpaid orders`)
          console.log(`Scheduled due notifications completed: created ${dueNotificationCount} reminders`)
        } catch (error) {
          await logError(c, 'ERROR', 'Failed to run scheduled contract cleanup', error as Error)
          console.error('Scheduled contract cleanup failed:', error)
        }
      })()
    )
  }
}
