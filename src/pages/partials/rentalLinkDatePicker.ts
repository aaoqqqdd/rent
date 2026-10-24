/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { createRentalLinkAvailability, type RentalLinkAvailabilityConfig } from '../../domain/rentalLinkAvailability'

export function renderRentalLinkDatePicker(config: RentalLinkAvailabilityConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c')
  return `<div id="rental-date-picker">
    <div class="grid grid-2"><div class="form-group"><label class="form-label" for="rental-choose-start">取货日期</label><button class="form-control" type="button" id="rental-choose-start" aria-pressed="true" aria-controls="rental-calendar">请选择取货日期</button><input type="hidden" id="rental-startDate" name="startDate"></div>
    <div class="form-group"><label class="form-label" for="rental-choose-end">归还日期</label><button class="form-control" type="button" id="rental-choose-end" aria-pressed="false" aria-controls="rental-calendar" disabled>请选择归还日期</button><input type="hidden" id="rental-endDate" name="endDate"></div></div>
    <p class="form-text" id="rental-picker-hint" aria-live="polite">请选择取货日期。</p>
    <div class="booking-month-nav"><button class="button button-sm button-secondary" type="button" id="rental-prev-month" aria-label="上个月">←</button><strong id="rental-month-label" aria-live="polite"></strong><button class="button button-sm button-secondary" type="button" id="rental-next-month" aria-label="下个月">→</button></div>
    <div class="booking-weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="booking-calendar" id="rental-calendar" role="group" aria-label="选择租赁日期"></div>
    <div class="grid grid-2" style="margin-top:16px"><div class="form-group"><label class="form-label" for="rental-startPeriod">取货时段</label><select class="form-control" id="rental-startPeriod" name="startPeriod"><option value="AM">上午</option><option value="PM">下午</option></select></div><div class="form-group"><label class="form-label" for="rental-endPeriod">归还时段</label><select class="form-control" id="rental-endPeriod" name="endPeriod"><option value="AM">上午</option><option value="PM">下午</option></select></div></div>
    <noscript><p class="alert">请启用浏览器 JavaScript 后选择租期。</p></noscript>
  </div><script>(()=>{const init=()=>{
    const config=${json}, createAvailability=(${createRentalLinkAvailability.toString()});
    const root=document.getElementById('rental-date-picker'), form=root.closest('form'), start=document.getElementById('rental-startDate'), end=document.getElementById('rental-endDate'), startPeriod=document.getElementById('rental-startPeriod'), endPeriod=document.getElementById('rental-endPeriod'), startButton=document.getElementById('rental-choose-start'), endButton=document.getElementById('rental-choose-end'), calendar=document.getElementById('rental-calendar'), label=document.getElementById('rental-month-label'), hint=document.getElementById('rental-picker-hint'), prev=document.getElementById('rental-prev-month'), submit=form.querySelector('[type="submit"]');
    let target='start', month=new Date(config.today.slice(0,7)+'-01T00:00:00Z'), availability;
    const iso=date=>date.toISOString().slice(0,10), periods=['AM','PM'];
    function refreshClock(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const part=type=>parts.find(item=>item.type===type).value;config.today=part('year')+'-'+part('month')+'-'+part('day');config.minutes=Number(part('hour'))*60+Number(part('minute'));availability=createAvailability(config)}
    function allowed(date,period){return target==='start'?availability.canStart(date,period):availability.canEnd(start.value,startPeriod.value,date,period)}
    function syncPeriods(select,date,predicate){Array.from(select.options).forEach(option=>{option.disabled=!!date&&!predicate(date,option.value)});if(select.selectedOptions[0]?.disabled)select.value=Array.from(select.options).find(option=>!option.disabled)?.value||''}
    function update(){
      refreshClock();syncPeriods(startPeriod,start.value,availability.canStart);
      if(start.value&&!periods.some(period=>availability.canStart(start.value,period))){start.value='';end.value='';target='start'}
      if(end.value&&!periods.some(period=>availability.canEnd(start.value,startPeriod.value,end.value,period)))end.value='';
      syncPeriods(endPeriod,end.value,(date,period)=>availability.canEnd(start.value,startPeriod.value,date,period));
      const valid=!!end.value&&availability.canEnd(start.value,startPeriod.value,end.value,endPeriod.value);
      submit.disabled=!valid;endButton.disabled=!start.value;
      startButton.textContent=start.value||'请选择取货日期';endButton.textContent=end.value||'请选择归还日期';startButton.setAttribute('aria-pressed',String(target==='start'));endButton.setAttribute('aria-pressed',String(target==='end'));
      hint.textContent=target==='start'?'请选择取货日期。':valid?'租期已选择，可继续签署合同。':'请选择归还日期。';
      render();
    }
    function choose(date){
      const available=periods.filter(period=>allowed(date,period));if(!available.length)return;
      if(target==='start'){start.value=date;startPeriod.value=available.includes(startPeriod.value)?startPeriod.value:available[0];end.value='';target='end'}else{end.value=date;endPeriod.value=available.includes(endPeriod.value)?endPeriod.value:available[0]}
      month=new Date(date.slice(0,7)+'-01T00:00:00Z');update();
    }
    function render(){
      calendar.replaceChildren();label.textContent=month.toLocaleDateString('zh-CN',{year:'numeric',month:'long',timeZone:'UTC'});prev.disabled=iso(month).slice(0,7)<=config.today.slice(0,7);
      const grid=new Date(month);grid.setUTCDate(1-(grid.getUTCDay()+6)%7);
      for(let i=0;i<42;i++){const date=new Date(grid);date.setUTCDate(grid.getUTCDate()+i);const value=iso(date), disabled=!periods.some(period=>allowed(value,period)), cell=document.createElement('button');cell.type='button';cell.dataset.date=value;cell.disabled=disabled;cell.textContent=String(date.getUTCDate());cell.setAttribute('aria-label',value+(disabled?'，不可选':''));cell.setAttribute('aria-pressed',String(value===start.value||value===end.value));cell.className='booking-day'+(date.getUTCMonth()!==month.getUTCMonth()?' is-outside':'')+(start.value&&end.value&&start.value<value&&value<end.value?' is-selected-range':'')+(value===start.value?' is-range-start':'')+(value===end.value?' is-range-end':'');cell.addEventListener('click',()=>choose(value));calendar.appendChild(cell)}
    }
    startButton.addEventListener('click',()=>{target='start';update()});endButton.addEventListener('click',()=>{if(start.value){target='end';update()}});
    prev.addEventListener('click',()=>{month.setUTCMonth(month.getUTCMonth()-1);render()});document.getElementById('rental-next-month').addEventListener('click',()=>{month.setUTCMonth(month.getUTCMonth()+1);render()});
    startPeriod.addEventListener('change',update);endPeriod.addEventListener('change',update);
    form.addEventListener('submit',event=>{update();if(submit.disabled){event.preventDefault();hint.textContent='请先选择可用的租期。'}});
    update();setInterval(update,30000);
  };if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();</script>`
}
