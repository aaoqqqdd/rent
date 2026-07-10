import { Hono } from 'hono'
import * as pages from './pages'
import { users, findUserBySession } from './site'

const app = new Hono()

function parseFormBody(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=')
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value || '')
  }
  return result
}

app.get('/', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user) {
    return c.html(pages.renderHome(null))
  }
  if (user.role === 'CUSTOMER') return c.redirect('/customer/dashboard')
  if (user.role === 'STAFF') return c.redirect('/staff/dashboard')
  return c.redirect('/admin/dashboard')
})

app.get('/login', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
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
  const user = users.find((item) => item.email === account || item.name === account)
  if (!user || user.password !== password) {
    return c.html(pages.renderLogin('账号或密码错误'))
  }
  const response = c.redirect(user.role === 'CUSTOMER' ? '/customer/dashboard' : user.role === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard')
  response.headers.set('Set-Cookie', `session=${user.role}:${user.id}; Path=/; HttpOnly`)
  return response
})

app.get('/register', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
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
  return c.html(pages.renderRegister('注册功能仅演示，暂不保存数据'))
})

app.get('/forgot-password', (c) => {
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

app.get('/logout', (c) => {
  const response = c.redirect('/')
  response.headers.set('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return response
})

app.get('/customer/dashboard', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerDashboard(user))
})

app.get('/customer/orders', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerOrders(user))
})

app.get('/customer/orders/:id', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerOrderDetails(user, c.req.param('id')))
})

app.get('/staff/dashboard', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffDashboard(user))
})

app.get('/staff/orders/pending', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffOrdersPending(user))
})

app.get('/staff/orders/:id', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffOrderDetails(user, c.req.param('id')))
})

app.get('/staff/contracts', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContracts(user))
})

app.get('/staff/rentals/tracking', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffRentalsTracking(user))
})

app.get('/staff/devices', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffDevices(user))
})

app.get('/staff/contract/new', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContractNew(user))
})

app.post('/staff/contract/new', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  const deviceId = form.deviceId?.trim() || 'd-1'
  return c.redirect('/staff/contracts')
})

app.get('/staff/contracts/:id/progress', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContractProgress(user, c.req.param('id')))
})

app.get('/staff/contract/view', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffContractView(user, c.req.query('orderId') || ''))
})

app.get('/contract/sign', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  return c.html(pages.renderContractSign(c.req.query('token') || '', user))
})

app.post('/contract/sign', async (c) => {
  return c.redirect('/payment/result?status=success&orderId=o-1')
})

app.get('/contract/view', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  return c.html(pages.renderContractView(c.req.query('orderId') || '', user))
})

app.get('/payment/result', (c) => {
  return c.html(pages.renderPaymentResult(c.req.query('status') || 'success', c.req.query('orderId') || ''))
})

app.get('/customer/rentals', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerRentals(user))
})

app.get('/customer/profile', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerProfile(user))
})

app.post('/customer/profile', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
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

  user.name = name
  user.phone = phone
  user.bsb = bsb
  user.account = account
  user.referralCode = referralCode
  if (password) {
    user.password = password
  }

  return c.html(pages.renderCustomerProfile(user, '个人信息已更新', 'success'))
})

app.get('/customer/referral', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerReferral(user))
})

app.get('/customer/referral/withdraw', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerReferralWithdraw(user))
})

app.post('/customer/referral/withdraw', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  const amount = Number(form.amount)
  if (!amount || amount <= 0) {
    return c.html(pages.renderCustomerReferralWithdraw(user, '请输入正确的提现金额'))
  }
  if (amount > user.commissionBalance) {
    return c.html(pages.renderCustomerReferralWithdraw(user, '提现金额不能超过可提现余额'))
  }
  return c.html(pages.renderCustomerReferralWithdraw(user, '提现申请已提交，预计2个工作日处理'))
})

app.get('/customer/security', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(pages.renderCustomerSecurity(user))
})

app.post('/customer/security', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
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
  if (currentPassword !== user.password) {
    return c.html(pages.renderCustomerSecurity(user, '当前密码不正确'))
  }
  if (newPassword !== confirmPassword) {
    return c.html(pages.renderCustomerSecurity(user, '两次输入的新密码不一致'))
  }
  user.password = newPassword
  return c.html(pages.renderCustomerSecurity(user, '密码已更新', 'success'))
})

app.get('/admin/dashboard', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDashboard(user))
})

app.get('/admin/users', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminUsers(user))
})

app.get('/admin/orders', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminOrders(user))
})

app.get('/admin/contracts', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminContracts(user))
})

app.get('/admin/contracts/:id', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminContractDetails(user, c.req.param('id')))
})

app.get('/admin/orders/:id', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminOrderDetails(user, c.req.param('id')))
})

app.get('/admin/finance', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminFinance(user))
})

app.get('/admin/devices', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDevices(user))
})

app.get('/admin/devices/new', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminDeviceNew(user))
})

app.post('/admin/devices/new', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
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

app.get('/admin/devices/:id/edit', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  // In a real app, you'd fetch the device from the database.
  const device = { id: c.req.param('id'), name: 'Sample Device', model: 'Sample Model', pricePerDay: 10, depositAmount: 100, status: 'available' };
  return c.html(pages.renderAdminDeviceEdit(user, device))
})

app.post('/admin/devices/:id/edit', async (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  const body = await c.req.text()
  const form = parseFormBody(body)
  // In a real app, you'd validate the form data
  // and update the device in the database.
  return c.redirect('/admin/devices')
})

app.get('/admin/devices/:id/delete', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  // In a real app, you'd delete the device from the database.
  return c.redirect('/admin/devices')
})


app.get('/admin/settings', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(pages.renderAdminSettings(user))
})

app.get('*', (c) => c.html(pages.render404()))

export default app