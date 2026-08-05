/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDevices, getSystemSettings, loadSystemSettingsFromDB, sanitizePlainText } from '../../site'
import type { Context } from 'hono'

export async function renderNewContractPage(c: Context, user: any) {
  await loadSystemSettingsFromDB(c)
  const pickupLocations = getSystemSettings().companyDetails.pickupLocations
  const escape = (value: unknown) => sanitizePlainText(value, 300).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const locationOptions = pickupLocations.map(location => `<option value="${escape(location)}">${escape(location)}</option>`).join('')
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
        <div class="grid grid-2" style="margin-top: 16px;">
          <div class="form-group">
            <label for="device-condition" class="form-label">出租时设备状况</label>
            <textarea id="device-condition" name="deviceCondition" class="form-control" required placeholder="例如：外观良好，屏幕无划痕"></textarea>
          </div>
          <div class="form-group">
            <label for="device-accessories" class="form-label">配件列表</label>
            <textarea id="device-accessories" name="deviceAccessories" class="form-control" placeholder="例如：充电器、鼠标、电脑包"></textarea>
          </div>
          <div class="form-group">
            <label for="late-fee" class="form-label">每日逾期费用（AUD）</label>
            <input type="number" id="late-fee" name="lateFeePerDay" class="form-control" min="0" step="0.01" value="0" required>
          </div>
          <div class="form-group">
            <label for="repair-cost" class="form-label">损坏维修金额（AUD，后续可留空）</label>
            <input type="number" id="repair-cost" name="repairCost" class="form-control" min="0" step="0.01">
          </div>
          <div class="form-group"><label for="delivery-method" class="form-label">交付方式</label><select id="delivery-method" name="deliveryMethod" class="form-control"><option value="Pickup">客户自取</option><option value="Delivery">送货上门</option></select></div>
          <div class="form-group" id="pickup-location-group"><label for="pickup-location" class="form-label">自取地点</label>${user.role === 'ADMIN' ? '<input id="pickup-location" name="pickupLocation" class="form-control" required placeholder="管理员可编辑地点">' : `<select id="pickup-location" name="pickupLocation" class="form-control" required><option value="">请选择自取地点</option>${locationOptions}</select>`}${user.role !== 'ADMIN' && !pickupLocations.length ? '<small class="form-text text-danger">管理员尚未配置自取地点，请先联系管理员。</small>' : ''}</div>
          <div class="form-group"><label for="return-location" class="form-label">归还地点</label>${user.role === 'ADMIN' ? '<input id="return-location" name="returnLocation" class="form-control" required placeholder="管理员可编辑地点">' : `<select id="return-location" name="returnLocation" class="form-control" required><option value="">请选择归还地点</option>${locationOptions}</select>`}</div>
          <div class="form-group delivery-only" hidden><label for="delivery-fee" class="form-label">配送费（AUD）</label><input type="number" id="delivery-fee" name="deliveryFee" class="form-control" min="0" step="0.01" value="0"></div>
        </div>
        <section id="delivery-address-section" class="form-section delivery-address" hidden>
          <div class="form-section-title"><span class="mono">AU</span><div><h3>送货地址</h3><p>输入至少 3 个字符选择地址，街道、城区、州和邮编会自动填写。</p></div></div>
          <div class="form-group address-autocomplete"><label class="form-label" for="delivery-address-search">搜索澳洲地址</label><input id="delivery-address-search" class="form-control" autocomplete="off" placeholder="例如 123 Collins Street Melbourne"><div id="address-suggestions" class="address-suggestions" role="listbox" hidden></div></div>
          <input type="hidden" id="delivery-place-id" name="deliveryPlaceId"><input type="hidden" id="delivery-address" name="deliveryAddress">
          <div class="grid grid-2"><div class="form-group"><label class="form-label" for="delivery-street">街道地址</label><input id="delivery-street" name="deliveryStreet" class="form-control" autocomplete="address-line1"></div><div class="form-group"><label class="form-label" for="delivery-suburb">Suburb</label><input id="delivery-suburb" name="deliverySuburb" class="form-control" autocomplete="address-level2"></div><div class="form-group"><label class="form-label" for="delivery-state">州</label><select id="delivery-state" name="deliveryState" class="form-control"><option value="">请选择</option>${['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'].map(state => `<option value="${state}">${state}</option>`).join('')}</select></div><div class="form-group"><label class="form-label" for="delivery-postcode">邮编</label><input id="delivery-postcode" name="deliveryPostcode" class="form-control" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="postal-code"></div></div>
        </section>
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

      const deliveryMethod = document.getElementById('delivery-method');
      const pickupLocation = document.getElementById('pickup-location');
      const deliverySection = document.getElementById('delivery-address-section');
      const deliveryOnly = Array.from(document.querySelectorAll('.delivery-only'));
      const deliveryFields = ['delivery-street','delivery-suburb','delivery-state','delivery-postcode'].map(id => document.getElementById(id));
      function updateDeliveryMethod() {
        const delivery = deliveryMethod.value === 'Delivery';
        document.getElementById('pickup-location-group').hidden = delivery;
        deliverySection.hidden = !delivery;
        deliveryOnly.forEach(element => element.hidden = !delivery);
        pickupLocation.disabled = delivery;
        deliveryFields.forEach(field => { field.required = delivery; field.disabled = !delivery; });
        document.getElementById('delivery-fee').disabled = !delivery;
      }
      deliveryMethod.addEventListener('change', updateDeliveryMethod);
      updateDeliveryMethod();

      const searchInput = document.getElementById('delivery-address-search');
      const suggestions = document.getElementById('address-suggestions');
      let addressTimer;
      let sessionToken = crypto.randomUUID();
      searchInput.addEventListener('input', function() {
        clearTimeout(addressTimer);
        const query = searchInput.value.trim();
        if (query.length < 3) { suggestions.hidden = true; suggestions.innerHTML = ''; return; }
        addressTimer = setTimeout(async function() {
          try {
            const response = await fetch('/api/address/autocomplete?q=' + encodeURIComponent(query) + '&session=' + encodeURIComponent(sessionToken));
            if (!response.ok) throw new Error('autocomplete unavailable');
            const data = await response.json();
            suggestions.replaceChildren();
            data.suggestions.forEach(function(item) { const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'option'); button.dataset.placeId = item.placeId; button.textContent = item.text; suggestions.appendChild(button); });
            if (data.suggestions.length) { const attribution = document.createElement('small'); attribution.textContent = 'Powered by Google'; suggestions.appendChild(attribution); }
            suggestions.hidden = !data.suggestions.length;
          } catch { suggestions.hidden = true; }
        }, 300);
      });
      suggestions.addEventListener('click', async function(event) {
        const button = event.target.closest('button[data-place-id]');
        if (!button) return;
        const response = await fetch('/api/address/details?placeId=' + encodeURIComponent(button.dataset.placeId) + '&session=' + encodeURIComponent(sessionToken));
        if (!response.ok) return;
        const address = await response.json();
        searchInput.value = address.formattedAddress || button.textContent;
        document.getElementById('delivery-address').value = address.formattedAddress || '';
        document.getElementById('delivery-place-id').value = button.dataset.placeId;
        document.getElementById('delivery-street').value = address.street || '';
        document.getElementById('delivery-suburb').value = address.suburb || '';
        document.getElementById('delivery-state').value = address.state || '';
        document.getElementById('delivery-postcode').value = address.postcode || '';
        suggestions.hidden = true;
        sessionToken = crypto.randomUUID();
      });
    </script>
  `;

  return buildLayout('新增合同 - 电脑租赁管理系统', formHtml, user);
}
