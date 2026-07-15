import { buildLayout, getOrdersForUser, getDeviceById, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderCustomerRentals(c: Context, user: any) {
  const rentals = await getOrdersForUser(c, user.id);

  const statusMap: Record<string, string> = {
    'pending_payment': '待支付',
    'paid': '已支付',
    'active': '租赁中',
    'completed': '已完成',
    'cancelled': '已取消'
  };

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>我的租赁</h2>
        <span class="section-note">查看您的当前和历史租赁记录。</span>
      </div>

      <h3>📦 当前租赁中</h3>
      ${rentals.filter(r => r.status === 'active').length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>设备名称</th>
              <th>租期</th>
              <th>日租金</th>
              <th>押金</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${await Promise.all(rentals.filter(r => r.status === 'active').map(async (rental: any) => {
              const device = await getDeviceById(c, rental.device_id || rental.deviceId);
              return `
                <tr>
                  <td><strong>${device?.name ?? '未知设备'}</strong></td>
                  <td>${rental.start_date || rental.startDate} 至 ${rental.end_date || rental.endDate}</td>
                  <td>${formatCurrency((device?.price_per_day || device?.pricePerDay) ?? 0)}</td>
                  <td>${formatCurrency(rental.deposit_amount || rental.depositAmount)}</td>
                  <td><span class="badge badge-primary">${statusMap[rental.status] || rental.status}</span></td>
                </tr>
              `;
            })).then(results => results.join(''))}
          </tbody>
        </table>
      ` : '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">您当前没有正在租赁的设备。</p>'}

      <h3 style="margin-top: 32px;">📋 租赁历史记录</h3>
      ${rentals.filter(r => r.status !== 'active').length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>设备名称</th>
              <th>租期</th>
              <th>总租金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${await Promise.all(rentals.filter(r => r.status !== 'active').map(async (rental: any) => {
              const device = await getDeviceById(c, rental.device_id || rental.deviceId);
              return `
                <tr>
                  <td><strong>${device?.name ?? '未知设备'}</strong></td>
                  <td>${rental.start_date || rental.startDate} 至 ${rental.end_date || rental.endDate}</td>
                  <td>${formatCurrency(rental.total_amount || rental.totalAmount)}</td>
                  <td><span class="badge badge-info">${statusMap[rental.status] || rental.status}</span></td>
                  <td><a class="link-button" href="/customer/orders/${rental.id}">查看详情</a></td>
                </tr>
              `;
            })).then(results => results.join(''))}
          </tbody>
        </table>
      ` : '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">您还没有租赁历史记录。</p>'}
    </div>
  `;

  return buildLayout('我的租赁 - 电脑租赁管理系统', body, user);
}
