/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// CSS 压缩的语义等价性证明。
//
// 「压缩前/后语义一致」的验证方法（不引入浏览器，纯结构化比对）：
//   1. 用 collectCssRules() 把源码与压缩结果各自解析成「规则路径 + 声明列表」序列
//      （规则路径包含 @media/@supports 条件、选择器原文；@keyframes 展开到每帧）。
//   2. 逐条比对：路径（空白规范化后）、属性名、属性值必须完全一致。
//      —— 任何一个选择器、属性、值被改写/丢失/合并都会在这里暴露。
//   3. 再做「关键选择器与声明仍然存在」的正向断言 + 体积下降断言 + 幂等断言。
//
// 这样证明的语义不变量：
//   * 选择器与 @media/@supports 条件除空白外字节级不变 ⇒ 匹配行为不变；
//   * 属性值除 `;` 两侧空白外不变 ⇒ calc()/min()/attr()/data: URL 等不会被破坏；
//   * 规则条数与顺序不变 ⇒ 层叠顺序不变。

import test from 'node:test'
import assert from 'node:assert/strict'

import { collectCssRules, minifyCss, minifyCssCached } from '../src/lib/cssMin'
import { styleSheetSource, styleSheetText, styleSheetVersion, styleSheetByteLength } from '../src/lib/assetVersion'

const bytes = (value: string) => Buffer.byteLength(value, 'utf8')

/** 路径/值比较：只折叠空白种类差异，不折叠空白的有无（calc 依赖空格）。 */
function normalizeRulePath(path: string[]): string[] {
  return path.map((part) => part.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim())
}

function comparableRules(css: string) {
  return collectCssRules(css).map((rule) => ({
    path: normalizeRulePath(rule.path),
    declarations: rule.declarations.map((declaration) => ({
      property: declaration.property,
      value: declaration.value.replace(/\s*,\s*/g, ',').replace(/\s*>\s*/g, '>').trim(),
    })),
  }))
}

test('cssMin: 压缩前后每一条规则/选择器/声明都逐条相等（真实 styles.css）', () => {
  const before = comparableRules(styleSheetSource)
  const after = comparableRules(styleSheetText)

  assert.ok(before.length > 1000, `styles.css 应解析出上千条规则，实际 ${before.length}`)
  assert.equal(after.length, before.length, `规则条数必须一致：压缩前 ${before.length}，压缩后 ${after.length}`)

  for (let index = 0; index < before.length; index++) {
    assert.deepEqual(
      after[index],
      before[index],
      `第 ${index} 条规则被改变：\n压缩前 ${JSON.stringify(before[index]).slice(0, 400)}\n压缩后 ${JSON.stringify(after[index]).slice(0, 400)}`,
    )
  }
})

