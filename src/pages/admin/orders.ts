import { buildLayout, getOrders, getDeviceById, getUserById, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderAdminOrders(c: Context, user: any) {
  const orders = await getOrders(c);

  // 并行获取所有订单关联的用户和设备
  const ordersWithDetail = await Promise.all(orders.map(async (order: any) => {
    const customerId = order.customer_id || order.userId
    const deviceId = order.device_id || order.deviceId
    const customer = customerId ? await getUserById(c, customerId) : null
    const device = deviceId ? await getDeviceById(c, deviceId) : null
    return { ...order, customer, device };
  }));

  const statusMap: Record<string, { text: string; class: string }> = {
    'pending_approval': { text: '待审核', class: 'badge-warning' },
    'pending_payment': { text: '待支付', class: 'badge-warning' },
    'approved': { text: '已审核', class: 'badge-info' },
    'paid': { text: '已支付', class: 'badge-primary' },
    'active': { text: '租赁中', class: 'badge-primary' },
    'completed': { text: '已完成', class: 'badge-success' },
    'cancelled': { text: '已取消', class: 'badge-danger' }
  };

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>订单管理</h2>
        <span class="section-note">查看和管理系统中的所有订单。</span>
        <a href="/admin/orders/export" class="button button-secondary" style="margin-left: auto;">导出报表</a>
      </div>
      ${ordersWithDetails.length === 0 ? `
        <div style="text-align: center; padding: 48px 24px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📋</div>
          <h3>暂无订单</h3>
          <p>系统中还没有任何订单记录</p>
        </div>
      ` : `
      <table>
        <thead>
          <tr>
            <th>订单号</th>
            <th>客户</th>
            <th>设备</th>
            <th>总金额</th>
            <th>状态</th>
            <th>租期</th>
            <th>下单日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${ordersWithDetail.map((order: any) => {
            const status = statusMap[order.status] || { text: order.status, class: 'badge-info' };
            const totalAmount = order.total_amount || order.totalAmount || 0
            const startDate = order.start_date || order.startDate || '-'
            const endDate = order.end_date || order.endDate || '-'
            const createdAt = order.created_at || order.createdAt
            return `
              <tr>
                <td style="font-family: monospace;">${order.id}</td>
                <td>${order.customer?.name || '未知用户'}</td>
                <td>${order.device?.name || '未知设备'}</td>
                <td><strong>${formatCurrency(totalAmount)}</strong></td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>${startDate} ~ ${endDate}</td>
                <td>${createdAt ? new Date(createdAt).toLocaleDateString('zh-CN') : '-'}</td>
                <td>
                  <a class="link-button" href="/admin/orders/${order.id}">查看详情</a>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;

  return buildLayout('订单管理 - 电脑租赁管理系统', body, user);
}
