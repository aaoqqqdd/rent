import { buildLayout, getAllDevices } from '../../site';

export function renderAdminDevices(user: any) {
  const allDevices = getAllDevices(); // 假设有一个函数获取所有设备

  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备管理</h2><span class="section-note">管理所有租赁设备的库存、状态和维护记录。</span></div>

      <div class="device-actions">
        <a href="/admin/device/new" class="button button-primary">添加新设备</a>
      </div>

      ${allDevices.length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>设备名称</th>
              <th>型号</th>
              <th>序列号</th>
              <th>日租金</th>
              <th>押金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${allDevices.map(device => `
              <tr>
                <td>${device.name}</td>
                <td>${device.model}</td>
                <td>${device.serial_number}</td>
                <td>$${device.price_per_day}</td>
                <td>$${device.deposit_amount}</td>
                <td>${device.status}</td>
                <td>
                  <a class="button button-sm button-secondary" href="/admin/device/edit/${device.id}">编辑</a>
                  <a class="button button-sm button-info" href="/admin/device/maintenance/${device.id}">维护记录</a>
                  <button class="button button-sm button-danger" onclick="confirmDeleteDevice('${device.id}')">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>目前没有设备记录。</p>'}
    </div>

    <script>
      function confirmDeleteDevice(deviceId) {
        if (confirm("确定要删除此设备吗？此操作不可逆！")) {
          // 实际删除操作，可能需要发送请求到后端
          alert("设备 " + deviceId + " 已删除 (模拟操作)");
          // window.location.reload();
        }
      }
    </script>
  `;

  return buildLayout('设备管理 - 电脑租赁管理系统', body, user);
}