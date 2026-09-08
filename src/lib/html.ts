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

export function renderEmailNotificationHtml(title: unknown, content: unknown, companyName = 'PC Rental', themeColor = '#f0a35b'): string {
  const safeTitle = sanitizePlainText(title, 200)
  const safeCompany = sanitizePlainText(companyName, 120)
  const accent = /^#[0-9a-f]{6}$/i.test(String(themeColor)) ? String(themeColor) : '#f0a35b'
  const messageHtml = renderFlexibleContent(content)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="margin:0;background:#e9eef1;color:#172331;font-family:Arial,'Noto Sans SC',sans-serif;"><div style="padding:32px 16px;background:#e9eef1;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #cbd7df;box-shadow:0 12px 32px rgba(23,35,49,.12);"><tr><td style="padding:28px 32px;background:#172331;color:#f5f8fa;border-bottom:5px solid ${accent};"><div style="font:700 12px/1.2 Arial,sans-serif;letter-spacing:2px;color:${accent};">PR / PC RENTAL</div><div style="margin-top:14px;font-size:12px;letter-spacing:1.5px;color:#aebdca;">ASSET OPS · CUSTOMER NOTICE</div></td></tr><tr><td style="padding:36px 32px 30px;"><div style="font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.8px;color:${accent};text-transform:uppercase;">${safeCompany} / MESSAGE</div><h1 style="margin:12px 0 22px;font-size:28px;line-height:1.25;color:#172331;">${safeTitle}</h1><div style="height:1px;background:#d7e0e6;margin-bottom:24px;"></div><div style="font-size:16px;line-height:1.8;color:#40515e;">${messageHtml}</div></td></tr><tr><td style="padding:20px 32px;background:#f5f8fa;border-top:1px solid #d7e0e6;color:#71818d;font:11px/1.7 monospace;">${safeCompany}<br>这是一封系统通知邮件，请勿直接回复。</td></tr></table></div></body></html>`
}

export function createPageBreakHtml(): string {
  return '<div class="page-break" style="page-break-after: always; break-after: page;"></div><p><br></p>'
}
