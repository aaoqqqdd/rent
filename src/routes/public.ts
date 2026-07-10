import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/', (c) => c.html(html.layout('首页', html.home())))
app.get('/login', (c) => c.html(html.layout('登录', html.login())))
app.get('/register', (c) => c.html(html.layout('注册', html.register())))
app.get('/forgot-password', (c) => c.html(html.layout('找回密码', '<h2>找回密码</h2><p>请输入注册邮箱发送重置邮件。</p>')))
app.get('/contract/sign', (c) => c.html(html.layout('合同签署', '<h2>合同签署占位页</h2>')))
app.get('/contract/view', (c) => c.html(html.layout('合同查看', '<h2>合同查看占位页</h2>')))
app.get('/payment/result', (c) => c.html(html.layout('支付结果', '<h2>支付结果占位页</h2>')))

export default app
