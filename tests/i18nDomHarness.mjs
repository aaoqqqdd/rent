/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 极简 DOM 桩：够 src/lib/i18n.ts 的运行时脚本跑起来即可（不引入 jsdom，保持无新依赖）。
// 支持：元素树、文本节点、属性、TreeWalker、querySelector(All) 的常用选择器
// （标签 / .class / #id / [attr] / [attr="v"] / :not()）、closest、MutationObserver 手动派发。
//
// 用 .mjs 而不是 .ts：这是一份纯测试脚手架，避免给 tsc 增加类型负担。

export class DomText {
  constructor(value) {
    this.nodeType = 3
    this.nodeValue = String(value)
    this.parentElement = null
    this.ownerDocument = null
  }
  get textContent() {
    return this.nodeValue
  }
  set textContent(value) {
    this.nodeValue = String(value)
  }
}

export class DomElement {
  constructor(tagName, attributes = {}) {
    this.nodeType = 1
    this.tagName = String(tagName).toUpperCase()
    this.attributes = new Map()
    this.childNodes = []
    this.parentElement = null
    this.ownerDocument = null
    this.hidden = false
    this.value = ''
    this.selectionStart = undefined
    this.selectionEnd = undefined
    this.__isRoot = false
    for (const [key, value] of Object.entries(attributes)) this.setAttribute(key, value)
    this.type = this.attributes.get('type') || ''
    const self = this
    const classes = () => (self.attributes.get('class') || '').split(/\s+/).filter(Boolean)
    this.classList = {
      add: (name) => {
        const list = new Set(classes())
        list.add(name)
        self.attributes.set('class', [...list].join(' '))
      },
      contains: (name) => classes().includes(name),
    }
  }

  get id() {
    return this.attributes.get('id') || ''
  }
  get className() {
    return this.attributes.get('class') || ''
  }
  get childElementCount() {
    return this.childNodes.filter((node) => node.nodeType === 1).length
  }
  get isConnected() {
    let node = this
    while (node.parentElement) node = node.parentElement
    return node.__isRoot === true
  }
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('')
  }
  set textContent(value) {
    this.childNodes = []
    if (value !== '' && value !== null && value !== undefined) this.appendChild(new DomText(String(value)))
  }

  // 测试辅助：用极简 HTML 子集构建子树（<tag attr="v">文本</tag> 与嵌套）。
  set innerHTML(html) {
    this.childNodes = []
    const parse = (source, parent) => {
      const tagPattern = /<([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g
      let match
      while ((match = tagPattern.exec(source))) {
        if (match[3] !== undefined) {
          const text = match[3]
          if (text.trim() !== '') parent.appendChild(new DomText(text.replace(/\s+/g, ' ')))
          continue
        }
        const element = new DomElement(match[1])
        const attrPattern = /([\w-]+)(?:="([^"]*)")?/g
        let attribute
        while ((attribute = attrPattern.exec(match[2] || ''))) {
          element.setAttribute(attribute[1], attribute[2] === undefined ? '' : attribute[2])
        }
        parent.appendChild(element)
        const closing = `</${match[1]}>`
        const closeAt = source.indexOf(closing, tagPattern.lastIndex)
        if (closeAt !== -1) {
          parse(source.slice(tagPattern.lastIndex, closeAt), element)
          tagPattern.lastIndex = closeAt + closing.length
        }
      }
    }
    parse(String(html), this)
  }

  appendChild(node) {
    if (node.parentElement) node.parentElement.removeChild(node)
    node.parentElement = this
    if (this.ownerDocument) node.ownerDocument = this.ownerDocument
    this.childNodes.push(node)
    return node
  }
  append(...nodes) {
    for (const node of nodes) this.appendChild(typeof node === 'string' ? new DomText(node) : node)
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node)
    if (index >= 0) this.childNodes.splice(index, 1)
    node.parentElement = null
    return node
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null
  }
  hasAttribute(name) {
    return this.attributes.has(name)
  }
  removeAttribute(name) {
    this.attributes.delete(name)
  }
  matches(selector) {
    return matchesSelector(this, selector)
  }
  closest(selector) {
    let node = this
    while (node && node.nodeType === 1) {
      if (node.matches(selector)) return node
      node = node.parentElement
    }
    return null
  }
  querySelectorAll(selector) {
    const out = []
    for (const part of selector.split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      walkDescendants(this, (node) => {
        if (matchesSelector(node, trimmed) && !out.includes(node)) out.push(node)
      })
    }
    return out
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null
  }
  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this
  }
  setSelectionRange(start, end) {
    this.selectionStart = start
    this.selectionEnd = end
  }
}

