import { Hono } from 'hono'
import { html } from '../templates'

const app = new Hono()

app.get('/dashboard', (c) =>
  c.html(
    html.layout(
      '顾客仪表盘',
      html.pageSection(
        '欢迎回来，张三！',
        `
        <div class="grid">
          <div class="card"><strong>当前租赁</strong><p>1 台</p></div>
          <div class="card"><strong>待付款</strong><p>0 笔</p></div>
          <div class="card"><strong>待处理</strong><p>0 项</p></div>
          <div class="card"><strong>当前余额</strong><p>¥300</p></div>
        </div>
        <div class="section" style="margin-top:24px;"><h3>即将到期提醒</h3><p>您租赁的 MacBook Pro 14寸 将于 3 天后到期。</p><p><a class="button" href="/customer/rentals">续租申请</a> <a class="button secondary" href="/customer/rentals">提前归还</a></p></div>
      `
      ),
      [
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
        { href: '/customer/profile', label: '个人信息' },
      ]
    )
  )
)

app.get('/rentals', (c) =>
  c.html(
    html.layout(
      '我的租赁',
      html.pageSection(
        '我的租赁',
        `
          <div class="section">
            <h3>当前租赁中</h3>
            <div class="card">
              <p>设备：MacBook Pro 14寸</p>
              <p>租期：2026-07-10 ~ 2026-08-10</p>
              <p>租金：¥1,200.00 押金：¥2,000.00</p>
              <p>状态：<span class="status online">租赁中</span></p>
              <p><a class="button" href="/customer/orders">续租申请</a> <a class="button secondary" href="/customer/orders">提前归还</a> <a class="button secondary" href="/contract/view?orderId=OR20260708001">查看合同</a></p>
            </div>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>租赁历史</h3>
            <div class="card">
              <p>设备：Dell XPS 13</p>
              <p>租期：2026-06-01 ~ 2026-06-30</p>
              <p>状态：<span class="status online">已归还</span></p>
              <p><a class="button secondary" href="/customer/orders">查看详情</a> <a class="button secondary" href="/contract/view?orderId=OR20260615002">查看合同</a></p>
            </div>
          </div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/orders', label: '我的订单' },
        { href: '/customer/profile', label: '个人信息' },
      ]
    )
  )
)

app.get('/orders', (c) =>
  c.html(
    html.layout(
      '我的订单',
      html.pageSection(
        '我的订单',
        `
          <div class="section">
            <h3>订单列表</h3>
            <table>
              <thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr><td>OR20260708001</td><td>MacBook Pro 14寸</td><td>2026-07-10 ~ 2026-08-10</td><td>¥3,200.00</td><td><span class="status pending">待付款</span></td><td><a class="button" href="/payment/result?status=success&orderId=OR20260708001">立即支付</a> <a class="button secondary" href="/contract/view?orderId=OR20260708001">查看合同</a></td></tr>
                <tr><td>OR20260615002</td><td>Dell XPS 13</td><td>2026-06-01 ~ 2026-06-30</td><td>¥2,250.00</td><td><span class="status online">已完成</span></td><td><a class="button secondary" href="/contract/view?orderId=OR20260615002">查看合同</a></td></tr>
              </tbody>
            </table>
          </div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/profile', label: '个人信息' },
      ]
    )
  )
)

