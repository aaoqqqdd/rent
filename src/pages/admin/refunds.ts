import { buildLayout, getOrders, getUserById, getDeviceById, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderAdminRefunds(c: Context, user: any) {
  const allOrders = await getOrders(c);
  // 获取所有需要退款的订单：状态为cancelled或已完成需要退押金的
  const refundOrders = allOrders.filter(order => 
    order.status === 'cancelled' || 
    order.needsRefund
  );

  // 获取关联数据
  const ordersWithDetails = await Promise.all(refundOrders.map(async (order) => {
    const customer = await getUserById(c, order.userId);
    const device = await getDeviceById(c, order.device_id || order.deviceId);
    return { ...order, customer, device };
  }));

  const body = `
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>待退款处理</h2>
          <p style="color: var(--text-secondary); margin-top: 4px; font-size: 0.9rem;">管理所有待退款的订单，处理客户退款请求。</p>
        </div>
      </div>
      
      ${ordersWithDetails.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户信息</th>
              <th>设备</th>
              <th>退款金额</th>
              <th>客户银行信息</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ordersWithDetails.map(order => {
              const refundAmount = order.deposit_amount || order.depositAmount || order.total_amount || 0;
              return `
                <tr>
                  <td style="font-family: monospace;">${order.id}</td>
                  <td>
                    <div><strong>${order.customer?.name || '未知客户'}</strong></div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">${order.customer?.email || ''}</div>
                  </td>
                  <td>${order.device?.name || '未知设备'}</td>
                  <td><span style="color: var(--danger); font-weight: bold;">${formatCurrency(refundAmount)}</span></td>
                  <td>
                    <div><small>BSB: ${order.customer?.bsb || '未填写'}</small></div>
                    <div><small>账号: ${order.customer?.account_number || order.customer?.account || '未填写'}</small></div>
                  </td>
                  <td><span class="badge badge-warning">待退款</span></td>
                  <td>
                    <a href="/admin/orders/${order.id}" class="link-button">查看详情</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
          <h3 style="margin-bottom: 8px;">暂无待退款订单</h3>
          <p style="color: var(--text-secondary);">所有退款请求都已处理完毕！</p>
        </div>
      `}
    </div>
  `;

  return buildLayout('待退款处理 - 电脑租赁管理系统', body, user);
}