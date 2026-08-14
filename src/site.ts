/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import sanitizeHtml from 'sanitize-html'
import layoutTemplate from './layout.html'

function renderLayoutTemplate(values: Record<string, string>): string {
  return layoutTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder
  )
}

export function sanitizeRichHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? ''), {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'a', 'span', 'div', 'hr', 'code', 'pre'],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class', 'style'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        width: [/^\d+(\.\d+)?(%|px)$/],
        margin: [/^[\d\s.%px-]+$/], padding: [/^[\d\s.%px-]+$/],
        border: [/^[\d\s.#a-z()-]+$/i], 'border-collapse': [/^(collapse|separate)$/],
        'page-break-after': [/^(always|avoid|auto|left|right)$/],
        'break-after': [/^(auto|avoid|always|page|column|region)$/],
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
  })
}

export function renderSiteVariables(content: string, currentUser: any = {}, extraValues: Record<string, unknown> = {}): string {
  const values: Record<string, unknown> = {
    company_name: systemSettings.companyDetails.name,
    company_abn: systemSettings.companyDetails.abn,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    user_name: currentUser?.name || '',
    user_email: currentUser?.email || '',
    ...extraValues,
  }

  const filled = Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\$\\{${key}\\}|\\{${key}\\}`, 'g'), escapeContractValue(value))
  }, String(content ?? ''))

  return sanitizeRichHtml(filled)
}

export function sanitizePlainText(value: unknown, maxLength = 500): string {
  return sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLength)
}

export function renderNotificationMarkdown(value: unknown): string {
  return sanitizeRichHtml(String(value ?? '').slice(0, 20000))
}

export function renderFlexibleContent(value: unknown, format?: unknown): string {
  return sanitizeRichHtml(String(value ?? '').slice(0, 20000))
}

export function renderEmailNotificationHtml(title: unknown, content: unknown, companyName = 'PC Rental', themeColor = '#f0a35b'): string {
  const safeTitle = sanitizePlainText(title, 200)
  const safeCompany = sanitizePlainText(companyName, 120)
  const accent = /^#[0-9a-f]{6}$/i.test(String(themeColor)) ? String(themeColor) : '#f0a35b'
  const messageHtml = renderFlexibleContent(content)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="margin:0;background:#e9eef1;color:#172331;font-family:Arial,'Noto Sans SC',sans-serif;"><div style="padding:32px 16px;background:#e9eef1;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #cbd7df;box-shadow:0 12px 32px rgba(23,35,49,.12);"><tr><td style="padding:28px 32px;background:#172331;color:#f5f8fa;border-bottom:5px solid ${accent};"><div style="font:700 12px/1.2 Arial,sans-serif;letter-spacing:2px;color:${accent};">PR / PC RENTAL</div><div style="margin-top:14px;font-size:12px;letter-spacing:1.5px;color:#aebdca;">ASSET OPS · CUSTOMER NOTICE</div></td></tr><tr><td style="padding:36px 32px 30px;"><div style="font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.8px;color:${accent};text-transform:uppercase;">${safeCompany} / MESSAGE</div><h1 style="margin:12px 0 22px;font-size:28px;line-height:1.25;color:#172331;">${safeTitle}</h1><div style="height:1px;background:#d7e0e6;margin-bottom:24px;"></div><div style="font-size:16px;line-height:1.8;color:#40515e;">${messageHtml}</div></td></tr><tr><td style="padding:20px 32px;background:#f5f8fa;border-top:1px solid #d7e0e6;color:#71818d;font:11px/1.7 monospace;">${safeCompany}<br>这是一封系统通知邮件，请勿直接回复。</td></tr></table></div></body></html>`
}

export function createPageBreakHtml(): string {
  return '<div class="page-break" style="page-break-after: always; break-after: page;"></div><p><br></p>'
}

export function splitPersonName(value: unknown): { firstName: string; lastName: string } {
  const name = sanitizePlainText(value, 200).trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length > 1) return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' }
  if (/^[\p{Script=Han}]{2,}$/u.test(name)) return { firstName: name.slice(1), lastName: name.slice(0, 1) }
  return { firstName: name, lastName: '' }
}

export function combinePersonName(firstName: unknown, lastName: unknown): string {
  return `${sanitizePlainText(firstName, 100).trim()} ${sanitizePlainText(lastName, 100).trim()}`.trim()
}

export function getAvatarInitials(name: unknown): string {
  const value = sanitizePlainText(name, 200).trim()
  if (!value) return '?'
  if (/^[\p{Script=Han}]+$/u.test(value)) {
    return value.slice(0, 1)
  }
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('').toUpperCase()
  return `${Array.from(parts[0])[0] || ''}${Array.from(parts.at(-1) || '')[0] || ''}`.toUpperCase()
}

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN'

export function canUseAccountBalance(user: any): boolean {
  const role = String(user?.role || '').trim().toUpperCase()
  const accountType = String(user?.accountType ?? user?.account_type ?? 'formal').trim().toLowerCase()
  return Boolean(user && role === 'CUSTOMER' && accountType === 'formal')
}

export interface User {
  id: string
  name: string
  email: string
  passwordHash?: string
  password_salt?: string // 添加 password_salt 字段
  password?: string // 添加password属性以兼容旧代码
  role: Role
  phone?: string
  bsb?: string
  account?: string
  account_number?: string
  accountNumber?: string // camelCase兼容前端代码
  balance: number
  status?: 'active' | 'inactive'
  accountStatus?: 'active' | 'banned' | 'inactive' | 'departed'
  account_status?: 'active' | 'banned' | 'inactive' | 'departed'
  commissionRate?: number
  referrerId?: string
  referralCode?: string
  registrationDate?: string

  // camelCase
  createdAt?: string
  commissionBalance: number

  // snake_case 兼容旧页面
  created_at?: string
  commission_balance?: number

  pendingCommission?: number
  withdrawnCommission?: number
  referredUsers?: Array<Record<string, any>>

  // staff 相关旧代码可能依赖
  staffId?: string
  staff_id?: string
  accountType?: 'formal' | 'guest' | 'deleted_guest'
  account_type?: 'formal' | 'guest' | 'deleted_guest'
  guestOrderId?: string | null
  guest_order_id?: string | null
  guestExpiresAt?: string | null
  guest_expires_at?: string | null
  deletedAt?: string | null
  deleted_at?: string | null
}

export interface Device {
  id: string
  name: string
  brand?: string
  model: string
  assetTag?: string
  asset_tag?: string
  serialNumber: string
  serial_number?: string
  cpu?: string
  ram?: string
  storage?: string
  gpu?: string
  os?: string

  // camelCase
  pricePerDay: number
  dailyRate?: number
  depositAmount: number

  // snake_case 兼容旧页面
  price_per_day?: number
  deposit_amount?: number

  status: 'available' | 'rented' | 'maintenance' | 'retired'
  description: string
}

export interface Order {
  id: string
  orderNo: string | null
  userId: string
  deviceId: string
  deviceName?: string
  startDate: string
  endDate: string
  startPeriod?: 'AM' | 'PM'
  endPeriod?: 'AM' | 'PM'
  pickupTimeSlot?: string
  returnTimeSlot?: string
  pickupLocation?: string
  returnLocation?: string
  rentalPeriod?: number
  orderDate?: string
  status: 'pending_approval' | 'pending_payment' | 'approved' | 'paid' | 'active' | 'completed' | 'cancelled'
  paymentMethod: 'card' | 'bank_transfer' | 'balance'
  totalAmount: number
  depositAmount: number
  couponCode?: string | null
  discountAmount?: number
  dailyRate: number
  contractId: string
  signedAt: string | null
  createdAt: string

  // snake_case 兼容旧页面
  device_id?: string
  start_date?: string
  end_date?: string
  rental_period?: number
  total_amount?: number
  deposit_amount?: number
  created_at?: string

  // refunds 旧逻辑
  needsRefund?: boolean
  refundMethod?: 'balance' | 'original'
  refundBsb?: string
  refundAccountNumber?: string
  refundAccountName?: string
}

export async function createNotification(c: Context, notification: { recipientId: string; type: string; title: string; message: string; orderId?: string; senderId?: string }): Promise<void> {
  await ensureNotificationsTable(c)
  const id = `nt-${crypto.randomUUID()}`
  await c.env.RENT.prepare('INSERT INTO notifications (id, recipient_id, type, title, message, order_id, sender_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, notification.recipientId, notification.type, notification.title, notification.message, notification.orderId || null, notification.senderId || null).run()
}

let notificationsSchemaReady: Promise<void> | null = null

export async function ensureNotificationsTable(c: Context): Promise<void> {
  if (!notificationsSchemaReady) notificationsSchemaReady = (async () => {
    await c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    order_id TEXT,
    sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    read_at TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN sender_id TEXT REFERENCES users(id) ON DELETE SET NULL').run() } catch (_) { /* column already exists */ }
    try { await c.env.RENT.prepare('ALTER TABLE notifications ADD COLUMN deleted_at TEXT').run() } catch (_) { /* column already exists */ }
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, read_at, created_at DESC)').run()
    await c.env.RENT.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_sender_created ON notifications(sender_id, deleted_at, created_at DESC)').run()
  })()
  try { await notificationsSchemaReady } catch (error) { notificationsSchemaReady = null; throw error }
}

export async function getNotifications(c: Context, recipientId: string): Promise<any[]> {
  await ensureNotificationsTable(c)
  const result = await c.env.RENT.prepare('SELECT * FROM notifications WHERE recipient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100').bind(recipientId).all()
  return result.results || []
}

export async function createDueDateNotifications(c: Context): Promise<number> {
  await ensureNotificationsTable(c)
  const today = new Date()
  const notices = [
    { days: 3, type: 'due_soon_3d', title: '租赁即将到期', text: '您的设备租赁将在 3 天后到期，请提前安排归还或联系工作人员续租。' },
    { days: 0, type: 'due_today', title: '租赁今日到期', text: '您的设备租赁今天到期，请尽快归还设备并等待验机。' },
  ]
  let created = 0
  for (const notice of notices) {
    const due = new Date(today)
    due.setUTCDate(due.getUTCDate() + notice.days)
    const date = due.toISOString().slice(0, 10)
    const rows = await c.env.RENT.prepare(`
      SELECT o.id, o.orderNo, o.userId, o.endDate, u.name
      FROM orders o JOIN users u ON u.id = o.userId
      WHERE o.endDate = ? AND o.status IN ('paid', 'active') AND u.role = 'CUSTOMER'
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_id = o.userId AND n.order_id = o.id AND n.type = ?)
    `).bind(date, notice.type).all()
    for (const order of (rows.results || []) as any[]) {
      await createNotification(c, { recipientId: order.userId, type: notice.type, title: notice.title, message: `${notice.text} 订单：${order.orderNo || order.id}。`, orderId: order.id })
      created += 1
    }
  }
  return created
}

export interface Contract {
  id: string
  rentalId: string
  contractNumber: string
  content: string
  signedAt: string | null
  createdAt?: string
  signToken?: string
  status: 'draft' | 'pending_sign' | 'signed' | 'completed' | 'cancelled' | 'expired'
  validFrom?: string | null // New field for contract validity start date
  validUntil?: string | null // New field for contract validity end date
  valid_until?: string | null
  signExpiresAt?: string | null
  sign_expires_at?: string | null
  created_by?: string | null // 记录合同创建人ID
  createdBy?: string | null // camelCase 兼容：合同创建人ID
  deleted_at?: string | null // 软删除时间戳

  // snake_case 兼容旧页面
  rental_id?: string
  device_condition?: string | null
  device_accessories?: string | null
  late_fee_per_day?: number
  repair_cost?: number | null
  pickup_location?: string | null
  return_location?: string | null
  customer_id_type?: string | null
  customer_id_number?: string | null
  esign_ip?: string | null
  esign_device?: string | null
  contract_data?: string | Record<string, unknown> | null
  signed_content?: string | null
  content_hash?: string | null
}

export interface ContractTemplate {
  id: string
  name: string
  content: string
  createdAt?: string
  updatedAt?: string
}

export function isContractExpired(contract: Contract, now = Date.now()): boolean {
  if ((contract.status as string) === 'expired') return true
  if (!['draft', 'pending_sign'].includes(contract.status)) return false
  const expiry = contract.signExpiresAt || contract.sign_expires_at || contract.validUntil || contract.valid_until
  if (!expiry) return false
  const expiryTime = new Date(expiry).getTime()
  return Number.isFinite(expiryTime) && expiryTime < now
}

export function isContractFinalized(contract: Contract | null | undefined): boolean {
  return Boolean(contract && ['signed', 'completed'].includes(contract.status) && contract.signedAt && contract.signed_content)
}

// 生成一个随机的盐值
function generateSalt(length: number = 16): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PBKDF2_ITERATIONS = 100000

export async function generateReferralCode(length: number = 6): Promise<string> {
  const { customAlphabet } = await import('nanoid');
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nanoid = customAlphabet(alphabet, length);
  return nanoid();
}

export function generateUserId(role: 'ADMIN' | 'STAFF' | 'CUSTOMER', accountType: 'formal' | 'guest' = 'formal'): string {
  const prefix = accountType === 'guest' ? 'VS' : role === 'ADMIN' ? 'AD' : role === 'STAFF' ? 'ST' : 'US'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `${prefix}-${Array.from(bytes, byte => String(byte % 10)).join('')}`
}

export async function generateUniqueUserId(c: Context, role: 'ADMIN' | 'STAFF' | 'CUSTOMER', accountType: 'formal' | 'guest' = 'formal'): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = generateUserId(role, accountType)
    const existing = await c.env.RENT.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!existing) return id
  }
  throw new Error('无法生成唯一用户 ID，请稍后重试')
}

export async function hashPassword(password: string): Promise<string> {
  const iterations = PBKDF2_ITERATIONS
  const salt = generateSalt()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
  const hash = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
  return `pbkdf2$${iterations}$${salt}$${hash}`
}

export function isStrongPassword(password: unknown): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/.test(String(password ?? ''))
}

export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const alphabet = upper + lower + digits
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const password = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    ...Array.from(bytes.slice(3), byte => alphabet[byte % alphabet.length]),
  ]
  // Fisher-Yates shuffle so the required character classes are not fixed in position.
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[index] % (index + 1)
    ;[password[index], password[swapIndex]] = [password[swapIndex], password[index]]
  }
  return password.join('')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    const [, iterationText, salt, expected] = storedHash.split('$')
    const iterations = Number(iterationText)
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS || !salt || !expected) return false
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
    const actual = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual.length !== expected.length) return false
    let difference = 0
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
    return difference === 0
  }
  const parts = storedHash.split('$');
  if (parts.length !== 2) {
    // 如果存储的哈希值格式不正确，则验证失败
    return false;
  }
  const salt = parts[0];
  const hash = parts[1];

  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt); // 使用存储的盐值和用户输入的密码进行哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const newHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return newHash === hash; // 比较新生成的哈希值与存储的哈希值
}

// 旧的 SHA-256 散列函数 (无盐值)
async function oldSha256Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getUserById(cOrContext: Context | string, id?: string): Promise<User | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  const userRow = await db.prepare('SELECT * FROM users WHERE id = ?').bind(actualId).first()
  if (!userRow) return null

  return normalizeUserRow(userRow)
}

