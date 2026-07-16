import { buildLayout, getDevices } from '../../site'
import type { Context } from 'hono'

export async function renderNewContractPage(c: Context, user: any) {
  const allDevices = await getDevices(c);
  const devices = allDevices.filter(d => d.status === 'available');

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
          <label for="validity-duration" class="form-label">合同有效期</label>
          <select id="validity-duration" name="validityDuration" class="select-control">
            <option value="1">1 天</option>
            <option value="3">3 天</option>
            <option value="5">5 天</option>
            <option value="7" selected>7 天 (默认)</option>
            <option value="10">10 天</option>
            <option value="30">30 天</option>
          </select>
          <input type="hidden" id="valid-from" name="validFrom">
          <input type="hidden" id="valid-until" name="validUntil">
        </div>
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

      const validityDurationSelect = document.getElementById('validity-duration');
      const validFromInput = document.getElementById('valid-from');
      const validUntilInput = document.getElementById('valid-until');

      function updateValidityDates() {
        const duration = parseInt(validityDurationSelect.value);
        const today = new Date();
        const validFrom = today.toISOString().split('T')[0]; // YYYY-MM-DD

        const validUntilDate = new Date(today);
        validUntilDate.setDate(today.getDate() + duration);
        const validUntil = validUntilDate.toISOString().split('T')[0]; // YYYY-MM-DD

        validFromInput.value = validFrom;
        validUntilInput.value = validUntil;
      }

      // Set initial values and update on change
      updateValidityDates();
      validityDurationSelect.addEventListener('change', updateValidityDates);
    </script>
  `;

  return buildLayout('新增合同 - 电脑租赁管理系统', formHtml, user);
}