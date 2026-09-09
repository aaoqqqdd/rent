/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// styles.css 被打包进 Worker，内容随部署变化。这里用内容指纹给它的 URL 加版本号，
// 从而可以安全地对 /styles.css 设置一年期 immutable 缓存：部署后指纹变化即自动 cache-bust，
// 平时浏览器 / CF 边缘完全命中缓存，不再每小时回源重新拉 ~150KB。

import siteStyles from '../styles.css'
import clientScript from '../appClient.js.txt'

export const styleSheetText: string = siteStyles
export const appScriptText: string = clientScript

// FNV-1a 32-bit —— 快、稳定、无依赖，足够用作缓存版本号。
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export const styleSheetVersion: string = fnv1a(siteStyles)
export const styleSheetHref: string = `/styles.css?v=${styleSheetVersion}`

export const appScriptVersion: string = fnv1a(clientScript)
export const appScriptHref: string = `/app.js?v=${appScriptVersion}`