export class DomDocument {
  constructor() {
    this.documentElement = new DomElement('html')
    this.documentElement.__isRoot = true
    this.documentElement.ownerDocument = this
    this.body = new DomElement('body')
    this.documentElement.appendChild(this.body)
    this.title = ''
    this.activeElement = null
    this.listeners = {}
  }
  createElement(tagName) {
    const element = new DomElement(tagName)
    element.ownerDocument = this
    return element
  }
  createTextNode(value) {
    const node = new DomText(value)
    node.ownerDocument = this
    return node
  }
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector)
  }
  querySelector(selector) {
    return this.documentElement.querySelector(selector)
  }
  createTreeWalker(root) {
    return new TreeWalkerStub(root)
  }
  addEventListener(type, handler) {
    ;(this.listeners[type] = this.listeners[type] || []).push(handler)
  }
}

function walkDescendants(root, visit) {
  for (const node of root.childNodes) {
    if (node.nodeType !== 1) continue
    visit(node)
    walkDescendants(node, visit)
  }
}

// 支持的简单选择器：tag、.class、#id、[attr]、[attr="v"]、[attr^="v"]、:not(...)。
function matchesSimple(element, selector) {
  const pattern = /([a-zA-Z][\w-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:([\^$*]?=)"?([^"\]]*)"?)?\]|:not\(([^)]*)\)/g
  const compact = selector.replace(/\s+/g, '')
  let matched = false
  let match
  while ((match = pattern.exec(compact))) {
    matched = true
    if (match[1]) {
      if (element.tagName !== match[1].toUpperCase()) return false
    } else if (match[2]) {
      if (!element.classList.contains(match[2])) return false
    } else if (match[3]) {
      if (element.id !== match[3]) return false
    } else if (match[4]) {
      const name = match[4]
      const operator = match[5]
      const value = match[6] || ''
      if (!element.hasAttribute(name)) return false
      const actual = element.getAttribute(name) || ''
      if (operator === '=' && actual !== value) return false
      if (operator === '^=' && !actual.startsWith(value)) return false
      if (operator === '$=' && !actual.endsWith(value)) return false
      if (operator === '*=' && !actual.includes(value)) return false
    } else if (match[7]) {
      if (matchesSelector(element, match[7])) return false
    }
  }
  return matched
}

export function matchesSelector(element, selector) {
  const groups = selector.split(',').map((part) => part.trim()).filter(Boolean)
  return groups.some((group) => {
    const pieces = group.split(/\s+/).filter(Boolean)
    if (!matchesSimple(element, pieces[pieces.length - 1])) return false
    let node = element.parentElement
    for (let i = pieces.length - 2; i >= 0; i--) {
      let found = false
      while (node) {
        if (matchesSimple(node, pieces[i])) {
          found = true
          node = node.parentElement
          break
        }
        node = node.parentElement
      }
      if (!found) return false
    }
    return true
  })
}

export class TreeWalkerStub {
  constructor(root) {
    this.root = root
    this.stack = [root]
  }
  nextNode() {
    while (this.stack.length) {
      const node = this.stack.pop()
      if (node.nodeType === 1) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) this.stack.push(node.childNodes[i])
      }
      if (node.nodeType === 3) return node
    }
    return null
  }
}

// 创建一个可用于 i18n 运行时的全局环境。
export function createDomEnvironment({ storedLanguage = null, browserLanguages = ['zh-CN'], url = 'https://rent.test/' } = {}) {
  const document = new DomDocument()
  const listeners = new Map()
  const storage = new Map()
  if (storedLanguage) storage.set('rent-language', storedLanguage)
  const frames = []
  const observed = []

  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback
      this.records = []
    }
    observe(target, options) {
      this.target = target
      this.options = options
      observed.push(this)
    }
    takeRecords() {
      const records = this.records
      this.records = []
      return records
    }
    /** 测试用：模拟一次 DOM 变更并同步派发给观察者 */
    trigger(records) {
      this.records.push(...records)
      this.callback(records, this)
    }
  }

  class CustomEventStub {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }

  const window = {
    document,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    navigator: { languages: browserLanguages, language: browserLanguages[0] || 'zh-CN' },
    location: { href: url },
    requestAnimationFrame: (callback) => {
      frames.push(callback)
      return frames.length
    },
    setTimeout: (callback) => {
      frames.push(callback)
      return frames.length
    },
    addEventListener: (type, handler) => {
      const list = listeners.get(type) || []
      list.push(handler)
      listeners.set(type, list)
    },
    dispatchEvent: (event) => {
      for (const handler of listeners.get(event.type) || []) handler(event)
      return true
    },
    MutationObserver: MutationObserverStub,
    CustomEvent: CustomEventStub,
  }

  return {
    window,
    document,
    globals: {
      window,
      document,
      localStorage: window.localStorage,
      navigator: window.navigator,
      MutationObserver: MutationObserverStub,
      NodeFilter: { SHOW_TEXT: 4 },
      Element: DomElement,
      requestAnimationFrame: window.requestAnimationFrame,
      setTimeout: window.setTimeout,
      CustomEvent: CustomEventStub,
    },
    storage,
    observed,
    /** 执行所有排队的 rAF / timeout 回调 */
    flushFrames() {
      let guard = 0
      while (frames.length && guard++ < 50) {
        const batch = frames.splice(0, frames.length)
        for (const callback of batch) callback(0)
      }
    },
    pendingFrames: () => frames.length,
  }
}
