import { Context } from 'hono'

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  password_hash?: string
  password?: string // 添加password属性以兼容旧代码
  role: Role
  phone?: string
  bsb?: string
  account?: string
  account_number?: string
  balance: number
  status?: 'active' | 'inactive'
  commissionRate?: number
  referrerId?: string
  referralCode?: string
  registrationDate?: string
  createdAt?: string
  commissionBalance: number
  pendingCommission?: number
  withdrawnCommission?: number
  referredUsers?: Array<Record<string, any>>
}

export interface Device {
  id: string
  name: string
  model: string
  serialNumber: string
  serial_number?: string
  pricePerDay: number
  dailyRate?: number
  depositAmount: number
  status: 'available' | 'rented' | 'maintenance' | 'retired'
  description: string
}

export interface Order {
  id: string
  orderNo: string
  userId: string
  customerId?: string // 添加customerId作为userId的别名，兼容现有代码，设置为可选
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
}

export interface ContractTemplate {
  id: string
  name: string
  content: string
  createdAt?: string
  updatedAt?: string
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

export async function getUserById(cOrContext: Context | string, id?: string): Promise<User | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(actualId).first() as User | null
}

export async function getOrderById(cOrContext: Context | string, id?: string): Promise<Order | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(actualId).first() as Order | null
}

export async function getDeviceById(cOrContext: Context | string, id?: string): Promise<Device | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  return db.prepare('SELECT * FROM devices WHERE id = ?').bind(actualId).first() as Device | null
}

export async function getContractById(cOrContext: Context | string, id?: string): Promise<Contract | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualId = typeof cOrContext === 'string' ? cOrContext : id
  if (!actualId) return null
  return db.prepare('SELECT * FROM contracts WHERE id = ?').bind(actualId).first() as Contract | null
}

export async function getContractByOrderId(cOrContext: Context | string, orderId?: string): Promise<Contract | null> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualOrderId = typeof cOrContext === 'string' ? cOrContext : orderId
  if (!actualOrderId) return null
  return db.prepare('SELECT * FROM contracts WHERE rentalId = ?').bind(actualOrderId).first() as Contract | null
}

export async function getAllContracts(c?: Context): Promise<Contract[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM contracts').all()
  return (result.results as Contract[]) || []
}

export async function getOrders(c?: Context): Promise<Order[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM orders').all()
  return (result.results as Order[]) || []
}

export async function getOrdersForUser(cOrContext: Context | string, userId?: string): Promise<Order[]> {
  const db = getDB(typeof cOrContext === 'string' ? undefined : cOrContext)
  const actualUserId = typeof cOrContext === 'string' ? cOrContext : userId
  if (!actualUserId) return []
  const result = await db.prepare('SELECT * FROM orders WHERE customer_id = ?').bind(actualUserId).all()
  return (result.results as Order[]) || []
}

export async function insertOrder(c: Context, order: Order): Promise<void> {
  const db = getDB(c)
  await db
    .prepare(
      'INSERT INTO orders (id, orderNo, userId, deviceId, startDate, endDate, status, paymentMethod, totalAmount, depositAmount, dailyRate, contractId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      order.id,
      order.orderNo,
      order.userId,
      order.deviceId,
      order.startDate,
      order.endDate,
      order.status,
      order.paymentMethod,
      order.totalAmount,
      order.depositAmount,
      order.dailyRate,
      order.contractId,
      order.createdAt
    )
    .run()
}


