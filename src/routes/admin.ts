import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) =>
  c.html(
    html.layout(
      '管理员仪表盘',
      html.pageSection(
        '数据总览',
        `
          <div class="grid">
            <div class="card"><strong>今日订单</strong><p>24 笔</p></div>
            <div class="card"><strong>营收总额</strong><p>¥152,400</p></div>
            <div class="card"><strong>出租率</strong><p>82%</p></div>
            <div class="card"><strong>待处理事项</strong><p>8 项</p></div>
          </div>
        `
      ),
      [
        { href: '/admin/users', label: '用户管理' },
        { href: '/admin/orders', label: '订单管理' },
      ]
    )
  )
)

app.get('/users', (c) =>
  c.html(
    html.layout(
      '用户管理',
      html.pageSection(
        '用户管理',
        `
          <div class="card">
            <p>管理员可以查看所有用户、配置推荐分成、启用/禁用账号。</p>
          </div>
          <table style="margin-top:24px;">
            <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>推荐分成</th></tr></thead>
            <tbody>
              <tr><td>张三</td><td>顾客</td><td>Active</td><td>25%</td></tr>
              <tr><td>王经理</td><td>员工</td><td>Active</td><td>25%</td></tr>
            </tbody>
          </table>
        `
      ),
      [
        { href: '/admin/dashboard', label: '仪表盘' },
        { href: '/admin/orders', label: '订单管理' },
      ]
    )
  )
)

app.get('/orders', (c) =>
  c.html(
    html.layout(
      '订单管理',
      html.pageSection(
        '订单管理',
        `
          <div class="card">
            <p>管理员可浏览订单列表、执行退款、导出报表。</p>
          </div>
          <table style="margin-top:24px;">
            <thead><tr><th>订单号</th><th>客户</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr><td>OR20260708001</td><td>张三</td><td>¥3,200.00</td><td><span class="status pending">待付款</span></td><td><a class="button secondary" href="/staff/orders/OR20260708001">查看</a></td></tr>
            </tbody>
          </table>
        `
      ),
      [
        { href: '/admin/dashboard', label: '仪表盘' },
        { href: '/admin/users', label: '用户管理' },
      ]
    )
  )
)

export default app
