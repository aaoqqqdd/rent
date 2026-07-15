import { buildLayout } from '../../site';

export function renderAdminDeviceEdit(user: any, device: any) {
  if (!device) {
    return buildLayout('编辑设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user);
  }

  // 兼容snake_case和camelCase字段名
  const name = device.name || ''
  const model = device.model || ''
  const serialNumber = device.serialNumber || device.serial_number || ''
  const pricePerDay = device.pricePerDay || device.price_per_day || 0
  const depositAmount = device.depositAmount || device.deposit_amount || 0
  const description = device.description || ''
  const status = device.status || 'available'

  const body = `
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>编辑设备 - ${name}</h2>
          <p style="color: var(--text-secondary); margin-top: 4px; font-size: 0.9rem;">更新设备信息和租赁状态。</p>
        </div>
        <a href="/admin/devices" class="button button-secondary">← 返回列表</a>
      </div>
      <form method="POST" action="/admin/devices/${device.id}/edit" style="max-width: 600px;">
        <div class="form-group">
          <label class="form-label">💻 设备名称</label>
          <input class="form-control" name="name" value="${name}" required />
        </div>
        <div class="form-group">
          <label class="form-label">🏷️ 型号</label>
          <input class="form-control" name="model" value="${model}" required />
        </div>
        <div class="form-group">
          <label class="form-label">🔢 序列号</label>
          <input class="form-control" name="serialNumber" value="${serialNumber}" required style="font-family: monospace;" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label">💰 日租金 (AUD$)</label>
            <input type="number" class="form-control" name="pricePerDay" value="${pricePerDay}" min="0" step="0.01" required />
          </div>
          <div class="form-group">
            <label class="form-label">💎 押金 (AUD$)</label>
            <input type="number" class="form-control" name="depositAmount" value="${depositAmount}" min="0" step="0.01" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">🎯 状态</label>
          <select class="form-control" name="status">
            <option value="available" ${status === 'available' ? 'selected' : ''}>✅ 可用</option>
            <option value="rented" ${status === 'rented' ? 'selected' : ''}>📦 已租出</option>
            <option value="maintenance" ${status === 'maintenance' ? 'selected' : ''}>🔧 维护中</option>
            <option value="retired" ${status === 'retired' ? 'selected' : ''}>📌 已退役</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">📄 设备配置描述</label>
          <textarea class="form-control" name="description" rows="4">${description}</textarea>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button class="button button-primary" type="submit">💾 保存修改</button>
          <a href="/admin/devices/${device.id}/delete" class="button button-danger" onclick="return confirm('确定要删除此设备吗？此操作不可恢复。')">🗑️ 删除设备</a>
        </div>
      </form>
    </div>
  `;

  return buildLayout('编辑设备 - 电脑租赁管理系统', body, user);
}
