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

async function hashPassword(password: string): Promise<string> {
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

export const devices: Device[] = [
  {
    id: 'd-1',
    name: 'MacBook Pro 14寸',
    model: 'M4 Pro 18GB 512GB',
    serialNumber: 'SN20260708001',
    serial_number: 'SN20260708001',
    pricePerDay: 40,
    dailyRate: 40,
    depositAmount: 2000,
    status: 'available',
    description: '适合专业创作者与商务办公的高性能笔记本',
  },
  {
    id: 'd-2',
    name: 'Dell XPS 13',
    model: 'Intel i7 16GB 512GB',
    serialNumber: 'SN20260601002',
    serial_number: 'SN20260601002',
    pricePerDay: 35,
    dailyRate: 35,
    depositAmount: 1500,
    status: 'rented',
    description: '轻薄便携，高效办公与移动演示首选',
  },
]

export const users: User[] = [
  {
    id: 'u-admin',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
    balance: 0,
    commissionBalance: 0,
    status: 'active',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 'u-staff',
    name: 'Staff User',
    email: 'staff@example.com',
    role: 'STAFF',
    balance: 0,
    commissionBalance: 0,
    status: 'active',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 'u-customer',
    name: 'Customer User',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    balance: 0,
    commissionBalance: 0,
    status: 'active',
    createdAt: '2026-07-01T00:00:00Z',
  },
]

export const contracts: Contract[] = [
  {
    id: 'ct-1',
    rentalId: 'o-1',
    contractNumber: 'CT20260708001',
    content: '甲方（出租方）：PC Rental Pty Ltd\n乙方（承租方）：张三\n设备名称：MacBook Pro 14寸\n设备型号：M4 Pro 18GB 512GB\n设备序列号：SN20260708001\n租赁起始日：2026年07月10日\n租赁结束日：2026年08月10日\n日租金：¥40.00/天\n租金总额：¥1,200.00\n押金：¥2,000.00\n总计应付：¥3,200.00\n',
    signedAt: '2026-07-10 14:30:25',
    createdAt: '2026-07-10 14:20:00',
    signToken: 'ct-1-token',
    status: 'signed',
  },
]

export const orders: Order[] = [
  {
    id: 'o-1',
    orderNo: 'OR20260708001',
    userId: 'u-customer',
    deviceId: 'd-1',
    deviceName: 'MacBook Pro 14寸',
    startDate: '2026-07-10',
    endDate: '2026-08-10',
    rentalPeriod: 31,
    orderDate: '2026-07-08 14:00:00',
    status: 'paid',
    paymentMethod: 'card',
    totalAmount: 3200,
    depositAmount: 2000,
    dailyRate: 40,
    contractId: 'ct-1',
    signedAt: '2026-07-10 14:30:25',
    createdAt: '2026-07-10 14:00:00',
  },
]

export const rentalTerms = '默认租赁条款：租客须遵守设备使用规范，并承担因使用不当造成的损坏责任。';
export const systemSettings = {
  bankDetails: {
    bsb: '062-001',
    account: '87654321',
    accountName: 'PC Rental Pty Ltd',
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
  emailTemplate: '尊敬的用户，您的订单已创建。感谢选择我们的设备租赁服务！',
  referralSettings: {
    defaultRate: 10,
    levelLimit: 3,
    settlementPeriod: 30,
  },
}

export const contractTemplate = {
  id: 'tmpl-1',
  name: '标准租赁合同模板',
  content: '这是默认合同模板内容，包含租赁条款、押金及租期信息。',
}

export async function getContractTemplate(c: Context): Promise<ContractTemplate> {
  const db = getDB(c);
  const template = await db.prepare('SELECT * FROM contract_templates WHERE id = ?').bind('default').first<ContractTemplate>();
  if (template) {
    return template;
  }
  // Fallback to a default in-memory template if not found in DB
  return {
    id: 'default',
    name: '标准租赁合同模板',
    content: '<h1>电脑租赁协议</h1><p>本协议由以下双方于 {{date}} 签订：</p><p><strong>出租方：</strong> 电脑租赁公司</p><p><strong>承租方：：</strong> {{customerName}}</p><h2>租赁设备</h2><p><strong>设备名称：</strong> {{deviceName}}</p><p><strong>型号：</strong> {{deviceModel}}</p><p><strong>序列号：</strong> {{deviceSerialNumber}}</p><h2>租赁期限</h2><p><strong>起始日期：</strong> {{startDate}}</p><p><strong>结束日期：：</strong> {{endDate}}</p><h2>租金与押金</h2><p><strong>日租金：</strong> {{dailyRate}} 元</p><p><strong>总租金：</strong> {{totalRent}} 元</p><p><strong>押金：</strong> {{depositAmount}} 元</p><p><strong>总计：</strong> {{totalAmount}} 元</p>',
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

export function getDB(c: Context): any {
  if (!dbInstance) {
    dbInstance = c.env.RENT
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

  const userInsert = db.prepare('INSERT INTO users (id, name, email, password_hash, role, status, balance, commissionBalance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const userInserts = []
  for (const user of usersToSeed) {
    const hash = await hashPassword(user.password)
    userInserts.push(userInsert.bind(user.id, user.name, user.email, hash, user.role, 'active', 0, 0))
  }
  await db.batch(userInserts)
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
</body>
</html>`
}

export function getDeviceById(id: string): Device | undefined {
  return devices.find((d) => d.id === id)
}

export function getOrderById(id: string): Order | undefined {
  return orders.find((o) => o.id === id)
}

export function getContractById(id: string): Contract | undefined {
  return contracts.find((c) => c.id === id)
}

export function getContractBySignToken(token: string): Contract | undefined {
  return contracts.find((c) => c.signToken === token)
}

export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id)
}

export function getSystemSettings() {
  return systemSettings
}

export async function updateUser(c: Context, userId: string, data: Partial<User> & { password?: string }): Promise<User | null> {
  const db = getDB(c)
  const fields: { [key: string]: any } = { ...data }

  if (fields.password) {
    fields.password_hash = await hashPassword(fields.password)
    delete fields.password
  }

  const hasReferralCode = await userHasColumn(c, 'referralCode')
  if (!hasReferralCode) {
    delete fields.referralCode
  }

  const fieldEntries = Object.entries(fields).filter(([key]) => key !== 'id')
  if (fieldEntries.length === 0) {
    return findUserBySession(c, null)
  }

  const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ')
  const values = fieldEntries.map(([, value]) => value)
  values.push(userId)

  await db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).bind(...values).run()

  const updatedUser: User | null = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  if (updatedUser) {
    delete updatedUser.password_hash
  }
  return updatedUser
}

export async function insertUser(c: Context, user: User): Promise<User> {
  const db = getDB(c)
  const fields: { [key: string]: any } = { ...user }

  if (fields.password) {
    fields.password_hash = await hashPassword(fields.password)
    delete fields.password
  }

  const hasReferralCode = await userHasColumn(c, 'referralCode')
  if (!hasReferralCode) {
    delete fields.referralCode
  }

  const fieldEntries = Object.entries(fields)
  const keys = fieldEntries.map(([key]) => key).join(', ')
  const placeholders = fieldEntries.map(() => '?').join(', ')
  const values = fieldEntries.map(([, value]) => value)

  await db.prepare(`INSERT INTO users (${keys}) VALUES (${placeholders})`).bind(...values).run()

  const insertedUser: User | null = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
  if (insertedUser) {
    delete insertedUser.password_hash
  }
  return insertedUser as User
}

// 同步版本保持向后兼容，返回空数组
export function getUsers(): User[] {
  return users
}

// 异步版本从数据库获取用户列表
export async function getUsersAsync(c: Context): Promise<User[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM users').all()
  return (result.results as User[] || []).map((user) => {
    if (user.password_hash) {
      delete user.password_hash
    }
    return user
  })
}

// 异步版本从数据库获取订单列表
export async function getOrdersAsync(c: Context): Promise<any[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM rentals').all()
  return result.results || []
}

// 异步版本从数据库获取设备列表
export async function getDevicesAsync(c: Context): Promise<any[]> {
  const db = getDB(c)
  const result = await db.prepare('SELECT * FROM devices').all()
  return result.results || []
}

export function getContractByOrderId(orderId: string): Contract | undefined {
  return contracts.find((c) => c.rentalId === orderId)
}

export function getDevices(): Device[] {
  return devices
}

export function getAllDevices(): Device[] {
  return devices
}

export function getOrders(user?: User): Order[] {
  if (user && user.role === 'STAFF') {
    return orders.filter(order => order.created_by === user.id);
  }
  return orders;
}

export function getOrdersForUser(userId: string): Order[] {
  return orders.filter((o) => o.userId === userId || o.customerId === userId)
}

export function getPendingOrders(): Order[] {
  return orders.filter((o) => o.status === 'pending_payment' || o.status === 'pending_approval')
}

export function getAllRentals(): Order[] {
  return orders
}

export function getRentalsByUserId(userId: string): Order[] {
  return orders.filter((o) => o.userId === userId || o.customerId === userId)
}

export function getAllContracts(): Contract[] {
  return contracts
}

export async function insertOrder(c: Context, order: Order): Promise<Order> {
  orders.push(order)
  return order
}

export async function insertContract(c: Context, contract: Contract): Promise<Contract> {
  contracts.push(contract)
  return contract
}

export async function updateDeviceStatus(c: Context, deviceId: string, status: Device['status']): Promise<Device | undefined> {
  const device = devices.find((d) => d.id === deviceId)
  if (device) {
    device.status = status
  }
  return device
}

export async function updateOrderStatus(c: Context, orderId: string, status: Order['status']): Promise<Order | undefined> {
  const order = orders.find((o) => o.id === orderId)
  if (order) {
    order.status = status
  }
  return order
}

export async function updateOrder(c: Context, orderId: string, data: Partial<Order>): Promise<Order | undefined> {
  const order = orders.find((o) => o.id === orderId)
  if (!order) return undefined
  Object.assign(order, data)
  return order
}

export async function updateOrderInDB(c: Context, orderId: string, data: Partial<Order>): Promise<Order | undefined> {
  return updateOrder(c, orderId, data)
}

export async function updateContractStatus(c: Context, contractId: string, status: Contract['status']): Promise<Contract | undefined> {
  const contract = contracts.find((c) => c.id === contractId)
  if (contract) {
    contract.status = status
  }
  return contract
}

export async function updateContractStatusInDB(c: Context, contractId: string, status: Contract['status']): Promise<Contract | undefined> {
  return updateContractStatus(c, contractId, status)
}

export async function updateContractTemplateInDB(c: Context, newTemplate: { id: string; name: string; content: string }): Promise<ContractTemplate> {
  return updateContractTemplate(newTemplate)
}

export async function createContract(c: Context, contract: Contract): Promise<Contract> {
  return insertContract(c, contract)
}

export async function updateSystemSettings(c: Context, updates: Partial<typeof systemSettings>): Promise<typeof systemSettings> {
  Object.assign(systemSettings, updates)
  return systemSettings
}

export async function updatePassword(c: Context, userId: string, newPassword: string): Promise<User | undefined> {
  const user = users.find((u) => u.id === userId)
  if (!user) return undefined
  user.password = newPassword
  return user
}

export async function bindReferrer(c: Context, userId: string, referrerId: string): Promise<User | undefined> {
  const user = await c.env.RENT.prepare('SELECT referrerId FROM users WHERE id = ?').bind(userId).first() as any;
  
  // 如果用户已经绑定了推荐人，不允许再次更改
  if (user?.referrerId) {
    return undefined; // 已经绑定过推荐人，不能再绑定
  }
  
  // 检查推荐人是否存在
  const referrerExists = await c.env.RENT.prepare('SELECT 1 FROM users WHERE id = ?').bind(referrerId).first();
  if (!referrerExists) {
    return undefined;
  }
  
  await c.env.RENT.prepare('UPDATE users SET referrerId = ? WHERE id = ?').bind(referrerId, userId).run();
  return await c.env.RENT.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
}

// 生成6位数字和大写字母组合的唯一推荐码
function generateReferralCode(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 加入推荐计划，生成唯一推荐码
export async function joinReferralProgram(c: Context, userId: string): Promise<User | undefined> {
  const db = getDB(c);
  const user = await db.prepare('SELECT referralCode FROM users WHERE id = ?').bind(userId).first() as any;
  
  // 如果用户已经有推荐码了，直接返回
  if (user?.referralCode) {
    return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
  }
  
  // 生成唯一的推荐码，确保不重复
  let referralCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    referralCode = generateReferralCode();
    const existing = await db.prepare('SELECT 1 FROM users WHERE referralCode = ?').bind(referralCode).first();
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    return undefined; // 生成推荐码失败
  }
  
  await db.prepare('UPDATE users SET referralCode = ? WHERE id = ?').bind(referralCode, userId).run();
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
}

// 退出推荐计划，清除推荐码
export async function leaveReferralProgram(c: Context, userId: string): Promise<User | undefined> {
  const db = getDB(c);
  await db.prepare('UPDATE users SET referralCode = NULL WHERE id = ?').bind(userId).run();
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
}

export async function unbindReferrer(c: Context, userId: string): Promise<User | undefined> {
  // 不允许解绑推荐人，一旦绑定永久生效
  return undefined;
}