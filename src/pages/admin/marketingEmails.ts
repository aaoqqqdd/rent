import { buildLayout, sanitizePlainText } from '../../site'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x))

const MARKETING_VARIABLES = '{customer_name}、{company_name}、{company_email}、{promotion_title}、{promotion_description}、{discount_amount}、{coupon_code}、{promo_end_date}、{browse_url}、{unsubscribe_url}、{device_1_name}、{device_1_description}、{device_1_url}、{device_2_name}、{device_2_description}、{device_2_url}、{customer_email}、{discount_text}'

function variableIndex(): string {
  return `<details class="variable-index"><summary>可用变量（${MARKETING_VARIABLES.split('、').length} 项）</summary><section class="contract-variable-group"><div class="variable-chip-list">${MARKETING_VARIABLES.split('、').map(v => `<code>${v}</code>`).join('')}</div><ul class="variable-index-notes"><li><code>{coupon_code}</code>、<code>{discount_amount}</code>、<code>{discount_text}</code> 和 <code>{promo_end_date}</code> 仅在下方选择了优惠码后才会被替换，否则为空。</li><li><code>{unsubscribe_url}</code> 是每位收件人的专属退订地址，系统也会在邮件页脚自动附上退订链接。</li><li><code>{device_1_*}</code> 和 <code>{device_2_*}</code> 会自动填入当前设备列表中的前两台设备。</li></ul></section></details>`
}

function templateManager(templates: any[]): string {
  const items = templates.map(row => `<details class="record-archive__item" data-search="${esc(`${row.name} ${row.subject} ${row.body}`).toLowerCase()}"><summary class="record-archive__summary"><span class="record-archive__title">${esc(row.name)}</span><span class="record-archive__meta">${esc(row.subject)}</span></summary><div class="record-archive__body"><form method="post" action="/admin/marketing-emails/templates/${esc(row.id)}"><label class="form-label">模板名称</label><input class="form-control" name="name" value="${esc(row.name)}" maxlength="80" required><label class="form-label">邮件主题</label><input class="form-control" name="subject" value="${esc(row.subject)}" maxlength="200" required><label class="form-label">主题色</label><input class="form-control" type="color" name="theme_color" value="${esc(row.theme_color || '#f0a35b')}"><label class="form-label">正文（支持完整 HTML）</label><textarea class="form-control html-editor" name="body" rows="8" maxlength="10000" required>${esc(row.body)}</textarea><div class="record-archive__actions"><button class="button button-primary" type="submit">保存模板</button></div></form><form method="post" action="/admin/marketing-emails/templates/${esc(row.id)}/delete" onsubmit="return confirm('确定删除这个营销模板吗？')"><button class="button button-sm button-danger" type="submit">删除模板</button></form></div></details>`).join('')
  const createForm = `<div class="panel"><div class="section-title"><h3>新建营销模板</h3><span class="section-note">可反复用于不同批次的营销邮件</span></div><form method="post" action="/admin/marketing-emails/templates" class="form-grid"><div><label class="form-label">模板名称</label><input class="form-control" name="name" maxlength="80" required placeholder="例如：新年促销"></div><div><label class="form-label">邮件主题</label><input class="form-control" name="subject" maxlength="200" required placeholder="例如：新年折扣来袭，{customer_name} 专属优惠"></div><div><label class="form-label">主题色</label><input class="form-control" type="color" name="theme_color" value="#f0a35b"></div><div style="grid-column:1/-1"><label class="form-label">正文（支持完整 HTML）</label><textarea class="form-control html-editor" name="body" rows="8" maxlength="10000" required placeholder="您好 {customer_name}，使用专属优惠码 {coupon_code} 享受 {discount_text}！"></textarea></div><div style="grid-column:1/-1">${variableIndex()}</div><div style="grid-column:1/-1"><button class="button button-primary" type="submit">添加模板</button></div></form></div>`
  const archive = `<div class="record-archive"><div class="record-archive__toolbar"><input type="search" id="marketingTemplateSearch" class="form-control" placeholder="在本页搜索名称、主题或正文…" autocomplete="off"><span class="record-archive__count" id="marketingTemplateCount" data-base="共 ${templates.length} 条">共 ${templates.length} 条</span></div><div class="record-archive__list">${items || '<p class="empty-state">暂无自定义营销模板</p>'}</div></div>`
  const script = `<script>(()=>{const s=document.getElementById('marketingTemplateSearch');if(!s)return;const list=[...document.querySelectorAll('#marketingTemplatesPanel .record-archive__item')];const count=document.getElementById('marketingTemplateCount');const run=()=>{const q=s.value.trim().toLowerCase();let n=0;list.forEach(it=>{const hit=!q||(it.dataset.search||'').includes(q);it.style.display=hit?'':'none';if(hit)n++;});count.textContent=q?('匹配 '+n+' 条'):count.dataset.base;};s.addEventListener('input',run);})();</script>`
  return `<div id="marketingTemplatesPanel">${createForm}${archive}${script}</div>`
}

