import { buildLayout, getOrders, getUserById, getDeviceById, formatCurrency } from '../../site';

export function renderAdminRefunds(user: any) {
  // 获取所有需要退款的订单：状态为pending_refund或需要退款的订单
  const allOrders = getOrders();
  const refundOrders = allOrders.filter(order => 
    order.status === 'pending_refund' || 
    order.needsRefund || 
    order.status === 'refund_pending'
  );

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>待退款处理</h2>
        <span class="section-note">管理所有待退款的订单，处理客户退款请求。</span>
      </div>
      
      ${refundOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户信息</th>
                <th>设备</th>
                <th>退款金额</th>
                <th>客户银行信息</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${refundOrders.map(order => {
                const customer = getUserById(order.userId);
                const device = getDeviceById(order.deviceId);
                const refundAmount = order.depositAmount || order.totalAmount || 0;
                return `
                  <tr>
                    <td><strong>${order.orderNo}</strong></td>
                    <td>
                      <div>${customer?.name || '未知客户'}</div>
                      <div style="color: var(--text-secondary); font-size: 0.85rem;">${customer?.email || ''}</div>
                    </td>
                    <td>${device?.name || '未知设备'}</td>
                    <td><span style="color: var(--danger); font-weight: bold;">${formatCurrency(refundAmount)}</span></td>
                    <td>
                      <div><small>BSB: ${customer?.bsb || '未填写'}</small></div>
                      <div><small>账号: ${customer?.account || '未填写'}</small></div>
                    </td>
                    <td>${order.refundRequestedAt ? new Date(order.refundRequestedAt).toLocaleDateString('zh-CN') : '未知'}</td>
                    <td>
                      <form method="POST" action="/admin/refunds/${order.id}/process" style="display: inline;">
                        <button class="button button-primary" type="submit" style="margin-right: 8px;">处理退款</button>
                      </form>
                      <a href="/admin/orders/${order.id}" class="link-button">查看详情</a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
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