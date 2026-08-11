import { buildLayout } from '../../site'

export async function renderAdminEmailTemplates(c: any, user: any) {
  await c.env.RENT.prepare('CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  const rows = (await c.env.RENT.prepare('SELECT * FROM email_templates ORDER BY name').all()).results as any[]
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x))
  const body = `<div class="entity-header"><div class="identity-strip mono"><span>COMMUNICATION / EMAIL</span><span>${rows.length} TEMPLATES</span></div><div class="entity-heading"><div><p class="section-code">MESSAGE LIBRARY</p><h2>邮件通知模板</h2><p>创建和维护常用邮件内容，发送时可直接选择模板。</p></div></div></div><div class="panel email-template-list">${rows.map(row => `<form method="post" action="/admin/email-templates/${esc(row.id)}" class="email-template-card"><div class="section-title"><h3>${esc(row.name)}</h3><span class="badge ${row.enabled ? 'badge-success' : 'badge-neutral'}">${row.enabled ? '启用' : '停用'}</span></div><label class="form-label">邮件主题</label><input class="form-control" name="subject" value="${esc(row.subject)}" required><label class="form-label">邮件正文</label><textarea class="form-control" name="body" rows="5" required>${esc(row.body)}</textarea><small class="form-text">可用变量：{customer_name}、{order_number}、{contract_number}、{refund_amount}、{sign_url}</small><button class="button button-primary" type="submit">保存模板</button></form>`).join('')}</div>`
  return buildLayout('邮件通知模板 - 电脑租赁管理系统', body, user)
}
