import { buildLayout, getUsers, getOrders, getDevices, formatCurrency } from '../../site';

export function renderAdminDashboard(user: any) {
  const totalUsers = getUsers().length
  const totalOrders = getOrders().length
  const totalDevices = getDevices().length
  const totalRevenue = getOrders().filter(o => o.status === 'completed' || o.status === 'paid').reduce((sum, order) => sum + order.totalAmount, 0)

  const body = `
    <div class="panel hero">
      <h2>欢迎回来，管理员 ${user.name}！</h2>
      <p>这是您的管理控制中心。</p>
    </div>
    <div class="grid grid-4">
      <div class="card"><h3>总用户数</h3><p>${totalUsers}</p></div>
      <div class="card"><h3>总订单数</h3><p>${totalOrders}</p></div>
      <div class="card"><h3>设备总量</h3><p>${totalDevices}</p></div>
      <div class="card"><h3>总收入</h3><p>${formatCurrency(totalRevenue)}</p></div>
    </div>
    <div class="panel">
      <h3>系统概览</h3>
      <p>在这里您可以管理用户、设备、订单和系统设置。</p>
    </div>
  `
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user)
}