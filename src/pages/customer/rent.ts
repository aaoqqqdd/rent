/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDeviceById, formatCurrency, getSystemSettings, loadSystemSettingsFromDB } from '../../site';
import type { Context } from 'hono';

export async function renderCustomerRent(c: Context, deviceId: string, user: any, errorMessage?: string) {
  const device = await getDeviceById(c, deviceId);
  await loadSystemSettingsFromDB(c)
  const globalRules = getSystemSettings().rentalRules

  if (!device) {
    return buildLayout('租赁设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求租赁的设备不存在。</p></div>', user);
  }
  const deviceDates = ((await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ? ORDER BY unavailable_date').bind(deviceId).all().catch(() => ({ results: [] }))).results || []).map((row: any) => String(row.unavailable_date).slice(0, 10))
  const rentalRules = { ...globalRules, unavailableDates: [...new Set([...(globalRules.unavailableDates || []), ...deviceDates])] }

  // Do not use toISOString() here: UTC can already be tomorrow while the
  // customer is still on the previous local calendar date.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁设备: ${device.name}</h2><span class="section-note">填写租赁信息并确认订单。</span></div>
      ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}
      <form method="POST" action="/customer/rent/${device.id}">
        <div class="form-group">
          <label class="form-label" for="deviceName">设备名称</label>
          <input type="text" id="deviceName" class="form-control" value="${device.name}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="deviceModel">型号</label>
          <input type="text" id="deviceModel" class="form-control" value="${device.model}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="dailyRate">日租金</label>
          <input type="text" id="dailyRate" class="form-control" value="${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label" for="depositAmount">押金</label>
          <input type="text" id="depositAmount" class="form-control" value="${formatCurrency(device.depositAmount)}" readonly />
        </div>

        <div class="form-group">
          <label class="form-label" for="startDate">开始日期</label>
          <input type="date" id="startDate" name="startDate" class="form-control" min="${today}" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="endDate">结束日期</label>
          <input type="date" id="endDate" name="endDate" class="form-control" min="${today}" required />
        </div>
        <div class="form-group"><label class="form-label" for="deliveryMethod">设备交付方式</label><select id="deliveryMethod" name="deliveryMethod" class="form-control"><option value="Pickup">到店自取</option><option value="Delivery">送货上门（运费由管理员/员工确认）</option></select></div>
        <div class="form-group" id="deliveryAddressGroup" hidden><label class="form-label" for="deliveryAddress">送货地址</label><textarea id="deliveryAddress" name="deliveryAddress" class="form-control" rows="3" placeholder="请填写完整的街道、Suburb、州和邮编"></textarea><small class="form-text">提交后由绑定员工或管理员确认配送范围和运费，暂不在此页面收取。</small></div>
        <div class="form-group"><label class="form-label" for="rentalNote">申请备注（选填）</label><textarea id="rentalNote" name="rentalNote" class="form-control" rows="2" maxlength="500" placeholder="例如配送时间、设备使用要求等"></textarea></div>
        <div class="form-group"><label class="form-label" for="couponCode">优惠码（选填）</label><input id="couponCode" name="couponCode" class="form-control" maxlength="40" placeholder="输入优惠码"></div>
        <div class="alert" id="rentalRuleMessage">最短租赁时间：${rentalRules.minimumRentalDays} 天。不可用日期：${rentalRules.unavailableDates.length ? rentalRules.unavailableDates.join('、') : '无'}。</div>
        <div class="card" id="quotePreview"><strong>租赁报价</strong><p>请选择租期后查看租金、押金和配送费用。</p></div>

        <button type="submit" class="button button-primary" style="margin-top: 20px;">确认租赁</button>
      </form>
    </div><script>(()=>{const start=document.getElementById('startDate'),end=document.getElementById('endDate'),message=document.getElementById('rentalRuleMessage'),quote=document.getElementById('quotePreview'),delivery=document.getElementById('deliveryMethod'),addressGroup=document.getElementById('deliveryAddressGroup'),address=document.getElementById('deliveryAddress');const unavailable=${JSON.stringify(rentalRules.unavailableDates)},minDays=${rentalRules.minimumRentalDays},rate=${Number(device.pricePerDay||device.dailyRate||0)},deposit=${Number(device.depositAmount||0)};const localToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};const today=localToday();start.min=today;end.min=today;const update=()=>{const s=start.value,e=end.value;if(!s||!e)return;const days=Math.ceil((new Date(e+'T00:00:00Z')-new Date(s+'T00:00:00Z'))/86400000),blocked=unavailable.find(d=>d>=s&&d<e);const error=e<=s?'归还日期必须晚于租赁开始日期。':days<minDays?'最短租赁时间为 '+minDays+' 天。':blocked?'租期包含不可用日期：'+blocked:'';start.setCustomValidity(error);end.setCustomValidity(error);message.textContent=error||'日期可用。';message.className='alert '+(error?'page-notification--error':'');if(!error)quote.innerHTML='<strong>租赁报价</strong><p>'+days+' 天租金：AUD$ '+(days*rate).toFixed(2)+'；押金：AUD$ '+deposit.toFixed(2)+'；运费（如需配送）由管理员/员工审核后另行通知。</p>';};const updateDelivery=()=>{const deliveryNeeded=delivery.value==='Delivery';addressGroup.hidden=!deliveryNeeded;address.required=deliveryNeeded;};start.addEventListener('change',update);end.addEventListener('change',update);delivery.addEventListener('change',updateDelivery);updateDelivery();})();</script>
    </div>
  `;

  return buildLayout(`租赁 ${device.name} - 电脑租赁管理系统`, body, user);
}
