/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies or modified versions. */

// 移动端表格卡片化补齐：≤760px 时 CSS 把普通表格折叠成卡片，用
// `td::before { content: attr(data-label) }` 显示字段名。全站绝大多数表格没手写
// data-label，手机上就「只有值、没有字段名」。这里在 buildLayout 输出前统一补一次。
//
// 实现：纯字符串扫描，零新增依赖，Workers 运行时可直接跑。
// - 只在该 td 开标签末尾追加 ` data-label="…"`，绝不重排、重建或改写任何已有属性。
// - 列名取自同一表格 thead 第一行的 th（多行/合并表头无法逐列对齐，整表跳过）。
// - 嵌套表格各用各的表头；外层列名不会套到内层单元格上。
// - 含 <form>/<input>/<select>/<textarea> 的单元格不补字段名（卡片里按钮要整齐）。
// - 官方文档 / 打印表格（.official-document__table / .print-table / .contract-print-page）不处理。
// - 幂等：已带 data-label 的 td 不会被二次注入。
// - O(1) 早退：HTML 里没有 `<table` 时直接返回，不建正则、不扫描。

const SKIP_TABLE_CLASSES = ['official-document__table', 'print-table', 'contract-print-page']
const CONTAINER_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr']

interface TagMatch { name: string; start: number; end: number; closing: boolean; selfClosing: boolean; depth: number }
interface TableRecord { open: TagMatch; closeStart: number; depth: number }

const ATTRIBUTE_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeAttribute(value: string): string {
  let result = ''
  for (const character of value) result += ATTRIBUTE_ESCAPES[character] || character
  return result
}

/** 剥掉标签与实体，拿到表格头的可读纯文本。 */
function plainText(fragment: string): string {
  let text = ''
  let cursor = 0
  for (;;) {
    const start = fragment.indexOf('<', cursor)
    if (start === -1) { text += fragment.slice(cursor); break }
    text += fragment.slice(cursor, start)
    const end = fragment.indexOf('>', start)
    if (end === -1) break
    cursor = end + 1
  }
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 跳过引号内 '>'，返回标签结束位置（`>` 的下标）。 */
function tagEndAt(html: string, start: number): number {
  let quote = ''
  for (let index = start; index < html.length; index += 1) {
    const character = html[index]
    if (quote) { if (character === quote) quote = ''; continue }
    if (character === '"' || character === "'") { quote = character; continue }
    if (character === '>') return index
  }
  return -1
}

/** 顺序扫描标签，记录容器（table/thead/tbody/tr）层级。 */
function scanTags(html: string): TagMatch[] {
  const tags: TagMatch[] = []
  const lower = html.toLowerCase()
  let depth = 0
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start === -1) break
    if (lower.startsWith('<!--', start)) {
      const commentEnd = lower.indexOf('-->', start)
      cursor = commentEnd === -1 ? html.length : commentEnd + 3
      continue
    }
    const nameMatch = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(start, start + 40))
    if (!nameMatch) { cursor = start + 1; continue }
    const name = nameMatch[1].toLowerCase()
    const end = tagEndAt(html, start)
    if (end === -1) break
    if (name === 'script' || name === 'style') {
      const close = lower.indexOf(`</${name}`, end)
      if (close === -1) break
      const closeEnd = html.indexOf('>', close)
      cursor = closeEnd === -1 ? html.length : closeEnd + 1
      continue
    }
    const closing = nameMatch[0].startsWith('</')
    const selfClosing = html[end - 1] === '/'
    const tracked = CONTAINER_TAGS.includes(name)
    if (tracked && closing) depth = Math.max(0, depth - 1)
    tags.push({ name, start, end: end + 1, closing, selfClosing, depth })
    if (tracked && !closing && !selfClosing) depth += 1
    cursor = end + 1
  }
  return tags
}

function attributeSection(tagHtml: string): string {
  let start = 0
  while (start < tagHtml.length && tagHtml[start] !== ' ' && tagHtml[start] !== '\t' && tagHtml[start] !== '\n') start += 1
  return tagHtml.slice(start, tagHtml.endsWith('>') ? tagHtml.length - 1 : tagHtml.length)
}

function hasAttribute(tagHtml: string, name: string): boolean {
  const attributes = attributeSection(tagHtml)
  return attributes.includes(` ${name}=`) || attributes.includes(` ${name} =`)
}

function classList(tagHtml: string): string[] {
  const attributes = attributeSection(tagHtml)
  const marker = attributes.indexOf('class=')
  if (marker === -1) return []
  let value = attributes.slice(marker + 6).trimStart()
  if (value[0] === '"' || value[0] === "'") {
    const quote = value[0]
    const close = value.indexOf(quote, 1)
    value = close === -1 ? value.slice(1) : value.slice(1, close)
  } else {
    value = value.split(/\s/)[0]
  }
  return value.split(/\s+/).filter(Boolean)
}

/** 单元格内容里是否含表单控件（form / input / select / textarea）。 */
function cellHasFormControl(content: string): boolean {
  const tags = ['<form', '<input', '<select', '<textarea']
  for (const tag of tags) {
    if (content.indexOf(tag) !== -1) return true
  }
  return false
}

/** 只追加属性：原有属性与其顺序逐字保留。 */
function injectLabel(tagHtml: string, label: string): string {
  return `${tagHtml.slice(0, -1)} data-label="${escapeAttribute(label)}">`
}

