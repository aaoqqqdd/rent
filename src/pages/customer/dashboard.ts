import { buildLayout, formatCurrency } from '../../site';

export function renderCustomerDashboard(user: any, allOrders: any[], devices: any[]) {
  const orders = allOrders.filter(o => o.user_id === user.id)
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
          const device = devices.find(d => d.id === order.deviceId)
          return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('顾客仪表盘 - 电脑租赁管理系统', body, user)
}