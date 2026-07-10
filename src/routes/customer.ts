import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) => c.html(html.layout('顾客仪表盘', '<h2>顾客仪表盘（占位）</h2>')))
app.get('/rentals', (c) => c.html(html.layout('我的租赁', '<h2>我的租赁（占位）</h2>')))
app.get('/orders', (c) => c.html(html.layout('我的订单', '<h2>我的订单（占位）</h2>')))
app.get('/profile', (c) => c.html(html.layout('个人信息', '<h2>个人信息管理（占位）</h2>')))

export default app
