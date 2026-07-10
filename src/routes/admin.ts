import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) => c.html(html.layout('管理员仪表盘', '<h2>管理员仪表盘（占位）</h2>')))
app.get('/users', (c) => c.html(html.layout('用户管理', '<h2>用户管理（占位）</h2>')))
app.get('/orders', (c) => c.html(html.layout('订单管理', '<h2>订单管理（占位）</h2>')))

export default app
