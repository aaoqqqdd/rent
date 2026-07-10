import { buildLayout, findUserBySession, getOrderById, getOrdersForUser, getContractById, getDeviceById, getPendingOrders, formatCurrency, formatDate, users, devices, orders, contracts } from './site'

export function renderHome(user: any) {
  const body = `
    <div class="panel hero">
      <h2>欢迎来到电脑租赁管理系统</h2>
      <p>面向顾客、员工、管理员的一体化租赁管理平台。</p>
      <div class="grid grid-3">
        <div class="card"><h3>公开入口</h3><p>登录、注册、合同签署、支付结果页面。</p></div>
        <div class="card"><h3>顾客入口</h3><p>查看我的租赁、我的订单、个人信息、推荐收益。</p></div>
        <div class="card"><h3>员工入口</h3><p>待处理订单、合同管理、租赁进度、设备状态。</p></div>
      </div>
    </div>
    <div class="panel">
      <h3>示例设备</h3>
      <table class="table"><thead><tr><th>设备</th><th>型号</th><th>日租金</th><th>押金</th><th>状态</th></tr></thead><tbody>
        ${devices.map((device) => `<tr><td>${device.name}</td><td>${device.model}</td><td>${formatCurrency(device.pricePerDay)}</td><td>${formatCurrency(device.depositAmount)}</td><td>${device.status}</td></tr>`).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('首页 - 电脑租赁管理系统', body, user)
}

export function renderLogin(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel login-box" style="width: 400px;">
        <h2>登录</h2>
        ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
        <form method="POST" action="/login">
          <label class="form-label">账号（邮箱/用户名）</label>
          <input class="form-control" name="account" placeholder="请输入邮箱或用户名" />
          <label class="form-label">密码</label>
          <input class="form-control" type="password" name="password" placeholder="请输入密码" />
          <button class="button" type="submit">登录</button>
        </form>
        <div class="auth-notice">
          <strong>测试账号</strong>
          <ul>
            <li>管理员：admin@example.com / Admin123</li>
            <li>员工：staff@example.com / Staff123</li>
            <li>顾客：customer@example.com / Customer123</li>
          </ul>
        </div>
        <p class="text-muted">没有账号？<a class="link-button" href="/register">注册</a> | <a class="link-button" href="/forgot-password">忘记密码？</a></p>
      </div>
    </div>
  `
  return buildLayout('登录 - 电脑租赁管理系统', body)
}

