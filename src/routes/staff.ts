import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) =>
  c.html(
    html.layout(
      '员工仪表盘',
      html.pageSection(
        '工作台概览',
        `
          <div class="grid">
            <div class="card"><strong>待处理订单</strong><p>5 笔</p></div>
            <div class="card"><strong>待签署</strong><p>3 份</p></div>
            <div class="card"><strong>待审核付款</strong><p>2 笔</p></div>
            <div class="card"><strong>今日归还</strong><p>3 台</p></div>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>待处理订单列表</h3>
            <table>
              <thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr><td>OR001</td><td>张三</td><td>MBP14</td><td><span class="status pending">待确认</span></td><td><a class="button" href="/staff/orders/OR001">确认</a></td></tr>
                <tr><td>OR002</td><td>李四</td><td>XPS13</td><td><span class="status pending">待确认</span></td><td><a class="button" href="/staff/orders/OR002">确认</a></td></tr>
              </tbody>
            </table>
          </div>
        `
      ),
      [
        { href: '/staff/orders/pending', label: '待处理订单' },
        { href: '/staff/dashboard', label: '员工仪表盘' },
      ]
    )
  )
)

app.get('/orders/pending', (c) =>
  c.html(
    html.layout(
      '待处理订单',
      html.pageSection(
        '待处理订单',
        `
          <div class="section">
            <h3>筛选</h3>
            <div class="grid">
              <div class="card"><p>全部</p></div>
              <div class="card"><p>日期</p></div>
            </div>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>订单列表</h3>
            <div class="card">
              <p>订单号：OR20260708001</p>
              <p>客户：张三</p>
              <p>设备：MacBook Pro 14寸</p>
              <p>租期：2026-07-10 ~ 2026-08-10</p>
              <p>状态：<span class="status pending">待确认</span></p>
              <p><a class="button" href="/staff/orders/OR20260708001">设备出库登记</a></p>
            </div>
            <div class="card" style="margin-top:16px;">
              <p>订单号：OR20260708002</p>
              <p>客户：李四</p>
              <p>设备：Dell XPS 13</p>
              <p>租期：2026-07-12 ~ 2026-07-26</p>
              <p>状态：<span class="status pending">待确认</span></p>
              <p><a class="button" href="/staff/orders/OR20260708002">设备出库登记</a></p>
            </div>
          </div>
        `
      ),
      [
        { href: '/staff/dashboard', label: '员工仪表盘' },
        { href: '/staff/orders/pending', label: '待处理订单' },
      ]
    )
  )
)

app.get('/orders/:id', (c) =>
  c.html(
    html.layout(
      '订单详情',
      html.pageSection(
        `订单详情 #${c.req.param('id')}`,
        `
          <div class="card">
            <p><strong>客户信息</strong></p>
            <p>姓名：张三</p>
            <p>邮箱：zha****@xx.com</p>
            <p>电话：138******</p>
            <p>BSB：***-***</p>
            <p>Account：******78</p>
          </div>
          <div class="card" style="margin-top:16px;">
            <p><strong>租赁信息</strong></p>
            <p>设备：MacBook Pro 14寸</p>
            <p>租期：2026-07-10 ~ 2026-08-10 (30天)</p>
            <p>租金：¥1,200.00 押金：¥2,000.00</p>
            <p>支付方式：信用卡  状态：<span class="status online">租赁中</span></p>
          </div>
        `
      ),
      [
        { href: '/staff/dashboard', label: '员工仪表盘' },
        { href: '/staff/orders/pending', label: '待处理订单' },
      ]
    )
  )
)

export default app
