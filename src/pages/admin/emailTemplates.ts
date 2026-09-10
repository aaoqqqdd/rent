import { buildLayout } from '../../site'

export async function renderAdminEmailTemplates(c: any, user: any) {
  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'").run() } catch (_) {}
  try { await c.env.RENT.prepare("ALTER TABLE email_templates ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#f0a35b'").run() } catch (_) {}
  await c.env.RENT.batch([
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('email_verification', '验证邮箱', '验证您的邮箱 - PC Rental', '您好 {customer_name}，请验证您的邮箱：{verification_url}')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('welcome_site', '欢迎来到网站', '欢迎来到 PC Rental', '欢迎您，{customer_name}！感谢您使用 PC Rental。')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('order_created', '订单已创建', '订单已创建 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 已创建。设备：{device_name}，租期：{start_date} 至 {end_date}。订单金额：{total_amount}。')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('order_approved', '订单审核通过', '订单审核通过 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 已审核通过。请在 {payment_due_date} 前完成付款。')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('payment_reminder', '付款提醒', '付款提醒 - {order_number}', '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}。')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('pickup_reminder', '取件提醒', '取件提醒 - {order_number}', '您好 {customer_name}，请于 {pickup_date} 到 {pickup_location} 取件。设备：{device_name}。')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('return_confirmed', '归还确认', '设备归还确认 - {order_number}', '您好 {customer_name}，我们已确认收到订单 {order_number} 的设备。感谢您的使用！')"),
    c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('password_reset', '密码重置', '重置您的登录密码', '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}')")
    , c.env.RENT.prepare("INSERT OR IGNORE INTO email_templates (id, name, subject, body) VALUES ('agreement_update', '协议更新通知', '协议内容已更新 - {company_name}', '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请打开通知详情查看最新版本。')")
  ])
  const rows = (await c.env.RENT.prepare('SELECT * FROM email_templates ORDER BY name').all()).results as any[]
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(Math.max(1, Number(new URL(c.req.url).searchParams.get('page') || 1) || 1), pageCount)
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x))
  const variables = '{customer_name}、{customer_email}、{order_number}、{contract_number}、{device_name}、{start_date}、{end_date}、{rental_period}、{pickup_date}、{pickup_location}、{return_date}、{return_location}、{total_amount}、{deposit_amount}、{refund_amount}、{payment_due_date}、{sign_url}、{verification_url}、{reset_url}、{company_name}、{company_email}'
  const variableIndex = `<details class="variable-index"><summary>可用变量（${variables.split('、').length} 项）</summary><section class="contract-variable-group"><div class="variable-chip-list">${variables.split('、').map(variable => `<code>${variable}</code>`).join('')}</div></section></details>`
  const isBuiltin = (id: string) => !String(id).startsWith('custom_')
  const themeOf = (row: any) => row.theme_color || (isBuiltin(row.id) ? '#f0a35b' : '#71818d')

  const createForm = `<div class="panel"><div class="section-title"><h3>新建模板</h3><span class="section-note">管理员可创建自定义通知模板</span></div><form method="post" action="/admin/email-templates" class="form-grid"><div><label class="form-label">模板名称</label><input class="form-control" name="name" maxlength="80" required></div><div><label class="form-label">邮件主题</label><input class="form-control" name="subject" maxlength="200" required></div><div><label class="form-label">主题色</label><input class="form-control" type="color" name="theme_color" value="#71818d"></div><div style="grid-column:1/-1"><label class="form-label">正文（HTML）</label><textarea class="form-control html-editor" name="body" rows="8" maxlength="10000" required></textarea></div><div style="grid-column:1/-1">${variableIndex}</div><div style="grid-column:1/-1"><button class="button button-primary" type="submit">添加模板</button></div></form></div>`

  const items = pageRows.map(row => {
    const builtin = isBuiltin(row.id)
    return `<details class="record-archive__item" data-search="${esc(`${row.name} ${row.subject} ${row.body}`).toLowerCase()}"><summary class="record-archive__summary"><span class="record-archive__seq">${builtin ? '内置' : '自定义'}</span><span class="record-archive__title">${esc(row.name)}</span><span class="record-archive__meta"><span class="badge ${row.enabled ? 'badge-success' : 'badge-neutral'}">${row.enabled ? '启用' : '停用'}</span></span></summary><div class="record-archive__body"><form method="post" action="/admin/email-templates/${esc(row.id)}"><label class="form-label">主题</label><input class="form-control" name="subject" value="${esc(row.subject)}" maxlength="200" required><label class="form-label">主题色</label><input class="form-control" type="color" name="theme_color" value="${esc(themeOf(row))}"><label class="form-label">正文（HTML）</label><textarea class="form-control html-editor" name="body" rows="8" maxlength="10000" required>${esc(row.body)}</textarea><div class="record-archive__actions"><button class="button button-primary" type="submit">保存模板</button></div></form>${builtin ? '' : `<form method="post" action="/admin/email-templates/${esc(row.id)}/delete" onsubmit="return confirm('确定删除这个自定义模板吗？')"><button class="button button-sm button-danger" type="submit">删除模板</button></form>`}</div></details>`
  }).join('')

  const countLabel = pageCount > 1 ? `第 ${page}/${pageCount} 页 · 共 ${rows.length} 条` : `共 ${rows.length} 条`
  const pagination = pageCount > 1 ? `<nav class="record-archive__pagination" aria-label="通知模板分页">${Array.from({ length: pageCount }, (_, i) => `<a class="button button-sm ${i + 1 === page ? 'button-primary' : 'button-secondary'}" href="/admin/email-templates?page=${i + 1}">${i + 1}</a>`).join('')}</nav>` : ''
  const archive = `<div class="record-archive"><div class="record-archive__toolbar"><input type="search" id="templateSearch" class="form-control" placeholder="在本页搜索名称、主题或正文…" autocomplete="off"><span class="record-archive__count" id="templateCount" data-base="${countLabel}">${countLabel}</span></div><div class="record-archive__list">${items}</div><p class="empty-state" id="templateNoResult" style="display:none">本页没有匹配的模板</p>${pagination}</div>`

  const script = `<script>(()=>{const s=document.getElementById('templateSearch');if(!s)return;const list=[...document.querySelectorAll('.record-archive__item')];const count=document.getElementById('templateCount');const none=document.getElementById('templateNoResult');const run=()=>{const q=s.value.trim().toLowerCase();let n=0;list.forEach(it=>{const hit=!q||(it.dataset.search||'').includes(q);it.style.display=hit?'':'none';if(hit)n++;});count.textContent=q?('匹配 '+n+' 条'):count.dataset.base;none.style.display=q&&!n?'':'none';};s.addEventListener('input',run);})();</script>`

  const body = `<div class="entity-header"><div class="identity-strip mono"><span>COMMUNICATION / NOTIFICATIONS</span><span>${rows.length} TEMPLATES</span></div><div class="entity-heading"><div><p class="section-code">MESSAGE LIBRARY</p><h2>通知模板</h2><p>管理站内通知、邮件和欢迎/验证类消息，点击模板名称展开编辑。</p></div></div></div>${createForm}${archive}${script}`
  return buildLayout('邮件通知模板 - 电脑租赁管理系统', body, user)
}