export function renderRegister(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 600px;">
        <h2>注册</h2>
        ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
        <form method="POST" action="/register">
          <div class="grid grid-2">
            <div>
              <label class="form-label">姓名</label>
              <input class="form-control" name="name" placeholder="请输入姓名" />
            </div>
            <div>
              <label class="form-label">邮箱</label>
              <input class="form-control" type="email" name="email" placeholder="请输入邮箱" />
            </div>
          </div>
          <div class="grid grid-2">
            <div>
              <label class="form-label">密码</label>
              <input class="form-control" type="password" name="password" placeholder="至少8位，包含字母和数字" />
            </div>
            <div>
              <label class="form-label">确认密码</label>
              <input class="form-control" type="password" name="passwordConfirm" placeholder="请再次输入密码" />
            </div>
          </div>
          <div>
            <label class="form-label">推荐人（选填）</label>
            <input class="form-control" name="referrer" placeholder="填写推荐人ID或推荐码" />
          </div>
          <button class="button" type="submit">注册</button>
        </form>
        <p class="text-muted">已有账号？<a class="link-button" href="/login">登录</a></p>
      </div>
    </div>
  `
  return buildLayout('注册 - 电脑租赁管理系统', body)
}

export function renderCustomerDashboard(user: any) {
  const orders = getOrdersForUser(user.id)
  const currentRentals = orders.filter((order) => order.status === 'active' || order.status === 'paid')
  const pendingPayment = orders.filter((order) => order.status === 'pending_payment').length
  const cards = `
    <div class="grid grid-3">
      <div class="card"><h3>当前租赁</h3><p>${currentRentals.length} 台</p></div>
      <div class="card"><h3>待付款</h3><p>${pendingPayment} 笔</p></div>
      <div class="card"><h3>当前余额</h3><p>${formatCurrency(user.balance)}</p></div>
    </div>
  `
  const upcoming = currentRentals.length > 0 ? `
    <div class="card"><h3>即将到期提醒</h3><p>${currentRentals[0].orderNo} 将于 3 天后到期</p><p><a class="link-button" href="/customer/rentals">续租申请</a> <a class="link-button" href="/customer/rentals">提前归还</a></p></div>` : ''
  const body = `
    <div class="panel hero">
      <h2>欢迎回来，${user.name}！</h2>
      <p>这是您的顾客控制中心。</p>
    </div>
    ${cards}
    <div class="panel">
      ${upcoming}
    </div>
    <div class="panel">
      <h3>我的订单</h3>
      <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${orders.map((order) => {
          const device = getDeviceById(order.deviceId)
          return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('顾客仪表盘 - 电脑租赁管理系统', body, user)
}

export function renderCustomerOrders(user: any) {
  const orders = getOrdersForUser(user.id)
  const body = `
    <div class="panel">
      <h2>我的订单</h2>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${orders.map((order) => {
            const device = getDeviceById(order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('我的订单 - 电脑租赁管理系统', body, user)
}

export function renderCustomerRentals(user: any) {
  const orders = getOrdersForUser(user.id)
  const activeRentals = orders.filter((order) => order.status === 'paid' || order.status === 'active')
  const history = orders.filter((order) => order.status === 'completed' || order.status === 'cancelled')
  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的租赁</h2><span class="section-note">当前租赁、历史记录、续租与提前归还入口。</span></div>
      <div class="section-title"><h3>当前租赁中</h3></div>
      ${activeRentals.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>设备</th><th>租期</th><th>租金</th><th>押金</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${activeRentals.map((order) => {
              const device = getDeviceById(order.deviceId)
              return `<tr><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount - order.depositAmount)}</td><td>${formatCurrency(order.depositAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">详情</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>当前没有租赁中的设备。</p>'}
      <div class="section-title" style="margin-top:24px;"><h3>租赁历史</h3></div>
      ${history.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>设备</th><th>租期</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${history.map((order) => {
              const device = getDeviceById(order.deviceId)
              return `<tr><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>暂无历史租赁记录。</p>'}
    </div>
  `
  return buildLayout('我的租赁 - 电脑租赁管理系统', body, user)
}

export function renderCustomerProfile(user: any, message?: string, type: 'success' | 'error' = 'error') {
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>个人信息管理</h2><span class="section-note">编辑您的基本资料和支付账户信息。</span></div>
      ${alertMessage}
      <form method="POST" action="/customer/profile">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${user.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${user.email}" readonly />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${user.phone ?? ''}" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${user.bsb ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${user.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">推荐码</label>
            <input class="form-control" name="referralCode" value="${user.referralCode ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" name="password" placeholder="留空则保持原密码" />
          </div>
          <div>
            <label class="form-label">确认新密码</label>
            <input class="form-control" type="password" name="passwordConfirm" placeholder="再次输入新密码" />
          </div>
        </div>
        <div style="margin-top:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button class="button" type="submit">保存修改</button>
          <span class="section-note">密码为空时，不会修改当前密码。</span>
        </div>
      </form>
    </div>
  `
  return buildLayout('个人信息 - 电脑租赁管理系统', body, user)
}

export function renderCustomerReferral(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的推荐</h2><span class="section-note">管理推荐码、查看佣金和提现记录。</span></div>
      <div class="grid grid-2">
        <div class="card"><h3>我的推荐码</h3><p>${user.referralCode ?? '暂无推荐码'}</p><button class="button-secondary" type="button">复制推荐码</button></div>
        <div class="card"><h3>佣金统计</h3><p>累计佣金：${formatCurrency(user.commissionBalance)}</p><p>待结算：${formatCurrency(0)}</p><p>已提现：${formatCurrency(0)}</p></div>
      </div>
      <div class="panel" style="margin-top:24px;">
        <h3>已推荐好友</h3>
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>姓名</th><th>注册时间</th><th>状态</th><th>佣金</th></tr></thead><tbody>
            <tr><td>李四</td><td>2026-07-01</td><td>已租</td><td>${formatCurrency(150)}</td></tr>
            <tr><td>王五</td><td>2026-07-05</td><td>待租</td><td>${formatCurrency(0)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="panel" style="margin-top:24px;"><a class="button" href="/customer/referral/withdraw">佣金提现</a></div>
    </div>
  `
  return buildLayout('我的推荐 - 电脑租赁管理系统', body, user)
}

export function renderCustomerReferralWithdraw(user: any, message?: string) {
  const alertMessage = message ? `<div class="alert">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>佣金提现</h2><span class="section-note">请输入提现信息，发起佣金提现申请。</span></div>
      ${alertMessage}
      <div class="card">
        <h3>可提现余额</h3>
        <p>${formatCurrency(user.commissionBalance)}</p>
      </div>
      <form method="POST" action="/customer/referral/withdraw">
        <div class="grid grid-2">
          <div>
            <label class="form-label">提现金额</label>
            <input class="form-control" name="amount" placeholder="输入提现金额" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${user.bsb ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${user.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">备注</label>
            <input class="form-control" name="note" placeholder="选填：提现说明" />
          </div>
        </div>
        <button class="button" type="submit">提现</button>
      </form>
      <div class="panel" style="margin-top:24px;">
        <h3>提现记录</h3>
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>时间</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr><td>2026-07-01</td><td>${formatCurrency(100)}</td><td>已完成</td><td><a class="link-button" href="#">查看</a></td></tr>
            <tr><td>2026-06-15</td><td>${formatCurrency(50)}</td><td>处理中</td><td><a class="link-button" href="#">查看</a></td></tr>
          </tbody></table>
        </div>
      </div>
    </div>
  `
  return buildLayout('佣金提现 - 电脑租赁管理系统', body, user)
}

export function renderCustomerSecurity(user: any, message?: string, type: 'success' | 'error' = 'error') {
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>安全设置</h2><span class="section-note">修改登录密码并查看最近登录记录。</span></div>
      ${alertMessage}
      <form method="POST" action="/customer/security">
        <div class="grid grid-2">
          <div>
            <label class="form-label">当前密码</label>
            <input class="form-control" type="password" name="currentPassword" placeholder="请输入当前密码" />
          </div>
          <div>
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" name="newPassword" placeholder="至少8位，包含字母和数字" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">确认新密码</label>
            <input class="form-control" type="password" name="confirmPassword" placeholder="请再次输入新密码" />
          </div>
        </div>
        <button class="button" type="submit">修改密码</button>
      </form>
      <div class="panel" style="margin-top:24px;">
        <h3>登录记录</h3>
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>时间</th><th>IP地址</th><th>设备</th></tr></thead><tbody>
            <tr><td>2026-07-10 14:30:25</td><td>192.168.1.100</td><td>Chrome</td></tr>
            <tr><td>2026-07-09 09:15:30</td><td>192.168.1.101</td><td>Safari</td></tr>
          </tbody></table>
        </div>
      </div>
    </div>
  `
  return buildLayout('安全设置 - 电脑租赁管理系统', body, user)
}


export function renderStaffContractNew(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>创建租赁合同</h2><span class="section-note">选择设备、设置租期与押金，生成签署链接。</span></div>
      <form method="POST" action="/staff/contract/new">
        <div class="grid grid-2">
          <div>
            <label class="form-label">选择设备</label>
            <select class="form-control" name="deviceId">
              ${devices.map((device) => `<option value="${device.id}">${device.name} (${device.model})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">租赁开始日期</label>
            <input class="form-control" type="date" name="startDate" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">租赁结束日期</label>
            <input class="form-control" type="date" name="endDate" />
          </div>
          <div>
            <label class="form-label">押金金额</label>
            <input class="form-control" name="depositAmount" placeholder="请输入押金金额" />
          </div>
        </div>
        <div>
          <label class="form-label">备注</label>
          <textarea class="form-control" name="notes" rows="3" placeholder="合同备注内容"></textarea>
        </div>
        <button class="button" type="submit">生成签署链接</button>
      </form>
    </div>
  `
  return buildLayout('创建合同 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffContractProgress(user: any, contractId: string) {
  const contract = getContractById(contractId)
  if (!contract) {
    return buildLayout('合同不存在 - 员工 - 电脑租赁管理系统', `<div class="panel"><h2>合同不存在</h2></div>`, user)
  }
  const order = getOrderById(contract.rentalId)
  const progress = contract.status === 'signed' ? '已签署' : contract.status === 'pending_sign' ? '待签署' : '草稿'
  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同签署进度</h2><span class="section-note">查看合同签署状态与签署链接。</span></div>
      <div class="card"><h3>合同编号：${contract.contractNumber}</h3><p>设备：${order ? getDeviceById(order.deviceId)?.name ?? '' : '未知'}</p><p>租期：${order ? `${order.startDate} ~ ${order.endDate}` : '-'}</p><p>签署状态：${progress}</p></div>
      <div class="panel">
        <h3>签署详情</h3>
        <p>签署人：${contract.status === 'signed' ? '张三' : '待签署'}</p>
        <p>签署时间：${contract.signedAt ?? '-'}</p>
        <p>签署链接：/contract/sign?token=example-token</p>
        <div style="margin-top:16px;"><a class="button" href="/contract/sign?token=example-token">查看签署页面</a> <a class="button-secondary" href="/staff/contracts">返回合同列表</a></div>
      </div>
    </div>
  `
  return buildLayout('合同签署进度 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffContractView(user: any, orderId: string) {
  const order = getOrderById(orderId)
  const contract = order ? getContractById(order.contractId) : undefined
  const device = order ? getDeviceById(order.deviceId) : undefined
  if (!order || !contract || !device) {
    return buildLayout('合同不存在 - 员工 - 电脑租赁管理系统', `<div class="panel"><h2>合同或订单不存在</h2></div>`, user)
  }
  const customer = users.find((item) => item.id === order.userId)
  const body = `
    <div class="panel">
      <h2>合同查看</h2>
      <p>合同编号：${contract.contractNumber}</p>
      <pre style="white-space: pre-wrap;">${contract.content}</pre>
      <div class="panel"><h3>签署信息</h3><p>签署人：${customer?.name ?? '未知'}</p><p>签署时间：${contract.signedAt ?? '未签署'}</p><p>客户邮箱：${customer?.email ?? '-'}</p></div>
      <div style="margin-top:16px;"><a class="button-secondary" href="/staff/contracts">返回列表</a></div>
    </div>
  `
  return buildLayout('合同查看 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderAdminOrderDetails(user: any, orderId: string) {
  const order = getOrderById(orderId)
  if (!order) {
    return buildLayout('订单不存在 - 管理员 - 电脑租赁管理系统', `<div class="panel"><h2>订单不存在</h2></div>`, user)
  }
  const customer = users.find((item) => item.id === order.userId)
  const device = getDeviceById(order.deviceId)
  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单详情 #${order.orderNo}</h2><span class="section-note">管理员查看完整客户和财务信息。</span></div>
      <div class="grid grid-2">
        <div class="card"><h3>客户信息</h3><p>姓名：${customer?.name ?? ''}</p><p>邮箱：${customer?.email ?? ''}</p><p>电话：${customer?.phone ?? '-'}</p><p>BSB：${customer?.bsb ?? '-'}</p><p>Account：${customer?.account ?? '-'}</p></div>
        <div class="card"><h3>租赁信息</h3><p>设备：${device?.name ?? ''}</p><p>租期：${order.startDate} ~ ${order.endDate}</p><p>租金：${formatCurrency(order.totalAmount - order.depositAmount)}</p><p>押金：${formatCurrency(order.depositAmount)}</p><p>状态：${order.status}</p></div>
      </div>
      <div class="panel"><h3>操作</h3><button class="button-secondary" type="button">变更状态</button> <button class="button-secondary" type="button">退款处理</button></div>
      <div style="margin-top:16px;"><a class="button-secondary" href="/admin/orders">返回列表</a></div>
    </div>
  `
  return buildLayout('订单详情 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminContractDetails(user: any, contractId: string) {
  const contract = getContractById(contractId)
  if (!contract) {
    return buildLayout('合同不存在 - 管理员 - 电脑租赁管理系统', `<div class="panel"><h2>合同不存在</h2></div>`, user)
  }
  const order = getOrderById(contract.rentalId)
  const customer = order ? users.find((item) => item.id === order.userId) : undefined
  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同详情</h2><span class="section-note">管理员可查看完整合同与客户结算信息。</span></div>
      <div class="card"><h3>合同编号：${contract.contractNumber}</h3><p>状态：${contract.status}</p><p>签署时间：${contract.signedAt ?? '-'}</p></div>
      <div class="panel"><h3>合同内容</h3><pre style="white-space: pre-wrap;">${contract.content}</pre></div>
      <div class="panel"><h3>客户信息</h3><p>姓名：${customer?.name ?? '-'}</p><p>邮箱：${customer?.email ?? '-'}</p><p>电话：${customer?.phone ?? '-'}</p><p>BSB：${customer?.bsb ?? '-'}</p><p>Account：${customer?.account ?? '-'}</p></div>
      <div style="margin-top:16px;"><a class="button-secondary" href="/admin/contracts">返回列表</a></div>
    </div>
  `
  return buildLayout('合同详情 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderCustomerOrderDetails(user: any, orderId: string) {
  const order = getOrderById(orderId)
  if (!order || order.userId !== user.id) {
    return buildLayout('订单不存在 - 电脑租赁管理系统', `<div class="panel"><h2>订单不存在或无权限查看</h2></div>`, user)
  }
  const device = getDeviceById(order.deviceId)
  const contract = getContractById(order.contractId)
  const body = `
    <div class="panel">
      <h2>订单详情 #${order.orderNo}</h2>
      <div class="grid grid-2">
        <div class="card"><h3>设备信息</h3><p>${device?.name}</p><p>${device?.model}</p></div>
        <div class="card"><h3>租赁信息</h3><p>租期：${order.startDate} ~ ${order.endDate}</p><p>状态：${order.status}</p></div>
      </div>
      <div class="panel">
        <h3>支付信息</h3>
        <p>支付方式：${order.paymentMethod}</p>
        <p>租金：${formatCurrency(order.totalAmount - order.depositAmount)}</p>
        <p>押金：${formatCurrency(order.depositAmount)}</p>
      </div>
      <div class="panel">
        <h3>合同信息</h3>
        <p>合同编号：${contract?.contractNumber ?? '无'}</p>
        <p>签署时间：${contract?.signedAt ?? '未签署'}</p>
        <a class="link-button" href="/contract/view?orderId=${order.id}">查看合同</a>
      </div>
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}

export function renderContractSign(token?: string, currentUser?: any) {
  const order = orders[0]
  const contract = getContractById(order.contractId)
  const device = getDeviceById(order.deviceId)
  const name = currentUser?.name ?? '张三'
  const email = currentUser?.email ?? 'customer@example.com'
  const bsb = currentUser?.bsb ?? '062-000'
  const account = currentUser?.account ?? '12345678'
  const body = `
    <div class="panel">
      <h2>租赁合同签署</h2>
      <p>合同编号：${contract?.contractNumber}</p>
      <pre style="white-space: pre-wrap;">${contract?.content}</pre>
      <form method="POST" action="/contract/sign">
        <div>
          <label class="form-label">姓名</label>
          <input class="form-control" name="name" value="${name}" />
        </div>
        <div>
          <label class="form-label">邮箱</label>
          <input class="form-control" name="email" value="${email}" />
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${bsb}" />
          </div>
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${account}" />
          </div>
        </div>
        <div>
          <label><input type="checkbox" name="agree" /> 我已阅读并同意以上租赁协议条款</label>
        </div>
        <button class="button" type="submit">确认租赁并支付</button>
      </form>
    </div>
  `
  return buildLayout('合同签署 - 电脑租赁管理系统', body)
}

export function renderContractView(orderId: string, currentUser?: any) {
  const order = getOrderById(orderId)
  const contract = order ? getContractById(order.contractId) : undefined
  const device = order ? getDeviceById(order.deviceId) : undefined
  const customer = order ? users.find((item) => item.id === order.userId) : undefined
  if (!order || !contract || !device) {
    return buildLayout('合同不存在 - 电脑租赁管理系统', `<div class="panel"><h2>合同或订单不存在</h2></div>`, currentUser)
  }
  const signer = currentUser?.name ?? customer?.name ?? '匿名'
  const signerEmail = currentUser?.email ?? customer?.email ?? '-'
  const body = `
    <div class="panel">
      <h2>租赁合同</h2>
      <p>合同编号：${contract.contractNumber}</p>
      <pre style="white-space: pre-wrap;">${contract.content}</pre>
      <div class="panel">
        <h3>签署信息</h3>
        <p>签署人：${signer}</p>
        <p>签署邮箱：${signerEmail}</p>
        <p>签署时间：${contract.signedAt ?? '未签署'}</p>
        <p>IP地址：192.168.1.100</p>
      </div>
      <div>
        <a class="button" href="/payment/result?status=success&orderId=${order.id}">查看支付结果</a>
      </div>
    </div>
  `
  return buildLayout('合同查看 - 电脑租赁管理系统', body, currentUser)
}

export function renderPaymentResult(status: string, orderId: string) {
  const order = getOrderById(orderId)
  const device = order ? getDeviceById(order.deviceId) : undefined
  const success = status === 'success'
  const body = `
    <div class="panel">
      <h2>${success ? '✅ 支付成功' : '❌ 支付失败'}</h2>
      ${success ? `
        <div class="card"><p>订单号：${order?.orderNo}</p><p>设备：${device?.name}</p><p>租期：${order?.startDate} ~ ${order?.endDate}</p><p>支付方式：${order?.paymentMethod}</p><p>支付金额：${order ? formatCurrency(order.totalAmount) : ''}</p></div>
        <p>您的租赁订单已创建成功！</p>
        <div><a class="button" href="/contract/view?orderId=${order?.id}">查看合同</a> <a class="button-secondary" href="/">返回首页</a></div>
      ` : `
        <div class="card"><p>支付未成功，请重试或更换付款方式。</p><p>错误信息：余额不足，请选择其他付款方式</p></div>
        <div><a class="button" href="/">重新支付</a> <a class="button-secondary" href="/">返回首页</a></div>
      `}
    </div>
  `
  return buildLayout(success ? '支付成功 - 电脑租赁管理系统' : '支付失败 - 电脑租赁管理系统', body)
}

export function renderStaffDashboard(user: any) {
  const pending = getPendingOrders()
  const body = `
    <div class="panel hero">
      <div>
        <h2>员工工作台</h2>
        <p>查看待处理订单、合同审批、租赁进度等核心任务。</p>
      </div>
      <div class="hero-card-grid">
        <div class="card"><h3>待处理订单</h3><p>${pending.length} 笔</p></div>
        <div class="card"><h3>待签署合同</h3><p>1 份</p></div>
        <div class="card"><h3>今日归还</h3><p>3 台</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="section-title"><h2>待处理订单</h2><a class="button-secondary" href="/staff/orders/pending">查看全部</a></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${pending.map((order) => {
            const customer = users.find((item) => item.id === order.userId)
            const device = getDeviceById(order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('员工仪表盘 - 电脑租赁管理系统', body, user)
}

export function renderStaffOrdersPending(user: any) {
  const pending = getPendingOrders()
  const body = `
    <div class="panel">
      <div class="section-title"><h2>待处理订单</h2><span class="section-note">按订单状态筛选、登记出库、处理客户信息</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${pending.map((order) => {
            const customer = users.find((item) => item.id === order.userId)
            const device = getDeviceById(order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">订单详情</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('待处理订单 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffContracts(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同管理</h2><span class="section-note">查看签署状态，审核合同内容，下载 PDF。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>合同编号</th><th>订单号</th><th>客户</th><th>状态</th><th>签署时间</th><th>操作</th></tr></thead><tbody>
          ${contracts.map((contract) => {
            const order = getOrderById(contract.rentalId)
            const customer = order ? users.find((item) => item.id === order.userId) : undefined
            return `<tr><td>${contract.contractNumber}</td><td>${order?.orderNo ?? ''}</td><td>${customer?.name ?? ''}</td><td>${contract.status}</td><td>${contract.signedAt ?? '-'}</td><td><a class="link-button" href="/contract/view?orderId=${order?.id}">查看</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('合同管理 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffRentalsTracking(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁进度管理</h2><span class="section-note">跟踪租赁状态、到期提醒、押金退还流程。</span></div>
      <div class="grid grid-2">
        <div class="card"><h3>当前追踪</h3><p>正在租赁中订单：1</p><p>逾期订单：0</p></div>
        <div class="card"><h3>今日提醒</h3><p>3 台设备预计到期</p></div>
      </div>
      <div class="table-wrapper" style="margin-top: 18px;">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>状态</th></tr></thead><tbody>
          ${orders.map((order) => {
            const customer = users.find((item) => item.id === order.userId)
            const device = getDeviceById(order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('租赁进度管理 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffDevices(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备状态查看</h2><span class="section-note">查看设备库存与维修状态。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>设备</th><th>型号</th><th>日租金</th><th>押金</th><th>状态</th></tr></thead><tbody>
          ${devices.map((device) => `<tr><td>${device.name}</td><td>${device.model}</td><td>${formatCurrency(device.pricePerDay)}</td><td>${formatCurrency(device.depositAmount)}</td><td>${device.status}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('设备状态 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderStaffOrderDetails(user: any, orderId: string) {
  const order = getOrderById(orderId)
  if (!order) {
    return buildLayout('订单不存在 - 电脑租赁管理系统', `<div class="panel"><h2>订单不存在</h2></div>`, user)
  }
  const customer = users.find((item) => item.id === order.userId)
  const device = getDeviceById(order.deviceId)
  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单详情 #${order.orderNo}</h2><a class="button-secondary" href="/staff/orders/pending">返回列表</a></div>
      <div class="grid grid-2">
        <div class="card"><h3>客户信息</h3><p>姓名：${customer?.name}</p><p>邮箱：${customer?.email}</p><p>电话：${customer?.phone ?? '-'}</p><p>BSB：***-***</p><p>Account：******78</p></div>
        <div class="card"><h3>租赁信息</h3><p>设备：${device?.name}</p><p>租期：${order.startDate} ~ ${order.endDate}</p><p>租金：${formatCurrency(order.totalAmount - order.depositAmount)}</p><p>押金：${formatCurrency(order.depositAmount)}</p><p>状态：${order.status}</p></div>
      </div>
      <div class="panel"><h3>押金状态</h3><p>押金总额：${formatCurrency(order.depositAmount)}</p><p>已退金额：¥0.00</p><p>待退金额：${formatCurrency(order.depositAmount)}</p><button class="button">退回押金</button></div>
    </div>
  `
  return buildLayout('订单详情 - 员工 - 电脑租赁管理系统', body, user)
}

export function renderAdminDashboard(user: any) {
  const customerCount = users.filter((item) => item.role === 'CUSTOMER').length
  const staffCount = users.filter((item) => item.role === 'STAFF').length
  const body = `
    <div class="panel hero">
      <div>
        <h2>管理员仪表盘</h2>
        <p>系统总览：用户、订单、合同、设备管理一站式查看。</p>
      </div>
      <div class="hero-card-grid">
        <div class="card"><h3>客户用户</h3><p>${customerCount} 人</p></div>
        <div class="card"><h3>员工用户</h3><p>${staffCount} 人</p></div>
        <div class="card"><h3>总订单</h3><p>${orders.length} 笔</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="section-title"><h2>快速入口</h2></div>
      <div class="grid grid-3">
        <a class="card link-button" href="/admin/users">用户管理</a>
        <a class="card link-button" href="/admin/orders">订单管理</a>
        <a class="card link-button" href="/admin/contracts">合同管理</a>
      </div>
    </div>
  `
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user)
}

export function renderAdminUsers(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>用户管理</h2><span class="section-note">查看并管理管理员、员工、顾客账户。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>姓名</th><th>邮箱</th><th>账号</th><th>角色</th><th>余额</th><th>佣金</th></tr></thead><tbody>
          ${users.map((item) => `<tr><td>${item.name}</td><td>${item.email}</td><td>${item.email}</td><td>${item.role}</td><td>${formatCurrency(item.balance)}</td><td>${formatCurrency(item.commissionBalance)}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('用户管理 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminOrders(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单管理</h2><span class="section-note">筛选、状态变更、退款处理。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>金额</th><th>状态</th></tr></thead><tbody>
          ${orders.map((order) => {
            const customer = users.find((item) => item.id === order.userId)
            const device = getDeviceById(order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('订单管理 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminContracts(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同管理</h2><span class="section-note">维护合同模板、签署状态、合同归档。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>合同编号</th><th>订单号</th><th>客户</th><th>状态</th><th>签署时间</th><th>操作</th></tr></thead><tbody>
          ${contracts.map((contract) => {
            const order = getOrderById(contract.rentalId)
            const customer = order ? users.find((item) => item.id === order.userId) : undefined
            return `<tr><td>${contract.contractNumber}</td><td>${order?.orderNo ?? ''}</td><td>${customer?.name ?? ''}</td><td>${contract.status}</td><td>${contract.signedAt ?? '-'}</td><td><a class="link-button" href="/admin/contracts/${contract.id}">查看</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('合同管理 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminFinance(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>财务管理</h2><span class="section-note">收入、支出、对账与佣金记录。</span></div>
      <div class="grid grid-3">
        <div class="card"><h3>总收入</h3><p>${formatCurrency(orders.reduce((sum, order) => sum + order.totalAmount, 0))}</p></div>
        <div class="card"><h3>押金总额</h3><p>${formatCurrency(orders.reduce((sum, order) => sum + order.depositAmount, 0))}</p></div>
        <div class="card"><h3>未结清订单</h3><p>${orders.filter((order) => order.status === 'pending_payment').length} 笔</p></div>
      </div>
    </div>
  `
  return buildLayout('财务管理 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminDevices(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备管理</h2><span class="section-note">设备库存、状态、维修记录。</span></div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>设备</th><th>型号</th><th>日租金</th><th>押金</th><th>状态</th></tr></thead><tbody>
          ${devices.map((device) => `<tr><td>${device.name}</td><td>${device.model}</td><td>${formatCurrency(device.pricePerDay)}</td><td>${formatCurrency(device.depositAmount)}</td><td>${device.status}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('设备管理 - 管理员 - 电脑租赁管理系统', body, user)
}

export function renderAdminSettings(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">租赁条款、支付方式、推荐规则配置。</span></div>
      <div class="card"><h3>系统参数</h3><p>默认推荐分成：25%</p><p>推荐层级：1级</p><p>结算周期：每月</p></div>
    </div>
  `
  return buildLayout('系统设置 - 管理员 - 电脑租赁管理系统', body, user)
}

export function render404() {
  const body = `
    <div class="panel">
      <h2>404 页面未找到</h2>
      <p>您访问的页面不存在。</p>
      <a class="button" href="/">返回首页</a>
    </div>
  `
  return buildLayout('404 - 电脑租赁管理系统', body)
}