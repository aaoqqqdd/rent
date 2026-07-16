import { buildLayout, formatCurrency, getPendingOrdersWithDetails } from '../../site';
import { Context } from 'hono';

export async function renderStaffOrdersPending(c: Context, user: any) {
  const pendingOrders = await getPendingOrdersWithDetails(c);

  const body = `
    <div class="panel">
      <div class="section-title"><h2>待处理订单</h2><span class="section-note">管理待确认的租赁订单。</span></div>

      ${pendingOrders.length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>订单编号</th>
              <th>客户</th>
              <th>设备</th>
              <th>租期</th>
              <th>总金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pendingOrders.map((order: any) => `
              <tr>
                <td>${order.orderNo}</td>
                <td>${order.customerName ?? '未知客户'}</td>
                <td>${order.deviceName ?? '未知设备'}</td>
                <td>${order.startDate} 至 ${order.endDate}</td>
                <td>${formatCurrency(order.totalAmount)}</td>
                <td>${order.status}</td>
                <td>
                  <a class="button button-sm button-primary" href="/staff/orders/${order.id}/approve">批准</a>
                  <a class="button button-sm button-danger" href="/staff/orders/${order.id}/reject">拒绝</a>
                  <a class="button button-sm button-secondary" href="/staff/orders/${order.id}">详情</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>目前没有待处理的订单。</p>'}
    </div>
  `;

  return buildLayout('待处理订单 - 电脑租赁管理系统', body, user);
}