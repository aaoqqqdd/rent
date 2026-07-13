import { buildLayout, getAllDevices, formatCurrency } from '../../site';

export function renderAdminDevices(user: any) {
  const devices = getAllDevices();

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>设备管理</h2>
        <span class="section-note">管理所有租赁设备信息。</span>
        <a href="/admin/devices/new" class="button" style="margin-left: auto;">添加入库设备</a>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>设备名称</th>
              <th>型号</th>
              <th>日租金</th>
              <th>押金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${devices.map(device => `
              <tr>
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.model}</td>
                <td>${formatCurrency(device.pricePerDay)}</td>
                <td>${formatCurrency(device.depositAmount)}</td>
                <td>${device.status}</td>
                <td>
                  <a class="link-button" href="/admin/devices/${device.id}/edit">编辑</a>
                  <form method="POST" action="/admin/devices/${device.id}/delete" onsubmit="return confirm('确定要删除此设备吗？');" style="display: inline-block; margin-left: 8px;">
                    <button type="submit" class="link-button-danger">删除</button>
                  </form>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return buildLayout('设备管理 - 电脑租赁管理系统', body, user);
}