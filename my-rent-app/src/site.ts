export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: Role
  phone?: string
  bsb?: string
  account?: string
  balance: number
  referrerId?: string
  referralCode?: string
  commissionBalance: number
}

export interface Device {
  id: string
  name: string
  model: string
  serialNumber: string
  pricePerDay: number
  depositAmount: number
  status: 'available' | 'rented' | 'maintenance'
  description: string
}

export interface Order {
  id: string
  orderNo: string
  userId: string
  deviceId: string
  startDate: string
  endDate: string
  status: 'pending_payment' | 'paid' | 'active' | 'completed' | 'cancelled'
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
  status: 'draft' | 'pending_sign' | 'signed' | 'cancelled'
}

export const users: User[] = [
  {
    id: 'u-admin',
    name: '管理员',
    email: 'admin@example.com',
    password: 'Admin123',
    role: 'ADMIN',
    balance: 0,
    commissionBalance: 0,
  },
  {
    id: 'u-staff',
    name: '王经理',
    email: 'staff@example.com',
    password: 'Staff123',
    role: 'STAFF',
    phone: '13888888888',
    balance: 0,
    commissionBalance: 0,
  },
  {
    id: 'u-customer',
    name: '张三',
    email: 'customer@example.com',
    password: 'Customer123',
    role: 'CUSTOMER',
    phone: '13800000000',
    bsb: '062-000',
    account: '12345678',
    balance: 500,
    referralCode: 'ABC123XYZ',
    commissionBalance: 200,
  },
]

export const devices: Device[] = [
  {
    id: 'd-1',
    name: 'MacBook Pro 14寸',
    model: 'M4 Pro 18GB 512GB',
    serialNumber: 'SN20260708001',
    pricePerDay: 40,
    depositAmount: 2000,
    status: 'available',
    description: '适合专业创作者与商务办公的高性能笔记本',
  },
  {
    id: 'd-2',
    name: 'Dell XPS 13',
    model: 'Intel i7 16GB 512GB',
    serialNumber: 'SN20260601002',
    pricePerDay: 35,
    depositAmount: 1500,
    status: 'rented',
    description: '轻薄便携，高效办公与移动演示首选',
  },
]

export const contracts: Contract[] = [
  {
    id: 'ct-1',
    rentalId: 'o-1',
    contractNumber: 'CT20260708001',
    content: '甲方（出租方）：PC Rental Pty Ltd\n乙方（承租方）：张三\n设备名称：MacBook Pro 14寸\n设备型号：M4 Pro 18GB 512GB\n设备序列号：SN20260708001\n租赁起始日：2026年07月10日\n租赁结束日：2026年08月10日\n日租金：¥40.00/天\n租金总额：¥1,200.00\n押金：¥2,000.00\n总计应付：¥3,200.00\n',
    signedAt: '2026-07-10 14:30:25',
    status: 'signed',
  },
]