export async function insertContract(c: Context, contract: Contract): Promise<void> {
  const db = getDB(c);
  await db.prepare('INSERT INTO contracts (id, rentalId, contractNumber, content, signedAt, createdAt, signToken, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
    contract.id, contract.rentalId, contract.contractNumber, contract.content, contract.signedAt, contract.createdAt, contract.signToken, contract.status
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

export async function updateOrder(c: Context, order: Order): Promise<void> {
  const db = getDB(c)
  await db
    .prepare(
      'UPDATE orders SET orderNo = ?, userId = ?, deviceId = ?, startDate = ?, endDate = ?, status = ?, paymentMethod = ?, totalAmount = ?, depositAmount = ?, dailyRate = ?, contractId = ?, signedAt = ? WHERE id = ?'
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
      order.dailyRate,
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
}

// Compatibility alias expected by legacy code
export async function updateContractStatusInDB(c: Context, contractId: string, status: string, signedAt: string | null = null): Promise<void> {
  await updateContractStatus(c, contractId, status, signedAt)
}


export async function getContractBySignToken(c: Context, signToken: string): Promise<Contract | null> {
  const db = getDB(c)
  return db.prepare('SELECT * FROM contracts WHERE signToken = ?').bind(signToken).first() as Contract | null
}

export async function getDeviceBySerialNumber(c: Context, serialNumber: string): Promise<Device | null> {
  const db = getDB(c)
  return db.prepare('SELECT * FROM devices WHERE serialNumber = ?').bind(serialNumber).first() as Device | null
}

export async function getDevices(c?: Context): Promise<Device[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM devices').all()
  return (result.results as Device[]) || []
}

export async function getUsers(c?: Context): Promise<User[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM users').all()
  return (result.results as User[]) || []
}

export async function getOrdersAsync(c: Context): Promise<any[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM orders').all()
  return result.results || []
}

export const contracts: Contract[] = [
  {
    id: 'ct-1',
    rentalId: 'o-1',
    contractNumber: 'CT20260708001',
    content: '甲方（出租方）：PC Rental Pty Ltd\n乙方（承租方）：张三\n设备名称：MacBook Pro 14寸\n设备型号：M4 Pro 18GB 512GB\n设备序列号：SN20260708001\n租赁起始日：2026年07月10日\n租赁结束日：2026年08月10日\n日租金：AUD$40.00/天\n租金总额：AUD$1,200.00\n押金：AUD$2,000.00\n总计应付：AUD$3,200.00\n',
    signedAt: '2026-07-10 14:30:25',
    createdAt: '2026-07-10 14:20:00',
    signToken: 'ct-1-token',
    status: 'signed',
  },
]

export function getSystemSettings() {
  return systemSettings
}

export async function updateSystemSettings(c: Context, updates: Partial<typeof systemSettings>): Promise<typeof systemSettings> {
  Object.assign(systemSettings, updates)
  return systemSettings
}

export async function insertUser(c: Context, user: any): Promise<User> {
  const db = getDB(c)
  await db.prepare('INSERT INTO users (id, name, email, password_hash, role, status, balance, commissionBalance, referralCode, referrerId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, user.name, user.email, user.password_hash ?? null, user.role, user.status ?? 'active', user.balance ?? 0, user.commissionBalance ?? 0, user.referralCode ?? null, user.referrerId ?? null, user.createdAt ?? new Date().toISOString())
    .run()
  const inserted = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as User | null
  if (inserted && inserted.password_hash) delete (inserted as any).password_hash
  return inserted as User
}

export async function updateUser(c: Context, userId: string, data: Partial<User> & { password?: string }): Promise<User | null> {
  const db = getDB(c)
  const fields: Record<string, any> = { ...data }

  if (fields.password) {
    fields.password_hash = await hashPassword(fields.password)
    delete fields.password
  }

  const setEntries = Object.entries(fields).filter(([k]) => k !== 'id' && fields[k] !== undefined)
  if (setEntries.length === 0) {
    return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User | null
  }

  const setClause = setEntries.map(([k]) => `${k} = ?`).join(', ')
  const values = setEntries.map(([, v]) => v)

  await db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).bind(...values, userId).run()
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User | null
  if (updated && (updated as any).password_hash) delete (updated as any).password_hash
  return updated
}

export async function getDevicesAsync(c: Context): Promise<Device[]> {
  return getDevices(c)
}

export async function insertDevice(c: Context, device: Omit<Device, 'id'> & { id?: string }): Promise<Device> {
  const db = getDB(c)
  const { nanoid } = await import('nanoid')
  const deviceId = device.id || `d-${nanoid(8)}`
  await db.prepare(
    'INSERT INTO devices (id, name, model, serial_number, price_per_day, deposit_amount, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    deviceId,
    device.name,
    device.model,
    device.serialNumber || device.serial_number || '',
    device.pricePerDay || device.price_per_day || 0,
    device.depositAmount || device.deposit_amount || 0,
    device.status || 'available',
    device.description || ''
  ).run()
  const inserted = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first() as Device
  return inserted
}

export async function updateDevice(c: Context, deviceId: string, data: Partial<Device>): Promise<Device | null> {
  const db = getDB(c)
  const existing = await getDeviceById(c, deviceId)
  if (!existing) return null
  
  // 字段名映射 camelCase -> snake_case
  const fieldMap: Record<string, string> = {
    name: 'name',
    model: 'model',
    serialNumber: 'serial_number',
    serial_number: 'serial_number',
    pricePerDay: 'price_per_day',
    price_per_day: 'price_per_day',
    depositAmount: 'deposit_amount',
    deposit_amount: 'deposit_amount',
    status: 'status',
    description: 'description'
  }
  
  const setEntries: [string, any][] = []
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && fieldMap[key]) {
      setEntries.push([fieldMap[key], value])
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

export function getAllDevices(): Device[] {
  // DB-backed list is async; this is only used by templates. Keep empty for now.
  return []
}

export function devices(): Device[] {
  return []
}

export async function updateContractTemplateInDB(c: Context, newTemplate: { id: string; name: string; content: string }) {
  return updateContractTemplate(c, newTemplate)
}

export function joinReferralProgram() {
  return Promise.resolve(undefined)
}

export function leaveReferralProgram() {
  return Promise.resolve(undefined)
}

export function getPendingOrders() {
  return [] as Order[]
}

export function getAllRentals() {
  return [] as Order[]
}

export const rentalTerms = `## 电脑租赁协议条款

尊敬的 {customer_name}：

感谢您选择PC Rental电脑租赁服务，在签署合同前请仔细阅读以下租赁条款：

### 一、租赁基本信息
- 租赁设备：{device_name} ({device_model})
- 设备序列号：{device_sn}
- 租赁期限：从 {start_date} 至 {end_date}，共 {rental_days} 天
- 日租金：AUD${daily_rate}/天，租金总额：AUD${total_rent}
- 押金金额：AUD${deposit_amount}

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
  bankDetails: {
    bsb: '062-001',
    account: '87654321',
    accountName: '账户名',
  },
  squareConfig: {
    applicationId: 'sq0idp-YOUR_APPLICATION_ID',
    locationId: 'YOUR_LOCATION_ID',
  },
  rentalTerms,
  priceStrategy: '标准定价：按日租金计费，超过租期按日累加。',
  paymentMethods: {
    square: true,
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
│  租金总额：AUD${total_rent}        │
│  押金：AUD${deposit_amount}         │
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
<p>日租金：AUD${daily_rate}</p>
<p>租金总额：AUD${total_rent}</p>
<p>押金金额：AUD${deposit_amount}</p>
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
    return template;
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
<p>日租金：AUD${daily_rate}</p>
<p>租金总额：AUD${total_rent}</p>
<p>押金金额：AUD${deposit_amount}</p>
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
    .bind(newTemplate.id, newTemplate.name, newTemplate.content)
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
  if (count > 0) return
  const usersToSeed = [
    { id: 'u-admin', name: 'Admin User', email: 'admin@example.com', password: 'Admin123', role: 'ADMIN' },
    { id: 'u-staff', name: 'Staff User', email: 'staff@example.com', password: 'Staff123', role: 'STAFF' },
    { id: 'u-customer', name: 'Customer User', email: 'customer@example.com', password: 'Customer123', role: 'CUSTOMER' },
  ]

  const userInsert = db.prepare('INSERT INTO users (id, name, email, password_hash, role, status, balance, commission_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const userInserts = []
  for (const user of usersToSeed) {
    const hash = await hashPassword(user.password)
    userInserts.push(userInsert.bind(user.id, user.name, user.email, hash, user.role, 'active', 0, 0))
  }
  await db.batch(userInserts)

  // Seed示例设备
  const devicesToSeed = [
    { id: 'd-mbp14', name: 'MacBook Pro 14寸', model: 'M4 Pro 18GB 512GB', serial_number: 'SN-MBP14-001', price_per_day: 40.0, deposit_amount: 2000.0, status: 'available', description: 'Apple M4 Pro芯片，18GB内存，512GB固态硬盘，14英寸Liquid Retina XDR显示屏' },
    { id: 'd-xps13', name: 'Dell XPS 13', model: 'Intel i7-1360P 16GB', serial_number: 'SN-XPS13-001', price_per_day: 35.0, deposit_amount: 1500.0, status: 'available', description: '第13代Intel酷睿i7处理器，16GB LPDDR5内存，512GB NVMe SSD' },
    { id: 'd-thinkpad', name: 'Lenovo ThinkPad X1 Carbon', model: 'i7-1365U 16GB', serial_number: 'SN-TPX1-001', price_per_day: 38.0, deposit_amount: 1800.0, status: 'rented', description: '13代Intel vPro i7，16GB内存，1TB SSD，14英寸2.8K OLED屏' },
    { id: 'd-imac', name: 'iMac 24寸', model: 'M3 8GB 256GB', serial_number: 'SN-IMAC24-001', price_per_day: 45.0, deposit_amount: 2200.0, status: 'maintenance', description: 'Apple M3芯片，8GB统一内存，256GB SSD，24英寸4.5K Retina显示屏' },
  ]

  const deviceInsert = db.prepare('INSERT INTO devices (id, name, model, serial_number, price_per_day, deposit_amount, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const deviceInserts = devicesToSeed.map(d => 
    deviceInsert.bind(d.id, d.name, d.model, d.serial_number, d.price_per_day, d.deposit_amount, d.status, d.description)
  )
  await db.batch(deviceInserts)

  // Seed示例订单
  const now = new Date().toISOString()
  const ordersToSeed = [
    { 
      id: 'o-1', customer_id: 'u-customer', device_id: 'd-thinkpad', 
      start_date: '2026-07-10', end_date: '2026-08-10', rental_period: 31,
      total_amount: 1178.0, deposit_amount: 1800.0, status: 'active', payment_method: 'bank_transfer'
    },
    { 
      id: 'o-2', customer_id: 'u-customer', device_id: 'd-mbp14', 
      start_date: '2026-07-01', end_date: '2026-07-07', rental_period: 7,
      total_amount: 280.0, deposit_amount: 2000.0, status: 'completed', payment_method: 'card'
    },
    { 
      id: 'o-3', customer_id: 'u-customer', device_id: 'd-xps13', 
      start_date: '2026-07-20', end_date: '2026-07-27', rental_period: 7,
      total_amount: 245.0, deposit_amount: 1500.0, status: 'pending_payment', payment_method: null
    },
  ]

  const orderInsert = db.prepare('INSERT INTO orders (id, customer_id, device_id, start_date, end_date, rental_period, total_amount, deposit_amount, status, payment_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const orderInserts = ordersToSeed.map(o => 
    orderInsert.bind(o.id, o.customer_id, o.device_id, o.start_date, o.end_date, o.rental_period, o.total_amount, o.deposit_amount, o.status, o.payment_method, now, now)
  )
  await db.batch(orderInserts)
}

export async function loadDatabaseData(c: Context): Promise<void> {
  const db = getDB(c)
  await seedDatabaseIfEmpty(c)
}

export async function verifyUserCredentials(c: Context, emailOrName: string, password: string): Promise<User | null> {
  const db = getDB(c)
  const user: User | null =
    await db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').bind(emailOrName, emailOrName).first()

  if (!user || !user.password_hash) {
    return null
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash)
  if (!isPasswordValid) {
    return null
  }

  delete user.password_hash
  return user
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

  const [role, id] = token.split(':')
  if (!role || !id) return null

  const hasReferralCode = await userHasColumn(c, 'referralCode')
  const selectClause = hasReferralCode
    ? 'id, name, email, role, phone, bsb, account_number AS account, commission_balance AS commissionBalance, referralCode'
    : 'id, name, email, role, phone, bsb, account_number AS account, commission_balance AS commissionBalance'

  const user: User | null = await db
    .prepare(`SELECT ${selectClause} FROM users WHERE id = ? AND role = ?`)
    .bind(id, role.toUpperCase())
    .first()

  if (user && !hasReferralCode) {
    user.referralCode = ''
  }

  return user
}

export function buildLayout(title: string, body: string, currentUser?: User | null): string {
  const isAuthPage = title.includes('登录') || title.includes('注册') || title.includes('找回密码')
  const topNav =
    currentUser || isAuthPage
      ? ``
      : `
      <a href="/login">登录</a>
      <a href="/register">注册</a>
    `

  const userBlock = currentUser ? `
    <div class="user-avatar">${currentUser.name.charAt(0)}</div>
    <span class="user-label">${currentUser.name}</span>
    <a class="logout-button" href="/logout">退出登录</a>
  ` : ''

  const sidebar = currentUser
    ? `<aside class="sidebar">
        <div class="sidebar-section">
          <h3>快捷导航</h3>
          ${currentUser.role === 'CUSTOMER' ? `
            <a href="/customer/dashboard">顾客仪表盘</a>
            <a href="/customer/rentals">我的租赁</a>
            <a href="/customer/orders">我的订单</a>
            <a href="/customer/profile">个人信息</a>
            <a href="/customer/security">安全设置</a>
            <a href="/customer/referral">我的推荐</a>
          ` : ''}
          ${currentUser.role === 'STAFF' ? `
            <a href="/staff/dashboard">员工仪表盘</a>
            <a href="/staff/orders/pending">待处理订单</a>
            <a href="/staff/contracts">合同管理</a>
            <a href="/staff/contracts/new">新增合同</a>
            <a href="/staff/rentals/tracking">租赁进度</a>
            <a href="/staff/devices">设备状态</a>
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            <a href="/admin/dashboard">管理员仪表盘</a>
            <a href="/admin/users">用户管理</a>
            <a href="/admin/orders">订单管理</a>
            <a href="/admin/refunds">待退款处理</a>
            <a href="/admin/contracts">合同管理</a>
            <a href="/admin/finance">财务管理</a>
            <a href="/admin/devices">设备管理</a>
            <a href="/admin/settings">系统设置</a>
          ` : ''}
        </div>
      </aside>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!-- Quill Editor CSS -->
  <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
  <style>
    :root {
      --primary: #3b82f6;
      --primary-light: #dbeafe;
      --primary-dark: #1d4ed8;
      --primary-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      --success: #10b981;
      --success-light: #d1fae5;
      --warning: #f59e0b;
      --warning-light: #fef3c7;
      --danger: #ef4444;
      --danger-light: #fee2e2;
      --info: #06b6d4;
      --info-light: #cffafe;
      --background: #f1f5f9;
      --surface: #ffffff;
      --surface-secondary: #f8fafc;
      --text: #1e293b;
      --text-secondary: #64748b;
      --border: #e2e8f0;
      --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
      --radius: 12px;
      --radius-lg: 16px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    * { 
      box-sizing: border-box; 
      margin: 0;
      padding: 0;
    }
    body { 
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: var(--background); 
      color: var(--text); 
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .page { 
      max-width: 100%;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      box-shadow: var(--shadow-md);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.95);
    }
    .logo { 
      font-size: 1.5rem; 
      font-weight: 700; 
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-decoration: none; 
    }
    .main-nav a { 
      margin-left: 24px; 
      text-decoration: none; 
      color: var(--text-secondary);
      font-weight: 500;
      transition: var(--transition);
      position: relative;
    }
    .main-nav a:hover { 
      color: var(--primary);
    }
    .main-nav a::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--primary);
      transition: var(--transition);
    }
    .main-nav a:hover::after {
      width: 100%;
    }
    .user-block { 
      display: flex; 
      align-items: center; 
      gap: 16px; 
    }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      box-shadow: var(--shadow-md);
    }
    .user-label { 
      font-weight: 500;
      color: var(--text);
    }
    .container { 
      display: flex;
      min-height: calc(100vh - 73px);
    }
    .content { 
      flex: 1; 
      padding: 32px;
      background: var(--background);
    }
    .page-centered { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 80vh;
      padding: 20px;
    }
    .hero {
      background: var(--primary-gradient);
      color: #000000;
      border-radius: var(--radius-lg);
      padding: 48px;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      height: 300px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
      transform: translate(30%, -30%);
    }
    .hero h2 {
      font-size: 2rem;
      margin-bottom: 8px;
      position: relative;
      z-index: 1;
    }
    .hero p {
      font-size: 1.1rem;
      opacity: 0.9;
      position: relative;
      z-index: 1;
    }
    .panel { 
      background: var(--surface); 
      border-radius: var(--radius); 
      padding: 32px; 
      box-shadow: var(--shadow-lg);
      transition: var(--transition);
    }
    .panel:hover {
      box-shadow: var(--shadow-xl);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 28px;
      box-shadow: var(--shadow-md);
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--primary);
    }
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-xl);
    }
    .stat-card.primary::before { background: var(--primary); }
    .stat-card.success::before { background: var(--success); }
    .stat-card.warning::before { background: var(--warning); }
    .stat-card.danger::before { background: var(--danger); }
    .stat-card h3 {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-card .value {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1;
    }
    .stat-card .trend {
      font-size: 0.875rem;
      color: var(--success);
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .grid { 
      display: grid; 
      gap: 24px; 
    }
    .grid-2 { 
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
    }
    .grid-3 { 
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
    }
    .grid-4 { 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .section-title h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text);
    }
    .section-note {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    .button { 
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      transition: var(--transition);
      box-shadow: var(--shadow-md);
    }
    .button:hover { 
      background: var(--primary-dark);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }
    .button:active {
      transform: translateY(0);
    }
    .button-secondary { 
      background: var(--surface); 
      color: var(--primary); 
      border: 1px solid var(--primary);
      box-shadow: none;
    }
    .button-secondary:hover { 
      background: var(--primary-light);
      border-color: var(--primary-dark);
    }
    .button-success { background: var(--success); }
    .button-success:hover { background: #059669; }
    .button-warning { background: var(--warning); }
    .button-warning:hover { background: #d97706; }
    .button-danger { background: var(--danger); }
    .button-danger:hover { background: #dc2626; }
    .button-sm {
      padding: 8px 16px;
      font-size: 0.875rem;
    }
    .link-button { 
      background: none; 
      border: none; 
      color: var(--primary); 
      text-decoration: none; 
      cursor: pointer; 
      font-size: 0.9rem;
      font-weight: 500;
      transition: var(--transition);
      padding: 8px 16px;
      border-radius: 6px;
    }
    .link-button:hover { 
      background: var(--primary-light);
      text-decoration: none;
    }
    .form-label { 
      display: block; 
      margin-bottom: 8px; 
      font-weight: 500; 
      font-size: 0.9rem;
      color: var(--text);
    }
    .form-control { 
      width: 100%; 
      padding: 12px 16px; 
      border: 1px solid var(--border); 
      border-radius: 8px; 
      margin-bottom: 20px; 
      font-size: 1rem;
      transition: var(--transition);
      background: var(--surface);
    }
    .form-control:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }
    /* Quill Editor Styles */
    .quill {
      border-radius: var(--radius);
      box-shadow: var(--shadow-md);
      border: 1px solid var(--border);
      transition: var(--transition);
      margin-bottom: 20px;
    }
    .quill:hover {
      box-shadow: var(--shadow-lg);
    }
    .quill:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }
    .ql-toolbar {
      border-top-left-radius: var(--radius);
      border-top-right-radius: var(--radius);
      background: var(--surface-secondary);
      border-bottom: 1px solid var(--border);
      border-left: none;
      border-right: none;
      border-top: none;
    }
    .ql-container {
      border-bottom-left-radius: var(--radius);
      border-bottom-right-radius: var(--radius);
      min-height: 300px;
      background: var(--surface);
      border-left: none;
      border-right: none;
      border-bottom: none;
      font-size: 1rem;
      color: var(--text);
    }
    .ql-editor {
      min-height: 300px;
      font-family: inherit;
      line-height: 1.7;
    }
    .ql-editor.ql-blank::before {
      color: var(--text-secondary);
      font-style: normal;
    }
    .form-check { 
      display: flex;
      align-items: center;
      margin-bottom: 16px; 
      font-size: 0.9rem;
      gap: 8px;
    }
    .form-check input { 
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .alert { 
      padding: 16px 20px; 
      border-radius: 8px; 
      margin-bottom: 24px; 
      border: 1px solid;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .alert-success {
      background: var(--success-light);
      border-color: var(--success);
      color: #065f46;
    }
    .alert-warning {
      background: var(--warning-light);
      border-color: var(--warning);
      color: #92400e;
    }
    .alert-danger {
      background: var(--danger-light);
      border-color: var(--danger);
      color: #991b1b;
    }
    .alert-info {
      background: var(--info-light);
      border-color: var(--info);
      color: #155e75;
    }
    .card { 
      background: var(--surface); 
      border-radius: var(--radius); 
      padding: 24px; 
      box-shadow: var(--shadow-md);
      transition: var(--transition);
    }
    .card:hover {
      box-shadow: var(--shadow-lg);
    }
    .text-muted { 
      color: var(--text-secondary); 
      font-size: 0.9rem; 
    }
    .sidebar { 
      width: 260px; 
      background: var(--surface); 
      padding: 24px; 
      border-right: 1px solid var(--border);
      position: sticky;
      top: 73px;
      height: calc(100vh - 73px);
    }
    .sidebar-brand { 
      font-size: 1.3rem; 
      font-weight: 700; 
      margin-bottom: 32px;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .sidebar-section { 
      margin-bottom: 28px; 
    }
    .sidebar-section h3 { 
      font-size: 0.75rem; 
      text-transform: uppercase; 
      color: var(--text-secondary); 
      border-bottom: 1px solid var(--border); 
      padding-bottom: 10px; 
      margin-bottom: 16px;
      letter-spacing: 0.1em;
      font-weight: 600;
    }
    .sidebar-section a { 
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px; 
      text-decoration: none; 
      color: var(--text); 
      border-radius: 8px;
      margin-bottom: 4px;
      transition: var(--transition);
      font-weight: 500;
    }
    .sidebar-section a:hover { 
      background: var(--primary-light);
      color: var(--primary-dark);
      transform: translateX(4px);
    }
    .sidebar-section a.active {
      background: var(--primary);
      color: white;
    }
    .login-container {
      max-width: 420px;
      width: 100%;
    }
    .login-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 48px;
      box-shadow: var(--shadow-xl);
    }
    .login-logo {
      text-align: center;
      font-size: 2rem;
      font-weight: 700;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .login-subtitle {
      text-align: center;
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--surface);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }
    th, td {
      padding: 16px 20px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: var(--surface-secondary);
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }
    tr:hover td {
      background: var(--primary-light);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-success {
      background: var(--success-light);
      color: #065f46;
    }
    .badge-warning {
      background: var(--warning-light);
      color: #92400e;
    }
    .badge-danger {
      background: var(--danger-light);
      color: #991b1b;
    }
    .badge-info {
      background: var(--info-light);
      color: #155e75;
    }
    .badge-primary {
      background: var(--primary-light);
      color: #1e40af;
    }
    @media (max-width: 768px) {
      header {
        padding: 12px 16px;
      }
      .sidebar {
        display: none;
      }
      .content {
        padding: 16px;
      }
      .stats-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .grid-2, .grid-3, .grid-4 {
        grid-template-columns: 1fr;
      }
      .hero {
        padding: 32px 24px;
      }
      .hero h2 {
        font-size: 1.5rem;
      }
      table {
        display: block;
        overflow-x: auto;
      }
      .main-nav {
        display: none;
      }
      .login-card {
        padding: 32px 24px;
        margin: 16px;
      }
    }
    .logout-button {
      background: var(--danger-light);
      color: var(--danger);
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      transition: var(--transition);
    }
    .logout-button:hover {
      background: var(--danger);
      color: white;
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <a href="/" class="logo">PC Rental</a>
      <nav class="main-nav">
        ${topNav}
      </nav>
      <div class="user-block">${userBlock}</div>
    </header>
    <div class="container">
      ${sidebar}
      <main class="content">
        ${body}
      </main>
    </div>
  </div>
  <!-- Quill Editor JS -->
  <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
</body>
</html>`
}

// Legacy/local in-memory helpers have been removed to avoid shadowing DB-backed exports.

