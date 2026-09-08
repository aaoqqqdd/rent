/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 转账凭证 / 损坏照片一律走外部图床链接：拒绝 localhost / 内网 / 带账号密码的 URL。
export function validateHostedImageUrls(value: unknown, maxUrls = 5): string[] {
  const urls = String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean)
  if (!urls.length || urls.length > maxUrls) throw new Error(`请提供 1-${maxUrls} 个图片链接`)
  return urls.map(raw => {
    let parsed: URL
    try { parsed = new URL(raw) } catch { throw new Error('图片链接格式不正确') }
    const host = parsed.hostname.toLowerCase()
    const privateHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || privateHost) throw new Error('图片必须使用公开的 HTTPS 图床链接')
    return parsed.toString()
  })
}
