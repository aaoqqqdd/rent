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
  updateDeviceStatus,
  getContractById,
  CONTRACT_OPERATIONAL_FIELDS,
  CONTRACT_SIGNED_FIELDS,
  issueInvoice,
  createAuthSession,
  deleteAuthSession,
  getSystemSettings,
  loadSystemSettingsFromDB
} from './site'
import { nanoid, customAlphabet } from 'nanoid'
import { getStripeConfigSummary } from './stripe'
import { createStripeCheckout, handleStripeWebhook, refundDeposit, cancelAndRefund } from './actions/stripePayments'

function parseFormBody(body: string | null | undefined): Record<string, string> {
  const form: Record<string, string> = {}
  if (!body) return form

  const params = new URLSearchParams(body)
  for (const [key, value] of params.entries()) {
    form[key] = value
  }

  return form
}

async function getTableColumns(c: any, tableName: string): Promise<string[]> {
  const allowedTables = new Set(['users', 'commission_withdrawals'])
  if (!allowedTables.has(tableName)) throw new Error('Unsupported table name')
  const result = await c.env.RENT.prepare(`PRAGMA table_info(${tableName})`).all() as any
  return (result.results || []).map((column: any) => column.name)
}

const app = new Hono()

app.use('*', async (c, next) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (user) {
    c.set('user', user)
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
    : /^\/customer\/orders\/[^/]+\/bank-transfer-proof$/.test(c.req.path) ? ['bank-proof', 10, 3600] as const : null
  if (rateRule && !await enforceRateLimit(c, rateRule[0], ip, rateRule[1], rateRule[2])) return c.text('请求过于频繁，请稍后再试', 429)
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Cross-Origin-Resource-Policy', 'same-origin')
  if (new URL(c.req.url).protocol === 'https:') c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.quilljs.com; style-src 'self' 'unsafe-inline' https://cdn.quilljs.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'")
})



app.use('*', async (c, next) => {
  try {
    await next()
  } catch (error) {
    console.error('Server Error:', error)
    return c.html(renderServerError(), 500)
  }
})

app.notFound((c) => {
  return c.html(renderNotFound(), 404)
})

app.onError((error, c) => {
  console.error('Unhandled Application Error:', error)
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
  if (user.role === 'CUSTOMER') return c.redirect('/customer/dashboard')
  if (user.role === 'STAFF') return c.redirect('/staff/dashboard')
  return c.redirect('/admin/dashboard')
})

app.get('/login', async (c) => {
  const user = c.get('user')
  if (user) {
    return c.redirect('/')
  }
  return c.html(pages.renderLogin())
})

