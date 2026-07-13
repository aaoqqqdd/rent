import { buildLayout } from '../../site';

export function renderAdminDeviceNew(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>添加入库设备</h2>
        <span class="section-note">登记一台新的租赁设备。</span>
      </div>
      <form method="POST" action="/admin/devices/create" class="form-grid">
        <div class="form-group">
          <label for="name">设备名称</label>
          <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
          <label for="model">型号</label>
          <input type="text" id="model" name="model" required>
        </div>
        <div class="form-group">
          <label for="serialNumber">序列号</label>
          <input type="text" id="serialNumber" name="serialNumber" required>
        </div>
        <div class="form-group">
          <label for="pricePerDay">日租金</label>
          <input type="number" id="pricePerDay" name="pricePerDay" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label for="depositAmount">押金</label>
          <input type="number" id="depositAmount" name="depositAmount" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label for="status">初始状态</label>
          <select id="status" name="status">
            <option value="available" selected>可用</option>
            <option value="maintenance">维修中</option>
          </select>
        </div>
        <div class="form-group form-group-full">
          <label for="description">描述</label>
          <textarea id="description" name="description" rows="4"></textarea>
        </div>
        <div class="form-group form-group-full">
          <button type="submit" class="button">确认入库</button>
        </div>
      </form>
    </div>
  `;

  return buildLayout('添加入库设备 - 电脑租赁管理系统', body, user);
}