// 将数据库行归一化为同时包含 snake_case 和 camelCase 字段的 User 对象
function normalizeUserRow(row: any): User {
  if (!row) return null as any
  const account_number = row.account_number ?? row.accountNumber ?? row.account
  const accountNumber = row.accountNumber ?? row.account_number ?? row.account

  const commissionBalance = Number(row.commissionBalance ?? row.commission_balance ?? 0)
  const balance = Number(row.balance ?? 0)

  const createdAt = row.createdAt ?? row.created_at ?? row.registrationDate ?? row.created_at
  const created_at = row.created_at ?? row.createdAt ?? row.registrationDate ?? row.createdAt
  const updatedAt = row.updatedAt ?? row.updated_at ?? null
  const updated_at = row.updated_at ?? row.updatedAt ?? null

  const referralCode = row.referralCode ?? row.referral_code ?? null
  const referrerId = row.referrerId ?? row.referrer_id ?? row.referrerId
  const staffId = row.staffId ?? row.staff_id
  const accountType = row.accountType ?? row.account_type ?? 'formal'
  const accountStatus = row.accountStatus ?? row.account_status ?? (row.status === 'inactive' ? 'inactive' : 'active')
  const guestOrderId = row.guestOrderId ?? row.guest_order_id ?? null
  const guestExpiresAt = row.guestExpiresAt ?? row.guest_expires_at ?? null
  const deletedAt = row.deletedAt ?? row.deleted_at ?? null

  return {
    ...row,
    account_number,
    accountNumber,
    commissionBalance,
    commission_balance: commissionBalance,
    balance,
    createdAt,
    created_at,
    updatedAt,
    updated_at,
    referralCode,
    referrerId,
    staffId,
    staff_id: staffId,
    accountType,
    account_type: accountType,
    accountStatus,
    account_status: accountStatus,
    guestOrderId,
    guest_order_id: guestOrderId,
    guestExpiresAt,
    guest_expires_at: guestExpiresAt,
    deletedAt,
    deleted_at: deletedAt,
  } as User
}

function normalizeOrderRow(orderRow: any): Order {
  if (!orderRow) return null as any

  const deviceId = orderRow.deviceId ?? orderRow.device_id
  const startDate = orderRow.startDate ?? orderRow.start_date
  const endDate = orderRow.endDate ?? orderRow.end_date
  const rentalPeriod = orderRow.rentalPeriod ?? orderRow.rental_period
  const totalAmount = orderRow.totalAmount ?? orderRow.total_amount
  const depositAmount = orderRow.depositAmount ?? orderRow.deposit_amount
  const createdAt = orderRow.createdAt ?? orderRow.created_at
  const refundMethod = orderRow.refundMethod ?? orderRow.refund_method ?? 'balance'
  const refundBsb = orderRow.refundBsb ?? orderRow.refund_bsb
  const refundAccountNumber = orderRow.refundAccountNumber ?? orderRow.refund_account_number
  const refundAccountName = orderRow.refundAccountName ?? orderRow.refund_account_name
  const orderNo = orderRow.orderNo ?? orderRow.order_no
  const contractId = orderRow.contractId ?? orderRow.contract_id
  const signedAt = orderRow.signedAt ?? orderRow.signed_at

  return {
    ...orderRow,
    deviceId,
    device_id: deviceId,
    startDate,
    start_date: startDate,
    endDate,
    end_date: endDate,
    rentalPeriod,
    rental_period: rentalPeriod,
    totalAmount,
    total_amount: totalAmount,
    depositAmount,
    deposit_amount: depositAmount,
    createdAt,
    created_at: createdAt,
    refundMethod,
    refundBsb,
    orderNo,
    order_no: orderNo,
    contractId,
    contract_id: contractId,
    signedAt,
    signed_at: signedAt,
    refundAccountNumber,
    refundAccountName,
    status: orderRow.status ?? orderRow.order_status
  } as Order
}

function normalizeContractRow(contractRow: any): Contract {
  if (!contractRow) return null as any

  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.orderId ?? contractRow.order_id ?? contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId ?? contractRow.orderId ?? contractRow.order_id
  const sign_expires_at = contractRow.sign_expires_at ?? contractRow.signExpiresAt
  const valid_from = contractRow.valid_from ?? contractRow.validFrom
  const valid_until = contractRow.valid_until ?? contractRow.validUntil
  const createdBy = contractRow.createdBy ?? contractRow.created_by
  const created_by = contractRow.created_by ?? contractRow.createdBy

  return {
    ...contractRow,
    validFrom,
    validUntil,
    signExpiresAt,
    rentalId,
    rental_id,
    sign_expires_at,
    valid_from,
    valid_until,
    createdBy,
    created_by
  } as Contract
}

export async function getOrderById(cOrContext: Context | string, id?: string): Promise<Order | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) {
    return null;
  }

  // 1. 直接使用传入的 id 进行查询
  let orderRow = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(actualId).first()
  if (orderRow) {
    return normalizeOrderRow(orderRow)
  }

  // 2. 如果查询结果为空，并且传入的 id 不以 o- 开头，则尝试添加 o- 前缀后再次查询
  if (!actualId.startsWith('o-')) {
    const prefixedId = `o-${actualId}`
    orderRow = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(prefixedId).first()
    if (orderRow) {
      return normalizeOrderRow(orderRow)
    }
  }

  // 3. 如果查询结果为空，并且传入的 id 以 o- 开头，则尝试去除 o- 前缀后再次查询
  if (actualId.startsWith('o-')) {
    const unprefixedId = actualId.substring(2)
    orderRow = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(unprefixedId).first()
    if (orderRow) {
      return normalizeOrderRow(orderRow)
    }
  }

  return null
}

export async function getDeviceById(cOrContext: Context | string, id?: string): Promise<Device | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  const deviceRow = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(actualId).first()
  if (!deviceRow) return null

  // 统一处理snake_case和camelCase字段
  const pricePerDay = deviceRow.pricePerDay ?? deviceRow.price_per_day
  const depositAmount = deviceRow.depositAmount ?? deviceRow.deposit_amount

  // Add type validation for required fields
  if (typeof pricePerDay !== 'number' || typeof depositAmount !== 'number') {
    throw new Error(`Device ${actualId} has missing or invalid pricePerDay or depositAmount`)
  }

  // 确保返回的设备对象同时包含两种格式的字段，兼容所有调用方
  return {
    ...deviceRow,
    pricePerDay,
    price_per_day: pricePerDay,
    depositAmount,
    deposit_amount: depositAmount
  } as Device
}

export async function getContractById(cOrContext: Context | string, id?: string): Promise<Contract | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  const contractRow = await db.prepare('SELECT * FROM contracts WHERE id = ?').bind(actualId).first()
  if (!contractRow) return null

  // 统一处理snake_case和camelCase字段
  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.orderId ?? contractRow.order_id ?? contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId ?? contractRow.orderId ?? contractRow.order_id
  const sign_expires_at = contractRow.sign_expires_at ?? contractRow.signExpiresAt
  const valid_from = contractRow.valid_from ?? contractRow.validFrom
  const valid_until = contractRow.valid_until ?? contractRow.validUntil
  const createdBy = contractRow.createdBy ?? contractRow.created_by
  const created_by = contractRow.created_by ?? contractRow.createdBy

  // 确保返回的合同对象同时包含两种格式的字段，兼容所有调用方
  return {
    ...contractRow,
    validFrom,
    validUntil,
    signExpiresAt,
    rentalId,
    rental_id,
    sign_expires_at,
    valid_from,
    valid_until,
    createdBy,
    created_by
  } as Contract
}

export async function getContractByOrderId(cOrContext: Context | string, orderId?: string): Promise<Contract | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualOrderId = typeof cOrContext === 'string' ? cOrContext : orderId
  if (!actualOrderId) return null
  const contractRow = await db.prepare('SELECT * FROM contracts WHERE orderId = ?').bind(actualOrderId).first()
  if (!contractRow) return null

  // 统一处理snake_case和camelCase字段
  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.orderId ?? contractRow.order_id ?? contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId ?? contractRow.orderId ?? contractRow.order_id
  const sign_expires_at = contractRow.sign_expires_at ?? contractRow.signExpiresAt
  const valid_from = contractRow.valid_from ?? contractRow.validFrom
  const valid_until = contractRow.valid_until ?? contractRow.validUntil
  const createdBy = contractRow.createdBy ?? contractRow.created_by
  const created_by = contractRow.created_by ?? contractRow.createdBy

  // 确保返回的合同对象同时包含两种格式的字段，兼容所有调用方
  return {
    ...contractRow,
    validFrom,
    validUntil,
    signExpiresAt,
    rentalId,
    rental_id,
    sign_expires_at,
    valid_from,
    valid_until,
    createdBy,
    created_by
  } as Contract
}

export async function getAllContracts(c?: Context): Promise<Contract[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM contracts').all()
  return ((result.results || []) as any[]).map(normalizeContractRow) || []
}

export async function getOrders(c?: Context): Promise<Order[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM orders').all()
  return ((result.results || []) as any[]).map(normalizeOrderRow) || []
}

export async function getOrdersForUser(cOrContext: Context | string, userId?: string): Promise<Order[]> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualUserId = typeof cOrContext === 'string' ? cOrContext : userId
  if (!actualUserId) return []
  const result = await db.prepare('SELECT * FROM orders WHERE userId = ?').bind(actualUserId).all()
  return ((result.results || []) as any[]).map(normalizeOrderRow) || []
}

export async function getOrdersWithDetailsForUser(c: Context, userId: string): Promise<any[]> {
  const db = getDB(c);
  const query = `
    SELECT 
      o.id, 
      o.orderNo, 
      o.startDate, 
      o.endDate, 
      o.totalAmount, 
      o.status,
      d.name as deviceName
    FROM orders o
    LEFT JOIN devices d ON o.deviceId = d.id
    WHERE o.userId = ?
    ORDER BY o.createdAt DESC
  `;
  const result = await db.prepare(query).bind(userId).all();
  return result.results || [];
}

export async function insertOrder(c: Context, order: Order): Promise<void> {
  const db = getDB(c)
  await db
    .prepare(
      'INSERT INTO orders (id, orderNo, userId, deviceId, startDate, endDate, startPeriod, endPeriod, rentalPeriod, status, paymentMethod, totalAmount, depositAmount, contractId, pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod, deliveryFee, rentalNote, coupon_code, discount_amount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      order.id,
      order.orderNo,
      order.userId,
      order.deviceId,
      order.startDate,
      order.endDate,
      order.startPeriod || 'AM', order.endPeriod || 'AM',
      order.rentalPeriod, // Add rentalPeriod here
      order.status,
      order.paymentMethod,
      order.totalAmount,
      order.depositAmount,
      order.contractId, order.pickupTimeSlot || null, order.returnTimeSlot || null, order.pickupLocation || null, order.returnLocation || null, (order as any).deliveryMethod || 'Pickup', Number((order as any).deliveryFee || 0), (order as any).rentalNote || null,
      (order as any).couponCode || null, Number((order as any).discountAmount || 0), order.createdAt
    )
    .run()
}

export async function ensureOrderNumber(c: Context, orderId: string, externalReference = ''): Promise<string> {
  const existing = await c.env.RENT.prepare('SELECT orderNo FROM orders WHERE id = ?').bind(orderId).first() as any
  if (!existing) throw new Error('订单不存在，无法生成订单编号')
  if (existing.orderNo) return String(existing.orderNo)

  const dateParts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
  const date = Object.fromEntries(dateParts.map(part => [part.type, part.value]))
  const externalSuffix = externalReference.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-10)
  const randomBytes = new Uint8Array(5)
  crypto.getRandomValues(randomBytes)
  const randomSuffix = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  const orderNo = `OD${date.year}${date.month}${date.day}${externalSuffix || randomSuffix}`
  await c.env.RENT.prepare('UPDATE orders SET orderNo = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND (orderNo IS NULL OR orderNo = ?)')
    .bind(orderNo, orderId, '').run()
  const saved = await c.env.RENT.prepare('SELECT orderNo FROM orders WHERE id = ?').bind(orderId).first() as any
  if (!saved?.orderNo) throw new Error('订单编号生成失败')
  return String(saved.orderNo)
}


export async function insertContract(c: Context, contract: Contract): Promise<void> {
  const db = getDB(c);
  // 同时插入驼峰和下划线格式的字段，确保兼容性
  await db.prepare('INSERT INTO contracts (id, orderId, contractNumber, content, signedAt, createdAt, signToken, status, validFrom, validUntil, signExpiresAt, created_by, sign_expires_at, sign_token, device_condition, device_accessories, late_fee_per_day, repair_cost, pickup_location, return_location, contract_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
    contract.id, contract.rentalId, contract.contractNumber, contract.content, contract.signedAt, contract.createdAt, contract.signToken, contract.status, contract.validFrom, contract.validUntil, contract.signExpiresAt, contract.createdBy, contract.signExpiresAt, contract.signToken,
    contract.device_condition || null, contract.device_accessories || null, contract.late_fee_per_day || 0, contract.repair_cost ?? null, contract.pickup_location || null, contract.return_location || null,
    typeof contract.contract_data === 'string' ? contract.contract_data : JSON.stringify(contract.contract_data || {})
  ).run();
}

export async function updateDeviceStatus(c: Context, deviceId: string, status: string): Promise<void> {
  const db = getDB(c);
  await db.prepare('UPDATE devices SET status = ? WHERE id = ?').bind(status, deviceId).run();
}

export async function releaseDeviceIfUnbooked(c: Context, deviceId: string): Promise<void> {
  const activeOrder = await c.env.RENT.prepare(`
    SELECT id FROM orders
    WHERE deviceId = ? AND status IN ('paid', 'active', 'pending_pickup', 'pending_return')
    LIMIT 1
  `).bind(deviceId).first()
  if (!activeOrder) await updateDeviceStatus(c, deviceId, 'available')
}

