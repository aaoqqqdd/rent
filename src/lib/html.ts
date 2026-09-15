/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import sanitizeHtml from 'sanitize-html'

export function sanitizeRichHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? ''), {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'a', 'span', 'div', 'hr', 'code', 'pre', 'img'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], '*': ['class', 'style'] },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['data'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        width: [/^\d+(\.\d+)?(%|px)$/],
        margin: [/^[\d\s.%px-]+$/], padding: [/^[\d\s.%px-]+$/],
        border: [/^[\d\s.#a-z()-]+$/i], 'border-collapse': [/^(collapse|separate)$/],
        'page-break-after': [/^(always|avoid|auto|left|right)$/],
        'break-after': [/^(auto|avoid|always|page|column|region)$/],
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
  })
}

// 把未被填充的 `${token}` / `{token}` 占位符替换为可读的空位标记。
// 用于把含合同变量的模板（如 rentalTerms）作为「范本」公开展示：读者看到结构，
// 未知字段显示为 —— 而不是花括号变量名。
export function neutralizeTemplateTokens(html: string, placeholder = '<span class="doc-blank">——</span>'): string {
  return String(html ?? '').replace(/\$?\{[a-z0-9_]+\}/gi, placeholder)
}

export function sanitizePlainText(value: unknown, maxLength = 500): string {
  return sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLength)
}

export function renderNotificationMarkdown(value: unknown): string {
  return sanitizeRichHtml(String(value ?? '').slice(0, 20000))
}

export function renderFlexibleContent(value: unknown, format?: unknown): string {
  return sanitizeRichHtml(String(value ?? '').slice(0, 20000))
}

type EmailShellOptions = {
  title: unknown
  content: string
  themeColor?: string
  eyebrow?: string
  footer: string
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
}

function renderEmailShell(options: EmailShellOptions): string {
  const safeTitle = sanitizePlainText(options.title, 200)
  const accent = /^#[0-9a-f]{6}$/i.test(String(options.themeColor)) ? String(options.themeColor) : '#f0a35b'
  const eyebrow = escapeHtml(options.eyebrow || '账户服务 / ACCOUNT SERVICE')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>@media only screen and (max-width:640px){.email-frame{padding:12px 8px!important}.email-header,.email-content,.email-footer{padding-left:20px!important;padding-right:20px!important}.email-title{font-size:24px!important}}</style></head><body style="margin:0;background:#e8eeeb;color:#172331;font-family:Arial,'Noto Sans SC','Microsoft YaHei',sans-serif;"><div class="email-frame" style="padding:28px 16px;background:#e8eeeb;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #ccd8d2;"><tr><td class="email-header" style="padding:24px 32px 22px;background:#172b2a;color:#f6faf7;border-bottom:4px solid ${accent};"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width:44px;height:44px;background:${accent};color:#172b2a;text-align:center;vertical-align:middle;font:700 16px/44px Arial,sans-serif;letter-spacing:-1px;">PR</td><td style="padding-left:14px;vertical-align:middle;"><div style="font:700 13px/1.2 Arial,sans-serif;letter-spacing:2.5px;color:#f6faf7;">PC RENTAL</div><div style="margin-top:6px;font:11px/1.2 Arial,sans-serif;letter-spacing:1.4px;color:#a9bdb6;">设备租赁 · 账户服务</div></td></tr></table></td></tr><tr><td class="email-content" style="padding:34px 32px 32px;"><div style="font:700 10px/1.2 Arial,sans-serif;letter-spacing:1.8px;color:${accent};text-transform:uppercase;">${eyebrow}</div><h1 class="email-title" style="margin:12px 0 20px;font-size:28px;line-height:1.28;font-weight:700;color:#172b2a;">${safeTitle}</h1><div style="width:44px;height:4px;background:${accent};margin-bottom:24px;"></div><div style="font-size:16px;line-height:1.8;color:#405450;">${options.content}</div></td></tr><tr><td class="email-footer" style="padding:18px 32px 20px;background:#f3f7f4;border-top:1px solid #d9e3de;color:#71817c;font-size:11px;line-height:1.75;">${options.footer}</td></tr></table></div></body></html>`
}

export function renderEmailNotificationHtml(title: unknown, content: unknown, companyName = 'PC Rental', themeColor = '#f0a35b'): string {
  const safeCompany = sanitizePlainText(companyName, 120)
  return renderEmailShell({
    title,
    content: renderFlexibleContent(content),
    themeColor,
    eyebrow: `${safeCompany} / MESSAGE`,
    footer: `${safeCompany}<br>这是一封系统通知邮件，请勿直接回复。`,
  })
}

// Marketing emails are admin-authored (ADMIN role only) and rendered solely by the
// recipient's mail client, not by our own site — so unlike renderNotificationMarkdown's
// narrow allowlist (aimed at user/staff-submitted content shown inside our own pages),
// this only needs to strip actively dangerous content (script execution, event handlers)
// while leaving full layout/styling freedom for real marketing HTML (tables, buttons,
// inline styles, <style> blocks) that the shared allowlist would otherwise mangle.
export function sanitizeMarketingEmailHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? '').slice(0, 20000), {
    allowedTags: false,
    allowedAttributes: false,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    disallowedTagsMode: 'discard',
    allowVulnerableTags: true, // script/style are dropped or defanged below, not left as-is; this only silences sanitize-html's console warning about them being in the (here: unrestricted) allowedTags set
    exclusiveFilter: (frame) => ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'noscript'].includes(frame.tag.toLowerCase()),
    transformTags: {
      '*': (tagName, attribs) => {
        const safe: Record<string, string> = {}
        for (const [key, value] of Object.entries(attribs)) {
          if (/^on/i.test(key)) continue
          if (['href', 'src', 'background', 'action'].includes(key.toLowerCase()) && /^\s*javascript:/i.test(value)) continue
          safe[key] = value
        }
        return { tagName, attribs: safe }
      },
    },
  })
}

export function renderMarketingEmailHtml(title: unknown, content: unknown, companyName = 'PC Rental', themeColor = '#f0a35b', unsubscribeUrl?: string): string {
  const safeCompany = sanitizePlainText(companyName, 120)
  const messageHtml = sanitizeMarketingEmailHtml(content)
  const safeUnsubscribeUrl = unsubscribeUrl && /^https?:\/\//i.test(unsubscribeUrl) ? escapeHtml(unsubscribeUrl.slice(0, 500)) : ''
  const footer = safeUnsubscribeUrl
    ? `${safeCompany}<br>这是一封营销推广邮件。如不想再收到此类邮件，请<a href="${safeUnsubscribeUrl}" style="color:#71818d;text-decoration:underline;">点击取消订阅</a>。`
    : `${safeCompany}<br>这是一封营销推广邮件。`
  return renderEmailShell({ title, content: messageHtml, themeColor, eyebrow: `${safeCompany} / OFFER`, footer })
}

export function renderPlainTextEmailHtml(title: unknown, text: unknown, companyName = 'PC Rental'): string {
  const paragraphs = sanitizePlainText(text, 20000)
    .split(/\n{2,}/)
    .map(paragraph => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return renderEmailShell({
    title,
    content: paragraphs,
    eyebrow: '账户服务 / ACCOUNT SERVICE',
    footer: `${sanitizePlainText(companyName, 120)}<br>这是一封系统邮件，请勿直接回复。`,
  })
}

export function createPageBreakHtml(): string {
  return '<div class="page-break" style="page-break-after: always; break-after: page;"></div><p><br></p>'
}
