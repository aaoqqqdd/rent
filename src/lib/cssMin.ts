/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 保守型 CSS 压缩器（零依赖）。目标不是「压到最小」，而是「绝不改变浏览器语义」：
// 只做四类确定安全的改写，其余字符原样保留。
//
//   1. 删除 /* ... */ 注释（字符串与 url(...) 内部的字符不受影响）。
//   2. 折叠空白：选择器里连续空白折叠成单个空格，`{`/`}`/`;`/`,` 前后的空白去掉；
//      声明块（`{ ... }`）内部只去掉 `;` 两侧与行首行尾的空白，属性值原样保留
//      （`min(390px, 86vw)`、`calc(100% - 10px)`、`url('...')` 这类值里的空白
//      有语义，不动）。字符串（含 content: attr() 与 url(...)）永不改写。
//   3. 去掉最后一个声明后的多余分号、空声明（`;;`）。
//   4. 删除顶层的前后空白。
//
// 刻意「不」做的事（都有语义风险，收益很小）：
//   * 不删圆括号/方括号内的空白 —— `:nth-child(2n + 1)`、`@supports (display:grid)`。
//   * 不动 calc() 的 ± 两侧空格 —— `calc(100% - 10px)` 去掉空格会变成非法值。
//   * 不折叠自定义属性（`--x: ...`）的值 —— 它们可能被拼进 content/其他属性，
//     保留原始空白最安全。
//   * 不改写任何数值单位/颜色/引号。
//
// 已知安全前提：styles.css（以及本文件的测试）里没有 `@charset`。若将来出现，
// 需要把它保持为压缩结果的第一个 token —— 本实现会把字符串原样保留，位置不变，
// 但会删除前面的注释/空白，同样满足「charset 必须在最前」的要求。

const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g

/** 把源码拆成 token 序列：注释 / 字符串 / 单个其他字符。 */
function tokenize(css: string): Array<{ type: 'comment' | 'string' | 'char'; value: string }> {
  const tokens: Array<{ type: 'comment' | 'string' | 'char'; value: string }> = []
  let cursor = 0
  COMMENT_OR_STRING.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COMMENT_OR_STRING.exec(css))) {
    for (let i = cursor; i < match.index; i++) tokens.push({ type: 'char', value: css[i] })
    const value = match[0]
    tokens.push({ type: value.startsWith('/*') ? 'comment' : 'string', value })
    cursor = match.index + value.length
  }
  for (let i = cursor; i < css.length; i++) tokens.push({ type: 'char', value: css[i] })
  return tokens
}

const isSpace = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'

export function minifyCss(source: string): string {
  const tokens = tokenize(source)
  const out: string[] = []
  // depth：当前处于第几层声明块。0 = 顶层（选择器/@规则区），>0 = 声明区。
  let depth = 0
  // @media / @supports / @container 的条件里可能出现 calc()，其 ± 两侧的空格
  // 是语义的一部分，因此这段原文一字不动。
  let inAtRuleCondition = false
  // 上一个非空白字符，用来判断当前是不是处在 at-rule 名字的开头。
  let prevSignificant = ''

  // 输出一个字符。选择器（depth === 0 的规则前导）里折叠连续空白；
  // 声明块内部保留值原有空白，只在 `;` 两侧和行首行尾做裁剪。
  const emit = (ch: string): void => {
    if (isSpace(ch)) {
      const last = out.length ? out[out.length - 1] : ''
      if (!last || last === ';' || last === '{' || last === '}') return
      // 选择器里的逗号前后空白一律去掉；选择器内部其他连续空白折叠成一个空格。
      if (last === ',') return
      if (last === ' ' && (depth === 0 || inAtRuleCondition)) return
      out.push(' ')
      return
    }
    out.push(ch)
  }

  // 删除紧跟在 `{` `;` `}` 之后的空白，以及紧挨 `}` `;` 之前的空白。
  const trimTrailingSpace = (): void => {
    while (out.length && out[out.length - 1] === ' ') out.pop()
  }

  const atRuleConditionScopes: boolean[] = []

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const token = tokens[tokenIndex]
    if (token.type === 'comment') continue
    if (token.type === 'string') {
      out.push(token.value)
      continue
    }
    const ch = token.value
    if (ch === '{') {
      trimTrailingSpace()
      out.push('{')
      // 顶层 `{` 之前是选择器/at-rule 条件；进入后就是声明区。
      atRuleConditionScopes.push(inAtRuleCondition)
      depth++
      inAtRuleCondition = false
      continue
    }
    if (ch === '}') {
      trimTrailingSpace()
      // 去掉声明块里最后一个声明后的分号：`a:b;}` -> `a:b}`
      while (out.length && out[out.length - 1] === ';') out.pop()
      out.push('}')
      depth = Math.max(0, depth - 1)
      inAtRuleCondition = depth > 0 ? Boolean(atRuleConditionScopes.pop()) : false
      continue
    }
    if (ch === ';') {
      if (inAtRuleCondition) {
        // @media screen and (x: y); 这类语句很少见，原样输出。
        out.push(ch)
        continue
      }
      if (depth > 0) {
        trimTrailingSpace()
        // 跳过空声明（`;;`、块开头多余的 `;`）
        const last = out.length ? out[out.length - 1] : ''
        if (last === ';' || last === '{' || last === '') continue
        out.push(';')
      } else {
        out.push(';')
      }
      continue
    }
    emit(ch)
    // 识别条件组 at-rule 的开头：`@` 只会出现在规则之间的规则边界上
    // （选择器或 at-rule 的起始位置）。
    if (!inAtRuleCondition && ch === '@' && (prevSignificant === '' || prevSignificant === '{' || prevSignificant === '}' || prevSignificant === ';')) {
      let rest = ''
      for (let i = tokenIndex + 1; i < tokens.length && rest.length < 12; i++) {
        if (tokens[i].type === 'comment') continue
        rest += tokens[i].value
      }
      inAtRuleCondition = /^(media|supports|container|layer|document)\b/i.test(rest)
    }
    if (!isSpace(ch)) prevSignificant = ch
  }

  trimTrailingSpace()
  return out.join('')
}