app.post('/login', async (c) => {
  const form = await c.req.parseBody()
  const account = form.account?.trim()
  const password = form.password?.trim()
  if (!account || !password) {
    return c.html(pages.renderLogin('请输入账号和密码'))
  }
  const loginIp = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim().slice(0, 64)
  const normalizedAccount = String(account).toLowerCase().slice(0, 254)
  const recentFailures = await c.env.RENT.prepare("SELECT COUNT(*) count FROM login_attempts WHERE ip_address = ? AND account = ? AND attempted_at > datetime('now', '-15 minutes')").bind(loginIp, normalizedAccount).first() as any
  if (Number(recentFailures?.count || 0) >= 5) return c.html(pages.renderLogin('登录失败次数过多，请 15 分钟后再试'), 429)
  const user = await verifyUserCredentials(c, account, password)
  if (!user) {
    await c.env.RENT.prepare('INSERT INTO login_attempts (ip_address, account) VALUES (?, ?)').bind(loginIp, normalizedAccount).run()
    return c.html(pages.renderLogin('账号或密码错误'))
  }
  await c.env.RENT.prepare('DELETE FROM login_attempts WHERE ip_address = ? AND account = ?').bind(loginIp, normalizedAccount).run()
  const response = c.redirect(user.role === 'CUSTOMER' ? '/customer/dashboard' : user.role === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard')
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
  return c.html(pages.renderRegister())
})

app.get('/terms', (c) => {
  return c.html(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>租赁条款</title><link rel="stylesheet" href="/styles.css"></head><body><main class="container"><div class="panel"><h1>租赁条款</h1>${sanitizeRichHtml(getSystemSettings().rentalTerms)}<p><a class="button" href="/register">返回注册</a></p></div></main></body></html>`)
})

app.post('/register', async (c) => {
  const form = await c.req.parseBody()
  const { name, email, password, passwordConfirm, referrer, countryCode, phone } = form

  if (!name?.trim() || !email?.trim() || !password?.trim() || !passwordConfirm?.trim() || !phone?.trim()) {
    return c.html(pages.renderRegister('请输入完整注册信息'))
  }
  if (password !== passwordConfirm) {
    return c.html(pages.renderRegister('两次输入密码不一致'))
  }
  if (String(password).length < 10) return c.html(pages.renderRegister('密码至少需要 10 位'))

  // 检查邮箱是否已存在
  const existingUser = await findUserByEmail(c, email)
  if (existingUser) {
    return c.html(pages.renderRegister('该电子邮箱已被注册'))
  }

  // 处理推荐人
  let referrerId = null;
  if (referrer && referrer.trim()) {
    const referrerUser = await findUserByReferralCode(c, referrer)
    if (referrerUser) {
      referrerId = referrerUser.id;
    } else {
      return c.html(pages.renderRegister('无效的推荐码'))
    }
  }

  const numericAlphabet = '0123456789'
  const generateNumericId = customAlphabet(numericAlphabet, 8)
  const newUserId = `u-${generateNumericId()}`
  const fullPhone = `${countryCode}${phone}`
  const newUser = {
    id: newUserId,
    name: name.trim(),
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

  // 自动登录
  const response = c.redirect('/customer/dashboard')
  const session = await createAuthSession(c, newUserId)
  response.headers.set('Set-Cookie', `session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${new URL(c.req.url).protocol === 'https:' ? '; Secure' : ''}`)

  return response
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

app.post('/logout', async (c) => {
  await deleteAuthSession(c, c.req.header('cookie') ?? null)
  const response = c.redirect('/')
  response.headers.set('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return response
})

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
  return c.html(await pages.renderCustomerOrderDetail(c, user, c.req.param('id')))
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
  const form = await c.req.parseBody()
  const startDate = String(form.startDate || '')
  const endDate = String(form.endDate || '')
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!device || device.status !== 'available' || !startDate || !endDate || !Number.isFinite(start.getTime()) || start >= end || await hasDeviceBookingConflict(c, device?.id || '', startDate, endDate)) {
    return c.html(await pages.renderCustomerRent(c, c.req.param('id'), user, '请选择可用设备和正确的租赁日期'))
  }
  const rentalPeriod = Math.ceil((end.getTime() - start.getTime()) / 86400000)
  const orderId = `o-${nanoid(8)}`
  await insertOrder(c, {
    id: orderId, orderNo: `OD${Date.now()}${nanoid(4).toUpperCase()}`, userId: user.id,
    deviceId: device.id, startDate, endDate, rentalPeriod, status: 'pending_approval',
    paymentMethod: 'bank_transfer', totalAmount: rentalPeriod * device.pricePerDay + device.depositAmount,
    depositAmount: device.depositAmount, dailyRate: device.pricePerDay, contractId: '', signedAt: null,
    createdAt: new Date().toISOString()
  } as any)
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
  const dashboardData = await getStaffDashboardData(c)
  return c.html(pages.renderStaffDashboard(user, dashboardData))
})

app.get('/staff/orders/pending', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderStaffOrdersPending(c, user))
})

app.get('/staff/orders/:id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(await pages.renderStaffOrderDetail(c, user, c.req.param('id')))
})

// 新增：员工操作 - 标记订单为已拿取
app.post('/staff/orders/:orderId/pickup', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }
  const orderId = c.req.param('orderId')
  const pickupOrder = await getOrderById(c, orderId)
  if (!pickupOrder || !canTransitionOrder(pickupOrder.status, 'pending_return')) return c.json({ success: false, message: '当前订单状态不能标记为已拿取' }, 409)
  await updateOrderStatus(c, orderId, 'pending_return') // 从待拿取变为待归还
  return c.json({ success: true, message: '订单已标记为已拿取' })
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
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (!order || !canTransitionOrder(order.status, 'approved') || await hasDeviceBookingConflict(c, order.deviceId, order.startDate, order.endDate, order.id)) return c.text('订单状态无效或设备档期冲突', 409)
  await updateOrderStatus(c, order.id, 'approved')
  return c.redirect(`/staff/orders/${c.req.param('orderId')}`)
})

app.post('/staff/orders/:orderId/reject', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('orderId'))
  if (order) {
    await updateOrderStatus(c, order.id, 'cancelled')
    await updateDeviceStatus(c, order.deviceId, 'available')
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
  for (const [input, field] of [['screenCondition','screen_condition'],['keyboardCondition','keyboard_condition'],['trackpadCondition','trackpad_condition'],['bodyCondition','body_condition'],['cameraCondition','camera_condition'],['wifiCondition','wifi_condition'],['powerTest','power_test']]) {
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
  Object.assign(data, checks, { battery_cycles: batteryCycles ?? '', battery_health: String(form.batteryHealth || '').trim().slice(0, 100), damage_description: damageDescription, damage_photos: damagePhotos, replacement_cost: replacementCost.toFixed(2), return_status: damageDescription ? 'Damaged' : 'Returned', return_date: now.slice(0,10), inspection_date: now.slice(0,10), inspection_by: user.name || user.id })
  await c.env.RENT.batch([
    c.env.RENT.prepare('UPDATE contracts SET contract_data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify(data), contract.id),
    c.env.RENT.prepare("UPDATE orders SET status = 'completed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
    c.env.RENT.prepare('UPDATE devices SET status = ? WHERE id = ?').bind(damageDescription ? 'maintenance' : 'available', order.deviceId),
  ])
  return c.redirect(`/staff/orders/${order.id}`)
})

app.post('/staff/orders/:orderId/cancel', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) return c.html(renderForbidden(), 403)
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
  return c.html(await pages.renderStaffContractProgress(c, user, c.req.param('id')))
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
  const token = c.req.query('token') || '';
  const step = Number(c.req.query('step') || '1');
  const error = c.req.query('error');
  return c.html(await pages.renderContractSignPage(c, token, step, error));
});

app.post('/contract/sign', async (c) => {
  const token = c.req.query('token') || '';
  const step = Number(c.req.query('step') || '1');
  const form = await c.req.parseBody();
  return actions.handleSignContractStep(c, token, step, form);
});

app.post('/admin/contracts/template', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') {
    return c.html(renderForbidden(), 403)
  }

  const body = await c.req.text()
  const payload = JSON.parse(body || '{}')
  const updatedTemplate = await updateContractTemplateInDB(c, {
    id: payload.id || 'tmpl-1',
    name: payload.name || '标准租赁合同模板',
    content: payload.content || '',
  })
  return c.json(updatedTemplate)
});

app.get('/contract/view/:id', async (c) => {
  return c.html(await pages.renderContractView(c, c.req.param('id'), c.get('user')))
})

app.get('/payment/result', async (c) => {
  return c.html(await pages.renderPaymentResult(c, c.req.query('orderId') || '', c.get('user')))
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

app.post('/webhooks/stripe', async (c) => handleStripeWebhook(c))

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

  if (user.referralCode) {
    return c.html(await pages.renderCustomerReferral(c, user, '您已加入推荐计划，无需重复加入', 'info'))
  }

  const newReferralCode = await generateReferralCode()
  await updateUser(c, user.id, { referralCode: newReferralCode })

  // 更新session中的user对象
  const updatedUser = { ...user, referralCode: newReferralCode }

  return c.html(await pages.renderCustomerReferral(c, updatedUser, '恭喜您成功加入推荐计划！您的推荐码已生成。', 'success'))
})

app.post('/customer/referral/leave', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }

  if (!user.referralCode) {
    return c.html(await pages.renderCustomerReferral(c, user, '您还未加入推荐计划', 'info'))
  }

  await updateUser(c, user.id, { referralCode: null })

  // 更新session中的user对象，移除推荐码
  const updatedUser = { ...user, referralCode: null }

  return c.html(await pages.renderCustomerReferral(c, updatedUser, '您已成功退出推荐计划，推荐码已失效。', 'success'))
})

app.get('/customer/security', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerSecurity(c, user))
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
  const { getOrdersAsync, getUsersAsync, getDevicesAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  const users = await getUsersAsync(c)
  const devices = await getDevicesAsync(c)
  return c.html(pages.renderAdminDashboard(user, orders, users, devices))
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
  const name = String(form.name || '').trim()
  const email = String(form.email || '').trim().toLowerCase()
  const password = String(form.password || '')
  const role = String(form.role || 'CUSTOMER')
  const status = String(form.status || 'active')
  if (!name || !email || password.length < 8 || !['CUSTOMER', 'STAFF', 'ADMIN'].includes(role) || !['active', 'inactive'].includes(status)) return c.html(pages.renderAdminUserNew(user), 400)
  if (await findUserByEmail(c, email)) return c.html(pages.renderAdminUserNew(user), 409)
  await insertUser(c, { id: `u-${nanoid(10)}`, name, email, password, role, status, balance: 0, commissionBalance: 0, createdAt: new Date().toISOString() })
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

app.post('/admin/users/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const targetUserId = c.req.param('id')
  const form = await c.req.parseBody()

  const dataToUpdate: any = {
    name: form.name?.toString() || '',
    phone: form.phone?.toString() || '',
    bsb: form.bsb?.toString() || '',
    account_number: form.account_number?.toString() || '',
    balance: parseFloat(form.balance?.toString() || '0'),
    role: form.role?.toString() || 'CUSTOMER'
  }

  // 如果提供了密码，更新密码
  if (form.password && form.password.toString().length > 0) {
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
  return c.html(await pages.renderAdminContracts(c, user))
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
  const submitted = Object.entries(form).filter(([name]) => allowed.has(name as any) && (contract.status !== 'signed' || !CONTRACT_SIGNED_FIELDS.has(name))).map(([name, value]) => [name, String(value).trim().slice(0, 4000)])
  const submittedData = Object.fromEntries(submitted)
  if (submittedData.damage_photos) {
    try { submittedData.damage_photos = validateHostedImageUrls(submittedData.damage_photos).join('\n') } catch (error: any) { return c.text(error.message, 400) }
  }
  for (const name of ['delivery_fee', 'discount', 'replacement_cost', 'battery_cycles']) {
    const value = submittedData[name]
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) return c.text(`${name} 必须是非负数字`, 400)
  }
  const allowedOptions: Record<string, string[]> = { delivery_method: ['', 'Pickup', 'Delivery'], return_status: ['', 'Returned', 'Overdue', 'Damaged'], collection_required: ['', '否', '是'], power_test: ['', '通过', '失败'], insurance_required: ['', '否', '是'], waiver_signed: ['', '否', '是'], jurisdiction: ['', 'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] }
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
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const status = String((await c.req.parseBody()).status || '')
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || !['pending_payment', 'paid', 'active', 'completed', 'cancelled'].includes(status) || !canTransitionOrder(order.status, status)) return c.text('不允许的订单状态转换', 409)
  if (status === 'completed') {
    const contract = await c.env.RENT.prepare('SELECT contract_data FROM contracts WHERE orderId = ? AND deleted_at IS NULL ORDER BY createdAt DESC LIMIT 1').bind(order.id).first() as any
    if (!JSON.parse(contract?.contract_data || '{}').inspection_date) return c.text('完成订单前必须提交归还验机', 409)
  }
  await updateOrderStatus(c, order.id, status)
  return c.redirect(`/admin/orders/${c.req.param('id')}`)
})

app.post('/admin/orders/:id/transfer-proof/approve', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'ADMIN') return c.html(renderForbidden(), 403)
  const order = await getOrderById(c, c.req.param('id'))
  if (!order || order.status !== 'pending_payment' || order.paymentMethod !== 'bank_transfer') return c.text('订单状态不允许审核', 409)
  const proof = await c.env.RENT.prepare("SELECT pp.id, pp.payment_id FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? AND pp.status = 'submitted' ORDER BY pp.uploaded_at DESC LIMIT 1").bind(order.id).first() as any
  if (!proof) return c.text('没有待审核的转账信息', 409)
  await c.env.RENT.batch([
    c.env.RENT.prepare("UPDATE payment_proofs SET status = 'approved', verified_at = CURRENT_TIMESTAMP, verified_by = ? WHERE id = ? AND status = 'submitted'").bind(user.id, proof.id),
    c.env.RENT.prepare("UPDATE payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(proof.payment_id),
    c.env.RENT.prepare("UPDATE orders SET status = 'paid', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'").bind(order.id),
  ])
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
  if (selectedOrders.some(order => !order || !canTransitionOrder(order.status, targetStatus))) return c.text('批量操作包含不允许的状态转换', 409)
  if (targetStatus === 'completed') return c.text('完成订单必须逐笔执行归还验机', 409)
  await Promise.all(selectedOrders.map(order => updateOrderStatus(c, order!.id, targetStatus)))

  return c.redirect('/admin/orders')
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

app.get('/admin/finance', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const { getOrdersAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  return c.html(pages.renderAdminFinance(user, orders))
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

app.post('/admin/devices/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  await insertDevice(c, {
    name: form.name || '',
    model: form.model || '',
    serialNumber: form.serialNumber || '',
    pricePerDay: Number(form.pricePerDay) || 0,
    depositAmount: Number(form.depositAmount) || 0,
    status: (form.status as any) || 'available',
    description: form.description || ''
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
  return c.html(pages.renderAdminDeviceEdit(user, device))
})

app.post('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  await updateDevice(c, c.req.param('id'), {
    name: form.name,
    model: form.model,
    serialNumber: form.serialNumber,
    pricePerDay: form.pricePerDay ? Number(form.pricePerDay) : undefined,
    depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
    status: form.status as any,
    description: form.description
  })
  return c.redirect('/admin/devices')
})

app.post('/admin/devices/:id/delete', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  await deleteDevice(c, c.req.param('id'))
  return c.redirect('/admin/devices')
})


app.get('/admin/settings', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  await loadSystemSettingsFromDB(c)
  return c.html(pages.renderAdminSettings(user, await getStripeConfigSummary(c)))
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
    const { cleanupExpiredAndCancelledContracts, logError } = await import('./site')
    ctx.waitUntil(
      (async () => {
        try {
          const deletedCount = await cleanupExpiredAndCancelledContracts(c)
          console.log(`Scheduled contract cleanup completed: removed ${deletedCount} expired/cancelled contracts`)
        } catch (error) {
          await logError(c, 'ERROR', 'Failed to run scheduled contract cleanup', error as Error)
          console.error('Scheduled contract cleanup failed:', error)
        }
      })()
    )
  }
}
