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
  return c.html(pages.renderHome(user))
})

app.get('/login', (c) => c.html(pages.renderLogin()))

app.post('/login', async (c) => {
  const body = await c.req.text()
  const form = parseFormBody(body)
  const account = form.account?.trim()
  const password = form.password?.trim()
  const user = users.find((item) => item.email === account || item.name === account)
  if (!user || user.password !== password) {
    return c.html(pages.renderLogin('账号或密码错误'))
  }
  const response = c.html(pages.renderLogin('登录成功，演示跳转中...'))
  response.header('Set-Cookie', `session=${user.role}:${user.id}; Path=/; HttpOnly`)
  return response
})

app.get('/register', (c) => c.html(pages.renderRegister()))

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

app.get('/logout', (c) => {
  const response = c.redirect('/')
  response.header('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
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
  return c.html(pages.renderStaffDashboard(user))
})

app.get('/staff/orders/:id', (c) => {
  const user = findUserBySession(c.req.header('cookie') ?? null)
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return c.redirect('/login')
  }
  return c.html(pages.renderStaffOrderDetails(user, c.req.param('id')))
})

app.get('/contract/sign', (c) => {
  return c.html(pages.renderContractSign(c.req.query('token') || ''))
})

app.post('/contract/sign', async (c) => {
  return c.redirect('/payment/result?status=success&orderId=o-1')
})

app.get('/contract/view', (c) => {
  return c.html(pages.renderContractView(c.req.query('orderId') || ''))
})

app.get('/payment/result', (c) => {
  return c.html(pages.renderPaymentResult(c.req.query('status') || 'success', c.req.query('orderId') || ''))
})

app.get('*', (c) => c.html(pages.render404()))

export default app
