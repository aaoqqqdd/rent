import { buildLayout, getOrdersForUser, getDeviceById, formatCurrency } from '../../site';

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