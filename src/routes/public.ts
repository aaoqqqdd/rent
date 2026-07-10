import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/', (c) => c.html(html.layout('首页', html.home(), [{ href: '/login', label: '登录' }, { href: '/register', label: '注册' }])))
app.get('/login', (c) => c.html(html.layout('登录', html.login(), [{ href: '/', label: '首页' }, { href: '/register', label: '注册' }])))
app.get('/register', (c) => c.html(html.layout('注册', html.register(), [{ href: '/', label: '首页' }, { href: '/login', label: '登录' }])))
app.get('/forgot-password', (c) => c.html(html.layout('找回密码', html.pageSection('找回密码', '<p>请输入注册邮箱，系统将发送重置邮件。</p>'), [{ href: '/login', label: '登录' }, { href: '/register', label: '注册' }])))
app.get('/contract/sign', (c) => {
  const step = c.req.query('s') || '1'
  const token = c.req.query('token') || 'demo-token'
  let body = ''

  if (step === '1') {
    body = `
      <div class="section">
        <h3>步骤 1：租赁协议</h3>
        <p>请阅读以下租赁协议并勾选“我已阅读并同意”。</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:18px;border-radius:14px;">
          <p>甲方：PC Rental Pty Ltd</p>
          <p>乙方：填写您的姓名</p>
          <p>设备：MacBook Pro 14寸 / M4 Pro 18GB 512GB</p>
          <p>租期：2026-07-10 ~ 2026-08-10</p>
          <p>日租金：¥40.00</p>
          <p>押金：¥2,000.00</p>
        </div>
        <form action="/contract/sign?token=${token}&s=2" method="get">
          <div class="form-group"><label><input type="checkbox" name="agree" required /> 我已阅读并同意以上租赁协议条款</label></div>
          <input type="hidden" name="token" value="${token}" />
          <button class="button" type="submit">继续下一步</button>
        </form>
      </div>
    `
  } else if (step === '2') {
    body = `
      <div class="section">
        <h3>步骤 2：租赁详情</h3>
        <p>请确认租赁设备、租期、费用与支付方式。</p>
        <div class="card">
          <p>设备：MacBook Pro 14寸</p>
          <p>租期：2026-07-10 ~ 2026-08-10</p>
          <p>租金总额：¥1,200.00</p>
          <p>押金：¥2,000.00</p>
          <p>总计：¥3,200.00</p>
        </div>
        <a class="button" href="/contract/sign?token=${token}&s=3">继续填写信息</a>
      </div>
    `
  } else if (step === '3') {
    body = `
      <div class="section">
        <h3>步骤 3：填写信息</h3>
        <form action="/contract/sign?token=${token}&s=4" method="get">
          <div class="form-group"><label>姓名</label><input name="name" placeholder="姓名" required /></div>
          <div class="form-group"><label>邮箱</label><input type="email" name="email" placeholder="邮箱" required /></div>
          <div class="form-group"><label>BSB</label><input name="bsb" placeholder="XXX-XXX" required /></div>
          <div class="form-group"><label>Account</label><input name="account" placeholder="XXXXXXXX" required /></div>
          <div class="form-group"><label>推荐人（选填）</label><input name="referrer" placeholder="推荐人ID或推荐码" /></div>
          <div class="form-group"><label><input type="checkbox" name="register" /> 注册为新账户</label></div>
          <button class="button" type="submit">继续付款</button>
        </form>
      </div>
    `
  } else {
    body = `
      <div class="section">
        <h3>步骤 4：选择付款方式</h3>
        <form action="/payment/result?status=success&orderId=OR20260708001" method="get">
          <div class="form-group"><label><input type="radio" name="payment" value="card" checked /> 信用卡支付</label></div>
          <div class="form-group"><label><input type="radio" name="payment" value="bank" /> 银行转账</label></div>
          <div class="form-group"><label><input type="radio" name="payment" value="balance" /> 余额支付</label></div>
          <button class="button" type="submit">确认租赁并支付</button>
        </form>
      </div>
    `
  }

  return c.html(
    html.layout(
      '合同签署',
      html.pageSection('合同签署流程', body),
      [{ href: '/', label: '首页' }, { href: '/login', label: '登录' }]
    )
  )
})
app.get('/contract/view', (c) => {
  const orderId = c.req.query('orderId') || 'OR20260708001'
  return c.html(
    html.layout(
      '合同查看',
      html.pageSection(
        '合同查看',
        `
          <div class="section">
            <h3>合同编号：CT20260708001</h3>
            <p>甲方：PC Rental Pty Ltd</p>
            <p>乙方：张三</p>
            <p>设备：MacBook Pro 14寸 / M4 Pro 18GB 512GB</p>
            <p>租期：2026-07-10 ~ 2026-08-10</p>
            <p>支付方式：信用卡</p>
            <p>支付状态：<span class="status online">已支付</span></p>
            <p><a class="button" href="/payment/result?status=success&orderId=${orderId}">查看支付结果</a></p>
          </div>
        `
      ),
      [{ href: '/', label: '首页' }, { href: '/login', label: '登录' }]
    )
  )
})
app.get('/payment/result', (c) => {
  const status = c.req.query('status')
  const orderId = c.req.query('orderId') || 'OR20260708001'
  const body =
    status === 'success'
      ? `
          <div class="section">
            <h3>✅ 支付成功</h3>
            <div class="card">
              <p>订单号：${orderId}</p>
              <p>设备：MacBook Pro 14寸</p>
              <p>租期：2026-07-10 ~ 2026-08-10</p>
              <p>支付方式：信用卡</p>
              <p>支付金额：¥3,200.00</p>
            </div>
            <p>您的租赁订单已创建成功！</p>
            <p><a class="button" href="/contract/view?orderId=${orderId}">查看合同</a> <a class="button secondary" href="/">返回首页</a></p>
          </div>
        `
      : `
          <div class="section">
            <h3>❌ 支付失败</h3>
            <p>支付未成功，请重试或更换付款方式。</p>
            <p>错误信息：余额不足，请选择其他付款方式。</p>
            <p><a class="button" href="/contract/sign?token=demo-token&s=4">重新支付</a> <a class="button secondary" href="/">返回首页</a></p>
          </div>
        `
  return c.html(html.layout('支付结果', html.pageSection('支付结果', body), [{ href: '/', label: '首页' }, { href: '/login', label: '登录' }]))
})

export default app