function composeForm(templates: any[], coupons: any[], customers: any[]): string {
  const templateOptions = `<option value="custom">自定义内容</option>${templates.map(t => `<option value="${esc(t.id)}" data-subject="${esc(t.subject)}" data-body="${esc(t.body)}" data-theme="${esc(t.theme_color || '#f0a35b')}">${esc(t.name)}</option>`).join('')}`
  const couponOptions = coupons.map(cp => `<option value="${esc(cp.id)}">${esc(cp.code)} · ${cp.discount_type === 'percent' ? `${cp.discount_value}%` : `AUD$${Number(cp.discount_value).toFixed(2)}`}</option>`).join('')
  const recipientOptions = customers.map(u => `<option value="${esc(u.id)}">${esc(u.name || u.email)} · ${esc(u.email)}</option>`).join('')
  return `<div class="panel"><div class="section-title"><h3>新建营销邮件</h3><span class="section-note">选择模板或自定义内容，可选择性附带优惠码</span></div>
  <form method="post" action="/admin/marketing-emails/send" class="form-grid" id="marketingComposeForm">
    <div><label class="form-label">批次名称（仅后台可见）</label><input class="form-control" name="name" maxlength="120" required placeholder="例如：2026年会员专属促销"></div>
    <div><label class="form-label">使用模板</label><select class="form-control" id="marketingTemplateSelect" name="templateId">${templateOptions}</select></div>
    <div style="grid-column:1/-1"><label class="form-label">邮件主题</label><input class="form-control" id="marketingSubject" name="subject" maxlength="200" required></div>
    <div><label class="form-label">推广标题（可选）</label><input class="form-control" name="promotionTitle" maxlength="200" placeholder="默认使用邮件主题"></div>
    <div><label class="form-label">推广简介（可选）</label><input class="form-control" name="promotionDescription" maxlength="500" placeholder="默认使用优惠说明"></div>
    <div style="grid-column:1/-1"><label class="form-label">邮件主题色</label><input class="form-control" id="marketingThemeColor" type="color" name="theme_color" value="#f0a35b"></div>
    <div style="grid-column:1/-1"><label class="form-label">正文（支持完整 HTML：可直接粘贴带样式、图片、按钮、表格排版的邮件设计稿）</label><textarea class="form-control html-editor" id="marketingBody" name="body" rows="10" maxlength="20000" required placeholder="&lt;p&gt;您好 {customer_name}...&lt;/p&gt;"></textarea></div>
    <div style="grid-column:1/-1">${variableIndex()}</div>

    <div style="grid-column:1/-1" class="panel" >
      <h4>收件人</h4>
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="marketingSendAll" name="sendToAll"> 发送给全部活跃客户（共 ${customers.length} 人）</label>
      <div id="marketingRecipientPicker">
        <label class="form-label" for="marketingRecipient">或选择指定客户（可多选）</label>
        <input class="form-control recipient-search" id="marketingRecipientSearch" type="search" placeholder="搜索姓名或邮箱…" autocomplete="off">
        <div class="recipient-picker-actions"><button type="button" class="button button-sm button-secondary" id="marketingSelectVisible">全选当前结果</button><button type="button" class="button button-sm button-secondary" id="marketingClearRecipients">清空选择</button><span id="marketingRecipientCount" class="section-note">已选 0 人</span></div>
        <select class="form-control recipient-select" id="marketingRecipient" name="recipientId" multiple size="7">${recipientOptions}</select>
      </div>
    </div>

    <div style="grid-column:1/-1" class="panel">
      <h4>优惠码</h4>
      <div class="grid grid-2">
        <label style="display:flex;gap:8px;align-items:center;"><input type="radio" name="couponMode" value="none" checked> 不附带优惠码</label>
        <label style="display:flex;gap:8px;align-items:center;"><input type="radio" name="couponMode" value="shared"> 使用已有优惠码（所有人共用）</label>
        <label style="display:flex;gap:8px;align-items:center;"><input type="radio" name="couponMode" value="unique"> 为每位收件人生成专属唯一优惠码</label>
      </div>
      <div id="couponSharedFields" style="display:none;margin-top:8px;">
        <label class="form-label">选择优惠码</label>
        <select class="form-control" name="couponId">${couponOptions || '<option value="">暂无可用优惠码，请先在优惠码管理中创建</option>'}</select>
      </div>
      <div id="couponUniqueFields" style="display:none;margin-top:8px;" class="grid grid-2">
        <select class="form-control" name="uniqueDiscountType"><option value="percent">百分比折扣</option><option value="fixed">固定金额折扣</option></select>
        <input class="form-control" name="uniqueDiscountValue" type="number" min="0.01" step="0.01" placeholder="折扣值">
        <input class="form-control" name="uniqueMaxDiscountAmount" type="number" min="0" step="0.01" placeholder="最高优惠金额（仅百分比折扣，可留空）">
        <input class="form-control" name="uniqueExpiresAt" type="datetime-local">
        <input class="form-control" name="uniqueCodePrefix" maxlength="12" placeholder="优惠码前缀（可留空，例如 VIP）">
        <small class="form-text" style="grid-column:1/-1">系统会为每位收件人生成一个仅限本人使用一次的独立优惠码，并自动填充到邮件正文的 {coupon_code} 中。</small>
      </div>
    </div>

    <div style="grid-column:1/-1"><button class="button button-primary" type="submit">发送营销邮件</button></div>
  </form></div>
  <script>(()=>{
    const templateSelect=document.getElementById('marketingTemplateSelect'),subject=document.getElementById('marketingSubject'),body=document.getElementById('marketingBody'),theme=document.getElementById('marketingThemeColor');
    const syncTemplate=()=>{const opt=templateSelect.options[templateSelect.selectedIndex];if(!opt||opt.value==='custom')return;subject.value=opt.dataset.subject||'';body.value=opt.dataset.body||'';theme.value=opt.dataset.theme||'#f0a35b';};
    templateSelect?.addEventListener('change',syncTemplate);
    const sendAll=document.getElementById('marketingSendAll'),picker=document.getElementById('marketingRecipientPicker');
    const syncPicker=()=>{picker.style.display=sendAll.checked?'none':'';};
    sendAll?.addEventListener('change',syncPicker);syncPicker();
    const search=document.getElementById('marketingRecipientSearch'),select=document.getElementById('marketingRecipient'),count=document.getElementById('marketingRecipientCount');
    const updateCount=()=>{const q=search.value.trim().toLowerCase();Array.from(select.options).forEach(o=>{o.hidden=Boolean(q&&!o.textContent.toLowerCase().includes(q));});count.textContent='已选 '+Array.from(select.selectedOptions).length+' 人';};
    search?.addEventListener('input',updateCount);select?.addEventListener('change',updateCount);
    document.getElementById('marketingSelectVisible')?.addEventListener('click',()=>{Array.from(select.options).forEach(o=>{if(!o.hidden)o.selected=true;});updateCount();});
    document.getElementById('marketingClearRecipients')?.addEventListener('click',()=>{Array.from(select.options).forEach(o=>o.selected=false);updateCount();});
    updateCount();
    const modeRadios=document.querySelectorAll('input[name="couponMode"]'),sharedFields=document.getElementById('couponSharedFields'),uniqueFields=document.getElementById('couponUniqueFields');
    const syncCouponMode=()=>{const mode=document.querySelector('input[name="couponMode"]:checked')?.value;sharedFields.style.display=mode==='shared'?'':'none';uniqueFields.style.display=mode==='unique'?'':'none';};
    modeRadios.forEach(r=>r.addEventListener('change',syncCouponMode));syncCouponMode();
    document.getElementById('marketingComposeForm')?.addEventListener('submit',(e)=>{const mode=document.querySelector('input[name="couponMode"]:checked')?.value;if(!sendAll.checked&&!Array.from(select.selectedOptions).length){e.preventDefault();alert('请选择至少一位收件人，或勾选"发送给全部活跃客户"');return;}if(mode==='shared'&&!document.querySelector('select[name="couponId"]').value){e.preventDefault();alert('请选择一个已有优惠码');}});
  })();</script>`
}

