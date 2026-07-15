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

export async function findUserByEmail(c: Context, email: string): Promise<User | null> {
  const db = getDB(c)
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first() as User | null
}

export async function findUserByReferralCode(c: Context, referralCode: string): Promise<User | null> {
  const db = getDB(c)
  const normalizedCode = referralCode.trim().toUpperCase()
  return db.prepare('SELECT id FROM users WHERE UPPER(referralCode) = ?').bind(normalizedCode).first() as User | null
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

export async function getUsersByIds(c: Context, ids: string[]): Promise<User[]> {
  if (!ids.length) return []
  const db = getDB(c)
  const placeholders = ids.map(() => '?').join(', ')
  const result = await db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).bind(...ids).all()
  return (result.results as User[]) || []
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

export async function createWithdrawalRequest(c: Context, userId: string, amount: number, bsb: string, accountNumber: string): Promise<{ success: boolean; message: string }> {
  const db = getDB(c)
  const { nanoid } = await import('nanoid')

  try {
    // 使用事务确保数据一致性
    await db.batch([
      db.prepare('BEGIN'),
      db.prepare('SELECT * FROM users WHERE id = ? FOR UPDATE').bind(userId),
    ]);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as User;

    if (!user || user.commissionBalance < amount) {
      await db.prepare('ROLLBACK').run();
      return { success: false, message: '提现金额不能超过可提现余额' };
    }

    const withdrawalId = `w-${nanoid(8)}`;

    await db.batch([
      db.prepare(`
        INSERT INTO commission_withdrawals (id, user_id, amount, bsb, account_number, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).bind(withdrawalId, userId, amount, bsb, accountNumber),
      db.prepare(`
        UPDATE users SET commission_balance = commission_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(amount, userId),
      db.prepare(`
        UPDATE commission_records SET status = 'withdrawn', settled_at = CURRENT_TIMESTAMP
        WHERE referrer_id = ? AND status = 'pending'
        ORDER BY created_at ASC
      `).bind(userId),
      db.prepare('COMMIT'),
    ]);

    return { success: true, message: '提现申请已提交' };
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    console.error('Withdrawal failed:', error);
    return { success: false, message: '提现失败，请稍后重试' };
  }
}

export function getPendingOrders() {
  return [] as Order[]
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

export function getAllRentals() {
  return [] as Order[]
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
    ORDER BY d.updatedAt DESC
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

  const navIcons: Record<string, string> = {
    '/customer/dashboard': '◉', '/customer/rentals': '▤', '/customer/orders': '▦',
    '/customer/profile': '◎', '/customer/security': '⚿', '/customer/referral': '✦',
    '/staff/dashboard': '◉', '/staff/orders/pending': '◷', '/staff/contracts': '▤',
    '/staff/contracts/new': '+', '/staff/rentals/tracking': '◈', '/staff/devices': '▣',
    '/admin/dashboard': '◉', '/admin/users': '◎', '/admin/orders': '▦',
    '/admin/refunds': '↺', '/admin/contracts': '▤', '/admin/finance': '$',
    '/admin/devices': '▣', '/admin/settings': '⚙'
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
            ${renderNavLink('/customer/orders', '订单记录')}
            ${renderNavLink('/customer/profile', '账户资料')}
            ${renderNavLink('/customer/security', '安全设置')}
            ${renderNavLink('/customer/referral', '推荐计划')}
          ` : ''}
          ${currentUser.role === 'STAFF' ? `
            ${renderNavLink('/staff/dashboard', '工作台')}
            ${renderNavLink('/staff/orders/pending', '待审订单')}
            ${renderNavLink('/staff/contracts', '合同管理')}
            ${renderNavLink('/staff/contracts/new', '新建合同')}
            ${renderNavLink('/staff/rentals/tracking', '租赁追踪')}
            ${renderNavLink('/staff/devices', '设备状态')}
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            ${renderNavLink('/admin/dashboard', '管理后台')}
            ${renderNavLink('/admin/users', '用户管理')}
            ${renderNavLink('/admin/orders', '订单管理')}
            ${renderNavLink('/admin/refunds', '退款处理')}
            ${renderNavLink('/admin/contracts', '合同管理')}
            ${renderNavLink('/admin/finance', '财务中心')}
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
  <title>${title}</title>
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
      <div class="user-block">${userBlock}</div>
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

// Legacy/local in-memory helpers have been removed to avoid shadowing DB-backed exports.