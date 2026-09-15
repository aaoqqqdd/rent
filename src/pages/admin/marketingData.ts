/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatMelbourneDateTime, sanitizePlainText } from '../../site'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x))

export interface MarketingAnalyticsData {
  summary: {
    totalCustomers: number
    activeWithEmail: number
    sendableCustomers: number
    optedOutCustomers: number
    campaignCount: number
    recipientCount: number
    sentCount: number
    failedCount: number
  }
  optedOutCustomers: any[]
  campaigns: any[]
}

const count = (value: unknown) => Number(value || 0)

function deliveryRate(sent: number, failed: number): string {
  const total = sent + failed
  return total ? `${(sent / total * 100).toFixed(1)}%` : '-'
}

function campaignStatus(status: string): string {
  return ({ SENDING: '发送中', SENT: '已完成', FAILED: '失败' } as Record<string, string>)[status] || status || '-'
}

function campaignTone(status: string): string {
  return status === 'SENT' ? 'badge-success' : status === 'FAILED' ? 'badge-danger' : 'badge-neutral'
}

function renderOptedOutCustomers(customers: any[]): string {
  if (!customers.length) return '<div class="empty-state"><h3>暂无退订客户</h3><p>客户从营销邮件页脚取消订阅后，会在这里显示。</p></div>'
  const rows = customers.map(customer => `<tr data-search="${esc(`${customer.name || ''} ${customer.email || ''}`).toLowerCase()}">
    <td><strong>${esc(customer.name || '未填写姓名')}</strong><div class="section-note mono">${esc(customer.id)}</div></td>
    <td>${esc(customer.email || '-')}</td>
    <td><span class="badge ${customer.status === 'active' ? 'badge-success' : 'badge-neutral'}">${customer.status === 'active' ? '正常' : '已停用'}</span></td>
    <td>${customer.marketing_opt_out_at ? esc(formatMelbourneDateTime(customer.marketing_opt_out_at)) : '-'}</td>
    <td>${count(customer.campaign_count)} 批次</td>
    <td>${customer.last_marketing_sent_at ? esc(formatMelbourneDateTime(customer.last_marketing_sent_at)) : '-'}</td>
  </tr>`).join('')
  return `<div class="table-wrapper"><table><thead><tr><th>客户</th><th>邮箱</th><th>账户状态</th><th>退订时间</th><th>历史批次</th><th>最后发送</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

function renderCampaigns(campaigns: any[]): string {
  if (!campaigns.length) return '<div class="empty-state"><h3>暂无营销批次</h3><p>发送第一封营销邮件后，批次数据会显示在这里。</p></div>'
  const rows = campaigns.map(campaign => {
    const sent = count(campaign.sent_count)
    const failed = count(campaign.failed_count)
    return `<tr>
      <td><a href="/admin/marketing-emails/${encodeURIComponent(campaign.id)}"><strong>${esc(campaign.name)}</strong></a><div class="section-note">${esc(campaign.subject)}</div></td>
      <td>${count(campaign.recipient_count)}</td>
      <td>${sent}</td>
      <td>${failed}</td>
      <td>${deliveryRate(sent, failed)}</td>
      <td><span class="badge ${campaignTone(campaign.status)}">${campaignStatus(campaign.status)}</span></td>
      <td>${esc(formatMelbourneDateTime(campaign.created_at) || '-')}</td>
    </tr>`
  }).join('')
  return `<div class="table-wrapper"><table><thead><tr><th>批次</th><th>收件人数</th><th>成功</th><th>失败</th><th>成功率</th><th>状态</th><th>创建时间</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

export function renderAdminMarketingData(user: any, data: MarketingAnalyticsData): string {
  const s = data.summary
  const overallRate = deliveryRate(s.sentCount, s.failedCount)
  const stat = (title: string, value: string, note: string, tone = '') => `<div class="stat-card ${tone}"><h3>${title}</h3><div class="value">${value}</div><div class="trend">${note}</div></div>`
  const body = `<div class="page-header"><div><p class="section-code">MARKETING / ANALYTICS</p><h2>营销数据</h2><p>查看营销受众、退订情况和历史发送表现。已退订客户不会出现在营销邮件发送名单中。</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="button button-secondary" href="/admin/marketing-emails">写营销邮件</a><a class="button button-secondary" href="/admin/email-templates">系统邮件模板</a></div></div>
  <div class="stats-grid">
    ${stat('客户总数', String(s.totalCustomers), '全部客户账户')}
    ${stat('可发送客户', String(s.sendableCustomers), `活跃且有邮箱 · 已退订 ${s.optedOutCustomers} 人`, 'primary')}
    ${stat('累计发送', String(s.sentCount), `共 ${s.campaignCount} 个营销批次`)}
    ${stat('发送成功率', overallRate, `成功 ${s.sentCount} · 失败 ${s.failedCount}`, s.failedCount ? 'warning' : 'success')}
  </div>
  <div class="stats-grid">
    ${stat('活跃邮箱客户', String(s.activeWithEmail), '活跃客户且已填写邮箱')}
    ${stat('已退订客户', String(s.optedOutCustomers), '不会收到后续营销邮件', s.optedOutCustomers ? 'warning' : '')}
    ${stat('累计收件人记录', String(s.recipientCount), '所有营销批次合计')}
    ${stat('失败投递', String(s.failedCount), '包括退订后跳过和发送失败', s.failedCount ? 'warning' : '')}
  </div>
  <section class="panel"><div class="section-title"><div><p class="section-code">AUDIENCE / OPT-OUT</p><h3>已取消订阅的客户</h3></div><span class="section-note">${s.optedOutCustomers} 人</span></div><div class="record-archive__toolbar"><input type="search" id="marketingOptedOutSearch" class="form-control" placeholder="搜索姓名或邮箱…" autocomplete="off"><span class="record-archive__count" id="marketingOptedOutCount">显示 ${data.optedOutCustomers.length} 人</span></div><div id="marketingOptedOutList">${renderOptedOutCustomers(data.optedOutCustomers)}</div></section>
  <section class="panel"><div class="section-title"><div><p class="section-code">CAMPAIGNS / DELIVERY</p><h3>营销批次表现</h3></div><span class="section-note">最近 ${data.campaigns.length} 个批次</span></div>${renderCampaigns(data.campaigns)}</section>
  <script>(()=>{const search=document.getElementById('marketingOptedOutSearch');const list=document.querySelectorAll('#marketingOptedOutList tbody tr');const count=document.getElementById('marketingOptedOutCount');if(!search||!count)return;search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let visible=0;list.forEach(row=>{const hit=!q||(row.dataset.search||'').includes(q);row.style.display=hit?'':'none';if(hit)visible++;});count.textContent='显示 '+visible+' 人';});})();</script>`
  return buildLayout('营销数据 - 电脑租赁管理系统', body, user)
}
