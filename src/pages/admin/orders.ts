import { buildLayout, getOrders, getDeviceById, getUserById, formatCurrency } from '../../site';

export function renderAdminOrders(user: any) {
  const orders = getOrders();

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>订单管理</h2>
        <span class="section-note">查看和管理系统中的所有订单。</span>
        <button onclick="alert('导出订单报表功能正在开发中...')" class="button" style="margin-left: auto;">导出报表</button>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户</th>
              <th>设备</th>
              <th>总金额</th>
              <th>状态</th>
              <th>下单日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => {
              const customer = getUserById(order.userId);
              const device = getDeviceById(order.deviceId);
              return `
                <tr>
                  <td>${order.orderNo}</td>
                  <td>${customer?.name || 'N/A'}</td>
                  <td>${device?.name || 'N/A'}</td>
                  <td>${formatCurrency(order.totalAmount)}</td>
                  <td>${order.status}</td>
                  <td>${order.createdAt}</td>
                  <td>
                    <a class="link-button" href="/admin/orders/${order.id}">查看详情</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return buildLayout('订单管理 - 电脑租赁管理系统', body, user);
}