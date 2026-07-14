import { Hono } from 'hono'
import * as pages from './pages/index'
import * as actions from './actions/index'
import { verifyUserCredentials, findUserBySession, devices, getDeviceById, loadDatabaseData, updateContractTemplateInDB, updateUser, verifyPassword, insertUser } from './site'

const app = new Hono()

app.use('*', async (c, next) => {
  await loadDatabaseData(c)
  return next()
})


function parseFormBody(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=')
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value || '')
  }
  return result
}

app.get('/', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user) {
    return c.redirect('/login')
  }
  if (user.role === 'CUSTOMER') return c.redirect('/customer/dashboard')
  if (user.role === 'STAFF') return c.redirect('/staff/dashboard')
  return c.redirect('/admin/dashboard')
})

app.get('/login', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (user) {
    return c.redirect('/')
  }
  return c.html(pages.renderLogin())
})

app.post('/login', async (c) => {
  const body = await c.req.text()
  const form = parseFormBody(body)
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
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (user) {
    return c.redirect('/')
  }
  return c.html(pages.renderRegister())
})

app.post('/register', async (c) => {
  const body = await c.req.text()
  const form = parseFormBody(body)
  const name = form.name?.trim()
  const email = form.email?.trim()
  const password = form.password?.trim()
  const passwordConfirm = form.passwordConfirm?.trim()
  if (!name || !email || !password || !passwordConfirm) {
    return c.html(pages.renderRegister('请输入完整注册信息'))
  }
  if (password !== passwordConfirm) {
    return c.html(pages.renderRegister('两次输入密码不一致'))
  }
  
  // 检查邮箱是否已存在
  const existingUser = await (c.env as any).RENT.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (existingUser) {
    return c.html(pages.renderRegister('该电子邮箱已被注册'))
  }
  
  // 创建新用户
  const { nanoid } = await import('nanoid')
  const newUserId = `u-${nanoid(8)}`
  const newUser = {
    id: newUserId,
    name,
    email,
    password,
    role: 'CUSTOMER' as const,
    balance: 0,
    commissionBalance: 0,
    createdAt: new Date().toISOString(),
    status: 'active' as const
  }
  
  await insertUser(c, newUser)
  
  // 自动登录
  const sessionId = nanoid(16)
  const response = c.redirect('/customer/dashboard')
  response.headers.set('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`)
  
  return response
})

app.get('/forgot-password', async (c) => {
  return c.html(pages.renderForgotPassword())
})

app.post('/forgot-password', async (c) => {
  const body = await c.req.text()
  const form = parseFormBody(body)
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
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerDashboard(user))
})

app.get('/customer/orders', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerOrders(user))
})

app.get('/customer/orders/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerOrderDetail(user, c.req.param('id')))
})

app.get('/staff/dashboard', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffDashboard(user))
})

app.get('/staff/orders/pending', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffOrdersPending(user))
})

app.get('/staff/orders/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffOrderDetail(user, c.req.param('id')))
})

app.get('/staff/contracts', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContracts(user))
})

app.get('/staff/rentals/tracking', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffRentalsTracking(user))
})

app.get('/staff/devices', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffDevices(user))
})



app.get('/staff/contracts/new', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderNewContractPage(user))
})

app.post('/staff/contracts/create', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  return actions.handleCreateContractAction(c, user, form)
})

app.get('/staff/contracts/:id/progress', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContractProgress(user, c.req.param('id')))
})

app.get('/staff/contract/view', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContractView(user, c.req.query('orderId') || ''))
})

app.get('/contract/sign', async (c) => {
  const token = c.req.query('token') || '';
  const step = Number(c.req.query('step') || '1');
  const error = c.req.query('error');
  return c.html(pages.renderContractSignPage(token, step, error));
});

app.post('/contract/sign', async (c) => {
  const token = c.req.query('token') || '';
  const step = Number(c.req.query('step') || '1');
  const body = await c.req.text();
  const form = parseFormBody(body);
  return actions.handleSignContractStep(c, token, step, form);
});

app.post('/admin/contracts/template', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.text('无权限', 403)
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
  return c.html(pages.renderContractView(c.req.param('id'), await findUserBySession(c, c.req.header('cookie') ?? null)))
})

