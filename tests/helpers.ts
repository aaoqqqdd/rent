/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 用一个非正则的扫描器提取内联 <script> 体 —— 输入是我们自己渲染的可信 HTML，
// 只是想确认脚本能解析。刻意不用「过滤 HTML 标签的正则」，避开 CodeQL 的
// js/bad-tag-filter（那类正则要完全覆盖 </script > / 大小写 / 带属性等边角很难写对）。
export function extractInlineScripts(html: string): string[] {
  const bodies: string[] = []
  const hay = html.toLowerCase()
  let cursor = 0
  for (;;) {
    const tagStart = hay.indexOf('<script', cursor)
    if (tagStart === -1) break
    const openEnd = html.indexOf('>', tagStart)
    if (openEnd === -1) break
    const closeStart = hay.indexOf('</script', openEnd)
    if (closeStart === -1) break
    bodies.push(html.slice(openEnd + 1, closeStart))
    cursor = closeStart + '</script'.length
  }
  return bodies
}
