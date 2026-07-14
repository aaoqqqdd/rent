import { buildLayout, formatCurrency } from '../../site';

export function renderAdminDashboard(user: any, orders: any[], users: any[], devices: any[]) {
  const totalRevenue = orders.filter(o => o.status === 'completed' || o.status === 'paid').reduce((sum, order) => sum + (order.total_amount || order.totalAmount || 0), 0)
  const activeRentals = orders.filter(o => o.status === 'active' || o.status === 'paid').length
  const pendingOrders = orders.filter(o => o.status === 'pending_approval' || o.status === 'pending_payment').length
  const availableDevices = devices.filter(d => d.status === 'available').length
  const totalUsers = users.length;

  const body = `
    <div class="panel hero">
      <h2>欢迎回来，${user.name}！</h2>
      <p>这是您的管理员控制中心，管理整个系统的所有数据和设置。</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card primary">
        <h3>总收入</h3>
        <div class="value">${formatCurrency(totalRevenue)}</div>
        <div class="trend">↑ 系统累计收入</div>
      </div>
      <div class="stat-card success">
        <h3>活跃租赁</h3>
        <div class="value">${activeRentals} 笔</div>
        <div class="trend">正在进行中的订单</div>
      </div>
      <div class="stat-card warning">
        <h3>待处理订单</h3>
        <div class="value">${pendingOrders} 笔</div>
        <div class="trend">需要处理的订单</div>
      </div>
      <div class="stat-card info">
        <h3>可用设备</h3>
        <div class="value">${availableDevices}/${devices.length}</div>
        <div class="trend">可租赁的设备数量</div>
      </div>
      <div class="stat-card" style="margin-top: 0;">
        <h3>注册用户</h3>
        <div class="value">${totalUsers} 人</div>
        <div class="trend">系统总用户数</div>
      </div>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>最新订单</h3>
        <span class="section-note">最近的5条租赁记录</span>
      </div>
      <table><thead><tr><th>订单号</th><th>客户</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${orders.slice(0, 5).map((order) => {
          const customer = users.find(u => u.id === (order.userId || order.user_id))
          const device = devices.find(d => d.id === (order.deviceId || order.device_id))
          const statusClass = order.status === 'completed' ? 'badge-success' : 
                             order.status === 'pending_payment' || order.status === 'pending_approval' ? 'badge-warning' : 
                             order.status === 'active' ? 'badge-primary' : 'badge-info';
          return `<tr><td>${order.orderNo || order.order_no || 'N/A'}</td><td>${customer?.name ?? '未知用户'}</td><td>${device?.name ?? '未知设备'}</td><td><span class="badge ${statusClass}">${order.status}</span></td><td><a class="link-button" href="/admin/orders/${order.id}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
    <div class="panel">
      <div class="section-title">
        <h3>设备概览</h3>
        <span class="section-note">最近的5台设备状态</span>
      </div>
      <table><thead><tr><th>设备名称</th><th>状态</th><th>当前租用者</th><th>操作</th></tr></thead><tbody>
        ${devices.slice(0, 5).map((device) => {
          const currentOrder = orders.find(o => (o.deviceId || o.device_id) === device.id && (o.status === 'active' || o.status === 'paid'))
          const customer = currentOrder ? users.find(u => u.id === (currentOrder.userId || currentOrder.user_id)) : null
          const deviceStatusClass = device.status === 'available' ? 'badge-success' : 
                                   device.status === 'rented' ? 'badge-primary' : 'badge-warning';
          return `<tr><td>${device.name}</td><td><span class="badge ${deviceStatusClass}">${device.status}</span></td><td>${customer?.name ?? '无'}</td><td><a class="link-button" href="/admin/devices/${device.id}">查看详情</a></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
  `;
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user);
}