function statusLabel(status: string): string {
  return ({ SENDING: '发送中', SENT: '已发送', FAILED: '失败' } as Record<string, string>)[status] || status
}

function couponModeLabel(mode: string): string {
  return ({ none: '无', shared: '共用优惠码', unique: '专属唯一优惠码' } as Record<string, string>)[mode] || mode
}

function history(campaigns: any[]): string {
  if (!campaigns.length) return '<div class="panel"><div class="section-title"><h3>发送历史</h3></div><p class="empty-state">暂无营销邮件发送记录</p></div>'
  const rows = campaigns.map(item => `<tr>
    <td>${esc(item.name)}</td>
    <td>${esc(item.subject)}</td>
    <td>${couponModeLabel(item.coupon_mode)}</td>
    <td>${item.recipient_count}</td>
    <td>${item.sent_count}${item.failed_count ? ` / 失败 ${item.failed_count}` : ''}</td>
    <td><span class="badge ${item.status === 'SENT' ? 'badge-success' : item.status === 'FAILED' ? 'badge-danger' : 'badge-neutral'}">${statusLabel(item.status)}</span></td>
    <td>${esc(item.created_at)}</td>
    <td><a class="button button-sm button-secondary" href="/admin/marketing-emails/${encodeURIComponent(item.id)}">查看</a></td>
  </tr>`).join('')
  return `<div class="panel"><div class="section-title"><h3>发送历史</h3><span class="section-note">共 ${campaigns.length} 批次</span></div><div class="table-wrapper"><table><thead><tr><th>批次名称</th><th>主题</th><th>优惠码</th><th>收件人数</th><th>发送情况</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
}

export function renderAdminMarketingEmails(user: any, data: { templates: any[]; campaigns: any[]; coupons: any[]; customers: any[]; optedOutCount?: number }): string {
  const optedOutNote = data.optedOutCount ? `<p class="form-text">另有 ${data.optedOutCount} 位客户已取消订阅营销邮件，未在下方收件人列表中显示。<a href="/admin/marketing-emails/data">查看营销数据</a></p>` : `<p class="form-text"><a href="/admin/marketing-emails/data">查看营销数据和退订客户</a></p>`
  const body = `<div class="entity-header"><div class="identity-strip mono"><span>MARKETING / CAMPAIGNS</span><span>${data.customers.length} ACTIVE CUSTOMERS</span></div><div class="entity-heading"><div><p class="section-code">CUSTOMER OUTREACH</p><h2>营销邮件</h2><p>创建可复用的营销模板，向客户群发促销邮件，并可选择性地为每位收件人生成专属一次性优惠码。</p>${optedOutNote}</div></div></div>
  ${composeForm(data.templates, data.coupons, data.customers)}
  <div class="panel"><div class="section-title"><h3>营销模板库</h3><span class="section-note">共 ${data.templates.length} 个</span></div>${templateManager(data.templates)}</div>
  ${history(data.campaigns)}`
  return buildLayout('营销邮件 - 电脑租赁管理系统', body, user)
}

export function renderAdminMarketingEmailDetail(user: any, campaign: any, recipients: any[]): string {
  const rows = recipients.map(r => `<tr>
    <td>${esc(r.email)}</td>
    <td class="mono">${esc(r.coupon_code || '-')}</td>
    <td><span class="badge ${r.status === 'SENT' ? 'badge-success' : r.status === 'FAILED' ? 'badge-danger' : 'badge-neutral'}">${r.status === 'SENT' ? '已发送' : r.status === 'FAILED' ? '失败' : '待发送'}</span></td>
    <td>${esc(r.error_message || '-')}</td>
  </tr>`).join('')
  const body = `<div class="page-header"><div><p class="section-code">MARKETING / CAMPAIGNS</p><h2>${esc(campaign.name)}</h2><p>主题：${esc(campaign.subject)} · ${couponModeLabel(campaign.coupon_mode)} · ${statusLabel(campaign.status)}</p></div><a class="button button-secondary" href="/admin/marketing-emails">返回营销邮件</a></div>
  <div class="panel"><div class="section-title"><h3>收件人明细</h3><span class="section-note">共 ${recipients.length} 人 · 已发送 ${campaign.sent_count} · 失败 ${campaign.failed_count}</span></div><div class="table-wrapper"><table><thead><tr><th>邮箱</th><th>优惠码</th><th>状态</th><th>错误信息</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
  return buildLayout(`${campaign.name} - 营销邮件`, body, user)
}
