 import { Hono } from 'hono'
import * as pages from './pages/index'
import * as actions from './actions/index'
import { verifyUserCredentials, findUserBySession, getDeviceById, loadDatabaseData, updateContractTemplateInDB, updateUser, verifyPassword, insertUser, insertDevice, updateDevice, deleteDevice } from './site'

const app = new Hono()

function renderErrorPage(status: number, title: string, subtitle: string, errorDetails: string) {
  return `<!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - PC Rental</title>
        <style>
          :root {
            --primary-color: #3b82f6;
            --primary-dark: #2563eb;
            --danger-color: #ef4444;
            --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --card-bg: #ffffff;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            background: var(--bg-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .error-container {
            background: var(--card-bg);
            border-radius: 16px;
            box-shadow: var(--shadow-lg);
            max-width: 800px;
            width: 100%;
            padding: 40px;
            animation: fadeInUp 0.5s ease-out;
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .error-header {
            text-align: center;
            margin-bottom: 30px;
          }
          .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          .error-title {
            color: var(--danger-color);
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          .error-subtitle {
            color: var(--text-secondary);
            font-size: 16px;
          }
          .error-details {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            overflow-x: auto;
          }
          .error-details h3 {
            color: var(--text-primary);
            font-size: 18px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .error-details pre {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #374151;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .error-actions {
            text-align: center;
          }
          .btn-primary {
            display: inline-block;
            padding: 12px 32px;
            background: var(--primary-color);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
          }
          .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          }
          @media (max-width: 640px) {
            .error-container {
              padding: 25px;
            }
            .error-title {
              font-size: 22px;
            }
            .error-icon {
              font-size: 48px;
            }
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-header">
            <div class="error-icon">⚠️</div>
            <h1 class="error-title">${title}</h1>
            <p class="error-subtitle">${subtitle}</p>
          </div>
          <div class="error-details">
            <h3>📋 错误详情</h3>
            <pre>${errorDetails}</pre>
          </div>
          <div class="error-actions">
            <a href="/" class="btn-primary">返回首页</a>
          </div>
        </div>
      </body>
      </html>`
}

app.use('*', async (c, next) => {
  try {
    await loadDatabaseData(c)
    await next()
  } catch (error) {
    console.error('Server Error:', error)
    const details = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
    return c.html(renderErrorPage(500, '服务器错误', '出现未处理错误，请检查日志。', details), 500)
  }
})

app.onError((error, c) => {
  console.error('Unhandled Application Error:', error)
  const details = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
  return c.html(renderErrorPage(500, '服务器错误', '应用程序发生了未捕获错误。', details), 500)
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
  const { name, email, password, passwordConfirm, referrer } = form

  if (!name?.trim() || !email?.trim() || !password?.trim() || !passwordConfirm?.trim()) {
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

  // 处理推荐人
  let referrerId = null;
  if (referrer && referrer.trim()) {
    const normalizedReferrerCode = referrer.trim().toUpperCase();
    const referrerUser = await (c.env as any).RENT.prepare('SELECT id FROM users WHERE UPPER(referralCode) = ?').bind(normalizedReferrerCode).first();
    if (referrerUser) {
      referrerId = referrerUser.id;
    } else {
      // 如果推荐码无效，可以选择返回错误或忽略
      // return c.html(pages.renderRegister('无效的推荐码'))
    }
  }
  
  // 创建新用户
  const { nanoid } = await import('nanoid')
  const { hashPassword } = await import('./site')
  const newUserId = `u-${nanoid(8)}`
  const newUser = {
    id: newUserId,
    name: name.trim(),
    email: email.trim(),
    password_hash: await hashPassword(password),
    role: 'CUSTOMER' as const,
    balance: 0,
    commissionBalance: 0,
    referrer_id: referrerId,
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
  const { getOrdersAsync, getDevicesAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  const devices = await getDevicesAsync(c)
  return c.html(pages.renderCustomerDashboard(user, orders, devices))
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
  const { getOrdersAsync, getUsersAsync, getDevicesAsync } = await import('./site')
  const orders = await getOrdersAsync(c)
  const users = await getUsersAsync(c)
  const devices = await getDevicesAsync(c)
  return c.html(pages.renderStaffDashboard(user, orders, users, devices))
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
  const status = c.req.query('status');
  return c.html(pages.renderStaffContracts(user, status))
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
  return c.html(await pages.renderContractSignPage(c, token, step, error));
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
  return c.html(await pages.renderCustomerRentals(c, user))
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
  return c.html(await pages.renderCustomerReferral(c, user))
})

app.get('/customer/referral/withdraw', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderCustomerReferral(c, user))
})

app.post('/customer/referral/join', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  // 导入joinReferralProgram函数
  const { joinReferralProgram } = await import('./site')
  const updatedUser = await joinReferralProgram(c, user.id)
  if (updatedUser) {
    return c.html(await pages.renderCustomerReferral(c, updatedUser, '成功加入推荐计划，您的专属推荐码已生成！'))
  } else {
    return c.html(await pages.renderCustomerReferral(c, user, '加入推荐计划失败，请稍后重试'))
  }
})

app.post('/customer/referral/leave', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'CUSTOMER') {
    return c.redirect('/login')
  }
  // 导入leaveReferralProgram函数
  const { leaveReferralProgram } = await import('./site')
  const updatedUser = await leaveReferralProgram(c, user.id)
  if (updatedUser) {
    return c.html(await pages.renderCustomerReferral(c, updatedUser, '已成功退出推荐计划'))
  } else {
    return c.html(await pages.renderCustomerReferral(c, user, '退出推荐计划失败，请稍后重试'))
  }
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
    return c.html(await pages.renderCustomerReferral(c, user, '请输入正确的提现金额'))
  }
  // 获取完整用户信息以验证余额
  const fullUser = await c.env.RENT.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as any;
  if (amount > fullUser.commission_balance) {
    return c.html(await pages.renderCustomerReferral(c, user, '提现金额不能超过可提现余额'))
  }
  // 处理提现申请：创建提现记录并更新用户佣金余额
  const withdrawalId = `w-${(await import('nanoid')).nanoid(8)}`;
  await c.env.RENT.prepare(`
    INSERT INTO commission_withdrawals (id, user_id, amount, bsb, account_number, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).bind(withdrawalId, user.id, amount, form.bsb, form.account_number).run();
  
  // 更新用户佣金余额
  await c.env.RENT.prepare(`
    UPDATE users SET commission_balance = commission_balance - ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(amount, user.id).run();
  
  // 更新佣金记录状态
  await c.env.RENT.prepare(`
    UPDATE commission_records SET status = 'withdrawn', settled_at = CURRENT_TIMESTAMP
    WHERE referrer_id = ? AND status = 'pending'
    ORDER BY created_at ASC LIMIT 1
  `).bind(user.id).run();
  
  return c.html(await pages.renderCustomerReferral(c, user, '提现申请已提交，预计2个工作日处理'))
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
  return c.redirect('/admin/users')
})

app.get('/admin/refunds', async (c) => {
  const user = await findUserBySession(c, c.req.header('cookie') ?? null)
  if (!user || user.role !== 'ADMIN') {
    return c.redirect('/login')
  }
  return c.html(await pages.renderAdminRefunds(c, user))
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

export default app