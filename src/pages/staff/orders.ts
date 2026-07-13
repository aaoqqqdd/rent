import { buildLayout, getOrders, getUsers, getDevices, formatCurrency } from '../../site';

export function renderStaffOrders(user: any) {
  const orders = getOrders()
  const usersData = getUsers()
  const devicesData = getDevices()

  const body = `
    <div class="panel">
      <h2>订单管理</h2>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${orders.map((order) => {
            const customer = usersData.find(u => u.id === order.userId)
            const device = devicesData.find(d => d.id === order.deviceId)
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? 'N/A'}</td><td>${device?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('订单管理 - 电脑租赁管理系统', body, user)
}