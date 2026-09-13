/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getDeviceById, formatCurrency, getDeviceRentalRules } from '../../site';
import type { Context } from 'hono';

export async function renderCustomerRent(c: Context, deviceId: string, user: any, errorMessage?: string) {
  const device = await getDeviceById(c, deviceId);

  if (!device) {
    return buildLayout('租赁设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求租赁的设备不存在。</p></div>', user);
  }
  const rentalRules = await getDeviceRentalRules(c, deviceId)
  const bookingRanges = ((await c.env.RENT.prepare("SELECT startDate, endDate, startPeriod, endPeriod FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled')").bind(deviceId).all()).results || []) as any[]

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

        <div class="grid grid-2"><div class="form-group">
          <label class="form-label" for="startDate">开始日期</label>
          <input type="date" id="startDate" name="startDate" class="form-control" min="${today}" required />
        </div><div class="form-group">
          <label class="form-label" for="startPeriod">开始时段</label>
          <select id="startPeriod" name="startPeriod" class="form-control"><option value="AM">上午</option><option value="PM">下午</option></select>
        </div></div>
        <div class="grid grid-2"><div class="form-group">
          <label class="form-label" for="endDate">结束日期</label>
          <input type="date" id="endDate" name="endDate" class="form-control" min="${today}" required />
        </div><div class="form-group">
          <label class="form-label" for="endPeriod">结束时段</label>
          <select id="endPeriod" name="endPeriod" class="form-control"><option value="AM">上午</option><option value="PM">下午</option></select>
        </div></div>
        <div class="form-group"><label class="form-label" for="deliveryMethod">设备交付方式</label><select id="deliveryMethod" name="deliveryMethod" class="form-control"><option value="Pickup">到店自取</option><option value="Delivery">送货上门（运费由管理员/员工确认）</option></select></div>
        <div class="form-group" id="deliveryAddressGroup" hidden><label class="form-label" for="deliveryAddress">送货地址</label><textarea id="deliveryAddress" name="deliveryAddress" class="form-control" rows="3" placeholder="请填写完整的街道、Suburb、州和邮编"></textarea><small class="form-text">提交后由绑定员工或管理员确认配送范围和运费，暂不在此页面收取。</small></div>
        <div class="form-group"><label class="form-label" for="rentalNote">申请备注（选填）</label><textarea id="rentalNote" name="rentalNote" class="form-control" rows="2" maxlength="500" placeholder="例如配送时间、设备使用要求等"></textarea></div>
        <div class="form-group"><label class="form-label" for="couponCode">优惠码（选填）</label><input id="couponCode" name="couponCode" class="form-control" maxlength="40" placeholder="输入优惠码"><small class="form-text" id="couponQuotePreview" aria-live="polite"></small></div>
        <div class="alert" id="rentalRuleMessage">最短租赁时间：${rentalRules.minimumRentalDays} 天。不可用日期：${rentalRules.unavailableDates.length ? rentalRules.unavailableDates.join('、') : '无'}。</div>
        <div class="card" id="quotePreview"><strong>租赁报价</strong><p>请选择租期后查看租金、押金和配送费用。</p></div>

        <script>
          (() => {
            const code = document.getElementById('couponCode');
            const start = document.getElementById('startDate');
            const end = document.getElementById('endDate');
            const quote = document.getElementById('quotePreview');
            const message = document.getElementById('couponQuotePreview');
            const rate = ${Number(device.pricePerDay || device.dailyRate || 0)}, weeklyDiscount = ${Number(device.weeklyDiscountPercent || device.weekly_discount_percent || 0)}, monthlyDiscount = ${Number(device.monthlyDiscountPercent || device.monthly_discount_percent || 0)};
            const rentalFee = (days) => { const monthlyDays = Math.floor(days / 30) * 30, remaining = days - monthlyDays, weeklyDays = Math.floor(remaining / 7) * 7, dailyDays = remaining - weeklyDays; return monthlyDays * rate * (1 - monthlyDiscount / 100) + weeklyDays * rate * (1 - weeklyDiscount / 100) + dailyDays * rate; };
            let timer;
            const preview = () => {
              clearTimeout(timer);
              const value = code.value.trim();
              const days = Math.ceil((new Date(end.value + 'T00:00:00Z') - new Date(start.value + 'T00:00:00Z')) / 86400000);
              if (!value || !start.value || !end.value || !Number.isInteger(days) || days < 1) { message.textContent = ''; return; }
              timer = setTimeout(async () => {
                try {
                  const response = await fetch('/api/coupons/rental-preview?deviceId=${encodeURIComponent(device.id)}&days=' + days + '&code=' + encodeURIComponent(value));
                  const data = await response.json();
                  message.textContent = data.message || '';
                  message.style.color = data.ok ? '#16794f' : '#b42318';
                  if (data.ok) quote.innerHTML = '<strong>优惠后报价</strong><p>原租金：AUD$ ' + Number(data.rent).toFixed(2) + '；优惠：-AUD$ ' + Number(data.discount).toFixed(2) + '；押金：AUD$ ' + Number(data.deposit).toFixed(2) + '；<strong>最终应付：AUD$ ' + Number(data.total).toFixed(2) + '</strong>。</p>';
                  else { const rent = rentalFee(days).toFixed(2); const deposit = Number(${Number(device.depositAmount || 0)}).toFixed(2); quote.innerHTML = '<strong>租赁报价</strong><p>租金：AUD$ ' + rent + '；押金：AUD$ ' + deposit + '；<strong>最终应付：AUD$ ' + Number(Number(rent) + Number(deposit)).toFixed(2) + '</strong>。</p>'; }
                } catch { message.textContent = '暂时无法验证优惠码，请稍后重试。'; message.style.color = '#b42318'; }
              }, 250);
            };
            code.addEventListener('input', preview);
            start.addEventListener('change', preview);
            end.addEventListener('change', preview);
          })();
        </script>

        <button type="submit" class="button button-primary" style="margin-top: 20px;">确认租赁</button>
      </form>
    </div><script>(()=>{const start=document.getElementById('startDate'),end=document.getElementById('endDate'),startPeriod=document.getElementById('startPeriod'),endPeriod=document.getElementById('endPeriod'),message=document.getElementById('rentalRuleMessage'),quote=document.getElementById('quotePreview'),delivery=document.getElementById('deliveryMethod'),addressGroup=document.getElementById('deliveryAddressGroup'),address=document.getElementById('deliveryAddress');const unavailable=${JSON.stringify(rentalRules.unavailableDates)},unavailableTimeSlots=${JSON.stringify(rentalRules.unavailableTimeSlots||{})},bookings=${JSON.stringify(bookingRanges)},minDays=${rentalRules.minimumRentalDays},rate=${Number(device.pricePerDay||device.dailyRate||0)},weeklyDiscount=${Number(device.weeklyDiscountPercent||device.weekly_discount_percent||0)},monthlyDiscount=${Number(device.monthlyDiscountPercent||device.monthly_discount_percent||0)},deposit=${Number(device.depositAmount||0)};const rentalFee=(days)=>{const monthlyDays=Math.floor(days/30)*30,remaining=days-monthlyDays,weeklyDays=Math.floor(remaining/7)*7,dailyDays=remaining-weeklyDays;return monthlyDays*rate*(1-monthlyDiscount/100)+weeklyDays*rate*(1-weeklyDiscount/100)+dailyDays*rate};const localToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};const melbourneMinutes=()=>{const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const hour=Number(parts.find(part=>part.type==='hour')?.value||0);return(hour===24?0:hour)*60+Number(parts.find(part=>part.type==='minute')?.value||0)};const periodIndex=(date,period)=>Math.round(Date.parse(date+'T00:00:00Z')/86400000)*2+(period==='PM'?1:0);const today=localToday();const periodPassed=(date,period)=>date===today&&melbourneMinutes()>=(period==='AM'?12*60:23*60);const periodBlocked=(date,period)=>{const slots=unavailableTimeSlots[date]||[],group=period==='AM'?['morning_service','morning']:['afternoon','evening_service'];return group.every(slot=>slots.includes(slot))};const bookingBlocked=(date,period)=>bookings.some(item=>periodIndex(item.startDate,item.startPeriod||'AM')<=periodIndex(date,period)&&periodIndex(date,period)<periodIndex(item.endDate,item.endPeriod||'AM'));const updatePeriods=()=>{[[startPeriod,start],[endPeriod,end]].forEach(([select,input])=>{Array.from(select.options).forEach(option=>{option.disabled=periodPassed(input.value,option.value)||periodBlocked(input.value,option.value)||bookingBlocked(input.value,option.value)});if(select.selectedOptions[0]?.disabled)select.value=Array.from(select.options).find(option=>!option.disabled)?.value||''})};start.min=today;end.min=today;const update=()=>{updatePeriods();const s=start.value,e=end.value;if(!s||!e)return;const startIndex=periodIndex(s,startPeriod.value),endIndex=periodIndex(e,endPeriod.value),halfDays=endIndex-startIndex,days=Math.ceil(halfDays/2),blocked=unavailable.find(d=>d>=s&&d<=e),error=e<s||halfDays<=0?'归还时段必须晚于开始时段。':days<minDays?'最短租赁时间为 '+minDays+' 天。':blocked?'租期包含不可用日期：'+blocked:periodPassed(s,startPeriod.value)||periodPassed(e,endPeriod.value)?'所选时段已过，请重新选择。':bookingBlocked(s,startPeriod.value)||bookingBlocked(e,endPeriod.value)?'所选上午/下午时段已有租期，请重新选择。':'';start.setCustomValidity(error);end.setCustomValidity(error);startPeriod.setCustomValidity(error);endPeriod.setCustomValidity(error);message.textContent=error||'日期和时段可用。';message.className='alert '+(error?'page-notification--error':'');if(!error)quote.innerHTML='<strong>租赁报价</strong><p>'+days+' 天租金：AUD$ '+rentalFee(days).toFixed(2)+'；押金：AUD$ '+deposit.toFixed(2)+'；运费（如需配送）由管理员/员工审核后另行通知。</p>';};const updateDelivery=()=>{const deliveryNeeded=delivery.value==='Delivery';addressGroup.hidden=!deliveryNeeded;address.required=deliveryNeeded;};start.addEventListener('change',update);end.addEventListener('change',update);startPeriod.addEventListener('change',update);endPeriod.addEventListener('change',update);delivery.addEventListener('change',updateDelivery);window.setInterval(update,30000);updateDelivery();})();</script>
    </div>
  `;

  return buildLayout(`租赁 ${device.name} - 电脑租赁管理系统`, body, user);
}