export async function cancelExpiredPendingPaymentOrders(c: Context): Promise<number> {
  const orders = await c.env.RENT.prepare(`
    SELECT id, deviceId FROM orders
    WHERE status = 'pending_payment'
      AND datetime(createdAt) <= datetime('now', '-24 hours')
  `).all() as any
  let cancelled = 0
  for (const order of (orders.results || []) as any[]) {
    const result = await c.env.RENT.prepare(`
      UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending_payment'
    `).bind(order.id).run() as any
    const changes = Number(result.meta?.changes ?? result.changes ?? 0)
    if (changes > 0) {
      cancelled += changes
      await c.env.RENT.prepare(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE rental_id = ? AND status = 'pending'`).bind(order.id).run()
      await releaseDeviceIfUnbooked(c, order.deviceId)
    }
  }
  return cancelled
}

export async function updateOrderStatus(c: Context, orderId: string, status: string): Promise<void> {
  const db = getDB(c);
  await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, orderId).run();
}

export async function hasDeviceBookingConflict(c: Context, deviceId: string, startDate: string, endDate: string, excludeOrderId?: string, bufferDays = 0): Promise<boolean> {
  const requestedStart = new Date(`${startDate}T00:00:00Z`)
  const requestedEnd = new Date(`${endDate}T00:00:00Z`)
  requestedStart.setUTCDate(requestedStart.getUTCDate() - Math.max(0, bufferDays))
  requestedEnd.setUTCDate(requestedEnd.getUTCDate() + Math.max(0, bufferDays))
  const conflictStart = requestedStart.toISOString().slice(0, 10)
  const conflictEnd = requestedEnd.toISOString().slice(0, 10)
  const row = await c.env.RENT.prepare(`
    SELECT id FROM orders
    WHERE deviceId = ? AND id != ?
      AND status NOT IN ('completed', 'cancelled')
      AND startDate < ? AND endDate > ?
    LIMIT 1
  `).bind(deviceId, excludeOrderId || '', conflictEnd, conflictStart).first()
  return Boolean(row)
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ['approved', 'cancelled'],
  approved: ['pending_payment', 'cancelled'],
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['active', 'cancelled'],
  active: ['completed'],
  pending_pickup: ['pending_return', 'cancelled'],
  pending_return: ['completed'],
  completed: [], cancelled: [],
}

export function canTransitionOrder(from: string, to: string): boolean {
  return from === to || Boolean(ORDER_TRANSITIONS[from]?.includes(to))
}

export function validateHostedImageUrls(value: unknown, maxUrls = 5): string[] {
  const urls = String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean)
  if (!urls.length || urls.length > maxUrls) throw new Error(`请提供 1-${maxUrls} 个图片链接`)
  return urls.map(raw => {
    let parsed: URL
    try { parsed = new URL(raw) } catch { throw new Error('图片链接格式不正确') }
    const host = parsed.hostname.toLowerCase()
    const privateHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || privateHost) throw new Error('图片必须使用公开的 HTTPS 图床链接')
    return parsed.toString()
  })
}

export async function updateOrder(c: Context, order: Order): Promise<void> {
  const db = getDB(c)
  await db
    .prepare(
      'UPDATE orders SET orderNo = ?, userId = ?, deviceId = ?, startDate = ?, endDate = ?, status = ?, paymentMethod = ?, totalAmount = ?, depositAmount = ?, contractId = ? WHERE id = ?'
    )
    .bind(
      order.orderNo ?? null,
      order.userId ?? null,
      order.deviceId ?? null,
      order.startDate ?? null,
      order.endDate ?? null,
      order.status ?? 'pending_payment',
      order.paymentMethod ?? null,
      Number(order.totalAmount ?? 0),
      Number(order.depositAmount ?? 0),
      order.contractId || null,
      order.id
    )
    .run()
}

// Compatibility aliases expected by legacy code
export async function updateOrderInDB(c: Context, orderId: string, data: Partial<Order>): Promise<void> {
  const fields: Array<[string, unknown]> = [
    ['orderNo', data.orderNo],
    ['userId', data.userId],
    ['deviceId', data.deviceId],
    ['startDate', data.startDate],
    ['endDate', data.endDate],
    ['status', data.status],
    ['paymentMethod', data.paymentMethod],
    ['totalAmount', data.totalAmount],
    ['depositAmount', data.depositAmount],
    ['contractId', data.contractId],
  ]
  const updates = fields.filter(([, value]) => value !== undefined)
  if (!updates.length) return
  const existing = await c.env.RENT.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first()
  if (!existing) return
  await c.env.RENT.prepare(`UPDATE orders SET ${updates.map(([field]) => `${field} = ?`).join(', ')} WHERE id = ?`)
    .bind(...updates.map(([, value]) => value), orderId)
    .run()
}


export async function updateContractStatus(c: Context, contractId: string, status: string, signedAt: string | null = null): Promise<void> {
  const db = getDB(c)
  await db.prepare('UPDATE contracts SET status = ?, signedAt = ? WHERE id = ?').bind(status, signedAt, contractId).run()

  // 如果合同被取消，则将关联的设备状态设置回“可用”
  if (status === 'cancelled') {
    const contract = await getContractById(c, contractId);
    if (contract && (contract.rentalId || contract.rental_id)) {
      const orderId = contract.rentalId || contract.rental_id;
      const order = await getOrderById(c, orderId);
      if (order && order.deviceId) {
        await updateDeviceStatus(c, order.deviceId, 'available');
        console.log(`Device ${order.deviceId} status set to 'available' due to contract ${contractId} cancellation.`);
      }
    }
  }
}

// 定期清理过期和已取消的合同
export async function cleanupExpiredAndCancelledContracts(c: Context): Promise<number> {
  const db = getDB(c)
  const now = new Date().toISOString()

  // 删除条件：
  // 1. 已过期且未签署的合同 (status = 'pending_sign' 且 signExpiresAt < 当前时间)
  // 2. 已被取消的合同，且取消时间超过7天 (status = 'cancelled' 且 updatedAt < 7天前)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  try {
    const expiredResult = await db.prepare(`
      UPDATE contracts SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE status = 'pending_sign' AND (signExpiresAt < ? OR sign_expires_at < ?)
    `).bind(now, now).run()
    const deletedResult = await db.prepare(`
      DELETE FROM contracts WHERE status = 'cancelled' AND updatedAt < ?
    `).bind(sevenDaysAgoISO).run()

    const changedCount = Number(expiredResult.meta?.changes || 0) + Number(deletedResult.meta?.changes || 0)
    if (changedCount > 0) {
      await logError(c, 'INFO', `Updated or cleaned up ${changedCount} expired/cancelled contracts`)
    }
    return changedCount
  } catch (error) {
    await logError(c, 'ERROR', 'Failed to cleanup expired/cancelled contracts', error as Error)
    return 0
  }
}

export async function cleanupExpiredGuestAccounts(c: Context): Promise<number> {
  // 访客租期结束后先立即撤销登录权限并清除凭据；保留匿名业务记录，避免破坏合同/订单/付款外键。
  const expired = await c.env.RENT.prepare(`
    SELECT id FROM users
    WHERE account_type = 'guest' AND guest_expires_at IS NOT NULL
      AND date(guest_expires_at) < date('now')
  `).all() as any
  const ids = (expired.results || []).map((row: any) => String(row.id))
  if (!ids.length) return 0
  const placeholders = ids.map(() => '?').join(', ')
  await c.env.RENT.batch([
    c.env.RENT.prepare(`DELETE FROM auth_sessions WHERE user_id IN (${placeholders})`).bind(...ids),
    c.env.RENT.prepare(`UPDATE users SET account_type = 'deleted_guest', status = 'inactive', email = 'deleted-guest-' || id || '@invalid.local', phone = NULL, bsb = NULL, account_number = NULL, password_hash = 'disabled', password_salt = 'disabled', guest_order_id = NULL, guest_expires_at = NULL, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).bind(...ids),
  ])

  // 再保留 30 天后删除没有业务外键引用的访客用户行。
  // 仍被历史订单/付款引用的行保留为匿名墓碑，确保业务记录和外键完整。
  const purgeResult = await c.env.RENT.prepare(`
    DELETE FROM users
    WHERE account_type = 'deleted_guest'
      AND deleted_at IS NOT NULL
      AND datetime(deleted_at) < datetime('now', '-30 days')
      AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.userId = users.id)
      AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.customer_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM commission_records WHERE commission_records.customer_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM addresses WHERE addresses.user_id = users.id)
  `).run() as any
  return ids.length + Number(purgeResult.meta?.changes ?? purgeResult.changes ?? 0)
}

// Compatibility alias expected by legacy code
export async function updateContractStatusInDB(c: Context, contractId: string, status: string, signedAt: string | null = null): Promise<void> {
  await updateContractStatus(c, contractId, status, signedAt)
}


export async function getContractByContractNumber(c: Context, contractNumber: string): Promise<Contract | null> {
  const db = getDB(c)
  // 将输入的合同编号转为大写，数据库中存储的都是大写字母和数字，实现大小写不敏感查询
  const upperCaseContractNumber = contractNumber.toUpperCase()
  const contractRow = await db.prepare('SELECT * FROM contracts WHERE UPPER(contractNumber) = ?').bind(upperCaseContractNumber).first()
  if (!contractRow) return null

  // 统一处理snake_case和camelCase字段
  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.orderId ?? contractRow.order_id ?? contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId ?? contractRow.orderId ?? contractRow.order_id
  const sign_expires_at = contractRow.sign_expires_at ?? contractRow.signExpiresAt
  const valid_from = contractRow.valid_from ?? contractRow.validFrom
  const valid_until = contractRow.valid_until ?? contractRow.validUntil
  const createdBy = contractRow.createdBy ?? contractRow.created_by
  const created_by = contractRow.created_by ?? contractRow.createdBy

  // 确保返回的合同对象同时包含两种格式的字段，兼容所有调用方
  return {
    ...contractRow,
    validFrom,
    validUntil,
    signExpiresAt,
    rentalId,
    rental_id,
    sign_expires_at,
    valid_from,
    valid_until,
    createdBy,
    created_by
  } as Contract
}

export async function getContractBySignToken(c: Context, signToken: string): Promise<Contract | null> {
  const db = getDB(c)
  const contractRow = await db.prepare('SELECT * FROM contracts WHERE signToken = ?').bind(signToken).first()
  if (!contractRow) return null

  // 统一处理snake_case和camelCase字段
  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.orderId ?? contractRow.order_id ?? contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId ?? contractRow.orderId ?? contractRow.order_id
  const sign_expires_at = contractRow.sign_expires_at ?? contractRow.signExpiresAt
  const valid_from = contractRow.valid_from ?? contractRow.validFrom
  const valid_until = contractRow.valid_until ?? contractRow.validUntil
  const createdBy = contractRow.createdBy ?? contractRow.created_by
  const created_by = contractRow.created_by ?? contractRow.createdBy

  // 确保返回的合同对象同时包含两种格式的字段，兼容所有调用方
  return {
    ...contractRow,
    validFrom,
    validUntil,
    signExpiresAt,
    rentalId,
    rental_id,
    sign_expires_at,
    valid_from,
    valid_until,
    createdBy,
    created_by
  } as Contract
}

export async function findUserByEmail(c: Context, email: string): Promise<User | null> {
  const db = getDB(c)
  const userRow = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (!userRow) return null
  return normalizeUserRow(userRow)
}

export async function verifyUserCredentials(c: Context, account: string, password: string): Promise<User | null> {
  const db = getDB(c)
  // Find user by email first
  const userRow = await db.prepare('SELECT * FROM users WHERE email = ?').bind(account).first()
  if (userRow) {
    // Check password
    const normalizedUser = normalizeUserRow(userRow)
    // Get password hash (handle both camelCase and snake_case)
    const passwordHash = userRow.passwordHash || userRow.password_hash
    const passwordSalt = userRow.passwordSalt || userRow.password_salt
    if (passwordHash) {
      const isValid = await verifyPassword(password, String(passwordHash).startsWith('pbkdf2$') ? String(passwordHash) : `${passwordSalt}$${passwordHash}`)
      if (isValid) {
        if (!String(passwordHash).startsWith('pbkdf2$')) await updateUser(c, normalizedUser.id, { password })
        delete (normalizedUser as any).passwordHash
        delete (normalizedUser as any).passwordSalt
        delete (normalizedUser as any).password
        return normalizedUser
      }
    }
  }
  // If not found by email, try phone number as account
  const phoneRow = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(account).first()
  if (phoneRow) {
    const normalizedUser = normalizeUserRow(phoneRow)
    const passwordHash = phoneRow.passwordHash || phoneRow.password_hash
    const passwordSalt = phoneRow.passwordSalt || phoneRow.password_salt
    if (passwordHash) {
      const isValid = await verifyPassword(password, String(passwordHash).startsWith('pbkdf2$') ? String(passwordHash) : `${passwordSalt}$${passwordHash}`)
      if (isValid) {
        if (!String(passwordHash).startsWith('pbkdf2$')) await updateUser(c, normalizedUser.id, { password })
        delete (normalizedUser as any).passwordHash
        delete (normalizedUser as any).passwordSalt
        delete (normalizedUser as any).password
        return normalizedUser
      }
    }
  }
  return null
}

export async function findUserByReferralCode(c: Context, referralCode: string): Promise<User | null> {
  const db = getDB(c)
  const normalizedCode = referralCode.trim().toUpperCase()
  const userRow = await db.prepare('SELECT * FROM users WHERE UPPER(referral_code) = ?').bind(normalizedCode).first()
  return userRow ? normalizeUserRow(userRow as any) : null
}

export async function getDeviceBySerialNumber(c: Context, serialNumber: string): Promise<Device | null> {
  const db = getDB(c)
  return db.prepare('SELECT * FROM devices WHERE serialNumber = ?').bind(serialNumber).first() as Device | null
}

export async function getDevices(c?: Context): Promise<Device[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM devices').all()
  if (!result.results) return []

  // 为每个设备统一处理snake_case和camelCase字段
  return (result.results as any[]).map(deviceRow => {
    const pricePerDay = deviceRow.pricePerDay ?? deviceRow.price_per_day
    const depositAmount = deviceRow.depositAmount ?? deviceRow.deposit_amount
    const serialNumber = deviceRow.serialNumber ?? deviceRow.serial_number
    const serial_number = deviceRow.serial_number ?? deviceRow.serialNumber
    const price_per_day = deviceRow.price_per_day ?? deviceRow.pricePerDay
    const deposit_amount = deviceRow.deposit_amount ?? deviceRow.depositAmount

    return {
      ...deviceRow,
      pricePerDay,
      depositAmount,
      serialNumber,
      serial_number,
      price_per_day,
      deposit_amount
    } as Device
  }) || []
}

export async function getUsers(c?: Context): Promise<User[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM users').all()
  if (!result.results) return []
  return (result.results as any[]).map(normalizeUserRow) || []
}

export async function getUsersByIds(c: Context, ids: string[]): Promise<User[]> {
  if (!ids.length) return []
  const db = getDB(c)
  const placeholders = ids.map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).bind(...ids).all()
  if (!result.results) return []
  return (result.results as any[]).map(normalizeUserRow) || []
}

export async function getDevicesByIds(c: Context, ids: string[]): Promise<Device[]> {
  if (!ids.length) return []
  const db = getDB(c)
  const placeholders = ids.map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM devices WHERE id IN (${placeholders})`).bind(...ids).all()
  return (result.results as Device[]) || []
}

export async function getOrdersByIds(c: Context, ids: string[]): Promise<Order[]> {
  if (!ids.length) return []
  const db = getDB(c)
  const placeholders = ids.map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM orders WHERE id IN (${placeholders})`).bind(...ids).all()
  return (result.results as Order[]) || []
}

export async function getOrdersAsync(c: Context): Promise<any[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM orders').all()
  return result.results || []
}



type SystemSettingsKey = 'userTerms' | 'rentalTerms' | 'serviceTerms' | 'privacyPolicy' | 'copyrightNotice' | 'priceStrategy' | 'paymentMethods' | 'bankDetails' | 'referralSettings' | 'companyDetails' | 'rentalRules' | 'registrationSettings'

function safeJsonParse<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

export function getSystemSettings(): typeof systemSettings {
  return systemSettings
}

export async function loadSystemSettingsFromDB(c: Context): Promise<typeof systemSettings> {
  const db = getDB(c)
  const rows = await db.prepare('SELECT key, value FROM systemSettings').all() as any
  const values = new Map<SystemSettingsKey, string>((rows.results || []).map((row: any) => [row.key, row.value]))
  const userTermsValue = values.get('userTerms')
  const rentalTermsValue = values.get('rentalTerms')
  const serviceTermsValue = values.get('serviceTerms')
  const privacyPolicyValue = values.get('privacyPolicy')
  const copyrightNoticeValue = values.get('copyrightNotice')
  const priceStrategyValue = values.get('priceStrategy')
  const paymentMethodsValue = values.get('paymentMethods')
  const bankDetailsValue = values.get('bankDetails')
  const referralSettingsValue = values.get('referralSettings')
  const companyDetailsValue = values.get('companyDetails')
  const rentalRulesValue = values.get('rentalRules')
  const registrationSettingsValue = values.get('registrationSettings')

  systemSettings.userTerms = sanitizeRichHtml(userTermsValue ?? systemSettings.userTerms)
  systemSettings.rentalTerms = sanitizeRichHtml(rentalTermsValue ?? systemSettings.rentalTerms)
  systemSettings.serviceTerms = sanitizeRichHtml(serviceTermsValue ?? systemSettings.serviceTerms)
  systemSettings.privacyPolicy = sanitizeRichHtml(privacyPolicyValue ?? systemSettings.privacyPolicy)
  systemSettings.copyrightNotice = sanitizeRichHtml(copyrightNoticeValue ?? systemSettings.copyrightNotice)
  systemSettings.priceStrategy = priceStrategyValue ?? systemSettings.priceStrategy

  const parsedPaymentMethods = safeJsonParse<typeof systemSettings.paymentMethods>(paymentMethodsValue)
  const parsedBankDetails = safeJsonParse<typeof systemSettings.bankDetails>(bankDetailsValue)
  const parsedReferralSettings = safeJsonParse<typeof systemSettings.referralSettings>(referralSettingsValue)
  const parsedCompanyDetails = safeJsonParse<typeof systemSettings.companyDetails>(companyDetailsValue)
  const parsedRentalRules = safeJsonParse<typeof systemSettings.rentalRules>(rentalRulesValue)
  const parsedRegistrationSettings = safeJsonParse<typeof systemSettings.registrationSettings>(registrationSettingsValue)

  if (parsedPaymentMethods) {
    systemSettings.paymentMethods = {
      stripe: Boolean((parsedPaymentMethods as any).stripe ?? (parsedPaymentMethods as any).square),
      bankTransfer: Boolean((parsedPaymentMethods as any).bankTransfer),
      balancePayment: (parsedPaymentMethods as any).balancePayment === undefined
        ? systemSettings.paymentMethods.balancePayment
        : Boolean((parsedPaymentMethods as any).balancePayment),
    }
  }
  if (parsedBankDetails) systemSettings.bankDetails = parsedBankDetails
  if (parsedReferralSettings) systemSettings.referralSettings = parsedReferralSettings
  if (parsedCompanyDetails) systemSettings.companyDetails = { ...systemSettings.companyDetails, ...parsedCompanyDetails }
  if (parsedRentalRules) systemSettings.rentalRules = { ...systemSettings.rentalRules, ...parsedRentalRules }
  if (parsedRegistrationSettings) systemSettings.registrationSettings = { ...systemSettings.registrationSettings, ...parsedRegistrationSettings }

  return systemSettings
}

