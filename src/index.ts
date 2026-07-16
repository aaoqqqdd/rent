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
  createWithdrawalRequest
} from './site'
import { nanoid } from 'nanoid'

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
  const user = await verifyUserCredentials(c, account, password)
  if (!user) {
    return c.html(pages.renderLogin('账号或密码错误'))
  }
  const response = c.redirect(user.role === 'CUSTOMER' ? '/customer/dashboard' : user.role === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard')
  let cookieOptions = `session=${user.role}:${user.id}; Path=/; HttpOnly`;
  if (form.remember === 'on') {
    cookieOptions += `; Max-Age=${60 * 60 * 24 * 30}`; // 30 days
  }
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

app.post('/register', async (c) => {
  const form = await c.req.parseBody()
  const { name, email, password, passwordConfirm, referrer } = form

  if (!name?.trim() || !email?.trim() || !password?.trim() || !passwordConfirm?.trim()) {
    return c.html(pages.renderRegister('请输入完整注册信息'))
  }
  if (password !== passwordConfirm) {
    return c.html(pages.renderRegister('两次输入密码不一致'))
  }
  
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
  const newUser = {
    id: newUserId,
    name: name.trim(),
    email: email.trim(),
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
  response.headers.set('Set-Cookie', `session=CUSTOMER:${newUserId}; Path=/; HttpOnly; SameSite=Lax`)
  
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

app.get('/logout', async (c) => {
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
  return c.html(pages.renderCustomerOrderDetail(user, c.req.param('id')))
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
  await updateOrderStatus(c, orderId, 'pending_return') // 从待拿取变为待归还
  return c.json({ success: true, message: '订单已标记为已拿取' })
})

// 新增：员工操作 - 标记订单为已归还
app.post('/staff/orders/:orderId/return', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }
  const orderId = c.req.param('orderId')
  await updateOrderStatus(c, orderId, 'completed') // 从待归还变为已完成
  return c.json({ success: true, message: '订单已标记为已归还' })
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
  // 支持两种参数：token（旧格式）和number（新格式：contract/sign?number=合同编号&step=1）
  const token = c.req.query('token') || '';
  const number = c.req.query('number') || '';
  const identifier = token || number; // 优先使用token，否则使用合同编号
  const step = Number(c.req.query('step') || '1');
  const error = c.req.query('error');
  return c.html(await pages.renderContractSignPage(c, identifier, step, error));
});

app.post('/contract/sign', async (c) => {
  // 同样支持两种参数
  const token = c.req.query('token') || '';
  const number = c.req.query('number') || '';
  const identifier = token || number;
  const step = Number(c.req.query('step') || '1');
  const form = await c.req.parseBody();
  return actions.handleSignContractStep(c, identifier, step, form);
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
  const status = c.req.query('status') === 'fail' ? 'fail' : 'success'
  return c.html(await pages.renderPaymentResult(c, c.req.query('orderId') || '', status, c.get('user')))
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
  const phone = form.phone?.trim() || user.phone || ''
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

  const newReferralCode = generateNumericId()
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
  const confirmPassword = form.confirmPassword?.trim()
  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.html(await pages.renderCustomerSecurity(c, user, '请输入完整密码信息'))
  }

  const fullUser = await (c.env as any).RENT.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    
  if (!fullUser || !fullUser.passwordHash) {
    return c.html(await pages.renderCustomerSecurity(c, user, '无法验证当前密码'))
  }

  const isPasswordValid = await verifyPassword(currentPassword, fullUser.passwordHash)
  
  if (!isPasswordValid) {
    return c.html(await pages.renderCustomerSecurity(c, user, '当前密码不正确'))
  }
  if (newPassword !== confirmPassword) {
    return c.html(await pages.renderCustomerSecurity(c, user, '两次输入的新密码不一致'))
  }
  await updateUser(c, user.id, { password: newPassword })
  return c.html(await pages.renderCustomerSecurity(c, user, '密码已更新', 'success'))
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
  const body = await c.req.text()
  const form = parseFormBody(body)
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
  return c.redirect('/admin/orders')
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

app.get('/admin/orders/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminOrderDetail(c, user, c.req.param('id')))
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

app.get('/admin/devices/:id/delete', async (c) => {
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
  return c.html(pages.renderAdminSettings(user))
})

app.post('/admin/settings/save', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.text('无权限', 403)
  }
  const bodyText = await c.req.text()
  // 把文本 body 挂回 req，避免 handleSaveAdminSettings 里再次读取 text 时是空
  // Hono 不提供直接覆盖 req，这里改为直接 json 解析后写入 handler（handler已读取text）
  // 因此直接把 c.req 交给 handler 读取即可，这里无需复用 bodyText。
  return actions.handleSaveAdminSettings(c)
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
      set: () => {},
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