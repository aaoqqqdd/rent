import { buildLayout, findUserBySession, getOrderById, getOrdersForUser, getContractById, getDeviceById, getPendingOrders, formatCurrency, formatDate, users, devices, orders } from './site'

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
    <div class="panel">
      <h2>登录</h2>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/login">
        <label class="form-label">账号（邮箱/用户名）</label>
        <input class="form-control" name="account" placeholder="请输入邮箱或用户名" />
        <label class="form-label">密码</label>
        <input class="form-control" type="password" name="password" placeholder="请输入密码" />
        <button class="button" type="submit">登录</button>
      </form>
      <p class="text-muted">没有账号？<a class="link-button" href="/register">注册</a></p>
    </div>
  `
  return buildLayout('登录 - 电脑租赁管理系统', body)
}

export function renderRegister(errorMessage?: string) {
  const body = `
    <div class="panel">
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
      <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${orders.map((order) => {
          const device = getDeviceById(order.deviceId)
          return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('我的订单 - 电脑租赁管理系统', body, user)
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

export function renderContractSign(token?: string) {
  const order = orders[0]
  const contract = getContractById(order.contractId)
  const device = getDeviceById(order.deviceId)
  const body = `
    <div class="panel">
      <h2>租赁合同签署</h2>
      <p>合同编号：${contract?.contractNumber}</p>
      <pre style="white-space: pre-wrap;">${contract?.content}</pre>
      <form method="POST" action="/contract/sign">
        <div>
          <label class="form-label">姓名</label>
          <input class="form-control" name="name" value="张三" />
        </div>
        <div>
          <label class="form-label">邮箱</label>
          <input class="form-control" name="email" value="customer@example.com" />
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="062-000" />
          </div>
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="12345678" />
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

export function renderContractView(orderId: string) {
  const order = getOrderById(orderId)
  const contract = order ? getContractById(order.contractId) : undefined
  const device = order ? getDeviceById(order.deviceId) : undefined
  if (!order || !contract || !device) {
    return buildLayout('合同不存在 - 电脑租赁管理系统', `<div class="panel"><h2>合同或订单不存在</h2></div>`)
  }
  const body = `
    <div class="panel">
      <h2>租赁合同</h2>
      <p>合同编号：${contract.contractNumber}</p>
      <pre style="white-space: pre-wrap;">${contract.content}</pre>
      <div class="panel">
        <h3>签署信息</h3>
        <p>签署人：张三</p>
        <p>签署时间：${contract.signedAt}</p>
        <p>IP地址：192.168.1.100</p>
      </div>
      <div>
        <a class="button" href="/payment/result?status=success&orderId=${order.id}">查看支付结果</a>
      </div>
    </div>
  `
  return buildLayout('合同查看 - 电脑租赁管理系统', body)
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
      <h2>员工工作台</h2>
      <p>待处理订单、合同签署、付款审核一览。</p>
    </div>
    <div class="grid grid-3">
      <div class="card"><h3>待处理订单</h3><p>${pending.length} 笔</p></div>
      <div class="card"><h3>待签署合同</h3><p>0 份</p></div>
      <div class="card"><h3>今日归还</h3><p>3 台</p></div>
    </div>
    <div class="panel">
      <h3>待处理订单列表</h3>
      <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${pending.map((order) => {
          const user = users.find((item) => item.id === order.userId)
          const device = getDeviceById(order.deviceId)
          return `<tr><td>${order.orderNo}</td><td>${user?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('员工仪表盘 - 电脑租赁管理系统', body, user)
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
      <h2>订单详情 #${order.orderNo}</h2>
      <div class="grid grid-2">
        <div class="card"><h3>客户信息</h3><p>姓名：${customer?.name}</p><p>邮箱：${customer?.email}</p><p>电话：${customer?.phone ?? '-'}</p><p>BSB：***-***</p><p>Account：******78</p></div>
        <div class="card"><h3>租赁信息</h3><p>设备：${device?.name}</p><p>租期：${order.startDate} ~ ${order.endDate}</p><p>租金：${formatCurrency(order.totalAmount - order.depositAmount)}</p><p>押金：${formatCurrency(order.depositAmount)}</p><p>状态：${order.status}</p></div>
      </div>
      <div class="panel"><h3>押金状态</h3><p>押金总额：${formatCurrency(order.depositAmount)}</p><p>已退金额：¥0.00</p><p>待退金额：${formatCurrency(order.depositAmount)}</p><button class="button">退回押金</button></div>
      <div class="panel"><h3>操作</h3><p><a class="link-button" href="/staff/orders/pending">返回列表</a></p></div>
    </div>
  `
  return buildLayout('订单详情 - 员工 - 电脑租赁管理系统', body, user)
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
