import { buildLayout, getRentalsByUserId, getDeviceById, formatCurrency } from '../../site';

export function renderCustomerRentals(user: any) {
  const rentals = getRentalsByUserId(user.id);

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的租赁</h2><span class="section-note">查看您的当前和历史租赁记录。</span></div>

      <h3>当前租赁中</h3>
      ${rentals.filter(r => r.status === 'active').length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>设备名称</th>
              <th>租期</th>
              <th>日租金</th>
              <th>押金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rentals.filter(r => r.status === 'active').map(rental => {
              const device = getDeviceById(rental.deviceId);
              return `
                <tr>
                  <td>${device?.name ?? '未知设备'}</td>
                  <td>${rental.startDate} 至 ${rental.endDate}</td>
                  <td>${formatCurrency(device?.dailyRate ?? 0)}</td>
                  <td>${formatCurrency(rental.depositAmount)}</td>
                  <td>${rental.status}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/customer/rentals/${rental.id}/extend">续租</a>
                    <a class="button button-sm button-danger" href="/customer/rentals/${rental.id}/return">提前归还</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p>您当前没有正在租赁的设备。</p>'}

      <h3 style="margin-top: 40px;">租赁历史记录</h3>
      ${rentals.filter(r => r.status !== 'active').length > 0 ? `
        <table class="table">
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
            ${rentals.filter(r => r.status !== 'active').map(rental => {
              const device = getDeviceById(rental.deviceId);
              return `
                <tr>
                  <td>${device?.name ?? '未知设备'}</td>
                  <td>${rental.startDate} 至 ${rental.endDate}</td>
                  <td>${formatCurrency(rental.totalAmount)}</td>
                  <td>${rental.status}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/customer/orders/${rental.id}">查看订单</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p>您还没有租赁历史记录。</p>'}
    </div>
  `;

  return buildLayout('我的租赁 - 电脑租赁管理系统', body, user);
}