function findTables(tags: TagMatch[]): TableRecord[] {
  const records: TableRecord[] = []
  const stack: TableRecord[] = []
  for (const tag of tags) {
    if (tag.name !== 'table') continue
    if (!tag.closing && !tag.selfClosing) {
      const record: TableRecord = { open: tag, closeStart: -1, depth: tag.depth }
      records.push(record)
      stack.push(record)
      continue
    }
    const record = stack.pop()
    if (record && record.closeStart === -1 && tag.start > record.open.end) record.closeStart = tag.start
  }
  return records.filter(record => record.closeStart > record.open.end)
}

function isSkippedTable(openTag: string): boolean {
  const classes = classList(openTag)
  return classes.some(name => SKIP_TABLE_CLASSES.includes(name))
}

/** 列名：本表 thead 第一行的 th 纯文本；表头有合并单元格或多行时返回 null。 */
function headerLabels(html: string, bodyTags: TagMatch[], table: TableRecord): string[] | null {
  const tbody = bodyTags.find(tag => tag.name === 'tbody' && !tag.closing)
  const limit = tbody ? tbody.start : table.closeStart
  const thead = bodyTags.find(tag => tag.name === 'thead' && !tag.closing)
  if (!thead) return null
  const headerRows = bodyTags.filter(tag => tag.name === 'tr' && !tag.closing && tag.start >= thead.end && tag.start < limit)
  if (headerRows.length !== 1) return null
  const row = headerRows[0]
  const headers = bodyTags.filter(tag => tag.name === 'th' && !tag.closing && tag.start >= row.end && tag.start < limit)
  if (!headers.length) return null
  const labels: string[] = []
  for (const header of headers) {
    if (hasAttribute(html.slice(header.start, header.end), 'rowspan') || hasAttribute(html.slice(header.start, header.end), 'colspan')) return null
    const close = bodyTags.find(tag => tag.name === 'th' && tag.closing && tag.start > header.end)
    labels.push(plainText(html.slice(header.end, close ? close.start : header.end)).slice(0, 40))
  }
  return labels.filter(Boolean).length ? labels : null
}

/** 处理一张表，返回需要追加 data-label 的单元格编辑；null 表示跳过。 */
function tableEdits(html: string, tags: TagMatch[], table: TableRecord): Array<{ start: number; end: number; html: string }> | null {
  const openTag = html.slice(table.open.start, table.open.end)
  if (isSkippedTable(openTag)) return null

  const bodyTags = tags.filter(tag => tag.start >= table.open.end && tag.start < table.closeStart)
  if (!bodyTags.length) return null
  const ownRowDepth = bodyTags.filter(tag => tag.name === 'tr').reduce((min, tag) => Math.min(min, tag.depth), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(ownRowDepth)) return null

  const labels = headerLabels(html, bodyTags, table)
  if (!labels) return null

  const rows = bodyTags.filter(tag => tag.name === 'tr' && !tag.closing && tag.depth === ownRowDepth)
  const edits: Array<{ start: number; end: number; html: string }> = []
  for (const [index, row] of rows.entries()) {
    const rowEnd = index + 1 < rows.length ? rows[index + 1].start : table.closeStart
    const rowOpen = html.slice(row.start, row.end)
    if (hasAttribute(rowOpen, 'rowspan') || hasAttribute(rowOpen, 'colspan')) continue
    const cells = bodyTags.filter(tag => tag.name === 'td' && !tag.closing && tag.depth === row.depth + 1 && tag.start >= row.end && tag.start < rowEnd)
    if (cells.length !== labels.length) continue
    for (const [position, cell] of cells.entries()) {
      const openTagHtml = html.slice(cell.start, cell.end)
      if (hasAttribute(openTagHtml, 'data-label')) continue
      if (hasAttribute(openTagHtml, 'rowspan') || hasAttribute(openTagHtml, 'colspan')) continue
      // 单元格内容（开标签之后到该行内 `</td>` 之前）里含表单控件时不补字段名。
      const closeTd = html.indexOf('</td', cell.end)
      const contentEnd = closeTd !== -1 && closeTd < rowEnd ? closeTd : rowEnd
      const content = html.slice(cell.end, contentEnd)
      if (cellHasFormControl(content)) continue
      edits.push({ start: cell.start, end: cell.end, html: injectLabel(openTagHtml, labels[position]) })
    }
  }
  return edits.length ? edits : null
}

/**
 * 给整页 HTML 中普通表格的 td 追加 `data-label`（列名取自同一表格 thead 的 th）。
 * 幂等；HTML 里没有 `<table` 时原样返回同一字符串（O(1) 早退）。
 */
export function injectTableDataLabels(html: string): string {
  if (!html || !html.includes('<table')) return html
  let output = html
  // 每轮从后往前找第一张还能补标签的表；补完重新扫描，嵌套表格随之覆盖。
  for (let pass = 0; pass < 8; pass += 1) {
    const tags = scanTags(output)
    const tables = findTables(tags)
    let changed = false
    for (let index = tables.length - 1; index >= 0; index -= 1) {
      const edits = tableEdits(output, tags, tables[index])
      if (!edits) continue
      for (const edit of edits.sort((left, right) => right.start - left.start)) {
        output = output.slice(0, edit.start) + edit.html + output.slice(edit.end)
      }
      changed = true
      break
    }
    if (!changed) break
  }
  return output
}
