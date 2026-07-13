import { buildLayout, findUserBySession, getOrderById, getOrdersForUser, getContractById, getDeviceById, getPendingOrders, formatCurrency, formatDate, users, devices, orders, contracts } from './site'



export function renderLogin(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel login-box" style="width: 400px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">电脑租赁管理系统</h2>
        </div>
        <form method="POST" action="/login" style="text-align: left;">
          <label class="form-label">账号</label>
          <input class="form-control" name="account" placeholder="请输入邮箱或用户名" />
          <label class="form-label">密码</label>
          <input class="form-control" type="password" name="password" placeholder="请输入密码" />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; margin-bottom: 20px;">
            <label class="form-check">
              <input type="checkbox" name="remember" /> 记住我
            </label>
            <a class="link-button" href="/forgot-password">忘记密码？</a>
          </div>
          <div class="auth-notice" style="border: 1px solid #fdba74; background-color: #fff7ed; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            ${errorMessage ? `<div style="color: #c2410c; margin-bottom: 12px;">${errorMessage}</div>` : ''}
            <strong>测试账号</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0; list-style-type: disc;">
              <li>管理员：admin@example.com / Admin123</li>
              <li>员工：staff@example.com / Staff123</li>
              <li>顾客：customer@example.com / Customer123</li>
            </ul>
          </div>
          <button class="button" type="submit" style="width: 100%;">登录</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">还没有账号？ <a class="link-button" href="/register">注册</a></p>
      </div>
    </div>
  `
  return buildLayout('登录 - 电脑租赁管理系统', body)
}

export function renderRegister(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 480px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">创建新账户</h2>
        </div>
        ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
        <form method="POST" action="/register" style="text-align: left;">
          <label class="form-label">姓名</label>
          <input class="form-control" name="name" placeholder="请输入姓名" />
          <label class="form-label">邮箱</label>
          <input class="form-control" type="email" name="email" placeholder="请输入邮箱" />
          <label class="form-label">密码</label>
          <input class="form-control" type="password" name="password" placeholder="至少8位，包含字母和数字" />
          <label class="form-label">确认密码</label>
          <input class="form-control" type="password" name="passwordConfirm" placeholder="请再次输入密码" />
          <label class="form-label">推荐人（选填）</label>
          <input class="form-control" name="referrer" placeholder="填写推荐人ID或推荐码" />
          <div style="margin-top: 12px; margin-bottom: 20px;">
            <label class="form-check">
              <input type="checkbox" name="terms" /> 我已阅读并同意《用户协议》
            </label>
          </div>
          <button class="button" type="submit" style="width: 100%;">注册</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">已有账号？ <a class="link-button" href="/login">去登录</a></p>
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
  const body = `<h1>Staff Contract View (Not Implemented)</h1><p>Order ID: ${orderId}</p>`;
  return buildLayout('Staff Contract View', body, user);
}

function renderContractAgreement(contractData: any) {
  return `
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-title"><h3>■ 租赁协议</h3></div>
      <div class="contract-content" style="padding: 0 16px;">
        <p><strong>第一条 租赁物品</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          <li>甲方（出租方）：PC Rental Pty Ltd</li>
          <li>乙方（承租方）：${contractData.lesseeName}</li>
          <li>设备名称：${contractData.deviceName}</li>
          <li>设备型号：${contractData.deviceModel}</li>
          <li>设备序列号：${contractData.deviceSerial}</li>
        </ul>
        <p><strong>第二条 租赁期限</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          <li>租赁起始日：${contractData.startDate}</li>
          <li>租赁结束日：${contractData.endDate}</li>
          <li>共计：${contractData.duration}天</li>
        </ul>
        <p><strong>第三条 租金及支付</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          <li>日租金：${formatCurrency(contractData.dailyRate)}/天</li>
          <li>租金总额：${formatCurrency(contractData.totalRent)}</li>
          <li>押金：${formatCurrency(contractData.deposit)}</li>
          <li>总计应付：${formatCurrency(contractData.totalDue)}</li>
        </ul>
        <p><strong>第四条 设备使用及保管责任</strong></p>
        <ol>
          <li>乙方应按照设备使用说明正确使用设备。</li>
          <li>租赁期间设备损坏由乙方承担维修费用。</li>
          <li>设备丢失或无法修复，乙方按设备原价赔偿。</li>
        </ol>
        <p><strong>第五条 逾期归还</strong></p>
        <p>逾期归还按日租金2倍收取逾期费用。</p>
      </div>
      <div style="padding: 16px; border-top: 1px solid #eee; margin-top: 16px;">
        <label class="form-check">
          <input type="checkbox" name="agreement" /> 我已阅读并同意以上租赁协议条款
        </label>
      </div>
    </div>
  `;
}

function renderContractUserInfo(user: any) {
  return `
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-title"><h3>■ 承租方信息</h3></div>
      <div style="padding: 0 16px;">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${user?.name ?? ''}" placeholder="请输入真实姓名" />
          </div>
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${user?.phone ?? ''}" placeholder="请输入手机号" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${user?.email ?? ''}" placeholder="请输入邮箱" />
          </div>
          <div>
            <label class="form-label">身份证号</label>
            <input class="form-control" name="idCard" placeholder="请输入身份证号" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderContractPayment(user: any, contractData: any) {
  return `
    <div class="card">
      <div class="section-title"><h3>■ 支付信息</h3></div>
      <div style="padding: 0 16px;">
        <p>支付总额：<strong>${formatCurrency(contractData.totalDue)}</strong>（租金 ${formatCurrency(contractData.totalRent)} + 押金 ${formatCurrency(contractData.deposit)}）</p>
        <div class="grid grid-3">
          <label class="form-check">
            <input type="radio" name="paymentMethod" value="alipay" checked /> 支付宝
          </label>
          <label class="form-check">
            <input type="radio" name="paymentMethod" value="wechat" /> 微信支付
          </label>
          <label class="form-check">
            <input type="radio" name="paymentMethod" value="card" /> 银行卡
          </label>
        </div>
      </div>
    </div>
  `;
}

export function renderContractSign(token: string, user?: any) {
  const contractData = {
    contractNumber: 'CT20260708001',
    lesseeName: user?.name ?? '[待填写]',
    deviceName: 'MacBook Pro 14寸',
    deviceModel: 'M4 Pro 18GB 512GB',
    deviceSerial: 'SN20260708001',
    startDate: '2026年07月10日',
    endDate: '2026年08月10日',
    duration: 30,
    dailyRate: 40.00,
    totalRent: 1200.00,
    deposit: 2000.00,
    totalDue: 3200.00,
  };

  const agreementHtml = renderContractAgreement(contractData);
  const userInfoHtml = renderContractUserInfo(user);
  const paymentHtml = renderContractPayment(user, contractData);

  const body = `
    <div class="panel" style="max-width: 800px; margin: 24px auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2>📄 租赁合同签署</h2>
        <p class="text-muted">编号：${contractData.contractNumber}</p>
      </div>

      <form method="POST" action="/contract/sign?token=${token}">
        ${agreementHtml}
        ${userInfoHtml}
        ${paymentHtml}

        <div style="text-align: center; margin-top: 24px;">
          <button class="button" type="submit" style="width: 50%;">确认租赁并支付</button>
        </div>
      </form>
    </div>
  `;
  return buildLayout('签署租赁合同 - 电脑租赁管理系统', body, user);
}