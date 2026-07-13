import { buildLayout, getDeviceById } from '../../site';

export function renderAdminDeviceEdit(user: any, device: any) {
  if (!device) {
    return buildLayout('编辑设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user);
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>编辑设备 - ${device.name}</h2><span class="section-note">更新设备信息和租赁状态。</span></div>
      <form method="POST" action="/admin/devices/${device.id}/edit">
        <div class="form-group">
          <label class="form-label">设备名称</label>
          <input class="form-control" name="name" value="${device.name}" required />
        </div>
        <div class="form-group">
          <label class="form-label">型号</label>
          <input class="form-control" name="model" value="${device.model}" required />
        </div>
        <div class="form-group">
          <label class="form-label">日租金</label>
          <input type="number" class="form-control" name="pricePerDay" value="${device.pricePerDay}" required />
        </div>
        <div class="form-group">
          <label class="form-label">押金</label>
          <input type="number" class="form-control" name="depositAmount" value="${device.depositAmount}" required />
        </div>
        <div class="form-group">
          <label class="form-label">序列号</label>
          <input class="form-control" name="serialNumber" value="${device.serialNumber}" required />
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select class="form-control" name="status">
            <option value="available" ${device.status === 'available' ? 'selected' : ''}>可用</option>
            <option value="rented" ${device.status === 'rented' ? 'selected' : ''}>已租出</option>
            <option value="maintenance" ${device.status === 'maintenance' ? 'selected' : ''}>维护中</option>
            <option value="retired" ${device.status === 'retired' ? 'selected' : ''}>已退役</option>
          </select>
        </div>
        <button class="button button-primary" type="submit">保存修改</button>
      </form>

      <div class="section-title" style="margin-top: 24px;">
        <h3>设备维修记录</h3>
        <span class="section-note">此功能正在开发中。</span>
      </div>
      <!-- 维修记录列表将在这里显示 -->
      <p>暂无维修记录。</p>
    </div>
  `;

  return buildLayout('编辑设备 - 电脑租赁管理系统', body, user);
}