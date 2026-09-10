/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site'
import { CONNECTIVITY_PROBES } from '../../services/connectivity'

const CATEGORY_LABELS: Record<string, string> = { CORE: '核心服务', PAYMENT: '支付与汇率', MESSAGING: '消息服务', LOCATION: '地址服务', DEVICE: '设备通讯' }

const INBOUND_ENDPOINTS = [
  ['/api/system-status', 'GET', '公开', '页面底部轻量状态检查'],
  ['/api/monitor', 'GET', 'Bearer Token', 'Monitorflare 机器监控'],
  ['/api/payment/aud-cny', 'GET', '公开', 'AUD/CNY 汇率换算'],
  ['/api/payment/status', 'GET', '登录', '支付结果轮询'],
  ['/api/coupons/rental-preview', 'GET', '公开', '租赁优惠码试算'],
  ['/api/contract-sign/coupon-preview', 'GET', '签约 Token', '签约优惠码试算'],
  ['/api/address/autocomplete', 'GET', '员工 / 管理员', '地址联想'],
  ['/api/address/details', 'GET', '员工 / 管理员', 'Google 地点详情'],
  ['/api/device-agent/update', 'GET', '公开', 'Windows 客户端更新'],
  ['/api/device-agent/software-terms', 'GET', '公开', '客户端软件协议'],
  ['/api/device-agent/register', 'POST', '一次性访问码', '设备首次绑定'],
  ['/api/device-agent/register-legacy', 'POST', '旧版注册码', '旧版设备首次绑定'],
  ['/api/device-agent/heartbeat', 'POST', '设备 Token', '设备心跳'],
  ['/api/device-agent/inspection', 'POST', '设备 Token', '设备检查上报'],
  ['/api/device-agent/state', 'GET', '设备 / 监控 Token', '设备状态读取'],
  ['/api/device-agent/commands', 'GET', '设备 Token', '远程命令轮询'],
  ['/api/device-agent/commands/:id/ack', 'POST', '设备 Token', '命令确认'],
  ['/api/device-agent/commands/:id/start', 'POST', '设备 Token', '命令开始执行'],
  ['/api/device-agent/command-results', 'POST', '设备 Token', '命令结果上报'],
  ['/admin/connectivity/check', 'POST', '管理员 Session', '执行本页只读通讯检测'],
  ['/webhooks/stripe', 'POST', 'Stripe 签名', 'Stripe 付款事件回调'],
]

export function renderAdminConnectivity(user: any) {
  const probeCards = CONNECTIVITY_PROBES.map(probe => `<article class="panel connectivity-card" data-probe-id="${probe.id}">
    <div class="section-title"><div><p class="section-code">${sanitizePlainText(CATEGORY_LABELS[probe.category] || probe.category, 30)}</p><h3>${sanitizePlainText(probe.label, 60)}</h3></div><span class="badge badge-info" data-status>未检测</span></div>
    <p>${sanitizePlainText(probe.description, 160)}</p><code>${sanitizePlainText(probe.endpoint, 160)}</code>
    <div class="connectivity-result" data-result>点击检测以读取当前状态。</div>
    <button class="button button-sm button-secondary" type="button" data-check="${probe.id}">检测此项</button>
  </article>`).join('')
  const inboundRows = INBOUND_ENDPOINTS.map(([path, method, auth, use]) => `<tr><td><code>${sanitizePlainText(path, 120)}</code></td><td>${method}</td><td>${sanitizePlainText(auth, 40)}</td><td>${sanitizePlainText(use, 100)}</td></tr>`).join('')

  const body = `<div class="page-header"><div><p class="section-code">SYSTEM / CONNECTIVITY</p><h2>网站通讯检测</h2><p>主动检查 Worker、第三方 API 与设备客户端通道。检测不会发送邮件、创建付款或执行设备命令；第三方检测会计入对应服务的普通 API 请求量。</p></div><div class="record-actions"><button class="button button-primary" id="check-all" type="button">全部检测</button><a class="button button-secondary" href="/admin/monitoring">历史健康监控</a></div></div>
  <div class="grid grid-2" id="connectivity-grid">${probeCards}</div>
  <div class="panel"><div class="section-title"><div><p class="section-code">INBOUND API INVENTORY</p><h3>站内通讯接口目录</h3></div><span class="section-note">敏感接口仅列出，不执行写入测试</span></div><div class="table-wrapper"><table><thead><tr><th>接口</th><th>方法</th><th>鉴权</th><th>用途</th></tr></thead><tbody>${inboundRows}</tbody></table></div></div>
  <style>.connectivity-card code{display:block;margin:10px 0 14px;word-break:break-all}.connectivity-result{min-height:48px;margin:12px 0;color:var(--text-secondary)}.connectivity-result strong{display:block;color:var(--text-primary)}.connectivity-card.is-running{opacity:.72}</style>
  <script>(()=>{const labels={ok:'正常',warning:'注意',error:'失败',unconfigured:'未配置'},classes={ok:'badge-success',warning:'badge-warning',error:'badge-danger',unconfigured:'badge-warning'};function paint(result){const card=document.querySelector('[data-probe-id="'+result.id+'"]');if(!card)return;card.classList.remove('is-running');const badge=card.querySelector('[data-status]'),out=card.querySelector('[data-result]');badge.className='badge '+(classes[result.status]||'badge-info');badge.textContent=labels[result.status]||result.status;out.textContent='';const detail=document.createElement('strong');detail.textContent=result.detail;const meta=document.createElement('small');meta.textContent=result.latencyMs+' ms · '+new Date(result.checkedAt).toLocaleString('zh-CN');out.append(detail,meta)}async function run(target){const cards=target==='all'?document.querySelectorAll('[data-probe-id]'):[document.querySelector('[data-probe-id="'+target+'"]')];cards.forEach(card=>{if(card)card.classList.add('is-running')});try{const response=await fetch('/admin/connectivity/check',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({target})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||'检测请求失败');(payload.results||[]).forEach(paint)}catch(error){cards.forEach(card=>{if(!card)return;card.classList.remove('is-running');const badge=card.querySelector('[data-status]'),out=card.querySelector('[data-result]');badge.className='badge badge-danger';badge.textContent='失败';out.textContent=error.message||'检测请求失败'})}}document.getElementById('check-all').addEventListener('click',()=>run('all'));document.querySelectorAll('[data-check]').forEach(button=>button.addEventListener('click',()=>run(button.dataset.check)))})()</script>`
  return buildLayout('网站通讯检测 - 电脑租赁管理系统', body, user)
}
