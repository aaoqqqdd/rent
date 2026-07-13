import { buildLayout, getDevices, formatCurrency } from '../../site';

export function renderStaffDevices(user: any) {
  const devices = getDevices()
  const body = `
    <div class="panel">
      <h2>设备管理</h2>
      <div style="margin-bottom: 20px;">
        <a class="button button-primary" href="/staff/devices/new">添加新设备</a>
      </div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>设备名称</th><th>型号</th><th>序列号</th><th>日租金</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${devices.map((device) => `
            <tr>
              <td>${device.name}</td>
              <td>${device.model}</td>
              <td>${device.serialNumber}</td>
              <td>${formatCurrency(device.dailyRate ?? 0)}</td>
              <td>${device.status}</td>
              <td>
                <a class="link-button" href="/staff/devices/${device.id}">查看</a>
                <a class="link-button" href="/staff/devices/${device.id}/edit">编辑</a>
              </td>
            </tr>
          `).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('设备管理 - 电脑租赁管理系统', body, user)
}