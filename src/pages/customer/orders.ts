import { buildLayout, getOrdersForUser, getDeviceById, formatCurrency } from '../../site';

export function renderCustomerOrders(user: any) {
  const orders = getOrdersForUser(user.id);
  const pendingOrders = orders.filter(order => order.status === 'pending_payment');
  const completedOrders = orders.filter(order => order.status !== 'pending_payment');

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的订单</h2><span class="section-note">查看您的待付款和已完成订单。</span></div>

      <h3>待付款订单</h3>
      ${pendingOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${pendingOrders.map((order) => {
              const device = getDeviceById(order.deviceId);
              return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">去支付</a></td></tr>`;
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有待付款订单。</p>'}

      <h3 style="margin-top: 40px;">已完成订单</h3>
      ${completedOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${completedOrders.map((order) => {
              const device = getDeviceById(order.deviceId);
              return `<tr><td>${order.orderNo}</td><td>${device?.name ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>`;
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有已完成订单。</p>'}
    </div>
  `;
  return buildLayout('我的订单 - 电脑租赁管理系统', body, user);
}