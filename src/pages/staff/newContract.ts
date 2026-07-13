import { buildLayout, User, getAllDevices } from '../../site.ts'

export function renderNewContractPage(user: User) {
  const devices = getAllDevices().filter(d => d.status === 'available');

  const formHtml = `
    <div class="panel">
      <h2>新增租赁合同</h2>
      <form action="/staff/contracts/create" method="post">
        <div class="form-group">
          <label for="device-select" class="form-label">选择设备</label>
          <select id="device-select" name="deviceId" class="select-control" required>
            <option value="">请选择一个可用设备</option>
            ${devices.map(device => `<option value="${device.id}">${device.name} (${device.model}) - ${device.serialNumber}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-2" style="margin-top: 16px;">
          <div class="form-group">
            <label for="start-date" class="form-label">租赁开始日期</label>
            <input type="date" id="start-date" name="startDate" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="end-date" class="form-label">租赁结束日期</label>
            <input type="date" id="end-date" name="endDate" class="form-control" required>
          </div>
        </div>
        <div class="form-group" style="margin-top: 24px;">
           <label for="customer-id" class="form-label">客户ID</label>
           <input type="text" id="customer-id" name="customerId" class="form-control" required placeholder="请输入客户的用户ID">
        </div>
        <div style="margin-top: 24px;">
          <button type="submit" class="button">创建合同草稿</button>
        </div>
      </form>
    </div>
  `;

  return buildLayout('新增合同 - 电脑租赁管理系统', formHtml, user);
}