app.get('/security', (c) =>
  c.html(
    html.layout(
      '安全设置',
      html.pageSection(
        '安全设置',
        `
          <div class="section">
            <h3>修改密码</h3>
            <form action="#" method="post">
              <div class="form-group"><label>当前密码</label><input type="password" name="currentPassword" /></div>
              <div class="form-group"><label>新密码</label><input type="password" name="newPassword" placeholder="至少8位，包含字母和数字" /></div>
              <div class="form-group"><label>确认密码</label><input type="password" name="confirmPassword" /></div>
              <button class="button" type="submit">修改密码</button>
            </form>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>登录记录</h3>
            <table>
              <thead><tr><th>时间</th><th>IP地址</th><th>设备</th></tr></thead>
              <tbody>
                <tr><td>2026-07-10 14:30:25</td><td>192.168.1.100</td><td>Chrome</td></tr>
                <tr><td>2026-07-09 09:15:30</td><td>192.168.1.101</td><td>Safari</td></tr>
              </tbody>
            </table>
          </div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
      ]
    )
  )
)

app.get('/referral', (c) =>
  c.html(
    html.layout(
      '我的推荐',
      html.pageSection(
        '我的推荐',
        `
          <div class="card">
            <p>我的推荐码：<strong>ABC123XYZ</strong></p>
            <p><a class="button" href="#" onclick="navigator.clipboard.writeText('ABC123XYZ')">复制推荐码</a></p>
          </div>
          <div class="grid" style="margin-top:24px;">
            <div class="card"><strong>累计佣金</strong><p>¥850.00</p></div>
            <div class="card"><strong>待结算</strong><p>¥200.00</p></div>
            <div class="card"><strong>已提现</strong><p>¥650.00</p></div>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>已推荐好友</h3>
            <table>
              <thead><tr><th>姓名</th><th>注册时间</th><th>状态</th><th>佣金</th></tr></thead>
              <tbody>
                <tr><td>李四</td><td>2026-07-01</td><td>已租</td><td>¥150.00</td></tr>
                <tr><td>王五</td><td>2026-07-05</td><td>待租</td><td>¥0.00</td></tr>
              </tbody>
            </table>
          </div>
          <div style="margin-top:24px;"><a class="button" href="/customer/referral/withdraw">佣金提现</a></div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
      ]
    )
  )
)

app.get('/referral/withdraw', (c) =>
  c.html(
    html.layout(
      '佣金提现',
      html.pageSection(
        '佣金提现',
        `
          <div class="section">
            <p>可提现余额：¥200.00</p>
            <form action="#" method="post">
              <div class="form-group"><label>提现金额</label><input name="amount" placeholder="例如 100" /></div>
              <div class="form-group"><label>BSB</label><input name="bsb" placeholder="XXX-XXX" /></div>
              <div class="form-group"><label>Account</label><input name="account" placeholder="XXXXXXXX" /></div>
              <button class="button" type="submit">提现</button>
            </form>
          </div>
          <div class="section" style="margin-top:24px;">
            <h3>提现记录</h3>
            <table>
              <thead><tr><th>时间</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr><td>2026-07-01</td><td>¥100</td><td>已完成</td><td><a class="button secondary" href="#">查看</a></td></tr>
                <tr><td>2026-06-15</td><td>¥50</td><td>处理中</td><td><a class="button secondary" href="#">查看</a></td></tr>
              </tbody>
            </table>
          </div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
      ]
    )
  )
)

app.get('/devices', (c) =>
  c.html(
    html.layout(
      '设备租赁',
      html.pageSection(
        '设备租赁',
        `
          <div class="grid">
            <div class="card">
              <h3>MacBook Pro 14寸</h3>
              <p>M4 Pro 18GB 512GB</p>
              <p>日租金 ¥40.00</p>
              <p>押金 ¥2,000.00</p>
              <a class="button" href="/contract/sign?token=demo-token&s=1">立即租赁</a>
            </div>
            <div class="card">
              <h3>Dell XPS 13</h3>
              <p>Intel i7 16GB 512GB</p>
              <p>日租金 ¥35.00</p>
              <p>押金 ¥1,800.00</p>
              <a class="button secondary" href="/contract/sign?token=demo-token&s=1">立即租赁</a>
            </div>
          </div>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
      ]
    )
  )
)

app.get('/profile', (c) =>
  c.html(
    html.layout(
      '个人信息',
      html.pageSection(
        '个人信息管理',
        `
          <form action="#" method="post">
            <div class="form-group"><label>姓名</label><input name="name" value="张三" /></div>
            <div class="form-group"><label>邮箱</label><input type="email" name="email" value="zhangsan@example.com" /></div>
            <div class="form-group"><label>BSB</label><input name="bsb" value="062-000" /></div>
            <div class="form-group"><label>Account</label><input name="account" value="12345678" /></div>
            <div class="form-group"><label>推荐人</label><input name="referrer" value="ABC123XYZ" /></div>
            <button type="submit" class="button">保存修改</button>
          </form>
        `
      ),
      [
        { href: '/customer/dashboard', label: '仪表盘' },
        { href: '/customer/rentals', label: '我的租赁' },
        { href: '/customer/orders', label: '我的订单' },
      ]
    )
  )
)

export default app
