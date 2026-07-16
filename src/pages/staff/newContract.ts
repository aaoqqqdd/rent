import { buildLayout, getDevices } from '../../site'
import type { Context } from 'hono'

export async function renderNewContractPage(c: Context, user: any) {
  const allDevices = await getDevices(c);
  const activeOrderDevices = new Set(
    (await c.env.RENT.prepare(`
      SELECT deviceId FROM orders WHERE status IN ('active', 'paid')
    `).all()).results?.map((row: any) => row.deviceId) || []
  );

  const devices = allDevices.filter((device) => {
    const normalizedStatus = String(device.status || '').toLowerCase();
    if (normalizedStatus === 'available') {
      return true;
    }
    if (normalizedStatus === 'rented' || normalizedStatus === 'active') {
      return false;
    }
    return !activeOrderDevices.has(device.id);
  });

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
        <div class="form-group" style="margin-top: 16px;">
          <label for="expiry-duration" class="form-label">合同签署过期时间（过期后无法签署或查看）</label>
          <select id="expiry-duration" name="expiryDuration" class="select-control">
            <option value="1">1 天</option>
            <option value="3">3 天</option>
            <option value="7" selected>7 天 (默认)</option>
            <option value="15">15 天</option>
            <option value="30">30 天</option>
          </select>
        </div>
        <input type="hidden" id="valid-from" name="validFrom">
        <input type="hidden" id="valid-until" name="validUntil">
        <div style="margin-top: 24px;">
          <button type="submit" class="button">生成签约链接</button>
        </div>
      </form>
      ${devices.length === 0 ? '<p style="margin-top: 16px; color: var(--text-secondary);">当前没有可用的设备，请先添加设备或等待已出租的设备归还。</p>' : ''}
    </div>
    <script>
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      if (error) {
        alert(decodeURIComponent(error));
      }

      const validFromInput = document.getElementById('valid-from');
      const validUntilInput = document.getElementById('valid-until');

      // 默认设置合同有效期为租赁期限，与租赁开始/结束日期保持一致
      const startDateInput = document.getElementById('start-date');
      const endDateInput = document.getElementById('end-date');
      
      function updateValidityDates() {
        if (startDateInput.value && endDateInput.value) {
          validFromInput.value = startDateInput.value;
          validUntilInput.value = endDateInput.value;
        } else {
          // 如果还没有选择日期，默认设置为从今天开始7天
          const today = new Date();
          const validFrom = today.toISOString().split('T')[0];
          const validUntilDate = new Date(today);
          validUntilDate.setDate(today.getDate() + 7);
          const validUntil = validUntilDate.toISOString().split('T')[0];
          validFromInput.value = validFrom;
          validUntilInput.value = validUntil;
        }
      }

      // 当初始化和日期选择变化时更新有效期
      updateValidityDates();
      startDateInput.addEventListener('change', updateValidityDates);
      endDateInput.addEventListener('change', updateValidityDates);
    </script>
  `;

  return buildLayout('新增合同 - 电脑租赁管理系统', formHtml, user);
}