test('cssMin: 关键选择器与声明在压缩后仍然存在（:has / @media print / @supports / attr / 伪类）', () => {
  const minified = styleSheetText
  // :has() —— 不能把括号内的空白/内容玩坏
  assert.match(minified, /\.order-info-card p:not\(:has\(strong\)\)/)
  // content: attr(data-label) —— 值原样保留
  assert.match(minified, /content: ?attr\(data-label\)/)
  // @media print 及其内部的 !important 声明
  assert.match(minified, /@media print\{/)
  assert.match(minified, /visibility: ?visible !important/)
  // 自定义属性里的 data: URL（含引号内的尖括号与 %22）必须一字不差
  assert.match(minified, /url\('data:image\/svg\+xml,<svg xmlns=%22http:\/\/www\.w3\.org\/2000\/svg%22/)
  // min()/calc() 这类函数：逗号后的空格可省，但参数本身必须完整（不做数值改写）
  assert.match(minified, /min\(390px, ?86vw\)/)
  assert.match(minified, /calc\(100vw - 48px\)/)
  // 打印分页符的 content 字符串
  assert.match(minified, /content: ?'分页符'/)
})

test('cssMin: 体积下降（真实 styles.css）与指纹/Content-Length 一致', () => {
  const beforeBytes = bytes(styleSheetSource)
  const afterBytes = bytes(styleSheetText)
  const savedPercent = (1 - afterBytes / beforeBytes) * 100
  assert.ok(afterBytes < beforeBytes, '压缩后必须更小')
  assert.ok(savedPercent >= 10, `体积至少下降 10%，实际 ${savedPercent.toFixed(2)}%`)
  // 记录到测试输出，方便报告里引用
  console.log(`cssMin: ${beforeBytes}B -> ${afterBytes}B (-${savedPercent.toFixed(2)}%)`)
  assert.equal(styleSheetByteLength, afterBytes, 'Content-Length 使用的字节数必须等于实际返回内容')
})

test('cssMin: 压缩幂等，且缓存返回第一次压缩的结果', () => {
  const once = minifyCss(styleSheetSource)
  const twice = minifyCss(once)
  assert.equal(twice, once, '二次压缩不应再改变内容')
  assert.equal(minifyCssCached(styleSheetSource), once)
  assert.equal(minifyCssCached(styleSheetSource), minifyCssCached(styleSheetSource))
})

test('cssMin: 指纹基于压缩后内容（改 compress 规则会让 URL 变化，不会串缓存）', () => {
  // styleSheetVersion 必须是 fnv1a('css1:' + 压缩后内容) —— 用同样算法重算一次比对。
  const fnv1a = (input: string) => {
    let hash = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(36)
  }
  assert.equal(styleSheetVersion, fnv1a(`css1:${styleSheetText}`))
  assert.notEqual(styleSheetVersion, fnv1a(`css1:${styleSheetSource}`), '压缩前后指纹不应相同')
})

test('cssMin: 边界输入 —— 注释、字符串里的注释符、括号、@media/@supports、data URL', () => {
  const source = [
    '/* 顶部版权注释 */',
    ':root { --a: 1px; }',
    '.card {',
    '  color: red; /* 行尾注释 */',
    '  background: url("https://cdn.example.com/a/*not-a-comment*/.png");',
    '  content: "/* 字符串里的注释符 */";',
    '  width: min(100%, 42rem);',
    '  height: calc(100% - 10px);',
    '}',
    '@media screen and (max-width: 640px) {',
    '  .card { display: none; }',
    '}',
    '@supports (display: grid) {',
    '  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }',
    '}',
    '.a:has(> img) { padding: 0 }',
    '.b::after { content: attr(data-x) }',
    '@media print { .official-document, .official-document * { visibility: visible !important; } }',
  ].join('\n')

  const minified = minifyCss(source)
  assert.ok(!minified.includes('顶部版权注释'), '注释必须删除')
  assert.ok(!minified.includes('行尾注释'), '行尾注释必须删除')
  assert.ok(minified.includes('a/*not-a-comment*/.png'), '字符串里的 /* 不能被当成注释')
  assert.ok(minified.includes('"/* 字符串里的注释符 */"'), '字符串内容必须原样保留')
  assert.ok(minified.includes('calc(100% - 10px)'), 'calc 的 ± 两侧空格必须保留')
  assert.ok(/min\(100%, ?42rem\)/.test(minified), 'min() 参数原样保留')
  assert.ok(minified.includes('@supports (display: grid)'), '@supports 条件原样保留')
  assert.ok(minified.includes('(max-width: 640px)'), '@media 条件原样保留')
  assert.ok(minified.includes('.a:has(> img)'), ':has() 选择器原样保留')
  assert.ok(minified.includes('content: attr(data-x)'), 'content: attr() 原样保留')
  assert.ok(minified.includes('@media print{'), '@media print 保留且花括号前空白去掉')

  // 结构比对同样成立
  assert.deepEqual(comparableRules(minified), comparableRules(source))
})

test('cssMin: 删除空声明与多余分号，不产生空块', () => {
  const minified = minifyCss('.x { color: red;; ; }\n.y{;;}\n.z { }\n')
  assert.ok(!minified.includes(';;'), `不应残留连续分号：${minified}`)
  assert.ok(!minified.includes('{ }'), '空块内部空白应去掉')
  assert.ok(minified.startsWith('.x{color: red}'), `末位分号应去掉：${minified}`)
})

test('cssMin: 压缩结果里的花括号/注释标记配对正确（可被重新解析）', () => {
  const minified = styleSheetText
  let depth = 0
  let quote = ''
  for (let i = 0; i < minified.length; i++) {
    const ch = minified[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; assert.ok(depth >= 0, `偏移 ${i} 出现多余的 }`) }
  }
  assert.equal(depth, 0, '花括号必须配对')
  assert.equal(quote, '', '字符串引号必须闭合')
  assert.ok(!minified.includes('/*'), '压缩结果里不应残留注释起始符')
  assert.ok(!minified.startsWith('\n') && !minified.endsWith('\n'), '首尾不应有换行')
})
