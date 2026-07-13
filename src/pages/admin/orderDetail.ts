import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency } from '../../site';

export function renderAdminOrderDetail(user: any, orderId: string) {
  const order = getOrderById(orderId);

  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user);
  }

  const customer = getUserById(order.userId);
  const device = getDeviceById(order.deviceId);

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>订单详情 - ${order.orderNo}</h2>
        <span class="section-note">查看订单的详细信息并进行管理。</span>
      </div>
      <div class="grid grid-2">
        <div>
          <h3>订单信息</h3>
          <p><strong>订单号:</strong> ${order.orderNo}</p>
          <p><strong>状态:</strong> ${order.status}</p>
          <p><strong>租期:</strong> ${order.startDate} to ${order.endDate}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>支付方式:</strong> ${order.paymentMethod}</p>
          <p><strong>下单日期:</strong> ${order.createdAt}</p>
        </div>
        <div>
          <h3>关联信息</h3>
          <p><strong>客户:</strong> ${customer?.name || 'N/A'} (<a href="/admin/users/${customer?.id}">查看客户</a>)</p>
          <p><strong>设备:</strong> ${device?.name || 'N/A'} (<a href="/admin/devices/${device?.id}">查看设备</a>)</p>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h3>管理操作</h3>
        <form method="POST" action="/admin/orders/${order.id}/update" class="form-grid">
          <div class="form-group">
            <label for="status">更新订单状态</label>
            <select id="status" name="status">
              <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>待付款</option>
              <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>已付款</option>
              <option value="active" ${order.status === 'active' ? 'selected' : ''}>租赁中</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>已完成</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>已取消</option>
              <option value="refunded" ${order.status === 'refunded' ? 'selected' : ''}>已退款</option>
            </select>
          </div>
          <div class="form-group">
            <button type="submit" class="button">更新状态</button>
          </div>
        </form>

        <form method="POST" action="/admin/orders/${order.id}/refund" onsubmit="return confirm('确定要为该订单处理退款吗？');" style="margin-top: 16px;">
          <button type="submit" class="button button-warning" ${order.status !== 'paid' && order.status !== 'active' ? 'disabled' : ''}>处理退款</button>
        </form>
      </div>
    </div>
  `;

  return buildLayout('订单详情 - 电脑租赁管理系统', body, user);
}