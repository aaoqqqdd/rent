/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 列表分页的统一约定：URL 参数 `page`，默认每页 50 条。
//
// 以前 /staff/orders、/staff/customers、/admin/users 这些列表会把整表读进 Worker
// 内存再 filter，用户量/订单量一涨就是全表扫描 + 大量对象分配。现在统一改成
// 「SQL COUNT + LIMIT/OFFSET」，本文件只负责参数解析和分页条 HTML。

export const DEFAULT_PAGE_SIZE = 50
/** 防止 `?page=999999999` 之类让 OFFSET 溢出/慢查询。 */
const MAX_PAGE = 100_000

export interface PageRequest {
  /** 规范化后的页码，从 1 开始。 */
  page: number
  pageSize: number
  offset: number
}

export interface PaginationMeta extends PageRequest {
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  /** 本页实际条数（渲染层用它决定是否显示空状态）。 */
  count: number
}

/** `page` 的解析：非数字、0、负数、小数、超大都回到 1。 */
export function normalizePage(raw: unknown, fallback = 1): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  const page = Math.floor(value)
  if (page < 1) return fallback
  if (page > MAX_PAGE) return MAX_PAGE
  return page
}

export function parsePageRequest(raw: unknown, pageSize: number = DEFAULT_PAGE_SIZE): PageRequest {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE
  const page = normalizePage(raw)
  return { page, pageSize: size, offset: (page - 1) * size }
}

/**
 * 页越界时回落。
 *
 * - 总数已知（先 COUNT 再取页）：page 超过最后一页时落到最后一页，`?page=99`
 *   看到的是真实数据而不是空表；total = 0 时固定第 1 页。
 * - 总数未知（先取页、发现空页后才回查 COUNT）：没有数据时固定第 1 页，
 *   否则把请求页原样返回，由调用方决定是否回查。
 */
export function clampPageRequest(request: PageRequest, total?: number): PageRequest {
  if (total === undefined) return request
  if (total <= 0) return { ...request, page: 1, offset: 0 }
  const totalPages = Math.max(1, Math.ceil(total / request.pageSize))
  if (request.page <= totalPages) return request
  const page = totalPages
  return { ...request, page, offset: (page - 1) * request.pageSize }
}

/** 从 Hono 的 Context / 请求 URL 里取 `page`。 */
export function readPageFromUrl(url: string | URL): string | null {
  try {
    return new URL(String(url)).searchParams.get('page')
  } catch {
    return null
  }
}

export function buildPaginationMeta(total: number, request: PageRequest, count = 0): PaginationMeta {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const totalPages = Math.max(1, Math.ceil(safeTotal / request.pageSize))
  const page = Math.min(Math.max(1, request.page), totalPages)
  return {
    ...request,
    page,
    offset: (page - 1) * request.pageSize,
    total: safeTotal,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    count,
  }
}

/** 生成分页链接：保留当前查询串里的所有筛选条件，只替换 `page`。 */
export function pageHref(basePath: string, search: string, page: number): string {
  const params = new URLSearchParams(search || '')
  if (page > 1) params.set('page', String(page))
  else params.delete('page')
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export interface PagerOptions {
  /** 列表根路径，例如 `/staff/orders`。 */
  basePath: string
  /** 当前查询串（不带 `?`），用于保留筛选条件。 */
  search?: string
  label?: string
}

/**
 * 「上一页 / 下一页」分页条。只在多于 1 页时输出。
 *
 * 页面用服务端渲染 + SPA 局部导航（只替换 .content），普通 <a> 就能工作；
 * 分页条上标 `data-full-navigation`，保证翻页一定触发整页加载，
 * 避免浏览器缓存返回过期的局部页面。
 */
export function renderPager(meta: PaginationMeta, options: PagerOptions): string {
  if (!meta) return ''
  if (meta.totalPages <= 1) {
    // 只有一页：给出总数，帮助用户确认筛选没漏数据。
    return `<div class="pager" data-pager><span class="pager__summary">共 ${meta.total} 条</span></div>`
  }
  const label = options.label || '条'
  const prevHref = pageHref(options.basePath, options.search || '', meta.page - 1)
  const nextHref = pageHref(options.basePath, options.search || '', meta.page + 1)
  const prev = meta.hasPrev
    ? `<a class="button button-sm button-secondary pager__link" data-full-navigation="true" rel="prev" href="${prevHref}">上一页</a>`
    : `<span class="button button-sm button-secondary pager__link" aria-disabled="true">上一页</span>`
  const next = meta.hasNext
    ? `<a class="button button-sm button-secondary pager__link" data-full-navigation="true" rel="next" href="${nextHref}">下一页</a>`
    : `<span class="button button-sm button-secondary pager__link" aria-disabled="true">下一页</span>`
  return `<nav class="pager" data-pager aria-label="分页导航"><span class="pager__summary">第 ${meta.page} / ${meta.totalPages} 页，共 ${meta.total} ${label}</span><div class="pager__controls">${prev}${next}</div></nav>`
}