app.get('/payment/result', async (c) => {
  const status = c.req.query('status') === 'fail' ? 'fail' : 'success'
  return c.html(pages.renderPaymentResult(c.req.query('orderId') || '', status, await findUserBySession(c, c.req.header('cookie') ?? null)))
})

app.get('/customer/rentals', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerRentals(user))
})

app.get('/customer/profile', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerProfile(user))
})

app.post('/customer/profile', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  const name = form.name?.trim() || user.name
  const phone = form.phone?.trim() || user.phone || ''
  const bsb = form.bsb?.trim() || user.bsb || ''
  const account = form.account?.trim() || user.account || ''
  const referralCode = form.referralCode?.trim() || user.referralCode || ''
  const password = form.password?.trim()
  const passwordConfirm = form.passwordConfirm?.trim()

  if (password && password !== passwordConfirm) {
    return c.html(pages.renderCustomerProfile(user, '两次输入的新密码不一致'))
  }

  const dataToUpdate: any = {
    name,
    phone,
    bsb,
    account,
    referralCode
  }

  if (password) {
    dataToUpdate.password = password
  }

  const updatedUser = await updateUser(c, user.id, dataToUpdate)

  return c.html(pages.renderCustomerProfile(updatedUser, '个人信息已更新', 'success'))
})

app.get('/customer/referral', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerReferral(user))
})

app.get('/customer/referral/withdraw', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerReferral(user))
})

app.post('/customer/referral/withdraw', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  const amount = Number(form.amount)
  if (!amount || amount <= 0) {
    return c.html(pages.renderCustomerReferral(user, '请输入正确的提现金额'))
  }
  if (amount > user.commissionBalance) {
    return c.html(pages.renderCustomerReferral(user, '提现金额不能超过可提现余额'))
  }
  return c.html(pages.renderCustomerReferral(user, '提现申请已提交，预计2个工作日处理'))
})

app.get('/customer/security', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerSecurity(user))
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
    return c.html(pages.renderCustomerSecurity(user, '请输入完整密码信息'))
  }

  const fullUser = await (c.env as any).RENT.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    
  if (!fullUser || !fullUser.password_hash) {
    return c.html(pages.renderCustomerSecurity(user, '无法验证当前密码'))
  }

  const isPasswordValid = await verifyPassword(currentPassword, fullUser.password_hash)
  
  if (!isPasswordValid) {
    return c.html(pages.renderCustomerSecurity(user, '当前密码不正确'))
  }
  if (newPassword !== confirmPassword) {
    return c.html(pages.renderCustomerSecurity(user, '两次输入的新密码不一致'))
  }
  await updateUser(c, user.id, { password: newPassword })
  return c.html(pages.renderCustomerSecurity(user, '密码已更新', 'success'))
})

app.get('/admin/dashboard', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDashboard(user))
})

app.get('/admin/users', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const html = await pages.renderAdminUsers(user, c)
  return c.html(html)
})

app.get('/admin/orders', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminOrders(user))
})

app.get('/admin/contracts', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminContracts(user))
})

app.get('/admin/contracts/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminContractDetail(user, c.req.param('id')))
})

app.get('/admin/orders/:id', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminOrderDetail(user, c.req.param('id')))
})

app.get('/admin/finance', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminFinance(user))
})

app.get('/admin/devices', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDevices(user))
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
  // In a real app, you'd validate the form data
  // and create a new device in the database.
  // For now, we'll just redirect.
  return c.redirect('/admin/devices')
})

app.get('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const device = { id: c.req.param('id'), name: 'Sample Device', model: 'Sample Model', pricePerDay: 10, depositAmount: 100, status: 'available' };
  return c.html(pages.renderAdminDeviceEdit(user, device))
})

app.post('/admin/devices/:id/edit', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  // In a real app, you'd validate the form data
  // and update the device in the database.
  return c.redirect('/admin/devices')
})

app.get('/admin/devices/:id/delete', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  // In a real app, you'd delete the device from the database.
  return c.redirect('/admin/devices')
})


app.get('/admin/settings', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminSettings(user))
})

app.get('*', (c) => c.html(pages.renderNotFound()))

export default app