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
  account_number?: string
  balance: number
  status?: 'active' | 'inactive'
  commissionRate?: number
  referrerId?: string
  referralCode?: string
  registrationDate?: string
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

export const users: User[] = [
  {
    id: 'u-admin',
    name: '管理员',
    email: 'admin@example.com',
    password: 'Admin123',
    role: 'ADMIN',
    balance: 0,
    commissionBalance: 0,
    registrationDate: '2026-07-01',
    account_number: '00000000',
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
    registrationDate: '2026-07-05',
    account_number: '11111111',
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
    account_number: '12345678',
    balance: 500,
    referralCode: 'ABC123XYZ',
    commissionBalance: 200,
    pendingCommission: 50,
    withdrawnCommission: 150,
    referredUsers: [
      { name: '李四', registeredAt: '2026-06-20', orderCount: 2, contributedCommission: 80 },
      { name: '王五', registeredAt: '2026-06-22', orderCount: 1, contributedCommission: 20 },
    ],
    registrationDate: '2026-06-15',
  },
]

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

export const systemSettings = {
  bankDetails: {
    bsb: '062-001',
    account: '87654321',
    accountName: 'PC Rental Pty Ltd'
  },
  squareConfig: {
    applicationId: 'sq0idp-YOUR_APPLICATION_ID',
    locationId: 'YOUR_LOCATION_ID',
  },
  rentalTerms: '默认租赁条款：租客须遵守设备使用规范，并承担因使用不当造成的损坏责任。',
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
};

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
  const isAuthPage = title.includes('登录') || title.includes('注册') || title.includes('找回密码');
  const topNav = currentUser || isAuthPage
    ? ``
    : `
      <a href="/login">登录</a>
      <a href="/register">注册</a>
    `

  const userBlock = currentUser
    ? `<span class="user-label">${currentUser.name} • ${currentUser.role}</span><a class="button button-small" href="/logout">登出</a>`
    : ''

  const sidebar = currentUser
    ? `<aside class="sidebar">
        <div class="sidebar-brand"><strong>角色：</strong>${currentUser.role}</div>
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
      --primary: #0c4a6e;
      --primary-light: #e0f2fe;
      --primary-dark: #083344;
      --background: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      background: var(--background); 
      color: var(--text); 
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .page { max-width: 1200px; margin: 24px auto; padding: 0; }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 72px;
    }
    header .brand { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    header nav { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    header nav a { 
      color: var(--muted); 
      text-decoration: none; 
      padding: 8px 16px; 
      border-radius: 8px; 
      transition: all 0.2s ease-in-out;
    }
    header nav a:hover {
      background: var(--primary-light);
      color: var(--primary-dark);
    }
    header .user-label { font-weight: 600; margin-right: 12px; color: var(--text); }
    .panel { 
      background: var(--surface); 
      border: 1px solid var(--border);
      border-radius: 16px; 
      box-shadow: var(--shadow); 
      padding: 28px; 
      margin-bottom: 24px; 
    }
    .hero { display: grid; gap: 16px; }
    .form-label { display: block; margin-bottom: 8px; font-weight: 600; }
    .form-control, .select-control, .textarea-control { 
      width: 100%; 
      padding: 12px 16px; 
      border: 1px solid var(--border); 
      border-radius: 8px; 
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-control:focus, .select-control:focus, .textarea-control:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }
    .textarea-control { min-height: 120px; resize: vertical; }
    .button, .button-secondary { 
      background: var(--primary); 
      color: #fff; 
      border: none; 
      border-radius: 8px; 
      padding: 12px 20px; 
      cursor: pointer; 
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease-in-out;
    }
    .button-secondary { background: var(--border); color: var(--text); }
    .button:hover { background: var(--primary-dark); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
    .button-secondary:hover { background: #d1d5db; transform: translateY(-2px); box-shadow: var(--shadow-lg); }
    .grid { display: grid; gap: 24px; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .card { 
      border: 1px solid var(--border); 
      border-radius: 16px; 
      padding: 24px; 
      background: var(--surface);
      transition: all 0.2s ease-in-out;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .badge { display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; background: var(--primary-light); color: var(--primary-dark); }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border-bottom: 1px solid var(--border); padding: 16px; text-align: left; }
    .table th { background: var(--background); font-weight: 600; }
    .text-muted { color: var(--muted); }
    .alert { padding: 16px; border-radius: 8px; background: #f8fafc; border: 1px solid var(--border); margin-bottom: 20px; }
    .footer { text-align: center; color: var(--muted); padding: 32px 0; border-top: 1px solid var(--border); margin-top: 32px; }
    .link-button { color: var(--primary); text-decoration: none; font-weight: 600; }

    .page-centered {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 72px - 105px); /* Full height minus header and footer */
    }
    .layout-grid { display: grid; grid-template-columns: 240px 1fr; gap: 24px; }
    .sidebar { background: var(--surface); border-radius: 16px; padding: 24px; box-shadow: var(--shadow); }
    .sidebar h3 { margin-top: 0; color: var(--primary); }
    .sidebar a { display: block; padding: 12px 16px; text-decoration: none; color: var(--text); border-radius: 8px; margin-bottom: 4px; }
    .sidebar a:hover { background: var(--primary-light); color: var(--primary-dark); }
    .content { background: var(--surface); border-radius: 16px; padding: 28px; box-shadow: var(--shadow); }

    /* Responsive Design */
    @media (max-width: 900px) { 
      .grid-2, .grid-3 { grid-template-columns: 1fr; } 
      .layout-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) { 
      header { flex-direction: column; align-items: flex-start; }
      .page { padding: 16px; }
      .panel { padding: 20px; }
    }
     @media (max-width: 640px) {
      header nav {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }
      header nav a {
        text-align: center;
      }
    }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="brand"><strong>电脑租赁管理系统</strong></div>
      <nav class="top-nav">${topNav}</nav>
      <div>${userBlock}</div>
    </div>
  </header>
  <main class="page">
    ${currentUser
      ? `<div class="layout-grid">
          ${sidebar}
          <div class="content">${body}</div>
        </div>`
      : body
    }
  </main>
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

export function getUserById(userId?: string): User | undefined {
  return users.find((user) => user.id === userId)
}

export function getUsers(): User[] {
  return users
}

export function getOrders(): Order[] {
  return orders
}

export function getDevices(): Device[] {
  return devices
}

export function getAllDevices(): Device[] {
  return devices
}

export function getAllContracts(): Contract[] {
  return contracts
}

export function getContractByOrderId(orderId?: string): Contract | undefined {
  return contracts.find((contract) => contract.rentalId === orderId)
}

export function getContractBySignToken(token?: string): Contract | undefined {
  return contracts.find((contract) => contract.signToken === token)
}

export function getSystemSettings() {
  return systemSettings
}

export function updateSystemSettings(newSettings: Partial<typeof systemSettings>) {
  Object.assign(systemSettings, newSettings)
}

export function updateUser(userId: string, updates: Partial<User>): User | undefined {
  const user = getUserById(userId)
  if (user) {
    Object.assign(user, updates)
  }
  return user
}

export function updatePassword(userId: string, newPassword: string): boolean {
  const user = getUserById(userId)
  if (!user) return false
  user.password = newPassword
  return true
}

export function bindReferrer(userId: string, referrerId: string): boolean {
  const user = getUserById(userId)
  if (!user) return false
  user.referrerId = referrerId
  return true
}

export function unbindReferrer(userId: string): boolean {
  const user = getUserById(userId)
  if (!user) return false
  delete user.referrerId
  return true
}

export function getRentalsByUserId(userId: string): Order[] {
  return orders.filter((order) => order.userId === userId)
}

export function getAllRentals(): Order[] {
  return orders
}

export function updateOrderStatus(orderId: string, status: Order['status']): Order | undefined {
  const order = getOrderById(orderId)
  if (order) {
    order.status = status
  }
  return order
}

export function updateOrder(orderId: string, updates: Partial<Order>): Order | undefined {
  const order = getOrderById(orderId)
  if (order) {
    Object.assign(order, updates)
  }
  return order
}

export function createContract(contract: Contract): Contract {
  contracts.push(contract)
  return contract
}

export function updateContractStatus(contractId: string, status: Contract['status']): Contract | undefined {
  const contract = getContractById(contractId)
  if (contract) {
    contract.status = status
  }
  return contract
}