import { buildLayout, getDevices, formatCurrency } from '../../site';

export function renderCustomerDevices(user: any) {
  const devices = getDevices().filter(device => device.status === 'available'); // 只显示可用设备

  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备租赁</h2><span class="section-note">选择您需要的设备和租赁期限。</span></div>
      ${devices.length ? `
        <div class="device-list grid grid-3">
          ${devices.map(device => `
            <div class="device-card card">
              <h3>${device.name}</h3>
              <p>型号: ${device.model}</p>
              <p>日租金: ${formatCurrency(device.dailyRate ?? 0)}</p>
              <p>押金: ${formatCurrency(device.depositAmount)}</p>
              <a class="button button-primary" href="/customer/rent/${device.id}">立即租赁</a>
            </div>
          `).join('')}
        </div>
      ` : '<p>暂无可用设备。</p>'}
    </div>
  `;

  return buildLayout('设备租赁 - 电脑租赁管理系统', body, user);
}