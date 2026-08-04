import { Context } from 'hono'
import sanitizeHtml from 'sanitize-html'

export function sanitizeRichHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? ''), {
    allowedTags: ['h1','h2','h3','h4','p','br','strong','b','em','i','u','s','ol','ul','li','table','thead','tbody','tr','th','td','blockquote','a','span','div','hr','code','pre'],
    allowedAttributes: { a: ['href','target','rel'], '*': ['class','style'] },
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
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
  })
}

export function sanitizePlainText(value: unknown, maxLength = 500): string {
  return sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLength)
}

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN'

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
}

export interface Device {
  id: string
  name: string
  model: string
  serialNumber: string
  serial_number?: string

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
  orderNo: string
  userId: string
  deviceId: string
  deviceName?: string
  startDate: string
  endDate: string
  rentalPeriod?: number
  orderDate?: string
  status: 'pending_approval' | 'pending_payment' | 'approved' | 'paid' | 'active' | 'completed' | 'cancelled'
  paymentMethod: 'card' | 'bank_transfer' | 'balance'
  totalAmount: number
  depositAmount: number
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

export interface Contract {
  id: string
  rentalId: string
  contractNumber: string
  content: string
  signedAt: string | null
  createdAt?: string
  signToken?: string
  status: 'draft' | 'pending_sign' | 'signed' | 'cancelled'
  validFrom?: string | null // New field for contract validity start date
  validUntil?: string | null // New field for contract validity end date
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

// 生成一个随机的盐值
function generateSalt(length: number = 16): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateReferralCode(length: number = 6): Promise<string> {
  const { customAlphabet } = await import('nanoid');
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nanoid = customAlphabet(alphabet, length);
  return nanoid();
}

export async function hashPassword(password: string): Promise<string> {
  const iterations = 210000
  const salt = generateSalt()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
  const hash = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
  return `pbkdf2$${iterations}$${salt}$${hash}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    const [, iterationText, salt, expected] = storedHash.split('$')
    const iterations = Number(iterationText)
    if (!iterations || !salt || !expected) return false
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
    referrerId
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
  const rentalId = contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId
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
  const rentalId = contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId
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
  const contractRow = await db.prepare('SELECT * FROM contracts WHERE rentalId = ? OR rental_id = ?').bind(actualOrderId, actualOrderId).first()
  if (!contractRow) return null

  // 统一处理snake_case和camelCase字段
  const validFrom = contractRow.validFrom ?? contractRow.valid_from
  const validUntil = contractRow.validUntil ?? contractRow.valid_until
  const signExpiresAt = contractRow.signExpiresAt ?? contractRow.sign_expires_at
  const rentalId = contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId
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
      'INSERT INTO orders (id, orderNo, userId, deviceId, startDate, endDate, rentalPeriod, status, paymentMethod, totalAmount, depositAmount, contractId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      order.id,
      order.orderNo,
      order.userId,
      order.deviceId,
      order.startDate,
      order.endDate,
      order.rentalPeriod, // Add rentalPeriod here
      order.status,
      order.paymentMethod,
      order.totalAmount,
      order.depositAmount,
      order.contractId,
      order.createdAt
    )
    .run()
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

export async function updateOrderStatus(c: Context, orderId: string, status: string): Promise<void> {
  const db = getDB(c);
  await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, orderId).run();
}

export async function hasDeviceBookingConflict(c: Context, deviceId: string, startDate: string, endDate: string, excludeOrderId?: string): Promise<boolean> {
  const row = await c.env.RENT.prepare(`
    SELECT id FROM orders
    WHERE deviceId = ? AND id != ?
      AND status NOT IN ('completed', 'cancelled')
      AND startDate < ? AND endDate > ?
    LIMIT 1
  `).bind(deviceId, excludeOrderId || '', endDate, startDate).first()
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
      'UPDATE orders SET orderNo = ?, userId = ?, deviceId = ?, startDate = ?, endDate = ?, status = ?, paymentMethod = ?, totalAmount = ?, depositAmount = ?, contractId = ?, signedAt = ? WHERE id = ?'
    )
    .bind(
      order.orderNo,
      order.userId,
      order.deviceId,
      order.startDate,
      order.endDate,
      order.status,
      order.paymentMethod,
      order.totalAmount,
      order.depositAmount,
      order.contractId,
      order.signedAt,
      order.id
    )
    .run()
}

// Compatibility aliases expected by legacy code
export async function updateOrderInDB(c: Context, orderId: string, data: Partial<Order>): Promise<void> {
  const existing = await getOrderById(c, orderId)
  if (!existing) return
  await updateOrder(c, { ...existing, ...data, id: orderId } as Order)
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
    const result = await db.prepare(`
      DELETE FROM contracts 
      WHERE (status = 'pending_sign' AND (signExpiresAt < ? OR sign_expires_at < ?))
         OR (status = 'cancelled' AND (updatedAt < ? OR updated_at < ?))
    `).bind(now, now, sevenDaysAgoISO, sevenDaysAgoISO).run()

    const deletedCount = result.meta?.changes || 0
    if (deletedCount > 0) {
      await logError(c, 'INFO', `Cleaned up ${deletedCount} expired/cancelled contracts`)
    }
    return deletedCount
  } catch (error) {
    await logError(c, 'ERROR', 'Failed to cleanup expired/cancelled contracts', error as Error)
    return 0
  }
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
  const rentalId = contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId
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
  const rentalId = contractRow.rentalId ?? contractRow.rental_id
  const rental_id = contractRow.rental_id ?? contractRow.rentalId
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



type SystemSettingsKey = 'rentalTerms' | 'priceStrategy' | 'paymentMethods' | 'bankDetails' | 'emailTemplate' | 'referralSettings' | 'companyDetails'

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

  const read = async (key: SystemSettingsKey) => {
    const row = await db.prepare('SELECT value FROM systemSettings WHERE key = ?').bind(key).first()
    const value = (row as any)?.value
    return value ?? null
  }

  const rentalTermsValue = await read('rentalTerms')
  const priceStrategyValue = await read('priceStrategy')
  const paymentMethodsValue = await read('paymentMethods')
  const bankDetailsValue = await read('bankDetails')
  const emailTemplateValue = await read('emailTemplate')
  const referralSettingsValue = await read('referralSettings')
  const companyDetailsValue = await read('companyDetails')

  systemSettings.rentalTerms = sanitizeRichHtml(rentalTermsValue ?? systemSettings.rentalTerms)
  systemSettings.priceStrategy = priceStrategyValue ?? systemSettings.priceStrategy
  systemSettings.emailTemplate = emailTemplateValue ?? systemSettings.emailTemplate

  const parsedPaymentMethods = safeJsonParse<typeof systemSettings.paymentMethods>(paymentMethodsValue)
  const parsedBankDetails = safeJsonParse<typeof systemSettings.bankDetails>(bankDetailsValue)
  const parsedReferralSettings = safeJsonParse<typeof systemSettings.referralSettings>(referralSettingsValue)
  const parsedCompanyDetails = safeJsonParse<typeof systemSettings.companyDetails>(companyDetailsValue)

  if (parsedPaymentMethods) {
    systemSettings.paymentMethods = {
      stripe: Boolean((parsedPaymentMethods as any).stripe ?? (parsedPaymentMethods as any).square),
      bankTransfer: Boolean((parsedPaymentMethods as any).bankTransfer),
      balancePayment: Boolean((parsedPaymentMethods as any).balancePayment),
    }
  }
  if (parsedBankDetails) systemSettings.bankDetails = parsedBankDetails
  if (parsedReferralSettings) systemSettings.referralSettings = parsedReferralSettings
  if (parsedCompanyDetails) systemSettings.companyDetails = { ...systemSettings.companyDetails, ...parsedCompanyDetails }

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

  await write('rentalTerms', systemSettings.rentalTerms)
  await write('priceStrategy', systemSettings.priceStrategy)
  await write('paymentMethods', systemSettings.paymentMethods)
  await write('bankDetails', systemSettings.bankDetails)
  await write('emailTemplate', systemSettings.emailTemplate)
  await write('referralSettings', systemSettings.referralSettings)
  await write('companyDetails', systemSettings.companyDetails)

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
  const insertFields = ['id', 'name', 'email', 'role', 'status', 'balance'];
  const insertValues = [user.id, user.name, user.email, user.role, user.status ?? 'active', user.balance ?? 0];

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
    commissionRate: 'commission_rate'
  }

  const allowedFields = new Set([
    'name', 'email', 'role', 'status', 'balance', 'phone', 'bsb', 'account', 'accountNumber',
    'referralCode', 'referrerId', 'passwordHash', 'passwordSalt', 'commissionBalance',
    'createdAt', 'updatedAt', 'commissionRate',
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

  // 应用字段名映射，确保使用数据库中存在的列名
  const mappedSetEntries = setEntries.map(([k, v]) => [fieldMapping[k] || k, v])
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
  // 绑定后不可更改：如果 referrer_id 已存在则不更新
  const db = getDB(c)
  await db.prepare('UPDATE users SET referrer_id = ? WHERE id = ? AND referrer_id IS NULL').bind(referrerId, userId).run()
  return getUserById(c, userId)
}

export async function unbindReferrer(c: Context, userId: string): Promise<User | null> {
  const db = getDB(c)
  await db.prepare('UPDATE users SET referrer_id = NULL WHERE id = ?').bind(userId).run()
  return getUserById(c, userId)
}

export async function updateDevice(c: Context, deviceId: string, data: Partial<Device>): Promise<Device | null> {
  const db = getDB(c)
  const existing = await getDeviceById(c, deviceId)
  if (!existing) return null

  const columnMapping: Record<string, string> = {
    name: 'name', model: 'model', status: 'status', description: 'description',
    serialNumber: 'serialNumber', serial_number: 'serial_number',
    pricePerDay: 'pricePerDay', price_per_day: 'price_per_day',
    depositAmount: 'depositAmount', deposit_amount: 'deposit_amount',
  }
  const plainTextFields = new Set(['name', 'model', 'description', 'serialNumber', 'serial_number'])
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

export async function getPendingOrdersWithDetails(c: Context): Promise<any[]> {
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
    WHERE o.status = 'pending_approval'
    ORDER BY o.createdAt DESC
  `;
  const result = await db.prepare(query).all();
  return result.results || [];
}

export async function getStaffDashboardData(c: Context): Promise<any> {
  const db = getDB(c);

  const statsQuery = `
    SELECT
      (SELECT SUM(totalAmount) FROM orders WHERE status = 'completed' OR status = 'paid') as totalRevenue,
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
    ORDER BY o.createdAt DESC
    LIMIT 5
  `;

  const recentDevicesQuery = `
    SELECT d.id, d.name, d.status, u.name as customerName
    FROM devices d
    LEFT JOIN (
      SELECT deviceId, userId FROM orders WHERE status = 'active' OR status = 'paid'
    ) o ON d.id = o.deviceId
    LEFT JOIN users u ON o.userId = u.id
    ORDER BY d.createdAt DESC
    LIMIT 5
  `;

  const [statsResult, recentOrdersResult, recentDevicesResult] = await Promise.all([
    db.prepare(statsQuery).first(),
    db.prepare(recentOrdersQuery).all(),
    db.prepare(recentDevicesQuery).all()
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
    abn: '',
    gstIncluded: true,
    address: '',
    phone: '',
    email: '',
    contact: '',
  },
  bankDetails: {
    bsb: '062-001',
    account: '87654321',
    accountName: '账户名',
  },
  rentalTerms,
  priceStrategy: '标准定价：按日租金计费，超过租期按日累加。',
  paymentMethods: {
    stripe: true,
    bankTransfer: true,
    balancePayment: true,
  },
  emailTemplate: `主题：您的电脑租赁合同已签署确认 - {contract_number}

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
  referralSettings: {
    defaultRate: 10,
    levelLimit: 3,
    settlementPeriod: 30,
  },
}

function escapeContractValue(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

export function renderContractVariables(content: string, contract: Contract, order?: any, device?: any, customer?: any, extra: Record<string, unknown> = {}, includeInternal = false): string {
  const rentOnly = Math.max(0, Number(order?.totalAmount ?? order?.total_amount ?? 0) - Number(order?.depositAmount ?? order?.deposit_amount ?? 0))
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const emptyOperational = Object.fromEntries(CONTRACT_OPERATIONAL_FIELDS.map(([name]) => [name, '']))
  const values: Record<string, unknown> = {
    ...emptyOperational,
    ...stored,
    ...extra,
    contract_number: contract.contractNumber,
    order_no: order?.orderNo ?? order?.order_no,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_contact: systemSettings.companyDetails.contact,
    customer_name: customer?.name,
    customer_phone: customer?.phone,
    customer_email: customer?.email,
    device_name: device?.name ?? order?.deviceName,
    device_model: device?.model,
    device_sn: device?.serialNumber ?? device?.serial_number,
    device_condition: contract.device_condition,
    device_accessories: contract.device_accessories,
    start_date: order?.startDate ?? order?.start_date,
    end_date: order?.endDate ?? order?.end_date,
    rental_days: order?.rentalPeriod ?? order?.rental_period,
    daily_rate: Number(order?.dailyRate ?? order?.daily_rate ?? device?.pricePerDay ?? 0).toFixed(2),
    total_rent: rentOnly.toFixed(2),
    deposit_amount: Number(order?.depositAmount ?? order?.deposit_amount ?? 0).toFixed(2),
    late_fee_per_day: Number(contract.late_fee_per_day || 0).toFixed(2),
    repair_cost: contract.repair_cost == null ? '' : Number(contract.repair_cost).toFixed(2),
    pickup_location: contract.pickup_location,
    return_location: contract.return_location,
    payment_method: order?.paymentMethod ?? order?.payment_method,
    bank_bsb: systemSettings.bankDetails.bsb,
    bank_account: systemSettings.bankDetails.account,
    account_name: systemSettings.bankDetails.accountName,
    company_abn: systemSettings.companyDetails.abn,
    gst_included: systemSettings.companyDetails.gstIncluded ? '是' : '否',
    signer_name: customer?.name,
    sign_time: contract.signedAt ? new Date(contract.signedAt).toLocaleString('en-AU') : '',
    esign_ip: contract.esign_ip,
    esign_device: contract.esign_device,
    device_id: device?.id ?? order?.deviceId ?? order?.device_id,
    currency: 'AUD',
    created_time: contract.createdAt ?? (contract as any).created_at,
    updated_time: (contract as any).updatedAt ?? (contract as any).updated_at,
    contract_status: contract.status,
    deleted: contract.deleted_at ? '是' : '否',
  }
  if (!includeInternal) {
    for (const name of ['created_by', 'approved_by', 'created_time', 'updated_time', 'contract_status', 'deleted', 'notes']) values[name] = ''
  }
  return Object.entries(values).reduce((result, [name, value]) => {
    const safe = escapeContractValue(value)
    return result.replace(new RegExp(`\\$\\{${name}\\}|\\{${name}\\}`, 'g'), safe)
  }, sanitizeRichHtml(content || ''))
}

export const CONTRACT_OPERATIONAL_FIELDS = [
  ['invoice_number','发票编号'], ['delivery_method','配送方式（Pickup / Delivery）'], ['delivery_fee','配送费'],
  ['return_status','归还状态'], ['return_date','实际归还日期'], ['inspection_date','检查日期'], ['inspection_by','检查员工'],
  ['device_brand','设备品牌'], ['device_cpu','CPU'], ['device_ram','内存'], ['device_storage','存储'], ['device_gpu','显卡'], ['device_os','设备操作系统'],
  ['battery_health','电池健康'], ['charger_sn','充电器 SN'], ['asset_tag','公司资产编号'],
  ['esign_signature','客户电子签名'], ['company_signature','公司电子签名'], ['esign_location','签约 GPS 位置'], ['esign_browser','签约浏览器'], ['esign_os','签约操作系统'], ['agreement_version','合同版本'],
  ['discount','优惠金额'], ['coupon_code','优惠码'],
  ['damage_description','损坏说明'], ['damage_photos','损坏照片 URL'], ['repair_invoice','维修发票'], ['replacement_cost','更换费用'],
  ['collection_required','是否需要追回'], ['collection_date','回收日期'],
  ['screen_condition','屏幕状况'], ['keyboard_condition','键盘状况'], ['trackpad_condition','触控板状况'], ['body_condition','外壳状况'], ['camera_condition','摄像头状况'], ['wifi_condition','WiFi 状况'], ['battery_cycles','电池循环次数'], ['power_test','开机测试'],
  ['approved_by','审批员工'], ['notes','内部备注'],
  ['jurisdiction','司法管辖区'], ['insurance_required','是否要求保险'], ['insurance_provider','保险公司'], ['waiver_signed','是否签署免责'], ['privacy_version','隐私政策版本'],
] as const

export const CONTRACT_COMPUTED_FIELDS = [
  ['device_id','系统内部设备 ID'], ['currency','币种'], ['deposit_paid','已支付押金'], ['rent_paid','已支付租金'], ['amount_due','剩余应付款'], ['payment_date','付款日期'], ['payment_reference','银行 Reference'],
  ['subtotal','小计'], ['gst_amount','GST 金额'], ['refund_amount','退款金额'], ['deposit_refund','押金退款'], ['refund_date','退款日期'], ['deduction_amount','押金扣除金额'],
  ['late_days','逾期天数'], ['late_fee','逾期费用'], ['created_by','创建员工'], ['created_time','创建时间'], ['updated_time','更新时间'], ['contract_status','合同状态'], ['deleted','是否删除'],
] as const

export const CONTRACT_SIGNED_FIELDS = new Set([
  'esign_signature', 'esign_location', 'esign_browser', 'esign_os', 'agreement_version',
])

export async function getContractVariableData(c: Context, contract: Contract, order: any): Promise<Record<string, unknown>> {
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const payments = await c.env.RENT.prepare("SELECT COALESCE(SUM(amount),0) paid, COALESCE(SUM(deposit_amount),0) deposit_paid, COALESCE(SUM(rental_amount),0) rent_paid, MAX(paid_at) payment_date, MAX(currency) currency FROM payments WHERE rental_id = ? AND status = 'paid'").bind(order.id).first() as any
  const reference = await c.env.RENT.prepare("SELECT pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.created_at DESC LIMIT 1").bind(order.id).first() as any
  const refund = await c.env.RENT.prepare("SELECT type, refund_amount, deduction_amount, created_at FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first() as any
  const creator = contract.createdBy ? await getUserById(c, contract.createdBy) : null
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
    invoice_number: stored.invoice_number || `INV-${order.orderNo || order.id}`,
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
  }
}

export async function issueInvoice(c: Context, orderId: string): Promise<void> {
  const order = await getOrderById(c, orderId)
  if (!order) return
  const contract = await getContractByOrderId(c, orderId)
  const data = contract && typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : ((contract?.contract_data as Record<string, unknown>) || {})
  const taxableGross = Math.max(0, Number(order.totalAmount) - Number(order.depositAmount))
  const gstAmount = systemSettings.companyDetails.gstIncluded ? taxableGross / 11 : 0
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO invoices (id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount, total_amount, currency, status) VALUES (?, ?, ?, 'invoice', ?, ?, ?, ?, 'AUD', 'issued')`)
    .bind(`inv-${order.id}`, String(data.invoice_number || `INV-${order.orderNo || order.id}`), order.id, taxableGross - gstAmount, gstAmount, Number(order.depositAmount), Number(order.totalAmount)).run()
}

export async function issueCreditNote(c: Context, orderId: string, amount: number): Promise<void> {
  const invoice = await c.env.RENT.prepare("SELECT id, invoice_number FROM invoices WHERE order_id = ? AND type = 'invoice'").bind(orderId).first() as any
  if (!invoice) return
  await c.env.RENT.prepare(`INSERT OR IGNORE INTO invoices (id, invoice_number, order_id, type, subtotal, gst_amount, deposit_amount, total_amount, currency, status, related_invoice_id) VALUES (?, ?, ?, 'credit_note', ?, 0, 0, ?, 'AUD', 'issued', ?)`)
    .bind(`cn-${orderId}`, `CN-${invoice.invoice_number}`, orderId, -Math.abs(amount), -Math.abs(amount), invoice.id).run()
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

  const countResult = await db.prepare('SELECT COUNT(*) AS count FROM users').all()
  const count = Number(countResult.results?.[0]?.count ?? 0)

  const usersToSeed = [
    { id: 'u-admin', name: 'Admin User', email: 'admin@example.com', password: 'Admin123', role: 'ADMIN', accountNumber: '00000000' },
    { id: 'u-staff', name: 'Staff User', email: 'staff@example.com', password: 'Staff123', role: 'STAFF', accountNumber: '00000001' },
    { id: 'u-customer', name: 'Customer User', email: 'customer@example.com', password: 'Customer123', role: 'CUSTOMER', accountNumber: '00000002' },
  ]

  // users 表字段：兼容 snake_case / camelCase（同时避免插入时引用不存在的列）
  const hasReferralCode = await userHasColumn(c, 'referralCode')
  const hasAccountNumberSnake = await userHasColumn(c, 'account_number')
  const hasAccountNumberCamel = await userHasColumn(c, 'accountNumber')
  const hasCommissionBalanceSnake = await userHasColumn(c, 'commission_balance')
  const hasCommissionBalanceCamel = await userHasColumn(c, 'commissionBalance')

  const hasPasswordHashSnake = await userHasColumn(c, 'password_hash')
  const hasPasswordHashCamel = await userHasColumn(c, 'passwordHash')

  const passwordHashCol = hasPasswordHashSnake ? 'password_hash' : 'passwordHash'
  const accountNumberCol = hasAccountNumberSnake ? 'account_number' : 'accountNumber'
  const commissionBalanceCol = hasCommissionBalanceSnake ? 'commission_balance' : 'commissionBalance'

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
    if (hasReferralCode) {
      cols.push('referralCode')
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
  const tokenHash = await sha256Hex(token)
  const session = await db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP').bind(tokenHash).first() as any
  if (!session?.user_id) return null
  const id = String(session.user_id)

  const hasReferralCode = await userHasColumn(c, 'referralCode')

  // users 表字段：兼容 snake_case / camelCase
  const hasAccountNumberSnake = await userHasColumn(c, 'account_number')
  const hasAccountNumberCamel = await userHasColumn(c, 'accountNumber')
  const hasCommissionBalanceSnake = await userHasColumn(c, 'commission_balance')
  const hasCommissionBalanceCamel = await userHasColumn(c, 'commissionBalance')

  const accountSelect = hasAccountNumberSnake
    ? 'account_number AS account'
    : hasAccountNumberCamel
      ? 'accountNumber AS account'
      : 'NULL AS account'

  const commissionSelect = hasCommissionBalanceSnake
    ? 'commission_balance AS commissionBalance'
    : hasCommissionBalanceCamel
      ? 'commissionBalance AS commissionBalance'
      : '0 AS commissionBalance'

  const selectClause = hasReferralCode
    ? `id, name, email, role, phone, bsb, ${accountSelect}, ${commissionSelect}, referralCode`
    : `id, name, email, role, phone, bsb, ${accountSelect}, ${commissionSelect}`

  const user: User | null = await db
    .prepare(`SELECT ${selectClause} FROM users WHERE id = ? AND status = 'active'`)
    .bind(id)
    .first()

  if (!user) return null
  const normalized = normalizeUserRow(user as any)
  if (!hasReferralCode) {
    normalized.referralCode = ''
  }
  return normalized
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createAuthSession(c: Context, userId: string, remember = false): Promise<{ token: string; maxAge: number }> {
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
        <span class="user-label">${currentUser.name}</span>
        <div class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
        <form method="post" action="/logout" style="display:inline"><button type="submit" class="logout-button">登出</button></form>
      `
    : ''

  const navIcons: Record<string, string> = {
    '/customer/dashboard': '◉', '/customer/rentals': '▤', '/customer/orders': '▦',
    '/customer/profile': '◎', '/customer/security': '⚿', '/customer/referral': '✦',
    '/staff/dashboard': '◉', '/staff/orders/pending': '◷', '/staff/contracts': '▤',
    '/staff/contracts/new': '+', '/staff/rentals/tracking': '◈', '/staff/devices': '▣',
    '/admin/dashboard': '◉', '/admin/users': '◎', '/admin/orders': '▦',
    '/admin/refunds': '↺', '/admin/contracts': '▤', '/admin/finance': '$',
    '/admin/withdrawals': '💳', '/admin/devices': '▣', '/admin/settings': '⚙'
  }

  const renderNavLink = (href: string, text: string) => {
    const icon = navIcons[href] || '•'
    return `<a href="${href}"><span class="nav-icon">${icon}</span>${text}</a>`
  }

  const sidebar = currentUser
    ? `<aside class="sidebar">
        <div class="sidebar-section">
          <h3>导航</h3>
          ${currentUser.role === 'CUSTOMER' ? `
            ${renderNavLink('/customer/dashboard', '控制台')}
            ${renderNavLink('/customer/rentals', '我的租赁')}
            ${renderNavLink('/customer/orders', '订单管理')}
            ${renderNavLink('/customer/profile', '个人资料')}
            ${renderNavLink('/customer/security', '安全设置')}
            ${renderNavLink('/customer/referral', '推荐计划')}
          ` : ''}
          ${currentUser.role === 'STAFF' ? `
            ${renderNavLink('/staff/dashboard', '工作台')}
            ${renderNavLink('/staff/orders/pending', '待审订单')}
            ${renderNavLink('/staff/contracts', '合同管理')}
            ${renderNavLink('/staff/contracts/new', '新建合同')}
            ${renderNavLink('/staff/devices', '设备管理')}
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            ${renderNavLink('/admin/dashboard', '控制台')}
            ${renderNavLink('/admin/users', '用户管理')}
            ${renderNavLink('/admin/orders', '订单管理')}
            ${renderNavLink('/admin/refunds', '退款管理')}
            ${renderNavLink('/admin/contracts', '合同管理')}
            ${renderNavLink('/admin/finance', '财务管理')}
            ${renderNavLink('/admin/withdrawals', '佣金提现')}
            ${renderNavLink('/admin/devices', '设备管理')}
            ${renderNavLink('/admin/settings', '系统设置')}
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

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${normalizedTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
  <style>
    :root {
      --primary: #1e40af;
      --primary-light: #dbeafe;
      --primary-dark: #1e3a8a;
      --accent: #b45309;
      --accent-light: #fef3c7;
      --success: #047857;
      --success-light: #d1fae5;
      --warning: #b45309;
      --warning-light: #fef3c7;
      --danger: #b91c1c;
      --danger-light: #fee2e2;
      --info: #0369a1;
      --info-light: #e0f2fe;
      --bg: #fafaf9;
      --bg-subtle: #f5f5f4;
      --surface: #ffffff;
      --text: #18181b;
      --text-secondary: #71717a;
      --text-tertiary: #a1a1aa;
      --border: #e4e4e7;
      --border-subtle: #f4f4f5;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
      --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04);
      --radius: 6px;
      --radius-md: 8px;
      --radius-lg: 10px;
      --transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      --font-display: 'Space Grotesk', system-ui, sans-serif;
      --font-body: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: radial-gradient(circle at 1px 1px, #e4e4e7 1px, transparent 0);
      background-size: 32px 32px;
      opacity: 0.3;
      pointer-events: none;
      z-index: 0;
    }
    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .page { position: relative; z-index: 1; max-width: 100%; min-height: 100vh; display: flex; flex-direction: column; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 28px;
      height: 60px;
      background: rgba(255,255,255,0.85);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .logo {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.02em;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px; height: 32px;
      background: var(--primary);
      color: white;
      border-radius: var(--radius);
      font-size: 1rem;
    }
    .main-nav { display: flex; align-items: center; gap: 4px; }
    .main-nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 0.9rem;
      border-radius: var(--radius);
      transition: var(--transition);
    }
    .main-nav a:hover { color: var(--text); background: var(--bg-subtle); }
    .user-block { display: flex; align-items: center; gap: 12px; }
    .user-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--primary);
      display: flex; align-items: center; justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.85rem;
      font-family: var(--font-display);
      border: 2px solid var(--surface);
      box-shadow: var(--shadow-sm);
    }
    .user-label { font-weight: 500; font-size: 0.9rem; color: var(--text); }
    .logout-button {
      padding: 6px 14px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      text-decoration: none;
      transition: var(--transition);
    }
    .logout-button:hover { background: var(--danger-light); color: var(--danger); border-color: var(--danger-light); }

    .container { display: flex; flex: 1; }
    .content { flex: 1; padding: 28px 32px; max-width: 1400px; }
    .page-centered {
      display: flex; justify-content: center; align-items: center;
      min-height: calc(100vh - 60px);
      padding: 40px 20px;
    }

    .hero {
      background: linear-gradient(135deg, var(--primary) 0%, #312e81 100%);
      color: white;
      border-radius: var(--radius-lg);
      padding: 36px 40px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -50%; right: -20%;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(180,83,9,0.25) 0%, transparent 70%);
      border-radius: 50%;
    }
    .hero h2 {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 6px;
      position: relative; z-index: 1;
      letter-spacing: -0.02em;
    }
    .hero p { font-size: 0.95rem; opacity: 0.8; position: relative; z-index: 1; }

    .panel {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 28px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      margin-bottom: 20px;
    }
    .panel h3 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: var(--text); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 24px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--primary);
    }
    .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .stat-card.primary::before { background: var(--primary); }
    .stat-card.success::before { background: var(--success); }
    .stat-card.warning::before { background: var(--warning); }
    .stat-card.accent::before { background: var(--accent); }
    .stat-card.danger::before { background: var(--danger); }
    .stat-card h3 {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      font-family: var(--font-display);
    }
    .stat-card .value {
      font-family: var(--font-mono);
      font-size: 2rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .stat-card .trend { font-size: 0.8rem; color: var(--success); margin-top: 10px; display: flex; align-items: center; gap: 4px; }

    .grid { display: grid; gap: 16px; }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .grid-4 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .section-title h2 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }
    .section-note { color: var(--text-tertiary); font-size: 0.85rem; }

    .button {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 20px;
      background: var(--primary); color: white;
      border: none; border-radius: var(--radius);
      text-decoration: none; cursor: pointer;
      font-size: 0.9rem; font-weight: 500; font-family: var(--font-body);
      transition: var(--transition);
      box-shadow: var(--shadow-sm);
    }
    .button:hover { background: var(--primary-dark); box-shadow: var(--shadow-md); }
    .button:active { transform: translateY(1px); }
    .button-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: none; }
    .button-secondary:hover { background: var(--bg-subtle); border-color: var(--text-tertiary); }
    .button-success { background: var(--success); }
    .button-success:hover { background: #065f46; }
    .button-warning { background: var(--warning); }
    .button-warning:hover { background: #92400e; }
    .button-danger { background: var(--danger); }
    .button-danger:hover { background: #991b1b; }
    .button-sm { padding: 6px 14px; font-size: 0.8rem; }

    .link-button {
      background: none; border: none;
      color: var(--primary); text-decoration: none;
      cursor: pointer; font-size: 0.85rem; font-weight: 500;
      transition: var(--transition);
      padding: 6px 10px; border-radius: var(--radius);
    }
    .link-button:hover { background: var(--primary-light); text-decoration: none; }

    .form-label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.85rem; color: var(--text); }
    .form-control {
      width: 100%; padding: 10px 14px;
      border: 1px solid var(--border); border-radius: var(--radius);
      margin-bottom: 16px;
      font-size: 0.95rem; font-family: var(--font-body);
      transition: var(--transition);
      background: var(--surface); color: var(--text);
    }
    .form-control::placeholder { color: var(--text-tertiary); }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .form-control:hover:not(:focus) { border-color: var(--text-tertiary); }

    .quill { border-radius: var(--radius-lg); border: 1px solid var(--border); transition: var(--transition); margin-bottom: 16px; }
    .quill:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
    .ql-toolbar {
      border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg);
      background: var(--bg-subtle); border-bottom: 1px solid var(--border);
      border-left: none; border-right: none; border-top: none;
    }
    .ql-container {
      border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg);
      min-height: 280px; background: var(--surface); border: none;
      font-size: 0.95rem; color: var(--text); font-family: var(--font-body);
    }
    .ql-editor { min-height: 280px; line-height: 1.7; }
    .ql-editor.ql-blank::before { color: var(--text-tertiary); font-style: normal; }

    .form-check { display: flex; align-items: center; margin-bottom: 12px; font-size: 0.85rem; gap: 8px; color: var(--text-secondary); }
    .form-check input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }

    .alert {
      padding: 12px 16px; border-radius: var(--radius); margin-bottom: 16px;
      border: 1px solid; display: flex; align-items: flex-start;
      gap: 10px; font-size: 0.85rem; line-height: 1.5;
    }
    .alert-success { background: var(--success-light); border-color: #86efac; color: #065f46; }
    .alert-warning { background: var(--warning-light); border-color: #fcd34d; color: #92400e; }
    .alert-danger { background: var(--danger-light); border-color: #fca5a5; color: #991b1b; }
    .alert-info { background: var(--info-light); border-color: #7dd3fc; color: #0c4a6e; }

    .card {
      background: var(--surface); border-radius: var(--radius-lg); padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow-sm); transition: var(--transition);
    }
    .card:hover { box-shadow: var(--shadow-md); }
    .card h3 { font-family: var(--font-display); font-size: 1rem; font-weight: 600; margin-bottom: 12px; }
    .card p { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px; }
    .text-muted { color: var(--text-secondary); font-size: 0.85rem; }

    .sidebar {
      width: 220px; background: var(--surface); padding: 16px 12px;
      border-right: 1px solid var(--border);
      position: sticky; top: 60px; height: calc(100vh - 60px);
      display: flex; flex-direction: column;
    }
    .sidebar-section { flex: 1; }
    .sidebar-section h3 {
      font-size: 0.68rem; text-transform: uppercase; color: var(--text-tertiary);
      padding: 0 10px 8px; margin-bottom: 4px;
      letter-spacing: 0.1em; font-weight: 600; font-family: var(--font-display);
    }
    .sidebar-section a {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; text-decoration: none; color: var(--text-secondary);
      border-radius: var(--radius); margin-bottom: 2px;
      transition: var(--transition); font-weight: 500; font-size: 0.85rem;
    }
    .sidebar-section a .nav-icon { width: 18px; text-align: center; font-size: 0.85rem; opacity: 0.5; }
    .sidebar-section a:hover { background: var(--bg-subtle); color: var(--text); }
    .sidebar-section a:hover .nav-icon { opacity: 1; color: var(--primary); }
    .sidebar-section a.active { background: var(--primary-light); color: var(--primary-dark); }
    .sidebar-section a.active .nav-icon { opacity: 1; color: var(--primary); }
    .sidebar-footer { padding: 12px 10px 0; border-top: 1px solid var(--border); margin-top: auto; }
    .status-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: var(--text-tertiary); }
    .led {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 2px var(--success-light), 0 0 6px var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .login-container { max-width: 400px; width: 100%; }
    .login-card {
      background: var(--surface); border-radius: var(--radius-lg); padding: 40px 36px;
      border: 1px solid var(--border); box-shadow: var(--shadow-lg);
    }
    .login-logo {
      text-align: center; font-family: var(--font-display); font-size: 1.75rem;
      font-weight: 700; color: var(--primary); margin-bottom: 6px;
      letter-spacing: -0.02em; display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .login-subtitle { text-align: center; color: var(--text-secondary); margin-bottom: 28px; font-size: 0.9rem; }

    table {
      width: 100%; border-collapse: separate; border-spacing: 0;
      background: var(--surface); border-radius: var(--radius-lg); overflow: hidden;
      border: 1px solid var(--border); font-size: 0.88rem;
    }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-subtle); }
    th {
      background: var(--bg-subtle); font-weight: 600; font-size: 0.72rem;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary);
      font-family: var(--font-display);
    }
    td { color: var(--text); }
    tr:hover td { background: var(--bg-subtle); }
    tr:last-child td { border-bottom: none; }

    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 999px;
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; font-family: var(--font-mono);
    }
    .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; }
    .badge-success { background: var(--success-light); color: #065f46; }
    .badge-success::before { background: var(--success); }
    .badge-warning { background: var(--warning-light); color: #92400e; }
    .badge-warning::before { background: var(--warning); }
    .badge-danger { background: var(--danger-light); color: #991b1b; }
    .badge-danger::before { background: var(--danger); }
    .badge-info { background: var(--info-light); color: #0c4a6e; }
    .badge-info::before { background: var(--info); }
    .badge-primary { background: var(--primary-light); color: #1e3a8a; }
    .badge-primary::before { background: var(--primary); }

    @media (max-width: 768px) {
      header { padding: 0 16px; }
      .sidebar { display: none; }
      .content { padding: 16px; }
      .stats-grid { grid-template-columns: 1fr; gap: 12px; }
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
      .hero { padding: 24px 20px; }
      .hero h2 { font-size: 1.35rem; }
      table { display: block; overflow-x: auto; }
      .main-nav { display: none; }
      .user-label { display: none; }
      .login-card { padding: 28px 24px; margin: 12px; }
      .panel { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <a href="/" class="logo"><span class="logo-mark">▣</span>PC Rental</a>
      <nav class="main-nav">${topNav}</nav>
      <div class="user-block">${userBlockHtml}</div>
    </header>
    <div class="container">
      ${sidebar}
      <main class="content">${body}</main>
    </div>
  </div>
  <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
</body>
</html>`
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
      INSERT INTO error_logs (id, errorLevel, errorMessage, errorStack, contextData, userId, requestUrl, requestMethod, createdAt)
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
      DELETE FROM error_logs WHERE createdAt < ?
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
