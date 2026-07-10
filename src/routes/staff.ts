import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) => c.html(html.layout('员工仪表盘', '<h2>员工仪表盘（占位）</h2>')))
app.get('/orders/pending', (c) => c.html(html.layout('待处理订单', '<h2>待处理订单（占位）</h2>')))
app.get('/orders/:id', (c) => c.html(html.layout('订单详情', `<h2>订单 ${c.req.param('id')}（占位）</h2>`)))

export default app
