import { buildLayout, getOrders, getUsers, getDevices, formatCurrency } from '../../site';

export function renderStaffOrders(user: any, searchTerm: string = '') {
  const orders = getOrders(user);
  const usersData = getUsers();
  const devicesData = getDevices();

  const filteredOrders = orders.filter(order => {
    const customer = usersData.find(u => u.id === order.userId);
    const device = devicesData.find(d => d.id === order.deviceId);
    const searchLower = searchTerm.toLowerCase();
    return order.orderNo.toLowerCase().includes(searchLower) ||
           (customer?.name ?? '').toLowerCase().includes(searchLower) ||
           (device?.name ?? '').toLowerCase().includes(searchLower);
  });

  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单管理</h2><span class="section-note">管理所有客户订单。</span></div>
      <div class="search-bar" style="margin-bottom: 20px;">
        <form action="/staff/orders" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索订单号、客户或设备..." value="${searchTerm}" style="flex-grow: 1;" />
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${filteredOrders.map((order) => {
            const customer = usersData.find(u => u.id === order.userId);
            const device = devicesData.find(d => d.id === order.deviceId);
            return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? 'N/A'}</td><td>${device?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看</a></td></tr>`;
          }).join('')}
        </tbody></table>
      </div>
    </div>
  `;
  return buildLayout('订单管理 - 电脑租赁管理系统', body, user);
}