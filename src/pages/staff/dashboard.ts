import { buildLayout, formatCurrency } from '../../site';

export function renderStaffDashboard(user: any, orders: any[], users: any[], devices: any[]) {

  const totalRevenue = orders.filter(o => o.status === 'completed' || o.status === 'paid').reduce((sum, order) => sum + order.totalAmount, 0)
  const activeRentals = orders.filter(o => o.status === 'active' || o.status === 'paid').length
  const pendingOrders = orders.filter(o => o.status === 'pending_approval' || o.status === 'pending_payment').length

  const body = `
    <div class="panel hero">
      <h2>欢迎回来，${user.name}！</h2>
      <p>这是您的员工控制中心。</p>
    </div>
    <div class="grid grid-3">
      <div class="card"><h3>总收入</h3><p>${formatCurrency(totalRevenue)}</p></div>
      <div class="card"><h3>活跃租赁</h3><p>${activeRentals} 笔</p></div>
      <div class="card"><h3>待处理订单</h3><p>${pendingOrders} 笔</p></div>
    </div>
    <div class="panel">
      <h3>最新订单</h3>
      <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${orders.slice(0, 5).map((order) => {
          const customer = users.find(u => u.id === order.userId)
          const device = devices.find(d => d.id === order.deviceId)
          return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? ''}</td><td>${device?.name ?? ''}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
    <div class="panel">
      <h3>设备概览</h3>
      <table class="table"><thead><tr><th>设备名称</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${devices.slice(0, 5).map((device) => {
          const currentOrder = orders.find(o => o.deviceId === device.id && (o.status === 'active' || o.status === 'paid'))
          const customer = currentOrder ? users.find(u => u.id === currentOrder.userId) : null
          return `<tr><td>${device.name}</td><td>${device.status}</td><td>${customer?.name ?? '无'}</td><td><a class="link-button" href="/staff/devices/${device.id}">查看</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `
  return buildLayout('员工仪表盘 - 电脑租赁管理系统', body, user)
}