export async function updateSystemSettings(c: Context, updates: Partial<typeof systemSettings>): Promise<typeof systemSettings> {
  Object.assign(systemSettings, updates)

  const db = getDB(c)

  const write = async (key: SystemSettingsKey, value: any) => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await db.prepare(`
      INSERT INTO systemSettings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
    `).bind(key, serialized).run()
  }

  await write('userTerms', systemSettings.userTerms)
  await write('rentalTerms', systemSettings.rentalTerms)
  await write('serviceTerms', systemSettings.serviceTerms)
  await write('privacyPolicy', systemSettings.privacyPolicy)
  await write('copyrightNotice', systemSettings.copyrightNotice)
  await write('priceStrategy', systemSettings.priceStrategy)
  await write('paymentMethods', systemSettings.paymentMethods)
  await write('bankDetails', systemSettings.bankDetails)
  await write('referralSettings', systemSettings.referralSettings)
  await write('companyDetails', systemSettings.companyDetails)
  await write('rentalRules', systemSettings.rentalRules)
  await write('registrationSettings', systemSettings.registrationSettings)

  return systemSettings
}

export async function insertUser(c: Context, user: any): Promise<User> {
  const db = getDB(c)
  user = {
    ...user,
    name: sanitizePlainText(user.name, 100),
    email: String(user.email ?? '').trim().toLowerCase().slice(0, 254),
    phone: sanitizePlainText(user.phone, 40),
    bsb: sanitizePlainText(user.bsb, 20),
    account: sanitizePlainText(user.account, 40),
    accountNumber: sanitizePlainText(user.accountNumber, 40),
    referralCode: sanitizePlainText(user.referralCode, 64) || null,
  }

  // 检查数据库中存在哪些列
  const hasPasswordHashSnake = await userHasColumn(c, 'password_hash')
  const hasPasswordHashCamel = await userHasColumn(c, 'passwordHash')
  const hasPasswordSaltSnake = await userHasColumn(c, 'password_salt')
  const hasPasswordSaltCamel = await userHasColumn(c, 'passwordSalt')
  const hasReferrerIdSnake = await userHasColumn(c, 'referrer_id')
  const hasReferrerIdCamel = await userHasColumn(c, 'referrerId')
  const hasReferralCodeSnake = await userHasColumn(c, 'referral_code')
  const hasReferralCodeCamel = await userHasColumn(c, 'referralCode')
  const hasCreatedAtSnake = await userHasColumn(c, 'created_at')
  const hasCreatedAtCamel = await userHasColumn(c, 'createdAt')
  const hasCommissionBalanceSnake = await userHasColumn(c, 'commission_balance')
  const hasCommissionBalanceCamel = await userHasColumn(c, 'commissionBalance')
  const hasStaffIdSnake = await userHasColumn(c, 'staff_id')
  const hasStaffIdCamel = await userHasColumn(c, 'staffId')
  const hasAccountType = await userHasColumn(c, 'account_type')
  const hasAccountStatus = await userHasColumn(c, 'account_status')
  const hasGuestOrderId = await userHasColumn(c, 'guest_order_id')
  const hasGuestExpiresAt = await userHasColumn(c, 'guest_expires_at')

  let passwordHashToStore = user.passwordHash ?? null;
  let passwordSaltToStore = user.passwordSalt ?? null;

  if (user.password) {
    const newHashedPassword = await hashPassword(user.password);
    passwordHashToStore = newHashedPassword;
    passwordSaltToStore = 'v2';
  } else if (user.passwordHash && user.passwordHash.includes('$')) {
    if (user.passwordHash.startsWith('pbkdf2$')) {
      passwordHashToStore = user.passwordHash;
      passwordSaltToStore = 'v2';
    } else {
      const [newSalt, newHash] = user.passwordHash.split('$');
      passwordHashToStore = newHash;
      passwordSaltToStore = newSalt;
    }
  }

  // 构建INSERT字段和值
  const insertFields = ['id', 'name', 'email', 'phone', 'role', 'status', 'balance'];
  const insertValues = [user.id, user.name, user.email, user.phone || null, user.role, user.status ?? 'active', user.balance ?? 0];

  // 处理commission_balance / commissionBalance
  if (hasCommissionBalanceSnake) {
    insertFields.push('commission_balance');
    insertValues.push(user.commissionBalance ?? 0);
  } else if (hasCommissionBalanceCamel) {
    insertFields.push('commissionBalance');
    insertValues.push(user.commissionBalance ?? 0);
  }

  // 处理referral_code / referralCode
  if (hasReferralCodeSnake) {
    insertFields.push('referral_code');
    insertValues.push(user.referralCode ?? null);
  } else if (hasReferralCodeCamel) {
    insertFields.push('referralCode');
    insertValues.push(user.referralCode ?? null);
  }

  // 处理referrer_id / referrerId
  if (hasReferrerIdSnake) {
    insertFields.push('referrer_id');
    insertValues.push(user.referrerId ?? null);
  } else if (hasReferrerIdCamel) {
    insertFields.push('referrerId');
    insertValues.push(user.referrerId ?? null);
  }

  if (hasStaffIdSnake) {
    insertFields.push('staff_id');
    insertValues.push(user.staffId ?? null);
  } else if (hasStaffIdCamel) {
    insertFields.push('staffId');
    insertValues.push(user.staffId ?? null);
  }

  if (hasAccountType) {
    insertFields.push('account_type'); insertValues.push(user.accountType ?? 'formal')
  }
  if (hasAccountStatus) {
    insertFields.push('account_status'); insertValues.push(user.accountStatus ?? (user.status === 'active' ? 'active' : 'inactive'))
  }
  if (hasGuestOrderId) {
    insertFields.push('guest_order_id'); insertValues.push(user.guestOrderId ?? null)
  }
  if (hasGuestExpiresAt) {
    insertFields.push('guest_expires_at'); insertValues.push(user.guestExpiresAt ?? null)
  }

  // 处理created_at / createdAt
  if (hasCreatedAtSnake) {
    insertFields.push('created_at');
    insertValues.push(user.createdAt ?? new Date().toISOString());
  } else if (hasCreatedAtCamel) {
    insertFields.push('createdAt');
    insertValues.push(user.createdAt ?? new Date().toISOString());
  }

  // 根据数据库存在的列添加密码相关字段
  if (passwordHashToStore !== null) {
    if (hasPasswordHashSnake) {
      insertFields.push('password_hash');
      insertValues.push(passwordHashToStore);
    } else if (hasPasswordHashCamel) {
      insertFields.push('passwordHash');
      insertValues.push(passwordHashToStore);
    }
  }

  if (passwordSaltToStore !== null) {
    if (hasPasswordSaltSnake) {
      insertFields.push('password_salt');
      insertValues.push(passwordSaltToStore);
    } else if (hasPasswordSaltCamel) {
      insertFields.push('passwordSalt');
      insertValues.push(passwordSaltToStore);
    }
  }

  const placeholders = insertFields.map(() => '?').join(', ');
  const sql = `INSERT INTO users (${insertFields.join(', ')}) VALUES (${placeholders})`;

  await db.prepare(sql).bind(...insertValues).run()

  const usersOldTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'").first()
  if (usersOldTable) {
    await db.prepare(`
      INSERT OR IGNORE INTO users_old
        (id, name, email, phone, passwordHash, role, status, bsb, accountNumber,
         referrerId, commissionBalance, balance, referralCode, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      user.name,
      user.email,
      user.phone || null,
      passwordHashToStore ?? '',
      user.role,
      user.status ?? 'active',
      user.bsb || null,
      user.accountNumber || null,
      user.referrerId || null,
      user.commissionBalance ?? 0,
      user.balance ?? 0,
      user.referralCode ?? null,
      user.createdAt ?? new Date().toISOString(),
      user.updatedAt ?? new Date().toISOString()
    ).run()
  }

  const insertedRow = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as any | null
  if (!insertedRow) return null as any
  const inserted = normalizeUserRow(insertedRow)
  delete (inserted as any).passwordHash
  delete (inserted as any).passwordSalt
  delete (inserted as any).password_hash
  delete (inserted as any).password_salt
  delete (inserted as any).password
  return inserted as User
}

export async function updateUser(c: Context, userId: string, data: Partial<User> & { password?: string }): Promise<User | null> {
  const db = getDB(c)
  const fields: Record<string, any> = { ...data }

  if (fields.password) {
    const newHashedPassword = await hashPassword(fields.password);
    fields.passwordHash = newHashedPassword;
    fields.passwordSalt = 'v2';
    delete fields.password;
  }

  // 字段名映射：前端驼峰 -> 数据库蛇形列名
  const fieldMapping: Record<string, string> = {
    referralCode: 'referral_code',
    referrerId: 'referrer_id',
    passwordHash: 'password_hash',
    passwordSalt: 'password_salt',
    commissionBalance: 'commission_balance',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    commissionRate: 'commission_rate',
    staffId: 'staff_id',
    accountType: 'account_type',
    accountStatus: 'account_status',
    guestOrderId: 'guest_order_id',
    guestExpiresAt: 'guest_expires_at',
    deletedAt: 'deleted_at',
    accountNumber: 'account_number'
  }

  const allowedFields = new Set([
    'name', 'email', 'role', 'status', 'balance', 'phone', 'bsb', 'account', 'accountNumber',
    'referralCode', 'referrerId', 'passwordHash', 'passwordSalt', 'commissionBalance',
    'createdAt', 'updatedAt', 'commissionRate', 'staffId', 'accountType', 'accountStatus',
    'guestOrderId', 'guestExpiresAt', 'deletedAt',
  ])
  for (const key of Object.keys(fields)) {
    if (!allowedFields.has(key)) delete fields[key]
  }
  for (const key of ['name', 'phone', 'bsb', 'account', 'accountNumber', 'referralCode']) {
    if (fields[key] !== undefined) fields[key] = sanitizePlainText(fields[key], key === 'name' ? 100 : 64)
  }
  if (fields.email !== undefined) fields.email = String(fields.email).trim().toLowerCase().slice(0, 254)

  const setEntries = Object.entries(fields).filter(([k]) => k !== 'id' && fields[k] !== undefined)
  if (setEntries.length === 0) {
    return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User | null
  }

  const tableInfo = await db.prepare('PRAGMA table_info(users)').all() as any
  const columns = new Set((tableInfo.results || []).map((column: any) => column.name))
  const mappedSetEntries = setEntries
    .map(([key, value]) => {
      const mappedKey = fieldMapping[key] || key
      if (columns.has(mappedKey)) return [mappedKey, value]
      if (columns.has(key)) return [key, value]
      return null
    })
    .filter((entry): entry is [string, any] => Boolean(entry))
  if (!mappedSetEntries.length) return getUserById(c, userId)
  const setClause = mappedSetEntries.map(([k]) => `${k} = ?`).join(', ')
  const values = mappedSetEntries.map(([, v]) => v)

  await db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).bind(...values, userId).run()
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User | null
  if (!updated) return null
  const normalized = normalizeUserRow(updated as any)
  delete (normalized as any).passwordHash
  delete (normalized as any).passwordSalt
  delete (normalized as any).password
  return normalized
}

export async function getDevicesAsync(c: Context): Promise<Device[]> {
  return getDevices(c)
}

export async function insertDevice(c: Context, device: Omit<Device, 'id'> & { id?: string }): Promise<Device> {
  const db = getDB(c)
  const { nanoid } = await import('nanoid')
  const deviceId = device.id || `d-${nanoid(8)}`

  // 先检查devices表中存在哪些列，避免硬编码列名导致错误
  const tableInfo = await db.prepare('PRAGMA table_info(devices)').all() as any;
  const deviceColumns = (tableInfo.results || []).map((column: any) => column.name);

  const hasSerialNumberSnake = deviceColumns.includes('serial_number');
  const hasSerialNumberCamel = deviceColumns.includes('serialNumber');
  const hasPricePerDaySnake = deviceColumns.includes('price_per_day');
  const hasPricePerDayCamel = deviceColumns.includes('pricePerDay');
  const hasDepositAmountSnake = deviceColumns.includes('deposit_amount');
  const hasDepositAmountCamel = deviceColumns.includes('depositAmount');

  // 构建插入字段和值
  const insertFields = ['id', 'name', 'model', 'status', 'description'];
  const insertValues = [
    deviceId,
    sanitizePlainText(device.name, 120),
    sanitizePlainText(device.model, 120),
    device.status || 'available',
    sanitizePlainText(device.description, 2000),
  ];

  for (const field of ['brand', 'asset_tag', 'cpu', 'ram', 'storage', 'gpu', 'os']) {
    if (!deviceColumns.includes(field)) continue
    const sourceKey = field === 'asset_tag' ? 'assetTag' : field
    insertFields.push(field)
    insertValues.push(sanitizePlainText((device as any)[sourceKey] ?? (device as any)[field], 200))
  }

  // 处理序列号字段
  if (hasSerialNumberCamel) {
    insertFields.push('serialNumber');
    insertValues.push(device.serialNumber);
  } else if (hasSerialNumberSnake) {
    insertFields.push('serial_number');
    insertValues.push(device.serialNumber);
  }

  // 处理日租金字段
  if (hasPricePerDayCamel) {
    insertFields.push('pricePerDay');
    insertValues.push(device.pricePerDay.toString());
  } else if (hasPricePerDaySnake) {
    insertFields.push('price_per_day');
    insertValues.push(device.pricePerDay.toString());
  }

  // 处理押金字段
  if (hasDepositAmountCamel) {
    insertFields.push('depositAmount');
    insertValues.push(device.depositAmount.toString());
  } else if (hasDepositAmountSnake) {
    insertFields.push('deposit_amount');
    insertValues.push(device.depositAmount.toString());
  }

  const placeholders = insertFields.map(() => '?').join(', ');
  const sql = `INSERT INTO devices (${insertFields.join(', ')}) VALUES (${placeholders})`;

  await db.prepare(sql).bind(...insertValues).run()
  const inserted = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first() as Device
  return inserted
}

// ===== Customer account helpers (used by src/pages/customer/account.ts) =====

export async function updatePassword(c: Context, userId: string, newPassword: string): Promise<User | null> {
  return updateUser(c, userId, { password: newPassword })
}

export async function bindReferrer(c: Context, userId: string, referrerId: string): Promise<User | null> {
  const user = await getUserById(c, userId)
  if (!user || user.referrerId) return user
  return updateUser(c, userId, { referrerId })
}

export async function unbindReferrer(c: Context, userId: string): Promise<User | null> {
  return updateUser(c, userId, { referrerId: null as any })
}

export async function updateDevice(c: Context, deviceId: string, data: Partial<Device>): Promise<Device | null> {
  const db = getDB(c)
  const existing = await getDeviceById(c, deviceId)
  if (!existing) return null

  const columnMapping: Record<string, string> = {
    name: 'name', brand: 'brand', model: 'model', assetTag: 'asset_tag', asset_tag: 'asset_tag',
    cpu: 'cpu', ram: 'ram', storage: 'storage', gpu: 'gpu', os: 'os', status: 'status', description: 'description',
    serialNumber: 'serialNumber', serial_number: 'serial_number',
    pricePerDay: 'pricePerDay', price_per_day: 'price_per_day',
    depositAmount: 'depositAmount', deposit_amount: 'deposit_amount',
  }
  const plainTextFields = new Set(['name', 'brand', 'model', 'assetTag', 'asset_tag', 'cpu', 'ram', 'storage', 'gpu', 'os', 'description', 'serialNumber', 'serial_number'])
  const setEntries: [string, any][] = []
  for (const [key, value] of Object.entries(data)) {
    const column = columnMapping[key]
    if (value !== undefined && column) {
      setEntries.push([column, plainTextFields.has(key) ? sanitizePlainText(value, key === 'description' ? 2000 : 120) : value])
    }
  }

  if (setEntries.length === 0) return existing

  const setClause = setEntries.map(([col]) => `${col} = ?`).join(', ')
  const values = setEntries.map(([, v]) => v)

  await db.prepare(`UPDATE devices SET ${setClause} WHERE id = ?`).bind(...values, deviceId).run()
  return db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first() as Device
}

export async function deleteDevice(c: Context, deviceId: string): Promise<boolean> {
  const db = getDB(c)
  const references = [
    ['orders', 'deviceId'], ['orders', 'device_id'],
    ['rentals', 'device_id'], ['rentals', 'deviceId'],
    ['contracts', 'device_id'], ['contracts', 'deviceId'],
  ]
  for (const [table, column] of references) {
    try {
      const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`).bind(deviceId).first() as any
      if (Number(row?.count || 0) > 0) {
        await updateDevice(c, deviceId, { status: 'retired' })
        return false
      }
    } catch (_) { /* schema variant or table not present */ }
  }
  const result = await db.prepare('DELETE FROM devices WHERE id = ?').bind(deviceId).run()
  return result.success
}

