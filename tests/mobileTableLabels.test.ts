/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies or modified versions. */

// 移动端表格卡片化：buildLayout 输出前统一给 td 注入 data-label（取自对应 thead 的列标题）。
// 覆盖：单表、多表、分组（多行）thead 跳过、无 thead、列数不匹配、手写 data-label 保留、
// 嵌套表格、官方文档/打印表跳过、表单单元格跳过、属性顺序不变、无表格早退、幂等，
// 以及 buildLayout 端到端接入。

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { injectTableDataLabels } from '../src/lib/tableLabels'
import { buildLayout } from '../src/site'

const admin = { id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' } as any

function labelsOf(html: string): string[] {
  return Array.from(html.matchAll(/data-label="([^"]*)"/g)).map(match => match[1])
}

test('table labels: single table gets one data-label per column', () => {
  const html = '<table class="data-table"><thead><tr><th>订单号</th><th>客户</th><th>金额</th></tr></thead><tbody><tr><td>OD-1</td><td>张三</td><td>$120</td></tr><tr><td>OD-2</td><td>李四</td><td>$80</td></tr></tbody></table>'
  const output = injectTableDataLabels(html)
  assert.deepEqual(labelsOf(output), ['订单号', '客户', '金额', '订单号', '客户', '金额'])
  assert.match(output, /<td data-label="订单号">OD-1<\/td>/)
  // 可见文本不变：去掉新增属性后应与输入一致。
  assert.equal(output.replace(/ data-label="[^"]*"| scope="col"/g, ''), html)
})

test('table labels: multiple tables keep their own headers', () => {
  const html = '<div><table><thead><tr><th>设备</th><th>序列号</th></tr></thead><tbody><tr><td>MacBook</td><td>SN-1</td></tr></tbody></table><table><thead><tr><th>月份</th><th>租金</th><th>状态</th></tr></thead><tbody><tr><td>7月</td><td>$1,200</td><td>已结清</td></tr></tbody></table></div>'
  const output = injectTableDataLabels(html)
  assert.match(output, /<td data-label="设备">MacBook<\/td><td data-label="序列号">SN-1<\/td>/)
  assert.match(output, /<td data-label="月份">7月<\/td><td data-label="租金">\$1,200<\/td><td data-label="状态">已结清<\/td>/)
})

test('table labels: tables without a thead are left untouched', () => {
  const noHead = '<table><tbody><tr><td>OD-1</td><td>张三</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(noHead), noHead)
  // 表头列数与首行数据不一致时同样不注入，避免字段名错位。
  const mismatch = '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(mismatch), mismatch)
  const empty = '<table><thead><tr><th>A</th></tr></thead></table>'
  assert.equal(injectTableDataLabels(empty), empty)
  assert.equal(injectTableDataLabels(''), '')
  assert.equal(injectTableDataLabels('<p>没有表格</p>'), '<p>没有表格</p>')
})

test('table labels: rich headers become plain text, grouped (multi-row) headers are skipped', () => {
  const rich = '<table><thead><tr><th><span class="mono">订单号</span></th><th>客户<small>联系方式</small></th></tr></thead><tbody><tr><td>OD-1</td><td>张三</td></tr></tbody></table>'
  assert.deepEqual(labelsOf(injectTableDataLabels(rich)), ['订单号', '客户联系方式'])
  // 两行 thead（分组表头）无法逐列对齐，宁可不注入。
  const grouped = '<table><thead><tr><th>订单号</th><th>客户</th></tr><tr><th>次要</th><th>次要</th></tr></thead><tbody><tr><td>OD-1</td><td>张三</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(grouped), grouped)
})

test('table labels: header rowspans and official documents are skipped, manual labels kept', () => {
  const spanned = '<table><thead><tr><th rowspan="2">客户</th><th>订单号</th></tr><tr><th>金额</th></tr></thead><tbody><tr><td>张三</td><td>OD-1</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(spanned), spanned)
  const official = '<table class="official-document__table"><thead><tr><th>项目</th><th>金额</th></tr></thead><tbody><tr><td>押金</td><td>$1,800</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(official), official)
  const printable = '<table class="print-table"><thead><tr><th>项目</th></tr></thead><tbody><tr><td>押金</td></tr></tbody></table>'
  assert.equal(injectTableDataLabels(printable), printable)
  const manual = '<table><thead><tr><th>订单号</th><th>设备</th></tr></thead><tbody><tr><td data-label="自定义列">OD-1</td><td>MacBook</td></tr></tbody></table>'
  const output = injectTableDataLabels(manual)
  assert.match(output, /data-label="自定义列">OD-1/)
  assert.match(output, /<td data-label="设备">MacBook/)
})

test('table labels: nested tables get their own headers and the pass is idempotent', () => {
  const html = '<table><thead><tr><th>客户</th><th>明细</th></tr></thead><tbody><tr><td>张三</td><td><table><thead><tr><th>设备</th><th>天数</th></tr></thead><tbody><tr><td>MacBook</td><td>7</td></tr></tbody></table></td></tr></tbody></table>'
  const once = injectTableDataLabels(html)
  assert.match(once, /<td data-label="客户">张三<\/td>/)
  assert.match(once, /<td data-label="设备">MacBook<\/td><td data-label="天数">7<\/td>/)
  assert.match(once, /<td data-label="明细"><table>/)
  // 二次处理不应叠属性，也不应改动任何可见文本。
  assert.equal(injectTableDataLabels(once), once)
})

test('table labels: only appends the attribute and keeps existing attribute order', () => {
  const html = '<table><thead><tr><th>订单号</th><th>数据</th></tr></thead><tbody><tr><td class="mono" data-x="1">OD-1</td><td><form action="/x" method="post"><input class="form-control" type="text" name="note" value="a"></form></td></tr></tbody></table>'
  const output = injectTableDataLabels(html)
  // 新属性追加在开标签末尾，已有属性与顺序逐字保留。
  assert.match(output, /<td class="mono" data-x="1" data-label="订单号">OD-1<\/td>/)
  assert.ok(output.includes('<form action="/x" method="post"><input class="form-control" type="text" name="note" value="a"></form>'))
  // 去掉新增属性后与输入完全一致（没有重排、没有改写任何已有属性）。
  assert.equal(output.replace(/ data-label="[^"]*"/g, ''), html)
})

test('table labels: cells containing form controls get no label', () => {
  const html = '<table><thead><tr><th>订单号</th><th>操作</th></tr></thead><tbody><tr><td>OD-1</td><td><form action="/x" method="post"><button class="button" type="submit" aria-label="确认">确认</button></form></td></tr></tbody></table>'
  const output = injectTableDataLabels(html)
  assert.match(output, /<td data-label="订单号">OD-1<\/td>/)
  assert.ok(!output.includes('data-label="操作"'))
})

test('table labels: pages without tables return the same string (fast path)', () => {
  const html = '<div class="page"><p>没有表格</p></div>'
  assert.equal(injectTableDataLabels(html), html)
})

test('table labels: buildLayout output carries labels without touching visible markup', () => {
  const body = '<table class="data-table"><thead><tr><th>订单号</th><th>客户</th><th>操作</th></tr></thead><tbody><tr><td><a href="/staff/orders/o-1">OD-1</a></td><td>张三</td><td><a class="link-button" href="/staff/orders/o-1">查看</a></td></tr></tbody></table>'
  const html = buildLayout('订单列表', body, admin)
  const start = html.lastIndexOf('<table')
  const table = html.slice(start, html.indexOf('</table>', start) + 8)
  assert.deepEqual(labelsOf(table), ['订单号', '客户', '操作'])
  assert.match(table, /<td data-label="操作"><a class="link-button" href="\/staff\/orders\/o-1">查看<\/a><\/td>/)

})