// ---- 模块级缓存：Worker isolate 内只压一次。-------------------------------
let cachedSource: string | null = null
let cachedResult = ''

/** 压缩并缓存结果（按源码字符串 identity 判定）。 */
export function minifyCssCached(source: string): string {
  if (cachedSource === source) return cachedResult
  cachedResult = minifyCss(source)
  cachedSource = source
  return cachedResult
}

// ---- 浏览器语义一致性自检（供测试与运行期防御使用）------------------------
//
// 极简 CSS 结构扫描器：把压缩后的文本重新切成「规则/声明」序列，用来断言压缩
// 前后选择器、属性名、属性值逐条相等。它故意不实现完整 CSS 解析，只覆盖本项目
// 用到的结构（普通规则、@media/@supports/@keyframes/@font-face、嵌套 at-rule）。

export interface CssDeclaration {
  property: string
  value: string
}

export interface CssRule {
  /** 规则路径，例如 ['.a', '@media (max-width: 640px)', '.a>.b'] */
  path: string[]
  declarations: CssDeclaration[]
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote = ''
  let parens = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      current += ch
      if (ch === '\\') { current += input[++i] ?? ''; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue }
    if (ch === '(') parens++
    if (ch === ')') parens--
    if (ch === separator && parens === 0) { parts.push(current); current = ''; continue }
    current += ch
  }
  parts.push(current)
  return parts
}

/** 收集所有「叶子规则」：路径 + 声明列表。用于压缩前后逐条比对。 */
export function collectCssRules(source: string): CssRule[] {
  const rules: CssRule[] = []
  const text = source.replace(/\/\*[\s\S]*?\*\//g, ' ')

  const walk = (body: string, path: string[]): void => {
    let index = 0
    let prelude = ''
    while (index < body.length) {
      const ch = body[index]
      if (ch === '"' || ch === "'") {
        const quote = ch
        let end = index + 1
        while (end < body.length) {
          if (body[end] === '\\') { end += 2; continue }
          if (body[end] === quote) { end++; break }
          end++
        }
        prelude += body.slice(index, end)
        index = end
        continue
      }
      if (ch === ';' && !prelude.trim().startsWith('@') && !prelude.trim().endsWith(')')) {
        // 顶层 @import/@charset 之类语句
        prelude += ch
        index++
        continue
      }
      if (ch !== '{') { prelude += ch; index++; continue }

      // 找到与之配对的右花括号
      let depth = 1
      let end = index + 1
      while (end < body.length && depth > 0) {
        const c = body[end]
        if (c === '"' || c === "'") {
          const quote = c
          end++
          while (end < body.length) {
            if (body[end] === '\\') { end += 2; continue }
            if (body[end] === quote) { end++; break }
            end++
          }
          continue
        }
        if (c === '{') depth++
        else if (c === '}') depth--
        end++
      }
      const inner = body.slice(index + 1, depth === 0 ? end - 1 : end)
      const head = prelude.trim()
      prelude = ''
      index = end

      if (head.startsWith('@')) {
        // 条件组（@media/@supports/@layer/...）递归；其余（@font-face/@page/@keyframes 内容）按声明处理
        const isConditionGroup = /^@(media|supports|layer|container|document)\b/i.test(head)
        if (isConditionGroup) walk(inner, [...path, head])
        else if (/^@(keyframes|-webkit-keyframes)\b/i.test(head)) {
          // 关键帧内部是「百分比选择器 { 声明 }」，递归同样适用
          walk(inner, [...path, head])
        } else {
          rules.push({ path: [...path, head], declarations: parseDeclarations(inner) })
        }
        continue
      }
      rules.push({ path: [...path, head], declarations: parseDeclarations(inner) })
    }
  }

  walk(text, [])
  return rules
}

function parseDeclarations(body: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = []
  for (const chunk of splitTopLevel(body, ';')) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    declarations.push({
      property: trimmed.slice(0, colon).trim(),
      value: normalizeValue(trimmed.slice(colon + 1)),
    })
  }
  return declarations
}

/** 值比较时只折叠「空白种类差异」，不折叠空白的有无（calc 依赖空格）。 */
function normalizeValue(value: string): string {
  return value.trim().replace(/[ \t\n\r\f]+/g, ' ')
}