export async function getUsersAsync(c: Context): Promise<User[]> {
  return getUsers(c)
}





export async function updateContractTemplateInDB(c: Context, newTemplate: { id: string; name: string; content: string }) {
  return updateContractTemplate(c, newTemplate)
}



async function getTableColumns(c: Context, tableName: string): Promise<string[]> {
  const allowedTables = new Set(['commission_withdrawals'])
  if (!allowedTables.has(tableName)) throw new Error('Unsupported table name')
  const db = getDB(c)
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all() as any
  return (result.results || []).map((column: any) => column.name)
}

export async function createWithdrawalRequest(
  c: Context,
  userId: string,
  amount: number,
  withdrawMethod: 'balance' | 'bank_transfer',
  bankDetails?: { bsb?: string; accountNumber?: string; accountName?: string }
): Promise<{ success: boolean; message: string }> {
  const db = getDB(c)
  const { nanoid } = await import('nanoid')

  const normalizedAmount = Number(amount)

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { success: false, message: '请输入正确的提现金额，金额必须大于 0' }
  }

  if (withdrawMethod === 'bank_transfer' && (!Number.isInteger(normalizedAmount) || normalizedAmount < 100)) {
    return { success: false, message: '银行转账提现金额必须大于 100 且为整数' }
  }

  try {
    await db.prepare('BEGIN IMMEDIATE').run()

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User | null
    if (!user) {
      await db.prepare('ROLLBACK').run()
      return { success: false, message: '用户不存在' }
    }

    const currentCommissionBalance = Number(user.commission_balance ?? user.commissionBalance ?? 0)
    if (currentCommissionBalance < normalizedAmount) {
      await db.prepare('ROLLBACK').run()
      return { success: false, message: '提现金额不能超过可提现余额' }
    }

    const pendingRecords = await db.prepare(`
      SELECT id, amount
      FROM commission_records
      WHERE referrer_id = ? AND status = 'pending'
      ORDER BY created_at ASC
    `).bind(userId).all() as any

    const pendingTotal = (pendingRecords.results || []).reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0)
    if (pendingTotal < normalizedAmount) {
      await db.prepare('ROLLBACK').run()
      return { success: false, message: '暂无足够的待结算佣金可提取' }
    }

    let remainingAmount = normalizedAmount
    for (const record of pendingRecords.results || []) {
      if (remainingAmount <= 0) break
      const recordAmount = Number(record.amount || 0)
      if (recordAmount <= 0) continue

      await db.prepare(`
        UPDATE commission_records
        SET status = 'withdrawn', settled_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).bind(record.id).run()
      remainingAmount -= recordAmount
    }

    await db.prepare(`
      UPDATE users
      SET commission_balance = commission_balance - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(normalizedAmount, userId).run()

    if (withdrawMethod === 'balance') {
      await db.prepare(`
        UPDATE users
        SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(normalizedAmount, userId).run()
      await db.prepare('COMMIT').run()
      return { success: true, message: '提现成功！金额已划入您的账户余额' }
    }

    const withdrawalId = `w-${nanoid(8)}`
    const withdrawalColumns = await getTableColumns(c, 'commission_withdrawals')
    const hasAccountNameColumn = withdrawalColumns.includes('account_name') || withdrawalColumns.includes('accountName')
    const hasAccountNumberColumn = withdrawalColumns.includes('account_number') || withdrawalColumns.includes('accountNumber')
    const bsbColumn = withdrawalColumns.includes('bsb') ? 'bsb' : null
    const accountNumberColumn = hasAccountNumberColumn ? (withdrawalColumns.includes('account_number') ? 'account_number' : 'accountNumber') : null
    const accountNameColumn = hasAccountNameColumn ? (withdrawalColumns.includes('account_name') ? 'account_name' : 'accountName') : null

    const insertColumns = ['id', 'user_id', 'amount']
    const insertValues: any[] = [withdrawalId, userId, normalizedAmount]

    if (bsbColumn) {
      insertColumns.push(bsbColumn)
      insertValues.push(bankDetails?.bsb ?? null)
    }

    if (accountNumberColumn) {
      insertColumns.push(accountNumberColumn)
      insertValues.push(bankDetails?.accountNumber ?? null)
    }

    if (accountNameColumn) {
      insertColumns.push(accountNameColumn)
      insertValues.push(bankDetails?.accountName ?? null)
    }

    insertColumns.push('status')
    insertValues.push('pending')

    const placeholders = insertColumns.map(() => '?').join(', ')
    const insertSql = `INSERT INTO commission_withdrawals (${insertColumns.join(', ')}) VALUES (${placeholders})`

    await db.prepare(insertSql).bind(...insertValues).run()
    await db.prepare('COMMIT').run()
    return { success: true, message: '提现申请已提交，预计2个工作日处理' }
  } catch (error) {
    await db.prepare('ROLLBACK').run()
    console.error('Withdrawal failed:', error)
    return { success: false, message: '提现失败，请稍后重试' }
  }
}

export async function getPendingOrdersWithDetails(c: Context, staffId?: string): Promise<any[]> {
  const db = getDB(c);
  const query = `
    SELECT 
      o.id, 
      o.orderNo, 
      o.startDate, 
      o.endDate, 
      o.totalAmount, 
      o.status,
      u.name as customerName,
      d.name as deviceName
    FROM orders o
    JOIN users u ON o.userId = u.id
    JOIN devices d ON o.deviceId = d.id
    WHERE o.status = 'pending_approval' ${staffId ? 'AND u.staff_id = ?' : ''}
    ORDER BY o.createdAt DESC
  `;
  const statement = db.prepare(query)
  const result = staffId ? await statement.bind(staffId).all() : await statement.all();
  return result.results || [];
}

export async function getStaffDashboardData(c: Context, staffId?: string): Promise<any> {
  const db = getDB(c);

  const statsQuery = `
    SELECT
      (SELECT SUM(totalAmount) FROM orders WHERE status IN ('paid', 'active', 'completed')) as totalRevenue,
      (SELECT COUNT(*) FROM orders WHERE status = 'active' OR status = 'paid') as activeRentals,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending_approval' OR status = 'pending_payment') as pendingOrders,
      (SELECT COUNT(*) FROM devices WHERE status = 'available') as availableDevices,
      (SELECT COUNT(*) FROM devices) as totalDevices
  `;

  const recentOrdersQuery = `
    SELECT o.id, o.orderNo, o.status, u.name as customerName, d.name as deviceName
    FROM orders o
    LEFT JOIN users u ON o.userId = u.id
    LEFT JOIN devices d ON o.deviceId = d.id
    ${staffId ? 'WHERE u.staff_id = ?' : ''}
    ORDER BY o.createdAt DESC
    LIMIT 5
  `;

  const recentDevicesQuery = `
    SELECT d.id, d.name, d.status, u.name as customerName
    FROM devices d
    LEFT JOIN (
      SELECT o.deviceId, o.userId FROM orders o JOIN users owner ON o.userId = owner.id WHERE (o.status = 'active' OR o.status = 'paid') ${staffId ? 'AND owner.staff_id = ?' : ''}
    ) o ON d.id = o.deviceId
    LEFT JOIN users u ON o.userId = u.id
    ORDER BY d.createdAt DESC
    LIMIT 5
  `;

  const recentOrdersStatement = db.prepare(recentOrdersQuery)
  const recentDevicesStatement = db.prepare(recentDevicesQuery)
  const [statsResult, recentOrdersResult, recentDevicesResult] = await Promise.all([
    db.prepare(statsQuery).first(),
    staffId ? recentOrdersStatement.bind(staffId).all() : recentOrdersStatement.all(),
    staffId ? recentDevicesStatement.bind(staffId).all() : recentDevicesStatement.all()
  ]);

  return {
    stats: statsResult,
    recentOrders: recentOrdersResult.results || [],
    recentDevices: recentDevicesResult.results || []
  };
}

export const rentalTerms = `## 电脑租赁协议条款

尊敬的 {customer_name}：

感谢您选择PC Rental电脑租赁服务，在签署合同前请仔细阅读以下租赁条款：

### 一、租赁基本信息
- 租赁设备：{device_name} ({device_model})
- 设备序列号：{device_sn}
- 租赁期限：从 {start_date} 至 {end_date}，共 {rental_days} 天
- 日租金：AUD$ {daily_rate}/天，租金总额：AUD$ {total_rent}
- 押金金额：AUD$ {deposit_amount}

### 二、租客责任
1. 妥善保管租赁设备，不得转借、转租或抵押给第三方
2. 按时支付租金及押金，逾期未付将按日租金的 {overdue_rate} 倍收取逾期费用
3. 设备仅用于合法办公用途，不得用于任何违法活动
4. 租赁到期前3天需联系客服确认是否续租，逾期未归还将自动收取逾期费用

### 三、设备维护
1. 租赁期间设备正常损耗由出租方承担
2. 因人为损坏造成的维修费用由承租方承担
3. 不得自行拆卸、改装设备，否则需承担全部赔偿责任

### 四、付款信息
请将租金及押金支付至以下账户：
- 开户行BSB：{bank_bsb}
- 账号：{bank_account}
- 账户名：{account_name}

### 五、联系方式
如有任何问题，请联系我们的客服团队：
- 电话：{company_phone}
- 邮箱：{company_email}
- 地址：{company_address}

PC Rental电脑租赁团队
{register_time}`;

export const systemSettings = {
  companyDetails: {
    name: 'PC Rental',
    abn: '',
    gstIncluded: true,
    address: '',
    phone: '',
    email: '',
    contact: '',
    website: '',
    logo: '',
    pickupLocations: [] as string[],
  },
  rentalRules: {
    unavailableDates: [] as string[],
    minimumRentalDays: 1,
    bufferDays: 0,
  },
  bankDetails: {
    bankName: '',
    bsb: '062-001',
    account: '87654321',
    accountName: '账户名',
  },
  userTerms: `<h1>用户协议</h1>
<p>欢迎使用 PC Rental 电脑租赁服务。注册或使用本网站即表示您同意遵守本协议。</p>
<h2>账户与资料</h2>
<p>您应提供真实、准确且完整的资料，并妥善保管账户登录信息。</p>
<h2>服务使用</h2>
<p>您不得利用本服务从事违法活动、干扰平台运行或侵犯他人合法权益。</p>
<h2>协议更新</h2>
<p>更新后的协议将在本页面公布。继续使用服务即表示接受更新后的内容。</p>`,
  serviceTerms: `<h1>网站服务条款</h1>
<p>欢迎访问 PC Rental。使用本网站、提交租赁申请或使用相关服务，即表示您同意本服务条款。</p>
<h2>服务范围</h2><p>本网站提供设备信息展示、租赁合同签署、付款、订单与售后管理服务。具体租赁权利义务以双方签署的租赁协议和合同为准。</p>
<h2>合理使用</h2><p>您不得干扰网站运行、绕过安全措施、冒用他人身份或利用本网站从事违法活动。</p>
<h2>信息准确性</h2><p>您应确保提交的联系、身份、交付及付款资料真实准确，并及时更新发生变化的信息。</p>
<h2>服务变更</h2><p>我们可基于运营、安全或法律要求调整网站功能，并会在适当位置公布重要变化。</p>`,
  privacyPolicy: `<h1>隐私政策</h1>
<p>PC Rental 重视您的个人信息与隐私。本政策说明我们在提供设备租赁服务时如何处理信息。</p>
<h2>收集的信息</h2><p>我们可能收集账户资料、联系方式、身份核验资料、租赁与付款记录、电子签署记录以及保障网站安全所需的技术信息。</p>
<h2>使用目的</h2><p>信息用于创建和履行租赁合同、处理付款和退款、交付设备、客户支持、防止欺诈及履行法律义务。</p>
<h2>付款资料</h2><p>信用卡付款由第三方支付服务商处理，本网站不保存完整信用卡号码或安全码。</p>
<h2>保存与权利</h2><p>我们仅在提供服务或法律要求所需期限内保存信息。您可以联系我们申请查阅或更正个人资料。</p>`,
  copyrightNotice: `<h1>退款政策</h1>
<p>本政策说明 PC Rental 在订单取消、押金退还和提前归还情况下的退款处理方式。</p>
<h2>订单取消</h2><p>订单在付款前取消时不会产生退款；已经付款的订单按照订单状态和实际产生的费用处理。</p>
<h2>押金退还</h2><p>设备完成归还验机后，管理员会根据设备状况处理押金。正常归还时退还可退金额；如有损坏、缺件或逾期费用，将先扣除相应费用并说明原因。</p>
<h2>退款方式</h2><p>客户可以按照订单页面提供的选项选择退回账户余额或原支付方式。银行转账退款可能需要额外处理时间。</p>
<h2>申请与联系</h2><p>如对退款金额或处理结果有疑问，请通过订单详情联系管理员，并提供订单编号。</p>`,
  rentalTerms,
  priceStrategy: '标准定价：按日租金计费，超过租期按日累加。',
  paymentMethods: {
    stripe: true,
    bankTransfer: true,
    balancePayment: true,
  },
  registrationSettings: {
    requireEmailVerification: false,
  },
  /* legacy email templates are managed in email_templates */
  /*

尊敬的 {customer_name}：

感谢您选择PC Rental电脑租赁服务！

您的租赁合同已成功签署，以下是合同详情：

📋 合同编号：{contract_number}
📅 签署时间：{sign_time}

租赁信息：
┌─────────────────────────────────────┐
│  设备名称：{device_name}            │
│  设备型号：{device_model}           │
│  设备序列号：{device_sn}            │
│  租赁开始：{start_date}             │
│  租赁结束：{end_date}               │
│  租赁天数：{rental_days} 天         │
│  租金总额：AUD$ {total_rent}        │
│  押金：AUD$ {deposit_amount}         │
│  支付方式：{payment_method}          │
└─────────────────────────────────────┘

您的合同PDF已附件发送，请妥善保存。

📌 重要提醒：
• 请在 {payment_deadline} 日内完成支付
• 支付完成后，我们将安排设备配送
• 租赁到期前3天，您将收到续租提醒

查看您的合同详情：
{contract_view_link}

如有任何疑问，请联系我们的客服团队。

PC Rental电脑租赁团队
{company_phone} | {company_email}`,
  */
  referralSettings: {
    defaultRate: 10,
    levelLimit: 3,
    settlementPeriod: 30,
  },
}

function escapeContractValue(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

export const CONTRACT_VARIABLE_NAMES = [
  'contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction',
  'company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo',
  'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone',
  'device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories',
  'start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status',
  'currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference',
  'bank_name', 'account_name', 'bank_bsb', 'bank_account',
  'late_days', 'late_fee_per_day', 'late_fee',
  'inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes',
  'damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice',
  'deposit_refund', 'refund_amount', 'refund_date',
  'signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os',
  'company_representative', 'customer_initials', 'insurance_selected', 'insurance_fee',
  'pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement',
  'created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url',
] as const

export const CONTRACT_VARIABLE_GROUPS = [
  ['合同', ['contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction']],
  ['公司', ['company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo']],
  ['客户', ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone']],
  ['设备', ['device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories']],
  ['租赁', ['start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status']],
  ['付款', ['currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference']],
  ['银行', ['bank_name', 'account_name', 'bank_bsb', 'bank_account']],
  ['逾期归还', ['late_days', 'late_fee_per_day', 'late_fee']],
  ['验机', ['inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes']],
  ['损坏', ['damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice']],
  ['退款', ['deposit_refund', 'refund_amount', 'refund_date']],
  ['电子签名', ['signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os']],
  ['代表与确认', ['company_representative', 'customer_initials']],
  ['保险', ['insurance_selected', 'insurance_fee']],
  ['取还时间', ['pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement']],
  ['系统', ['created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url']],
] as const

export function renderContractVariables(content: string, contract: Contract, order?: any, device?: any, customer?: any, extra: Record<string, unknown> = {}, includeInternal = false): string {
  const rentOnly = Math.max(0, Number(order?.totalAmount ?? order?.total_amount ?? 0) - Number(order?.depositAmount ?? order?.deposit_amount ?? 0))
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const emptyVariables = Object.fromEntries(CONTRACT_VARIABLE_NAMES.map(name => [name, '']))
  const values: Record<string, unknown> = {
    ...emptyVariables,
    ...stored,
    ...extra,
    contract_number: contract.contractNumber,
    order_no: order?.orderNo ?? order?.order_no,
    agreement_version: stored.agreement_version || '1.0',
    jurisdiction: stored.jurisdiction || 'VIC',
    company_name: systemSettings.companyDetails.name,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_contact: systemSettings.companyDetails.contact,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    customer_name: customer?.name,
    customer_phone: customer?.phone,
    customer_email: customer?.email,
    customer_address: stored.customer_address || customer?.address,
    customer_dob: stored.customer_dob || customer?.dob,
    customer_country: stored.customer_country || customer?.country,
    customer_id_type: stored.customer_id_type || contract.customer_id_type,
    customer_id_number: stored.customer_id_number || contract.customer_id_number,
    device_name: device?.name ?? order?.deviceName,
    device_brand: device?.brand,
    device_model: device?.model,
    device_cpu: device?.cpu,
    device_ram: device?.ram,
    device_storage: device?.storage,
    device_gpu: device?.gpu,
    device_os: device?.os,
    device_sn: device?.serialNumber ?? device?.serial_number,
    asset_tag: device?.assetTag ?? device?.asset_tag,
    charger_sn: stored.charger_sn || device?.chargerSn || device?.charger_sn,
    battery_health: stored.battery_health || device?.batteryHealth || device?.battery_health,
    battery_cycles: stored.battery_cycles || device?.batteryCycles || device?.battery_cycles,
    device_condition: stored.device_condition || contract.device_condition,
    device_accessories: stored.device_accessories || contract.device_accessories,
    start_date: order?.startDate ?? order?.start_date,
    end_date: order?.endDate ?? order?.end_date,
    rental_days: order?.rentalPeriod ?? order?.rental_period,
    daily_rate: Number(order?.dailyRate ?? order?.daily_rate ?? device?.pricePerDay ?? 0).toFixed(2),
    total_rent: rentOnly.toFixed(2),
    deposit_amount: Number(order?.depositAmount ?? order?.deposit_amount ?? 0).toFixed(2),
    late_fee_per_day: Number(stored.late_fee_per_day ?? contract.late_fee_per_day ?? 0).toFixed(2),
    repair_cost: stored.repair_cost ?? (contract.repair_cost == null ? '' : Number(contract.repair_cost).toFixed(2)),
    pickup_location: stored.pickup_location || contract.pickup_location,
    return_location: stored.return_location || contract.return_location,
    payment_method: order?.paymentMethod ?? order?.payment_method,
    bank_name: systemSettings.bankDetails.bankName,
    bank_bsb: systemSettings.bankDetails.bsb,
    bank_account: systemSettings.bankDetails.account,
    account_name: systemSettings.bankDetails.accountName,
    company_abn: systemSettings.companyDetails.abn,
    gst_included: systemSettings.companyDetails.gstIncluded ? '是' : '否',
    signer_name: stored.signer_name || customer?.name,
    sign_time: contract.signedAt ? new Date(contract.signedAt).toLocaleString('en-AU') : '',
    esign_ip: contract.esign_ip,
    esign_device: contract.esign_device,
    device_id: device?.id ?? order?.deviceId ?? order?.device_id,
    currency: 'AUD',
    created_time: contract.createdAt ?? (contract as any).created_at,
    updated_time: (contract as any).updatedAt ?? (contract as any).updated_at,
    contract_status: contract.status,
    company_representative: stored.company_representative || systemSettings.companyDetails.contact,
    contract_url: stored.contract_url || `/contract/view/${contract.id}`,
    invoice_url: stored.invoice_url || (order?.id ? `/orders/${order.id}/invoice` : ''),
    deleted: contract.deleted_at ? '是' : '否',
  }
  if (!includeInternal) values.deleted = ''
  const filled = Object.entries(values).reduce((result, [name, value]) => {
    const safe = escapeContractValue(value)
    return result.replace(new RegExp(`\\$\\{${name}\\}|\\{${name}\\}`, 'g'), safe)
  }, String(content || ''))
  return renderFlexibleContent(filled)
}

export const CONTRACT_OPERATIONAL_FIELDS = [
  ['agreement_version', '合同版本'], ['jurisdiction', '司法管辖区'],
  ['customer_address', '客户地址'], ['customer_dob', '客户出生日期'], ['customer_country', '客户国家'], ['customer_id_type', '证件类型'], ['customer_id_number', '证件号码'], ['customer_driver_expiry', '驾照到期日'], ['emergency_contact', '紧急联系人'], ['emergency_phone', '紧急联系电话'],
  ['invoice_number', '发票编号'], ['delivery_method', '配送方式（Pickup / Delivery）'], ['delivery_fee', '配送费'], ['return_method', '归还方式（CourierPickup / StoreReturn）'], ['pickup_location', '取货地点'], ['return_location', '归还地点'], ['pickup_time', '取货时间'], ['return_time', '归还时间'],
  ['return_status', '归还状态'], ['return_date', '实际归还日期'], ['inspection_date', '检查日期'], ['inspection_by', '检查员工'],
  ['device_brand', '设备品牌'], ['device_cpu', 'CPU'], ['device_ram', '内存'], ['device_storage', '存储'], ['device_gpu', '显卡'], ['device_os', '设备操作系统'],
  ['battery_health', '电池健康'], ['charger_sn', '充电器 SN'], ['asset_tag', '公司资产编号'], ['device_condition', '设备状况'], ['device_accessories', '交付配件'],
  ['esign_signature', '客户电子签名'], ['company_signature', '公司电子签名'], ['esign_location', '签约 GPS 位置'], ['esign_browser', '签约浏览器'], ['esign_os', '签约操作系统'], ['company_representative', '公司代表'], ['customer_initials', '客户姓名首字母'],
  ['discount', '优惠金额'], ['coupon_code', '优惠码'],
  ['damage_description', '损坏说明'], ['damage_photos', '损坏照片 URL'], ['repair_invoice', '维修发票'], ['replacement_cost', '更换费用'], ['repair_cost', '维修费用'],
  ['collection_required', '是否需要追回'], ['collection_date', '回收日期'],
  ['screen_condition', '屏幕状况'], ['keyboard_condition', '键盘状况'], ['trackpad_condition', '触控板状况'], ['body_condition', '外壳状况'], ['camera_condition', '摄像头状况'], ['wifi_condition', 'WiFi 状况'], ['battery_cycles', '电池循环次数'], ['power_test', '开机测试'], ['inspection_notes', '验机备注'], ['accessories_returned', '已归还配件'], ['customer_acknowledgement', '客户确认'],
  ['approved_by', '审批员工'], ['notes', '内部备注'], ['qr_code', '合同二维码图片 URL'],
  ['insurance_selected', '是否选择保险'], ['insurance_fee', '保险费用'], ['insurance_provider', '保险公司'], ['waiver_signed', '是否签署免责'], ['privacy_version', '隐私政策版本'],
] as const

export const CONTRACT_COMPUTED_FIELDS = [
  ['device_id', '系统内部设备 ID'], ['currency', '币种'], ['deposit_paid', '已支付押金'], ['rent_paid', '已支付租金'], ['amount_due', '剩余应付款'], ['payment_date', '付款日期'], ['payment_reference', '银行 Reference'],
  ['subtotal', '小计'], ['gst_amount', 'GST 金额'], ['refund_amount', '退款金额'], ['deposit_refund', '押金退款'], ['refund_date', '退款日期'], ['deduction_amount', '押金扣除金额'],
  ['late_days', '逾期天数'], ['late_fee', '逾期费用'], ['created_by', '创建员工'], ['created_time', '创建时间'], ['updated_time', '更新时间'], ['contract_status', '合同状态'], ['deleted', '是否删除'],
] as const

export const CONTRACT_SIGNED_FIELDS = new Set([
  'signer_name', 'customer_initials', 'esign_signature', 'company_signature', 'esign_location', 'esign_browser', 'esign_os', 'agreement_version',
])

export async function getContractVariableData(c: Context, contract: Contract, order: any): Promise<Record<string, unknown>> {
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const [payments, reference, refund, creator] = await Promise.all([
    c.env.RENT.prepare("SELECT COALESCE(SUM(amount),0) paid, COALESCE(SUM(deposit_amount),0) deposit_paid, COALESCE(SUM(rental_amount),0) rent_paid, MAX(paid_at) payment_date, MAX(currency) currency FROM payments WHERE rental_id = ? AND status = 'paid'").bind(order.id).first(),
    c.env.RENT.prepare("SELECT pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.created_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare("SELECT type, refund_amount, deduction_amount, created_at FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(),
    contract.createdBy ? getUserById(c, contract.createdBy) : Promise.resolve(null),
  ]) as any[]
  const paid = Number(payments?.paid || 0)
  const deposit = Number(order.depositAmount ?? order.deposit_amount ?? 0)
  const total = Number(order.totalAmount ?? order.total_amount ?? 0)
  const discount = Number(stored.discount || 0)
  const deliveryFee = Number(stored.delivery_fee || 0)
  const rentSubtotal = Math.max(0, total - deposit - deliveryFee + discount)
  const returnDate = stored.return_date ? new Date(String(stored.return_date)) : null
  const dueDate = new Date(order.endDate ?? order.end_date)
  const lateDays = returnDate && returnDate > dueDate ? Math.ceil((returnDate.getTime() - dueDate.getTime()) / 86400000) : 0
  const returnStatus = stored.damage_description ? 'Damaged' : stored.return_date ? (lateDays > 0 ? 'Overdue' : 'Returned') : (order.status === 'completed' ? 'Returned' : '')
  return {
    ...stored,
    invoice_number: stored.invoice_number || (order.orderNo ? `INV-${order.orderNo}` : ''),
    currency: payments?.currency || 'AUD',
    deposit_paid: Number(payments?.deposit_paid || 0).toFixed(2),
    rent_paid: Number(payments?.rent_paid || 0).toFixed(2),
    amount_due: Math.max(0, total - paid).toFixed(2),
    payment_date: payments?.payment_date || '',
    payment_reference: reference?.reference_number || '',
    subtotal: rentSubtotal.toFixed(2),
    gst_amount: systemSettings.companyDetails.gstIncluded ? (rentSubtotal / 11).toFixed(2) : '0.00',
    refund_amount: Number(refund?.refund_amount || 0).toFixed(2),
    deposit_refund: Number(refund?.type === 'deposit' ? refund.refund_amount : 0).toFixed(2),
    refund_date: refund?.created_at || '',
    deduction_amount: Number(refund?.deduction_amount || 0).toFixed(2),
    late_days: lateDays,
    late_fee: (lateDays * Number(contract.late_fee_per_day || 0)).toFixed(2),
    return_status: returnStatus,
    created_by: creator?.name || contract.createdBy || '',
    contract_url: `/contract/view/${contract.id}`,
    invoice_url: `/orders/${order.id}/invoice`,
  }
}

export async function issueInvoice(c: Context, orderId: string): Promise<void> {
  const order = await getOrderById(c, orderId)
  if (!order) return
  const contract = await getContractByOrderId(c, orderId)
  const data = contract && typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : ((contract?.contract_data as Record<string, unknown>) || {})
  const taxableGross = Math.max(0, Number(order.totalAmount) - Number(order.depositAmount))
  const gstAmount = systemSettings.companyDetails.gstIncluded ? taxableGross / 11 : 0
  const payment = await c.env.RENT.prepare("SELECT processing_fee FROM payments WHERE rental_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1").bind(order.id).first() as any
  const processingFee = Math.max(0, Number(payment?.processing_fee || 0))
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO invoices (id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount, processing_fee, total_amount, currency, status) VALUES (?, ?, ?, 'invoice', ?, ?, ?, ?, ?, 'AUD', 'issued')`)
    .bind(`inv-${order.id}`, String(data.invoice_number || `INV-${order.orderNo || order.id}`), order.id, taxableGross - gstAmount, gstAmount, Number(order.depositAmount), processingFee, Number(order.totalAmount) + processingFee).run()
}

export async function issueCreditNote(c: Context, orderId: string, amount: number, refundedProcessingFee = 0): Promise<void> {
  const invoice = await c.env.RENT.prepare("SELECT id, invoice_number FROM invoices WHERE order_id = ? AND type = 'invoice'").bind(orderId).first() as any
  if (!invoice) return
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO invoices (id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount, processing_fee, total_amount, currency, status, related_invoice_id) VALUES (?, ?, ?, 'credit_note', ?, 0, 0, ?, ?, 'AUD', 'issued', ?)`)
    .bind(`cn-${orderId}`, `CN-${invoice.invoice_number}`, orderId, -Math.abs(amount), -Math.abs(refundedProcessingFee), -(Math.abs(amount) + Math.abs(refundedProcessingFee)), invoice.id).run()
}

export const contractTemplate = {
  id: 'tmpl-1',
  name: '标准租赁合同模板',
  content: `<h1>电脑租赁协议</h1>

<p>合同编号：<strong>{contract_number}</strong></p>
<p>签署日期：<strong>{sign_time}</strong></p>

<h2>一、双方当事人</h2>
<p><strong>出租方（甲方）：</strong>PC Rental电脑租赁平台</p>
<p>联系电话：{company_phone}</p>
<p>联系邮箱：{company_email}</p>
<br>
<p><strong>承租方（乙方）：</strong>{customer_name}</p>
<p>联系电话：{customer_phone}</p>
<p>联系邮箱：{customer_email}</p>

<h2>二、租赁设备信息</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f3f4f6;">
    <th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">设备名称</th>
    <th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">{device_name}</th>
  </tr>
  <tr>
    <td style="border:1px solid #e5e7eb;padding:8px;">设备型号</td>
    <td style="border:1px solid #e5e7eb;padding:8px;">{device_model}</td>
  </tr>
  <tr style="background:#f3f4f6;">
    <td style="border:1px solid #e5e7eb;padding:8px;">序列号</td>
    <td style="border:1px solid #e5e7eb;padding:8px;">{device_sn}</td>
  </tr>
</table>

<h2>三、租赁期限</h2>
<p>租赁开始日期：{start_date}</p>
<p>租赁结束日期：{end_date}</p>
<p>租赁天数：{rental_days}天</p>

<h2>四、费用明细</h2>
<p>日租金：AUD$ {daily_rate}</p>
<p>租金总额：AUD$ {total_rent}</p>
<p>押金金额：AUD$ {deposit_amount}</p>
<p>支付方式：{payment_method}</p>

<h2>五、银行账户信息</h2>
<p>BSB：{bank_bsb}</p>
<p>账号：{bank_account}</p>
<p>账户名：{account_name}</p>

<h2>六、双方签字</h2>
<p>甲方签字：_____________________ 日期：__________</p>
<p>乙方签字：{signer_name} 日期：{sign_time}</p>`,
}

export async function getContractTemplate(c: Context): Promise<ContractTemplate> {
  const db = getDB(c);
  const template = await db.prepare('SELECT * FROM contract_templates WHERE id = ?').bind('default').first() as ContractTemplate | null
  if (template) {
    return { ...template, content: sanitizeRichHtml(template.content) };
  }
  // Fallback to a default in-memory template if not found in DB
  return {
    id: 'default',
    name: '标准租赁合同模板',
    content: `<h1>电脑租赁协议</h1>
<p>合同编号：<strong>{contract_number}</strong></p>
<p>签署日期：<strong>{sign_time}</strong></p>

<h2>一、双方当事人</h2>
<p><strong>出租方（甲方）：</strong>PC Rental电脑租赁平台</p>
<p>联系电话：{company_phone}</p>
<p>联系邮箱：{company_email}</p>
<br>
<p><strong>承租方（乙方）：</strong>{customer_name}</p>
<p>联系电话：{customer_phone}</p>
<p>联系邮箱：{customer_email}</p>

<h2>二、租赁设备信息</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f3f4f6;">
    <th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">设备名称</th>
    <th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">{device_name}</th>
  </tr>
  <tr>
    <td style="border:1px solid #e5e7eb;padding:8px;">设备型号</td>
    <td style="border:1px solid #e5e7eb;padding:8px;">{device_model}</td>
  </tr>
  <tr style="background:#f3f4f6;">
    <td style="border:1px solid #e5e7eb;padding:8px;">序列号</td>
    <td style="border:1px solid #e5e7eb;padding:8px;">{device_sn}</td>
  </tr>
</table>

<h2>三、租赁期限</h2>
<p>租赁开始日期：{start_date}</p>
<p>租赁结束日期：{end_date}</p>
<p>租赁天数：{rental_days}天</p>

<h2>四、费用明细</h2>
<p>日租金：AUD$ {daily_rate}</p>
<p>租金总额：AUD$ {total_rent}</p>
<p>押金金额：AUD$ {deposit_amount}</p>
<p>支付方式：{payment_method}</p>

<h2>五、银行账户信息</h2>
<p>BSB：{bank_bsb}</p>
<p>账号：{bank_account}</p>
<p>账户名：{account_name}</p>

<h2>六、双方签字</h2>
<p>甲方签字：_____________________ 日期：__________</p>
<p>乙方签字：{signer_name} 日期：{sign_time}</p>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateContractTemplate(c: Context, newTemplate: { id: string; name: string; content: string }): Promise<ContractTemplate> {
  const db = getDB(c);
  await db.prepare('INSERT INTO contract_templates (id, name, content, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, content = EXCLUDED.content, updatedAt = EXCLUDED.updatedAt')
    .bind(newTemplate.id, String(newTemplate.name || '').slice(0, 100), sanitizeRichHtml(newTemplate.content))
    .run();
  return getContractTemplate(c);
}

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return `AUD$0.00`
  }
  return `AUD$${value.toFixed(2)}`
}

export function formatDate(value: string): string {
  return value
}

export function parseCookie(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result
  for (const item of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = item.trim().split('=')
    if (!rawName) continue
    result[rawName] = rawValue.join('=')
  }
  return result
}

let dbInstance: any = null

export function getDB(c?: Context): any {
  if (c) {
    dbInstance = c.env.RENT
  }
  if (!dbInstance) {
    throw new Error('Database connection is not initialized. Ensure the request context is available.')
  }
  return dbInstance
}

function toNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0
  return Number(value)
}

export async function seedDatabaseIfEmpty(c: Context): Promise<void> {
  const db = getDB(c)

  const host = String(c.req.header('Host') || '').split(':')[0].toLowerCase()
  const demoEnvironment = String((c.env as any).SHOW_TEST_ACCOUNTS || '').toLowerCase() === 'true' && host === 'test-rent.ydnw6zt6vj.workers.dev'
  if (!demoEnvironment) return

  const countResult = await db.prepare('SELECT COUNT(*) AS count FROM users').all()
  const count = Number(countResult.results?.[0]?.count ?? 0)

  const usersToSeed = [
    { id: 'u-admin', name: 'Admin User', email: 'admin@example.com', password: 'Admin123', role: 'ADMIN', accountNumber: '00000000' },
    { id: 'u-staff', name: 'Staff User', email: 'staff@example.com', password: 'Staff123', role: 'STAFF', accountNumber: '00000001' },
    { id: 'u-customer', name: 'Customer User', email: 'customer@example.com', password: 'Customer123', role: 'CUSTOMER', accountNumber: '00000002' },
  ]

  // users 表字段：兼容 snake_case / camelCase（同时避免插入时引用不存在的列）
  const hasReferralCodeSnake = await userHasColumn(c, 'referral_code')
  const hasReferralCodeCamel = await userHasColumn(c, 'referralCode')
  const hasAccountNumberSnake = await userHasColumn(c, 'account_number')
  const hasAccountNumberCamel = await userHasColumn(c, 'accountNumber')
  const hasCommissionBalanceSnake = await userHasColumn(c, 'commission_balance')
  const hasCommissionBalanceCamel = await userHasColumn(c, 'commissionBalance')

  const hasPasswordHashSnake = await userHasColumn(c, 'password_hash')
  const hasPasswordHashCamel = await userHasColumn(c, 'passwordHash')

  const passwordHashCol = hasPasswordHashSnake ? 'password_hash' : 'passwordHash'
  const accountNumberCol = hasAccountNumberSnake ? 'account_number' : 'accountNumber'
  const commissionBalanceCol = hasCommissionBalanceSnake ? 'commission_balance' : 'commissionBalance'
  const referralCodeCol = hasReferralCodeSnake ? 'referral_code' : 'referralCode'

  const hasUsersTableCols = (arr: string[]) => arr.every((col) => {
    // 只在已确认列存在时才写入（避免不同库状态混乱）
    return true
  })

  // 仅在 users 已存在时也要“修正默认用户密码/字段”，否则会出现你现在看到的“账号或密码错误”
  const userUpserts: any[] = []
  for (const user of usersToSeed) {
    const hash = await hashPassword(user.password)

    const cols: string[] = ['id', 'name', 'email', 'role', 'status', 'balance', passwordHashCol]
    const vals: any[] = [user.id, user.name, user.email, user.role, 'active', 0, hash]

    if (hasAccountNumberSnake || hasAccountNumberCamel) {
      cols.push(accountNumberCol)
      vals.push(user.accountNumber)
    }
    if (hasCommissionBalanceSnake || hasCommissionBalanceCamel) {
      cols.push(commissionBalanceCol)
      vals.push(0)
    }
    if (hasReferralCodeSnake || hasReferralCodeCamel) {
      cols.push(referralCodeCol)
      vals.push(null)
    }

    const setParts: string[] = cols
      .filter((col) => col !== 'id')
      .map((col) => `${col} = EXCLUDED.${col}`)

    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setParts.join(', ')}`
    userUpserts.push(db.prepare(sql).bind(...vals))
  }
  await db.batch(userUpserts)

  if (count > 0) return

  // Seed示例设备
  const devicesToSeed = [
    { id: 'd-mbp14', name: 'MacBook Pro 14寸', model: 'M4 Pro 18GB 512GB', serial_number: 'SN-MBP14-001', pricePerDay: 40.0, depositAmount: 2000.0, status: 'available', description: 'Apple M4 Pro芯片，18GB内存，512GB固态硬盘，14英寸Liquid Retina XDR显示屏' },
    { id: 'd-xps13', name: 'Dell XPS 13', model: 'Intel i7-1360P 16GB', serial_number: 'SN-XPS13-001', pricePerDay: 35.0, depositAmount: 1500.0, status: 'available', description: '第13代Intel酷睿i7处理器，16GB LPDDR5内存，512GB NVMe SSD' },
    { id: 'd-thinkpad', name: 'Lenovo ThinkPad X1 Carbon', model: 'i7-1365U 16GB', serial_number: 'SN-TPX1-001', pricePerDay: 38.0, depositAmount: 1800.0, status: 'rented', description: '13代Intel vPro i7，16GB内存，1TB SSD，14英寸2.8K OLED屏' },
    { id: 'd-imac', name: 'iMac 24寸', model: 'M3 8GB 256GB', serial_number: 'SN-IMAC24-001', pricePerDay: 45.0, depositAmount: 2200.0, status: 'maintenance', description: 'Apple M3芯片，8GB统一内存，256GB SSD，24英寸4.5K Retina显示屏' },
  ]

  const deviceInsert = db.prepare('INSERT INTO devices (id, name, model, serial_number, price_per_day, deposit_amount, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const deviceInserts = devicesToSeed.map(d =>
    deviceInsert.bind(
      d.id,
      d.name,
      d.model,
      d.serial_number,
      d.pricePerDay ?? 0,
      d.depositAmount ?? 0,
      d.status,
      d.description
    )
  )
  await db.batch(deviceInserts)

  // Seed示例订单
  const now = new Date().toISOString()
  const ordersToSeed = [
    {
      id: 'o-1', userId: 'u-customer', deviceId: 'd-thinkpad',
      startDate: '2026-07-10', endDate: '2026-08-10', rentalPeriod: 31,
      totalAmount: 1178.0, depositAmount: 1800.0, status: 'active', paymentMethod: 'bank_transfer'
    },
    {
      id: 'o-2', userId: 'u-customer', deviceId: 'd-mbp14',
      startDate: '2026-07-01', endDate: '2026-07-07', rentalPeriod: 7,
      totalAmount: 280.0, depositAmount: 2000.0, status: 'completed', paymentMethod: 'card'
    },
    {
      id: 'o-3', userId: 'u-customer', deviceId: 'd-xps13',
      startDate: '2026-07-20', endDate: '2026-07-27', rentalPeriod: 7,
      totalAmount: 245.0, depositAmount: 1500.0, status: 'pending_payment', paymentMethod: null
    },
  ]

  const orderInsert = db.prepare('INSERT INTO orders (id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, status, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const orderInserts = ordersToSeed.map(o =>
    orderInsert.bind(o.id, o.userId, o.deviceId, o.startDate, o.endDate, o.rentalPeriod, o.totalAmount, o.depositAmount, o.status, o.paymentMethod, now, now)
  )
  await db.batch(orderInserts)
}

export async function loadDatabaseData(c: Context): Promise<void> {
  const db = getDB(c)
  await seedDatabaseIfEmpty(c)
}


async function userHasColumn(c: Context, columnName: string): Promise<boolean> {
  const db = getDB(c)
  const result = await db.prepare('PRAGMA table_info(users)').all()
  return (result.results || []).some((column: any) => column.name === columnName)
}

export async function findUserBySession(c: Context, cookieHeader: string | null): Promise<User | null> {
  const db = getDB(c)
  const cookies = parseCookie(cookieHeader)
  const token = cookies.session || ''
  if (!token) return null

  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return null
  await ensureAuthSessionsSchema(c)
  const tokenHash = await sha256Hex(token)
  const session = await db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP').bind(tokenHash).first() as any
  if (!session?.user_id) return null
  const id = String(session.user_id)
  const user: User | null = await db
    .prepare("SELECT * FROM users WHERE id = ? AND status = 'active'")
    .bind(id)
    .first()

  if (!user) return null
  const guestExpiry = user.account_type === 'guest' ? String(user.guest_expires_at || '').slice(0, 10) : ''
  const todayMelbourne = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (guestExpiry && guestExpiry < todayMelbourne) {
    await db.prepare("UPDATE users SET account_type = 'deleted_guest', status = 'inactive', email = 'deleted-guest-' || id || '@invalid.local', phone = NULL, bsb = NULL, account_number = NULL, password_hash = 'disabled', password_salt = 'disabled', guest_order_id = NULL, guest_expires_at = NULL, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_type = 'guest'").bind(id).run()
    await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(id).run()
    return null
  }
  const normalized = normalizeUserRow(user as any)
  return normalized
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

let authSessionsSchemaReady: Promise<void> | null = null

async function ensureAuthSessionsSchema(c: Context): Promise<void> {
  if (!authSessionsSchemaReady) {
    authSessionsSchemaReady = c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`).run().then(() => undefined)
  }
  try {
    await authSessionsSchemaReady
  } catch (error) {
    authSessionsSchemaReady = null
    throw error
  }
}

export async function createAuthSession(c: Context, userId: string, remember = false): Promise<{ token: string; maxAge: number }> {
  await ensureAuthSessionsSchema(c)
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()
  await c.env.RENT.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), userId, expiresAt).run()
  return { token, maxAge }
}

export async function deleteAuthSession(c: Context, cookieHeader: string | null): Promise<void> {
  const token = parseCookie(cookieHeader).session || ''
  if (/^[A-Za-z0-9_-]{32,}$/.test(token)) await c.env.RENT.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
}

export async function enforceRateLimit(c: Context, scope: string, clientKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  await c.env.RENT.prepare(`INSERT INTO security_rate_limits (scope, client_key, bucket, request_count) VALUES (?, ?, ?, 1) ON CONFLICT(scope, client_key, bucket) DO UPDATE SET request_count = request_count + 1`).bind(scope, clientKey.slice(0, 200), bucket).run()
  const row = await c.env.RENT.prepare('SELECT request_count FROM security_rate_limits WHERE scope = ? AND client_key = ? AND bucket = ?').bind(scope, clientKey.slice(0, 200), bucket).first() as any
  return Number(row?.request_count || 0) <= limit
}

export function buildLayout(title: string, body: string, currentUser?: User | null): string {
  const normalizedTitle = title.includes('电脑租赁管理系统') ? title : `${title} - 电脑租赁管理系统`
  const isAuthPage = title.includes('登录') || title.includes('注册') || title.includes('找回密码')
  const topNav =
    currentUser || isAuthPage
      ? ``
      : `
      <a href="/login">登录</a>
      <a href="/register">注册</a>
    `

  const userBlockHtml = currentUser
    ? `
        <button class="notification-bell" type="button" aria-label="打开通知中心" aria-expanded="false"><svg class="notification-bell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><b class="notification-bell__count" hidden>0</b></button>
        <a class="user-profile-link" href="${currentUser.role === 'ADMIN' ? `/admin/users/${encodeURIComponent(currentUser.id)}/edit` : currentUser.role === 'STAFF' ? '/staff/profile' : '/customer/profile'}" aria-label="编辑个人信息"><span class="user-label">${currentUser.name}${currentUser.accountType === 'guest' ? ` · 访客（${currentUser.guestExpiresAt || '租期结束'}删除）` : ''}</span><div class="user-avatar">${getAvatarInitials(currentUser.name)}</div></a>
        <form method="post" action="/logout" style="display:inline"><button type="submit" class="logout-button">登出</button></form>
      `
    : ''

  const navIcons: Record<string, string> = {
    '/customer/dashboard': '◉', '/customer/rentals': '▤', '/customer/orders': '▦',
    '/customer/profile': '◎', '/customer/security': '⚿', '/customer/referral': '✦', '/customer/devices': '▣',
    '/staff/dashboard': '◉', '/staff/orders': '▦', '/staff/orders/ongoing': '◷', '/staff/customers': '◎', '/staff/contracts': '▤',
    '/staff/contracts/new': '+', '/staff/rentals/tracking': '◈', '/staff/devices': '▣',
    '/notifications': 'N', '/admin/dashboard': '◉', '/admin/users': '◎', '/admin/orders': '▦',
    '/admin/refunds': '↺', '/admin/contracts': '▤', '/admin/finance': '$',
    '/admin/withdrawals': '↗', '/admin/devices': '▣', '/admin/calendar': '▦', '/admin/templates': '▤', '/admin/email-templates': '▤', '/admin/settings': '⚙'
  }

  const navIconSvg = (kind: string) => {
    const paths: Record<string, string> = {
      '◉': '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2"></circle>',
      '▤': '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path>',
      '▦': '<rect x="5" y="5" width="14" height="14" rx="2"></rect><path d="M9 5v14M15 5v14M5 9h14M5 15h14"></path>',
      '◎': '<circle cx="12" cy="8" r="3"></circle><path d="M6 20c.7-3.3 2.7-5 6-5s5.3 1.7 6 5"></path>',
      '▣': '<rect x="5" y="5" width="14" height="14" rx="2"></rect><path d="M8 8h8v8H8z"></path>',
      '⚙': '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"></path>',
      'N': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
      '◷': '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path>',
      '↺': '<path d="M5 9a8 8 0 1 1 1 8"></path><path d="M5 5v4h4"></path>',
      '↗': '<path d="M7 17 17 7M9 7h8v8"></path>',
      '$': '<path d="M12 3v18M16 7.5c-.8-1-2-1.5-4-1.5-2.4 0-4 1.2-4 3s1.6 3 4 3 4 1.2 4 3-1.6 3-4 3c-2 0-3.2-.5-4-1.5"></path>',
      '⚿': '<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
      '✦': '<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"></path>',
      '◈': '<path d="m12 3 8 9-8 9-8-9 8-9Z"></path><path d="m12 8 3 4-3 4-3-4 3-4Z"></path>',
      '+': '<path d="M12 5v14M5 12h14"></path>'
    }
    return `<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths['▣']}</svg>`
  }
  const renderNavLink = (href: string, text: string) => {
    const icon = navIcons[href] || '▣'
    return `<a href="${href}"><span class="nav-icon">${navIconSvg(icon)}</span>${text}</a>`
  }
  const renderNavGroup = (label: string, links: Array<[string, string]>) => `<details class="sidebar-nav-group" open><summary>${label}<span aria-hidden="true">⌄</span></summary>${links.map(([href, text]) => renderNavLink(href, text)).join('')}</details>`

  const mobileLinks = currentUser?.role === 'ADMIN'
    ? [['/admin/dashboard', '控制台', '◉'], ['/notifications', '通知', 'N'], ['/admin/orders', '订单', '▦'], ['/admin/users', '用户', '◎'], ['/admin/settings', '设置', '⚙']]
    : currentUser?.role === 'STAFF'
      ? [['/staff/dashboard', '工作台', '◉'], ['/notifications', '通知', 'N'], ['/staff/orders', '订单', '▦'], ['/staff/contracts', '合同', '▤'], ['/staff/customers', '客户', '◎']]
      : currentUser?.accountType === 'guest'
        ? [['/customer/guest', '合同中心', '▤'], ['/customer/guest/upgrade', '升级账户', '✦']]
        : [['/customer/dashboard', '首页', '◉'], ['/notifications', '通知', 'N'], ['/customer/devices', '可租设备', '▣'], ['/customer/rentals', '租赁', '▤'], ['/customer/orders', '订单', '▦'], ['/customer/balance', '钱包', '$'], ['/customer/profile', '我的', '◎']]
  const mobileNav = currentUser ? mobileLinks.map(([href, text, icon]) => `<a href="${href}"><span class="nav-icon">${navIconSvg(navIcons[href] || icon)}</span><small>${text}</small></a>`).join('') : `<a href="/login"><span class="nav-icon">${navIconSvg('↗')}</span><small>登录</small></a><a href="/register"><span class="nav-icon">${navIconSvg('+')}</span><small>注册</small></a>`
  const mobileLabel = currentUser?.role === 'ADMIN' ? '管理端' : currentUser?.role === 'STAFF' ? '员工端' : currentUser?.accountType === 'guest' ? '访客合同' : '客户端'
  const mobileUserBlock = currentUser ? `<span class="mobile-user-avatar">${getAvatarInitials(currentUser.name)}</span>` : ''

  const sidebar = currentUser
    ? `<aside class="sidebar">
        <div class="sidebar-section">
          <h3>导航</h3>
          ${currentUser.role === 'CUSTOMER' ? `
            ${currentUser.accountType === 'guest' ? renderNavGroup('合同中心', [['/customer/guest', '访客合同中心'], ['/customer/guest/upgrade', '升级账户']]) : `
              ${renderNavLink('/customer/dashboard', '控制台')}
              ${renderNavGroup('租赁工作区', [['/customer/devices', '预览可租设备'], ['/customer/rentals', '我的租赁'], ['/customer/orders', '订单管理']])}
              ${renderNavGroup('账户与钱包', [['/customer/balance', '我的钱包'], ['/customer/profile', '个人资料'], ['/customer/security', '安全设置'], ['/customer/referral', '推荐计划']])}
            `}
          ` : ''}
          ${currentUser.role === 'STAFF' ? `
            ${renderNavLink('/staff/dashboard', '工作台')}
            ${renderNavLink('/notifications', '通知中心')}
            ${renderNavGroup('客户与订单', [['/staff/customers', '客户管理'], ['/staff/orders', '订单状态'], ['/staff/orders/ongoing', '进行中的订单']])}
            ${renderNavGroup('合同工作区', [['/staff/contracts', '合同管理'], ['/staff/contracts/new', '新建合同']])}
            ${renderNavGroup('设备运营', [['/staff/devices', '设备管理'], ['/staff/rentals/tracking', '租赁追踪']])}
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            ${renderNavLink('/admin/dashboard', '控制台')}
            ${renderNavLink('/notifications', '通知中心')}
            ${renderNavGroup('客户与用户', [['/admin/users', '用户管理']])}
            ${renderNavGroup('订单与合同', [['/admin/orders', '订单管理'], ['/admin/contracts', '合同管理']])}
            ${renderNavGroup('设备与日历', [['/admin/devices', '设备管理'], ['/admin/calendar', '租赁日历']])}
            ${renderNavGroup('财务管理', [['/admin/finance', '财务总览'], ['/admin/coupons', '优惠码管理'], ['/admin/refunds', '退款管理'], ['/admin/withdrawals', '佣金提现']])}
            ${renderNavGroup('协议与设置', [['/admin/templates', '协议与模板'], ['/admin/email-templates', '邮件通知模板'], ['/admin/settings', '系统设置']])}
          ` : ''}
        </div>
        <div class="sidebar-footer">
          <div class="status-indicator online">
            <span class="led"></span>
            <span>系统正常</span>
          </div>
        </div>
      </aside>`
    : ''

  return renderLayoutTemplate({
    TITLE: normalizedTitle,
    BODY_CLASS: isAuthPage ? 'auth-page' : currentUser ? 'app-page' : 'public-page',
    TOP_NAV: topNav,
    USER_BLOCK: userBlockHtml,
    MOBILE_NAV: mobileNav,
    MOBILE_LABEL: mobileLabel,
    MOBILE_USER_BLOCK: mobileUserBlock,
    SIDEBAR: sidebar,
    CONTENT: body,
    FOOTER: `<footer class="legal-footer"><span class="legal-footer__copyright">© ${new Date().getFullYear()} ${sanitizePlainText(systemSettings.companyDetails.name || 'PC Rental', 80)}</span><nav aria-label="网站法律信息"><a href="/service-terms">服务条款</a><a href="/privacy">隐私政策</a><a href="/copyright">退款政策</a></nav></footer>`
  })
}

// ==================== 错误日志记录系统 ====================
export type ErrorLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

/**
 * 记录错误到数据库和控制台
 * @param c Hono上下文对象
 * @param level 错误级别
 * @param message 错误消息
 * @param error 错误对象（可选）
 * @param contextData 额外的上下文数据（可选）
 */
export async function logError(c: Context, level: ErrorLevel, message: string, error?: Error, contextData?: Record<string, any>) {
  const user = c.get('user')
  const db = getDB(c)
  const { nanoid } = await import('nanoid')
  const errorId = `err-${nanoid(8)}`

  // 控制台输出，包含时间戳和级别
  const timestamp = new Date().toISOString()
  const consolePrefix = `[${timestamp}] [${level}]`

  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(`${consolePrefix} ${message}`, error?.stack || '')
  } else if (level === 'WARNING') {
    console.warn(`${consolePrefix} ${message}`)
  } else {
    console.log(`${consolePrefix} ${message}`)
  }

  try {
    // 保存到数据库
    const redact = (value: any): any => {
      if (Array.isArray(value)) return value.map(redact)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [/token|password|secret|signature|authorization/i.test(key) ? key : key, /token|password|secret|signature|authorization/i.test(key) ? '[REDACTED]' : redact(item)]))
      return value
    }
    const contextJson = contextData ? JSON.stringify(redact(contextData)) : null
    const stackTrace = error?.stack || null
    const userId = user?.id || null
    const parsedUrl = new URL(c.req.url)
    for (const key of ['token', 'number', 'session_id']) if (parsedUrl.searchParams.has(key)) parsedUrl.searchParams.set(key, '[REDACTED]')
    const url = parsedUrl.toString()
    const method = c.req.method

    await db.prepare(`
      INSERT INTO error_logs (id, error_level, error_message, error_stack, context_data, user_id, request_url, request_method, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(errorId, level, message, stackTrace, contextJson, userId, url, method).run()
  } catch (dbError) {
    // 如果数据库日志记录失败，至少保证控制台有日志
    console.error('Failed to write error to database:', dbError)
  }
}

/**
 * 清理过期的错误日志（保留30天）
 * @param c Hono上下文对象
 */
export async function cleanupOldErrorLogs(c: Context) {
  const db = getDB(c)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  try {
    await db.prepare(`
      DELETE FROM error_logs WHERE created_at < ?
    `).bind(thirtyDaysAgo.toISOString()).run()
    await logError(c, 'INFO', `Cleaned up error logs older than 30 days`)
  } catch (error) {
    await logError(c, 'WARNING', 'Failed to cleanup old error logs', error as Error)
  }
}

// ==================== 签约会话持久化管理 ====================
const SESSION_EXPIRY_HOURS = 24 // 会话24小时过期

/**
 * 获取或创建签约会话
 * @param c Hono上下文对象
 * @param token 会话token
 * @param contractToken 关联的合同token
 */
export async function getOrCreateSignSession(c: Context, token: string, contractToken: string): Promise<Record<string, any>> {
  const db = getDB(c)

  try {
    // 先尝试获取现有会话 - 使用正确的snake_case列名匹配数据库schema
    const existingSession = await db.prepare(`
      SELECT session_data, expires_at FROM sign_sessions WHERE token = ?
    `).bind(token).first()

    if (existingSession) {
      const sessionData = JSON.parse((existingSession as any).session_data)
      const expiresAt = new Date((existingSession as any).expires_at)

      // 检查会话是否过期
      if (expiresAt > new Date()) {
        await logError(c, 'DEBUG', `Retrieved existing sign session`, undefined, { token, contractToken })
        return sessionData
      } else {
        // 会话已过期，删除并创建新的
        await db.prepare('DELETE FROM sign_sessions WHERE token = ?').bind(token).run()
        await logError(c, 'INFO', `Removed expired sign session`, undefined, { token, contractToken })
      }
    }

    // 创建新会话 - 使用正确的snake_case列名匹配数据库schema
    const newSession: Record<string, any> = {}
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS)

    await db.prepare(`
      INSERT INTO sign_sessions (token, contract_token, session_data, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(token, contractToken, JSON.stringify(newSession), expiresAt.toISOString()).run()

    await logError(c, 'INFO', `Created new sign session`, undefined, { token, contractToken })
    return newSession
  } catch (error) {
    await logError(c, 'ERROR', `Failed to get or create sign session`, error as Error, { token, contractToken })
    throw error
  }
}

/**
 * 更新签约会话数据
 * @param c Hono上下文对象
 * @param token 会话token
 * @param data 要更新的会话数据
 */
export async function updateSignSession(c: Context, token: string, data: Record<string, any>): Promise<void> {
  const db = getDB(c)

  try {
    // 先获取当前会话
    const currentSession = await db.prepare(`
      SELECT session_data FROM sign_sessions WHERE token = ?
    `).bind(token).first()

    if (!currentSession) {
      throw new Error(`Sign session not found: ${token}`)
    }

    const sessionData = JSON.parse((currentSession as any).session_data)
    const updatedSession = { ...sessionData, ...data }

    // 更新数据库中的会话 - 使用正确的snake_case列名匹配数据库schema
    await db.prepare(`
      UPDATE sign_sessions 
      SET session_data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE token = ?
    `).bind(JSON.stringify(updatedSession), token).run()

    await logError(c, 'DEBUG', `Updated sign session`, undefined, { token, updates: Object.keys(data) })
  } catch (error) {
    await logError(c, 'ERROR', `Failed to update sign session`, error as Error, { token, updates: Object.keys(data) })
    throw error
  }
}

/**
 * 删除签约会话（签约完成后清理）
 * @param c Hono上下文对象
 * @param token 会话token
 */
export async function deleteSignSession(c: Context, token: string): Promise<void> {
  const db = getDB(c)

  try {
    await db.prepare('DELETE FROM sign_sessions WHERE token = ?').bind(token).run()
    await logError(c, 'INFO', `Deleted sign session successfully`, undefined, { token })
  } catch (error) {
    await logError(c, 'WARNING', `Failed to delete sign session`, error as Error, { token })
  }
}

/**
 * 清理所有过期的签约会话
 * @param c Hono上下文对象
 */
export async function cleanupExpiredSignSessions(c: Context): Promise<void> {
  const db = getDB(c)
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      DELETE FROM sign_sessions WHERE expiresAt < ?
    `).bind(now).run()

    const deletedCount = (result as any).changes || 0
    if (deletedCount > 0) {
      await logError(c, 'INFO', `Cleaned up ${deletedCount} expired sign sessions`)
    }
  } catch (error) {
    await logError(c, 'WARNING', 'Failed to cleanup expired sign sessions', error as Error)
  }
}


// Legacy/local in-memory helpers have been removed to avoid shadowing DB-backed exports.
