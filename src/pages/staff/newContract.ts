/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDevices, getSystemSettings, loadSystemSettingsFromDB, sanitizePlainText } from '../../site'
import type { Context } from 'hono'

export async function renderNewContractPage(c: Context, user: any) {
  await loadSystemSettingsFromDB(c)
  const pickupLocations = getSystemSettings().companyDetails.pickupLocations
  const rentalRules = getSystemSettings().rentalRules
  const escape = (value: unknown) => sanitizePlainText(value, 300).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const locationOptions = pickupLocations.map(location => `<option value="${escape(location)}">${escape(location)}</option>`).join('')
  const allDevices = await getDevices(c);
  const devices = allDevices.filter(device => !['maintenance', 'retired'].includes(String(device.status || '').toLowerCase()))
  const deviceGroups = new Map<string, any[]>()
  for (const device of devices) {
    const groupName = `${String(device.name || '未命名设备')}\u0000${String(device.model || '未登记型号')}`
    deviceGroups.set(groupName, [...(deviceGroups.get(groupName) || []), device])
  }
  const bookingRanges = ((await c.env.RENT.prepare(`SELECT id, deviceId, startDate, endDate, status FROM orders WHERE status NOT IN ('completed', 'cancelled') ORDER BY startDate`).all()).results || []) as any[]
  const today = new Date().toISOString().slice(0, 10)
  const bookedDeviceIds = new Set(bookingRanges.filter(item => item.deviceId && item.endDate >= today).map(item => item.deviceId))
  const deviceCatalog = [...deviceGroups.entries()].sort(([left], [right]) => left.localeCompare(right, 'zh-CN')).map(([groupName, groupDevices]) => {
    const [name, model] = groupName.split('\u0000')
    return `
    <section class="device-catalog-group" data-device-group data-group-page="0">
      <button class="device-catalog-group__heading" type="button" data-group-toggle aria-expanded="true"><span><strong>${escape(name)}</strong><small>${escape(model)}</small></span><span class="mono" data-group-count>${groupDevices.length} 台</span></button>
      <div class="device-catalog-grid">
        ${groupDevices.sort((left, right) => String(left.model || '').localeCompare(String(right.model || ''), 'zh-CN')).map(device => {
      const serial = device.serialNumber || device.serial_number || '未登记'
      const assetTag = device.assetTag || device.asset_tag || device.id
      const configuration = [device.cpu, device.ram, device.storage, device.gpu, device.os].filter(Boolean).join(' · ') || device.description || '暂无配置说明'
      const searchText = [device.name, device.brand, device.model, serial, assetTag, configuration].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
      const isBooked = bookedDeviceIds.has(device.id)
      return `<button class="device-catalog-card" type="button" data-device-id="${escape(device.id)}" data-device-search="${escape(searchText)}" aria-pressed="false"><span class="device-catalog-card__top"><strong>${escape(device.model || '未登记型号')}</strong><span class="badge ${isBooked ? 'badge-warning' : 'badge-success'}">${isBooked ? '有租赁档期' : '可安排'}</span></span><span class="device-catalog-card__config">${escape(configuration)}</span><span class="device-catalog-card__meta"><span>SN ${escape(serial)}</span><span>资产 ${escape(assetTag)}</span></span></button>`
    }).join('')}
      </div>
      <div class="device-group-pagination" data-group-pagination><button class="button button-sm button-secondary" data-group-prev type="button">上一页</button><span class="mono" data-group-page-status></span><button class="button button-sm button-secondary" data-group-next type="button">下一页</button></div>
    </section>`
  }).join('')
  const bookingData = JSON.stringify(bookingRanges).replace(/</g, '\\u003c')
  const rentalRulesData = JSON.stringify(rentalRules).replace(/</g, '\\u003c')

  const formHtml = `
    <div class="page-header"><div><p class="section-code">CONTRACT WORKFLOW</p><h2>新增租赁合同</h2><p>选择设备、租期与交付方式，生成客户签署链接。</p></div><a class="button button-secondary" href="/staff/contracts">返回合同管理</a></div>
    <div class="panel">
      <form action="/staff/contracts/create" method="post">
        <section class="device-catalog" aria-labelledby="device-catalog-title">
          <div class="device-catalog__header"><div><p class="section-code">ASSET DIRECTORY</p><h3 id="device-catalog-title">选择设备</h3><p>按名称分组显示；可搜索名称、型号、序列号、资产编号和设备配置。</p></div><span id="device-result-count" class="badge badge-neutral">${devices.length} 台设备</span></div>
          <label for="device-search" class="form-label">搜索设备</label>
          <div class="device-search-control"><input id="device-search" class="form-control" type="search" autocomplete="off" placeholder="搜索 MacBook、序列号、M2 / 16GB / 512GB…"><span class="mono" aria-hidden="true">SEARCH</span></div>
          <div id="device-catalog-results" class="device-catalog-results">${deviceCatalog}</div>
          <p id="device-empty-state" class="device-empty-state" hidden>没有符合条件的设备，请尝试其他名称、型号、序列号或配置。</p>
          <label for="device-select" class="visually-hidden">已选择设备</label>
          <select id="device-select" name="deviceId" class="visually-hidden" required>
            <option value="">请选择设备</option>
            ${devices.map(device => `<option value="${device.id}">${device.name} (${device.model}) - ${device.serialNumber}${device.status === 'rented' ? ' · 有租赁档期' : ''}</option>`).join('')}
          </select>
        </section>
        <section class="booking-picker" aria-labelledby="booking-picker-title"><div class="booking-picker__header"><div><p class="section-code">DEVICE AVAILABILITY</p><h3 id="booking-picker-title">设备租赁日历</h3><p>请手动选择设备，再在日历中选择开始日期和归还日期；红色日期已有租赁。</p></div><span id="booking-status" class="badge badge-neutral">请先选择设备</span></div><div class="booking-month-nav" aria-label="切换租赁日历月份"><button class="button button-sm button-secondary" id="booking-prev" type="button" aria-label="上个月">←</button><strong id="booking-month-label"></strong><button class="button button-sm button-secondary" id="booking-today" type="button">本月</button><button class="button button-sm button-secondary" id="booking-next" type="button" aria-label="下个月">→</button></div><div class="booking-weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div id="booking-calendar" class="booking-calendar"></div><div id="booking-conflict" class="field-error" role="alert"></div></section>
        <div class="grid grid-2" style="margin-top: 16px;">
          <div class="form-group">
            <label for="start-date" class="form-label">租赁开始日期</label>
            <input type="date" id="start-date" name="startDate" class="form-control" required min="${today}">
          </div>
          <div class="form-group">
            <label for="end-date" class="form-label">租赁结束日期</label>
            <input type="date" id="end-date" name="endDate" class="form-control" required min="${today}">
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
          <div class="form-group" id="return-method-group" hidden><label for="return-method" class="form-label">归还方式</label><select id="return-method" name="returnMethod" class="form-control"><option value="CourierPickup">上门提取（使用送货地址）</option><option value="StoreReturn">归还到店</option></select><small class="form-text">自取订单只能归还到店；送货订单可以安排上门提取。</small></div>
          <div class="form-group" id="return-location-group"><label for="return-location" class="form-label">归还店铺</label>${user.role === 'ADMIN' ? '<input id="return-location" name="returnLocation" class="form-control" required placeholder="填写归还店铺地点">' : `<select id="return-location" name="returnLocation" class="form-control" required><option value="">请选择归还店铺</option>${locationOptions}</select>`}</div>
          <div class="form-group delivery-only" hidden><label for="delivery-fee" class="form-label">运费（AUD）</label><input type="number" id="delivery-fee" name="deliveryFee" class="form-control" min="0" step="0.01" required placeholder="请输入送货运费"><small class="form-text">选择送货上门时必须填写。</small></div>
        </div>
        <section id="delivery-address-section" class="form-section delivery-address" hidden>
          <div class="form-section-title"><span class="mono">AU</span><div><h3>送货地址</h3><p>输入至少 3 个字符选择地址，街道、城区、州和邮编会自动填写。</p></div></div>
          <div class="form-group address-autocomplete"><label class="form-label" for="delivery-address-search">搜索澳洲地址</label><div class="address-search-control"><input id="delivery-address-search" class="form-control" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="address-suggestions" aria-expanded="false" placeholder="例如 123 Collins Street, Melbourne"><span class="address-search-indicator" aria-hidden="true">AU</span></div><div id="address-search-status" class="address-search-status" aria-live="polite">可直接手工填写下方地址。</div><div id="address-suggestions" class="address-suggestions" role="listbox" hidden></div></div>
          <input type="hidden" id="delivery-place-id" name="deliveryPlaceId"><input type="hidden" id="delivery-address" name="deliveryAddress">
          <div class="grid grid-2"><div class="form-group"><label class="form-label" for="delivery-street">街道地址</label><input id="delivery-street" name="deliveryStreet" class="form-control" autocomplete="address-line1"></div><div class="form-group"><label class="form-label" for="delivery-suburb">Suburb</label><input id="delivery-suburb" name="deliverySuburb" class="form-control" autocomplete="address-level2"></div><div class="form-group"><label class="form-label" for="delivery-state">州</label><select id="delivery-state" name="deliveryState" class="form-control"><option value="">请选择</option>${['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(state => `<option value="${state}">${state}</option>`).join('')}</select></div><div class="form-group"><label class="form-label" for="delivery-postcode">邮编</label><input id="delivery-postcode" name="deliveryPostcode" class="form-control" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="postal-code"></div></div>
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
      ${devices.length === 0 ? '<p style="margin-top: 16px; color: var(--text-secondary);">当前没有可出租设备；维修或退役设备不会显示。</p>' : ''}
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
      const deviceSelect = document.getElementById('device-select');
      const deviceSearch = document.getElementById('device-search');
      const deviceCards = Array.from(document.querySelectorAll('[data-device-id]'));
      const deviceGroups = Array.from(document.querySelectorAll('[data-device-group]'));
      const deviceResultCount = document.getElementById('device-result-count');
      const deviceEmptyState = document.getElementById('device-empty-state');
      const bookings = ${bookingData};
      const rentalRules = ${rentalRulesData};
      const bookingCalendar = document.getElementById('booking-calendar');
      const bookingStatus = document.getElementById('booking-status');
      const bookingConflict = document.getElementById('booking-conflict');
      const bookingMonthLabel = document.getElementById('booking-month-label');
      const now = new Date();
      const isoDate = date => date.toISOString().slice(0, 10);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayValue = isoDate(today);
      let bookingMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const devicePageSize = 4;
      const selectedBookings = () => bookings.filter(item => item.deviceId === deviceSelect.value);
      function selectDevice(card) {
        deviceSelect.value = card.dataset.deviceId;
        deviceCards.forEach(item => { const selected = item === card; item.classList.toggle('is-selected', selected); item.setAttribute('aria-pressed', String(selected)); });
        validateBookingDates();
      }
      function filterDevices() {
        const query = deviceSearch.value.trim().toLocaleLowerCase('zh-CN');
        const terms = query.split(/\\s+/).filter(Boolean);
        const matches = deviceCards.filter(card => terms.every(term => card.dataset.deviceSearch.includes(term)));
        const matchSet = new Set(matches);
        deviceGroups.forEach(group => {
          const groupMatches = Array.from(group.querySelectorAll('[data-device-id]')).filter(card => matchSet.has(card));
          const pageCount = Math.max(1, Math.ceil(groupMatches.length / devicePageSize));
          const page = Math.min(Number(group.dataset.groupPage || 0), pageCount - 1);
          group.dataset.groupPage = String(page);
          const pageCards = new Set(groupMatches.slice(page * devicePageSize, (page + 1) * devicePageSize));
          group.querySelectorAll('[data-device-id]').forEach(card => { card.hidden = !pageCards.has(card); });
          group.hidden = groupMatches.length === 0;
          group.querySelector('[data-group-count]').textContent = groupMatches.length + ' 台';
          group.querySelector('[data-group-page-status]').textContent = '第 ' + (page + 1) + ' / ' + pageCount + ' 页';
          group.querySelector('[data-group-prev]').disabled = page === 0;
          group.querySelector('[data-group-next]').disabled = page >= pageCount - 1;
          group.querySelector('[data-group-pagination]').hidden = groupMatches.length <= devicePageSize;
        });
        deviceResultCount.textContent = matches.length + ' 台设备';
        deviceEmptyState.hidden = matches.length !== 0;
      }
      function renderBookingCalendar() {
        bookingCalendar.replaceChildren();
        const first = new Date(bookingMonth);
        bookingMonthLabel.textContent = first.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', timeZone: 'UTC' });
        const offset = (first.getUTCDay() + 6) % 7;
        const gridStart = new Date(first); gridStart.setUTCDate(first.getUTCDate() - offset);
        const ranges = selectedBookings();
        for (let index = 0; index < 42; index += 1) {
          const date = new Date(gridStart); date.setUTCDate(gridStart.getUTCDate() + index);
          const value = isoDate(date);
          const isPast = value < todayValue;
          const blocked = rentalRules.unavailableDates.includes(value) || ranges.some(item => item.startDate <= value && item.endDate > value);
          const inRange = startDateInput.value && endDateInput.value && startDateInput.value <= value && value < endDateInput.value;
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.dataset.date = value;
          cell.className = 'booking-day' + (date.getUTCMonth() !== first.getUTCMonth() ? ' is-outside' : '') + (blocked ? ' is-booked' : '') + (isPast ? ' is-past' : '') + (inRange ? ' is-selected-range' : '') + (startDateInput.value === value ? ' is-range-start' : '') + (endDateInput.value === value ? ' is-range-end' : '');
          cell.textContent = String(date.getUTCDate());
          cell.title = rentalRules.unavailableDates.includes(value) ? '管理员设置为不可取货/归还日期' : blocked ? '该设备此日已有租赁' : isPast ? '无法选择过去日期' : deviceSelect.value ? '选择 ' + value : '请先选择设备';
          cell.disabled = blocked || !deviceSelect.value || isPast;
          cell.addEventListener('click', () => selectBookingDate(value));
          bookingCalendar.appendChild(cell);
        }
        bookingStatus.textContent = deviceSelect.value ? first.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', timeZone: 'UTC' }) : '请先选择设备';
      }
      function selectBookingDate(value) {
        if (!startDateInput.value || endDateInput.value || value < startDateInput.value) { startDateInput.value = value; endDateInput.value = ''; }
        else if (value === startDateInput.value) { const next = new Date(value + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1); endDateInput.value = isoDate(next); }
        else endDateInput.value = value;
        updateValidityDates(); validateBookingDates();
      }
      function moveBookingMonth(offset) { bookingMonth.setUTCMonth(bookingMonth.getUTCMonth() + offset); renderBookingCalendar(); }
      function validateBookingDates() {
        const invalidRange = startDateInput.value && endDateInput.value && endDateInput.value <= startDateInput.value;
        const conflict = !invalidRange && deviceSelect.value && startDateInput.value && endDateInput.value && selectedBookings().find(item => startDateInput.value < item.endDate && endDateInput.value > item.startDate);
        const rentalDays = !invalidRange && startDateInput.value && endDateInput.value ? Math.ceil((new Date(endDateInput.value + 'T00:00:00Z').getTime() - new Date(startDateInput.value + 'T00:00:00Z').getTime()) / 86400000) : 0;
        const unavailable = !invalidRange && startDateInput.value && endDateInput.value && rentalRules.unavailableDates.find(date => date >= startDateInput.value && date < endDateInput.value);
        const message = invalidRange ? '归还日期必须晚于租赁开始日期。' : rentalDays < rentalRules.minimumRentalDays ? '最短租赁时间为 ' + rentalRules.minimumRentalDays + ' 天。' : unavailable ? '租期包含不可取货或归还日期：' + unavailable : conflict ? '所选日期与已有租赁重叠：' + conflict.startDate + ' 至 ' + conflict.endDate : '';
        startDateInput.setCustomValidity(message); endDateInput.setCustomValidity(message); bookingConflict.textContent = message;
        bookingStatus.className = 'badge ' + (message ? 'badge-danger' : deviceSelect.value ? 'badge-success' : 'badge-neutral');
        if (!message && deviceSelect.value) bookingStatus.textContent = '所选日期可用';
        renderBookingCalendar();
        return !message;
      }
      
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
      startDateInput.addEventListener('change', () => { if (startDateInput.value) { const selected = new Date(startDateInput.value + 'T00:00:00Z'); bookingMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1)); } updateValidityDates(); validateBookingDates(); });
      endDateInput.addEventListener('change', () => { updateValidityDates(); validateBookingDates(); });
      deviceSelect.addEventListener('change', validateBookingDates);
      deviceCards.forEach(card => card.addEventListener('click', () => selectDevice(card)));
      deviceSearch.addEventListener('input', () => { deviceGroups.forEach(group => { group.dataset.groupPage = '0'; }); filterDevices(); });
      deviceGroups.forEach(group => {
        group.querySelector('[data-group-prev]').addEventListener('click', () => { group.dataset.groupPage = String(Math.max(0, Number(group.dataset.groupPage || 0) - 1)); filterDevices(); });
        group.querySelector('[data-group-next]').addEventListener('click', () => { group.dataset.groupPage = String(Number(group.dataset.groupPage || 0) + 1); filterDevices(); });
        group.querySelector('[data-group-toggle]').addEventListener('click', event => { const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!expanded)); group.classList.toggle('is-collapsed', expanded); });
      });
      document.getElementById('booking-prev').addEventListener('click', () => moveBookingMonth(-1));
      document.getElementById('booking-next').addEventListener('click', () => moveBookingMonth(1));
      document.getElementById('booking-today').addEventListener('click', () => { const today = new Date(); bookingMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)); renderBookingCalendar(); });
      document.querySelector('form[action="/staff/contracts/create"]').addEventListener('submit', event => { if (!validateBookingDates()) { event.preventDefault(); startDateInput.reportValidity(); } });
      renderBookingCalendar();
      filterDevices();

      const deliveryMethod = document.getElementById('delivery-method');
      const pickupLocation = document.getElementById('pickup-location');
      const deliverySection = document.getElementById('delivery-address-section');
      const returnMethod = document.getElementById('return-method');
      const returnMethodGroup = document.getElementById('return-method-group');
      const returnLocation = document.getElementById('return-location');
      const returnLocationGroup = document.getElementById('return-location-group');
      const deliveryFee = document.getElementById('delivery-fee');
      const deliveryOnly = Array.from(document.querySelectorAll('.delivery-only'));
      const deliveryFields = ['delivery-street','delivery-suburb','delivery-state','delivery-postcode'].map(id => document.getElementById(id));
      function updateDeliveryMethod() {
        const delivery = deliveryMethod.value === 'Delivery';
        document.getElementById('pickup-location-group').hidden = delivery;
        deliverySection.hidden = !delivery;
        deliveryOnly.forEach(element => element.hidden = !delivery);
        pickupLocation.disabled = delivery;
        deliveryFields.forEach(field => { field.required = delivery; field.disabled = !delivery; });
        deliveryFee.disabled = !delivery;
        deliveryFee.required = delivery;
        returnMethodGroup.hidden = !delivery;
        if (!delivery) returnMethod.value = 'StoreReturn';
        updateReturnMethod();
      }
      function updateReturnMethod() {
        const storeReturn = deliveryMethod.value !== 'Delivery' || returnMethod.value === 'StoreReturn';
        returnLocationGroup.hidden = !storeReturn;
        returnLocation.disabled = !storeReturn;
        returnLocation.required = storeReturn;
      }
      deliveryMethod.addEventListener('change', updateDeliveryMethod);
      returnMethod.addEventListener('change', updateReturnMethod);
      updateDeliveryMethod();

      const searchInput = document.getElementById('delivery-address-search');
      const suggestions = document.getElementById('address-suggestions');
      const addressStatus = document.getElementById('address-search-status');
      let addressTimer;
      let addressRequest;
      let activeSuggestion = -1;
      let sessionToken = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
      function setAddressStatus(message, state) {
        addressStatus.textContent = message;
        addressStatus.dataset.state = state || '';
      }
      function closeSuggestions() {
        suggestions.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
        activeSuggestion = -1;
      }
      function setActiveSuggestion(index) {
        const options = Array.from(suggestions.querySelectorAll('button[role="option"]'));
        if (!options.length) return;
        activeSuggestion = Math.max(0, Math.min(index, options.length - 1));
        options.forEach((option, optionIndex) => option.setAttribute('aria-selected', String(optionIndex === activeSuggestion)));
        options[activeSuggestion].scrollIntoView({ block: 'nearest' });
      }
      searchInput.addEventListener('input', function() {
        clearTimeout(addressTimer);
        if (addressRequest) addressRequest.abort();
        const query = searchInput.value.trim();
        document.getElementById('delivery-place-id').value = '';
        if (query.length < 3) { closeSuggestions(); suggestions.replaceChildren(); setAddressStatus('至少输入 3 个字符，或直接手工填写。'); return; }
        setAddressStatus('正在查找澳洲地址…', 'loading');
        addressTimer = setTimeout(async function() {
          addressRequest = new AbortController();
          try {
            const response = await fetch('/api/address/autocomplete?q=' + encodeURIComponent(query) + '&session=' + encodeURIComponent(sessionToken), { signal: addressRequest.signal });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '地址联想暂时不可用');
            suggestions.replaceChildren();
            const items = Array.isArray(data.suggestions) ? data.suggestions : [];
            items.forEach(function(item) { const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false'); button.dataset.placeId = item.placeId; const marker = document.createElement('span'); marker.className = 'address-suggestion-marker mono'; marker.textContent = 'AU'; const label = document.createElement('span'); label.textContent = item.text; button.append(marker, label); suggestions.appendChild(button); });
            if (items.length) { const attribution = document.createElement('small'); attribution.textContent = 'Powered by Google'; suggestions.appendChild(attribution); }
            suggestions.hidden = !items.length;
            searchInput.setAttribute('aria-expanded', String(Boolean(items.length)));
            setAddressStatus(items.length ? '请选择一个地址以自动填写。' : '没有找到匹配地址，请继续输入或手工填写。', items.length ? 'ready' : 'empty');
          } catch (error) {
            if (error.name === 'AbortError') return;
            closeSuggestions();
            setAddressStatus(error.message || '地址联想暂时不可用，请手工填写。', 'error');
          }
        }, 300);
      });
      searchInput.addEventListener('keydown', function(event) {
        const options = suggestions.querySelectorAll('button[role="option"]');
        if (suggestions.hidden || !options.length) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion(activeSuggestion + 1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion(activeSuggestion <= 0 ? options.length - 1 : activeSuggestion - 1); }
        if (event.key === 'Enter' && activeSuggestion >= 0) { event.preventDefault(); options[activeSuggestion].click(); }
        if (event.key === 'Escape') closeSuggestions();
      });
      suggestions.addEventListener('click', async function(event) {
        const button = event.target.closest('button[data-place-id]');
        if (!button) return;
        setAddressStatus('正在填写地址…', 'loading');
        try {
          const response = await fetch('/api/address/details?placeId=' + encodeURIComponent(button.dataset.placeId) + '&session=' + encodeURIComponent(sessionToken));
          const address = await response.json();
          if (!response.ok) throw new Error(address.error || '无法读取地址详情');
          searchInput.value = address.formattedAddress || button.textContent.trim();
          document.getElementById('delivery-address').value = address.formattedAddress || '';
          document.getElementById('delivery-place-id').value = button.dataset.placeId;
          document.getElementById('delivery-street').value = address.street || '';
          document.getElementById('delivery-suburb').value = address.suburb || '';
          document.getElementById('delivery-state').value = address.state || '';
          document.getElementById('delivery-postcode').value = address.postcode || '';
          closeSuggestions();
          setAddressStatus('地址已自动填写，请核对后提交。', 'success');
          sessionToken = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
        } catch (error) { setAddressStatus(error.message || '无法读取地址详情，请手工填写。', 'error'); }
      });
      document.addEventListener('click', function(event) { if (!event.target.closest('.address-autocomplete')) closeSuggestions(); });
    </script>
  `;

  return buildLayout('新增合同 - 电脑租赁管理系统', formHtml, user);
}
