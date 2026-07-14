import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency } from '../../site';

export function renderAdminOrderDetail(user: any, orderId: string) {
  const order = getOrderById(orderId);

  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user);
  }

  const customer = getUserById(order.userId);
  const device = getDeviceById(order.deviceId);

  const statusLabels: Record<string, {label: string, color: string, bg: string, icon: string}> = {
    'pending_payment': { label: '待付款', color: '#d97706', bg: '#fef3c7', icon: '⏳' },
    'paid': { label: '已付款', color: '#059669', bg: '#d1fae5', icon: '💳' },
    'active': { label: '租赁中', color: '#2563eb', bg: '#dbeafe', icon: '📦' },
    'completed': { label: '已完成', color: '#0891b2', bg: '#cffafe', icon: '✅' },
    'cancelled': { label: '已取消', color: '#dc2626', bg: '#fee2e2', icon: '❌' }
  };
  const currentStatus = statusLabels[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6', icon: '❓' };
  
  const body = `
    <div class="panel hero" style="padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">📋</div>
          <div>
            <h2 style="margin: 0 0 8px 0;">订单详情 - ${order.orderNo}</h2>
            <p style="margin: 0; opacity: 0.9;">查看和管理订单的详细信息</p>
          </div>
        </div>
        <span style="padding: 10px 20px; border-radius: 9999px; font-weight: 600; font-size: 1rem; background: ${currentStatus.bg}; color: ${currentStatus.color}; display: inline-flex; align-items: center; gap: 8px;">${currentStatus.icon} ${currentStatus.label}</span>
      </div>
    </div>

    <div class="grid grid-2" style="gap: 24px; margin-bottom: 24px;">
      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">📦 订单基本信息</h3>
        </div>
        <div style="display: grid; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">订单号</span>
            <span style="font-family: monospace; font-weight: 600;">${order.orderNo}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">租期</span>
            <span style="font-weight: 500;">${order.startDate} ~ ${order.endDate}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">总金额</span>
            <span style="font-weight: 700; font-size: 1.1rem; color: #059669;">${formatCurrency(order.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">支付方式</span>
            <span style="font-weight: 500;">${order.paymentMethod || 'N/A'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <span style="color: #6b7280;">下单日期</span>
            <span style="font-weight: 500;">${order.createdAt}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">🔗 关联信息</h3>
        </div>
        <div style="display: grid; gap: 16px;">
          <div style="padding: 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="width: 40px; height: 40px; background: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</span>
              <div>
                <div style="font-size: 0.85rem; color: #3b82f6; font-weight: 500;">客户信息</div>
                <div style="font-weight: 600;">${customer?.name || 'N/A'}</div>
              </div>
            </div>
            <a href="/admin/users/${customer?.id}" class="link-button" style="width: 100%; text-align: center; margin-top: 8px;">查看客户详情 →</a>
          </div>
          <div style="padding: 16px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="width: 40px; height: 40px; background: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💻</span>
              <div>
                <div style="font-size: 0.85rem; color: #16a34a; font-weight: 500;">租赁设备</div>
                <div style="font-weight: 600;">${device?.name || 'N/A'}</div>
              </div>
            </div>
            <a href="/admin/devices/${device?.id}" class="link-button" style="width: 100%; text-align: center; margin-top: 8px;">查看设备详情 →</a>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">⚙️ 订单管理操作</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        <div style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">🔄 更新订单状态</h4>
          <form method="POST" action="/admin/orders/${order.id}/update" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="status" style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">选择新状态</label>
              <select id="status" name="status" style="width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
                <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>⏳ 待付款</option>
                <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>💳 已付款</option>
                <option value="active" ${order.status === 'active' ? 'selected' : ''}>📦 租赁中</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ 已完成</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ 已取消</option>
              </select>
            </div>
            <button type="submit" class="button button-primary" style="padding: 14px; border-radius: 12px; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">💾 更新状态</button>
          </form>
        </div>

        <div style="padding: 24px; background: linear-gradient(135deg, #fef7ed 0%, #feedd9 100%); border-radius: 16px;">
          <h4 style="margin: 0 0 16px 0; color: #c2410c; display: flex; align-items: center; gap: 8px;">💸 退款处理</h4>
          <div style="margin-bottom: 16px; padding: 12px; background: rgba(251,146,60,0.1); border-radius: 10px; border: 1px solid rgba(251,146,60,0.3);">
            <p style="margin: 0; font-size: 0.9rem; color: #9a3412;">退款将原路返回给客户，仅在订单已付款或租赁中时可操作。</p>
          </div>
          <form method="POST" action="/admin/orders/${order.id}/refund" onsubmit="return confirm('⚠️ 确定要为该订单处理退款吗？此操作不可撤销！\\n\\n订单金额：${formatCurrency(order.totalAmount)}');" style="display: flex;">
            <button type="submit" class="button button-warning" ${order.status !== 'paid' && order.status !== 'active' ? 'disabled' : ''} style="width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; ${(order.status === 'paid' || order.status === 'active') ? 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); box-shadow: 0 4px 14px 0 rgba(249,115,22,0.4);' : 'opacity: 0.5; cursor: not-allowed;'}">↩️ 处理退款</button>
          </form>
        </div>
      </div>
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="/admin/orders" class="button button-secondary" style="padding: 12px 32px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">← 返回订单列表</a>
      </div>
    </div>
  `;

  return buildLayout('订单详情 - 电脑租赁管理系统', body, user);
}