export const orders: Order[] = [
  {
    id: 'o-1',
    orderNo: 'OR20260708001',
    userId: 'u-customer',
    deviceId: 'd-1',
    startDate: '2026-07-10',
    endDate: '2026-08-10',
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

export function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`
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

/**
 * 构建并返回一个完整的 HTML 页面字符串。
 * 此函数将页面的核心内容（body）和标题（title）包装在一个通用的网站布局中，
 * 该布局包含统一的页眉、页脚、导航和内联 CSS 样式。
 * 导航栏和用户信息会根据传入的 `currentUser` 对象动态生成。
 *
 * @param title - 要在 <title> 标签中显示的页面标题。
 * @param body - 页面的主要 HTML 内容，将被插入到 <main> 标签中。
 * @param currentUser - 可选的当前用户信息对象。用于显示个性化的导航链接和用户信息。
 * @returns 一个包含完整 HTML 结构的字符串。
 */
export function buildLayout(title: string, body: string, currentUser?: User | null): string {
  const navItems = currentUser
    ? currentUser.role === 'CUSTOMER'
      ? `
          <a href="/customer/dashboard">仪表盘</a>
          <a href="/customer/rentals">我的租赁</a>
          <a href="/customer/orders">我的订单</a>
          <a href="/customer/profile">个人信息</a>
          <a href="/customer/referral">我的推荐</a>
        `
      : currentUser.role === 'STAFF'
      ? `
          <a href="/staff/dashboard">员工仪表盘</a>
          <a href="/staff/orders/pending">待处理订单</a>
        `
      : `
          <a href="/admin/dashboard">管理员仪表盘</a>
          <a href="/staff/dashboard">员工页面</a>
        `
    : `
          <a href="/login">登录</a>
          <a href="/register">注册</a>
        `

  const userBlock = currentUser
    ? `<span class="user-label">${currentUser.name} (${currentUser.role})</span><a href="/logout">登出</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7fb; color: #1a1a1a; }
    .page { max-width: 1100px; margin: 0 auto; padding: 24px; }
    header { background: #0c4a6e; color: #fff; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    header h1 { margin: 0; font-size: 1.3rem; }
    header nav { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    header nav a { color: #fff; text-decoration: none; padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.12); }
    header .user-label { font-weight: 600; margin-right: 12px; }
    .panel { background: #fff; border-radius: 18px; box-shadow: 0 20px 40px rgba(15,23,42,0.08); padding: 28px; margin-bottom: 20px; }
    .hero { display: grid; gap: 16px; }
    .form-label { display: block; margin-bottom: 6px; font-weight: 600; }
    .form-control, .select-control, .textarea-control { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 1rem; }
    .textarea-control { min-height: 100px; resize: vertical; }
    .button, .button-secondary { background: #0c4a6e; color: #fff; border: none; border-radius: 12px; padding: 12px 18px; cursor: pointer; font-size: 1rem; }
    .button-secondary { background: #475569; }
    .grid { display: grid; gap: 16px; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #ffffff; }
    .badge { display: inline-flex; align-items: center; justify-content: center; padding: 4px 10px; border-radius: 999px; font-size: 0.9rem; background: #e0f2fe; color: #0369a1; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 12px 14px; text-align: left; }
    .table th { background: #f8fafc; }
    .text-muted { color: #64748b; }
    .alert { padding: 16px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 18px; }
    .footer { text-align: center; color: #64748b; padding-top: 14px; }
    .link-button { color: #0c4a6e; text-decoration: none; font-weight: 600; }
    @media (max-width: 900px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
    @media (max-width: 640px) { header { flex-direction: column; align-items: stretch; } }
  </style>
</head>
<body>
  <header>
    <h1>电脑租赁管理系统</h1>
    <nav>${navItems}</nav>
    <div>${userBlock}</div>
  </header>
  <main class="page">${body}</main>
  <footer class="footer">© 2026 PC Rental Pty Ltd. 电脑租赁系统演示版。</footer>
</body>
</html>`
}

export function renderMessageBox(message: string, type: 'info' | 'success' | 'error' = 'info'): string {
  const color = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#e0f2fe'
  const borderColor = type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#bae6fd'
  return `<div class="alert" style="background:${color};border-color:${borderColor};">${message}</div>`
}

export function findUserBySession(cookieHeader: string | null): User | null {
  const cookies = parseCookie(cookieHeader)
  const token = cookies.session || ''
  if (!token) return null
  const [role, id] = token.split(':')
  if (!role || !id) return null
  return users.find((user) => user.id === id && user.role === role as Role) ?? null
}

export function getDeviceById(deviceId?: string): Device | undefined {
  return devices.find((device) => device.id === deviceId)
}

export function getOrderById(orderId?: string): Order | undefined {
  return orders.find((order) => order.id === orderId)
}

export function getContractById(contractId?: string): Contract | undefined {
  return contracts.find((contract) => contract.id === contractId)
}

export function getOrdersForUser(userId: string): Order[] {
  return orders.filter((order) => order.userId === userId)
}

export function getPendingOrders(): Order[] {
  return orders.filter((order) => order.status === 'pending_payment')
}

export function getOrderSummary(order: Order): string {
  const device = getDeviceById(order.deviceId)
  return `${order.orderNo} · ${device?.name ?? '设备'} · ${order.startDate} ~ ${order.endDate}`
}