/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 英文模式运行时行为测试：真的把 /i18n.js 的产物丢进 DOM 桩里执行，验证
// 翻译、幂等、MutationObserver 合并、confirm 劫持、title/meta、语言切换等机制。
import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error 纯测试脚手架（.mjs，无类型声明）
import { createDomEnvironment } from './i18nDomHarness.mjs'
import { languageScript, languageBootScript } from '../src/lib/i18n'

interface Rig {
  document: any
  env: any
  window: any
}

interface BootOptions {
  storedLanguage?: string | null
  browserLanguages?: string[]
  script?: string
  env?: any
}

function boot(
  html: string,
  { storedLanguage = null, browserLanguages = ['zh-CN'], script = languageScript, env: providedEnv }: BootOptions = {},
): Rig {
  const env = providedEnv || createDomEnvironment({ storedLanguage, browserLanguages })
  const { document } = env
  // 用极简 HTML 子集构建 body：只支持 <tag attr="v">文本</tag> / 嵌套
  document.body.innerHTML = html
  const fn = new Function(
    'window',
    'document',
    'localStorage',
    'navigator',
    'MutationObserver',
    'NodeFilter',
    'Element',
    'requestAnimationFrame',
    'setTimeout',
    'CustomEvent',
    script,
  )
  fn(
    env.window,
    env.globals.document,
    env.globals.localStorage,
    env.globals.navigator,
    env.globals.MutationObserver,
    env.globals.NodeFilter,
    env.globals.Element,
    env.globals.requestAnimationFrame,
    env.globals.setTimeout,
    env.globals.CustomEvent,
  )
  return { document, env, window: env.window }
}

test('i18n runtime: 英文模式翻译文本节点、属性与 option，且不留中文', () => {
  const rig = boot(
    `<div class="page"><h1>订单详情</h1><p>当前状态</p>` +
      `<input placeholder="搜索姓名或邮箱" title="查看详情" aria-label="打开通知中心">` +
      `<select><option value="pending_payment">待支付</option><option>已完成</option></select></div>`,
    { storedLanguage: 'en' },
  )
  const document = rig.document
  const text = document.body.textContent
  assert.ok(text.includes('Order details'), `heading translated: ${text}`)
  assert.ok(text.includes('Current status'), `paragraph translated: ${text}`)
  assert.doesNotMatch(text, /[\u4e00-\u9fff]/, `no Chinese left in text: ${text}`)
  const input = document.querySelector('input')
  assert.equal(input.getAttribute('placeholder'), 'Search by name or email')
  assert.equal(input.getAttribute('title'), 'View details')
  assert.equal(input.getAttribute('aria-label'), 'Open notifications')
  const options = document.querySelectorAll('option')
  assert.equal(options[0].textContent, 'Awaiting payment')
  assert.equal(options[1].textContent, 'Completed')
})

test('i18n runtime: 中文模式保持原文，且切换回英文可重复', () => {
  const rig = boot(`<div><h1>订单详情</h1></div>`, { storedLanguage: 'zh' })
  const heading = rig.document.querySelector('h1')
  assert.equal(heading.textContent, '订单详情')
  rig.window.setSiteLanguage('en')
  assert.equal(heading.textContent, 'Order details')
  rig.window.setSiteLanguage('zh')
  assert.equal(heading.textContent, '订单详情')
  rig.window.setSiteLanguage('en')
  assert.equal(heading.textContent, 'Order details')
})

test('i18n runtime: apply 幂等，反复执行结果不变且原始值不被覆盖', () => {
  const rig = boot(`<div><h1>订单管理</h1><input placeholder="请输入邮箱"></div>`, { storedLanguage: 'en' })
  const html = rig.document.body.textContent
  const placeholder = rig.document.querySelector('input').getAttribute('placeholder')
  for (let i = 0; i < 5; i++) rig.window.applySiteLanguage(rig.document.body)
  assert.equal(rig.document.body.textContent, html)
  assert.equal(rig.document.querySelector('input').getAttribute('placeholder'), placeholder)
  // 原始中文被记录在 data-i18n-* 上，切回中文可以精确还原
  assert.equal(rig.document.querySelector('input').getAttribute('data-i18n-placeholder'), '请输入邮箱')
  rig.window.setSiteLanguage('zh')
  assert.equal(rig.document.querySelector('input').getAttribute('placeholder'), '请输入邮箱')
  assert.equal(rig.document.querySelector('h1').textContent, '订单管理')
})

test('i18n runtime: 未收录的中文保留原文并记录到 window.__i18nMissing', () => {
  const rig = boot(`<div><p>这是一句字典里没有的中文</p><p>订单详情</p></div>`, { storedLanguage: 'en' })
  const paragraphs = rig.document.querySelectorAll('p')
  assert.equal(paragraphs[0].textContent, '这是一句字典里没有的中文')
  assert.equal(paragraphs[1].textContent, 'Order details')
  const missing = rig.window.__i18nMissing
  assert.ok(Object.keys(missing).some((key) => key.includes('字典里没有')), JSON.stringify(missing))
})

test('i18n runtime: 已翻译节点不再被重复扫描（MutationObserver 合并为一次 rAF）', () => {
  const rig = boot(`<div id="app"><p>订单详情</p></div>`, { storedLanguage: 'en' })
  const observer = rig.env.observed[0]
  assert.ok(observer, 'MutationObserver 已注册')
  assert.equal(observer.options.childList, true)
  assert.equal(observer.options.subtree, true)
  // 模拟页面脚本插入新节点
  const host = rig.document.querySelector('#app')
  const added = rig.document.createElement('span')
  host.appendChild(added)
  added.appendChild(rig.document.createTextNode('合同管理'))
  observer.trigger([{ type: 'childList', target: host, addedNodes: [added] }])
  observer.trigger([{ type: 'childList', target: host, addedNodes: [added] }])
  // 多次 mutation 只排一次 rAF
  assert.equal(rig.env.pendingFrames(), 1)
  rig.env.flushFrames()
  assert.equal(added.textContent, 'Contract management')
})

test('i18n runtime: document.title / meta description 跟随语言切换', () => {
  const env = createDomEnvironment({ storedLanguage: 'zh' })
  env.document.title = '订单详情 - 电脑租赁管理系统'
  const rig = boot(`<p>订单详情</p>`, { storedLanguage: 'zh', env })
  // meta 放在 <head> 下（body 的内容会被 boot 重写）
  const meta = env.document.createElement('meta')
  meta.setAttribute('name', 'description')
  meta.setAttribute('content', '专业设备租赁管理平台')
  env.document.documentElement.appendChild(meta)
  assert.equal(rig.document.title, '订单详情 - 电脑租赁管理系统')
  rig.window.setSiteLanguage('en')
  assert.equal(rig.document.title, 'Order details - PC Rental')
  assert.equal(meta.getAttribute('content'), 'Professional device rental management platform')
  rig.window.setSiteLanguage('zh')
  assert.equal(rig.document.title, '订单详情 - 电脑租赁管理系统')
  assert.equal(meta.getAttribute('content'), '专业设备租赁管理平台')
})

test('i18n runtime: confirm / alert 文案被翻译且返回值不变', () => {
  // 运行时启动时包装 window.confirm/alert；先占位再启动，才能捕获包装后的结果。
  const env = createDomEnvironment({ storedLanguage: 'en' })
  const seen: string[] = []
  env.window.confirm = (message: string) => {
    seen.push(message)
    return false
  }
  env.window.alert = (message: string) => {
    seen.push(message)
  }
  const fn = new Function(
    'window', 'document', 'localStorage', 'navigator', 'MutationObserver', 'NodeFilter', 'Element',
    'requestAnimationFrame', 'setTimeout', 'CustomEvent', languageScript,
  )
  fn(env.window, env.globals.document, env.globals.localStorage, env.globals.navigator, env.globals.MutationObserver,
    env.globals.NodeFilter, env.globals.Element, env.globals.requestAnimationFrame, env.globals.setTimeout, env.globals.CustomEvent)
  const result = env.window.confirm('当前内容尚未保存，确定要离开吗？')
  assert.equal(result, false, '返回值不被包装改变')
  assert.equal(seen[0], 'Your changes have not been saved. Leave anyway?')
  assert.doesNotMatch(seen[0], /[\u4e00-\u9fff]/)
  env.window.alert('保存失败')
  assert.equal(seen[1], 'Save failed')
})

test('i18n runtime: 语言切换按钮标签 / aria / html lang / localStorage 同步', () => {
  const rig = boot(
    `<div><button data-language-toggle data-language-label><span data-language-label-text>English</span></button></div>`,
    { storedLanguage: 'zh' },
  )
  const button = rig.document.querySelector('button')
  assert.equal(button.getAttribute('aria-label'), '切换到英文')
  assert.equal(rig.document.documentElement.getAttribute('lang'), 'zh-CN')
  assert.equal(rig.document.documentElement.getAttribute('data-language'), 'zh')
  rig.window.setSiteLanguage('en')
  assert.equal(rig.document.documentElement.getAttribute('lang'), 'en')
  assert.equal(rig.document.documentElement.getAttribute('data-language'), 'en')
  assert.equal(rig.env.storage.get('rent-language'), 'en')
  assert.equal(button.getAttribute('aria-label'), 'Switch to Chinese')
  assert.equal(button.querySelector('span').textContent, '中文')
})

test('i18n runtime: 首屏脚本在任何内容渲染前写入 data-language', () => {
  const env = createDomEnvironment({ storedLanguage: 'en' })
  const fn = new Function('window', 'document', 'localStorage', 'navigator', languageBootScript)
  fn(env.window, env.document, env.globals.localStorage, env.globals.navigator)
  assert.equal(env.document.documentElement.getAttribute('data-language'), 'en')
  assert.equal(env.document.documentElement.getAttribute('lang'), 'en')

  const zhEnv = createDomEnvironment({ storedLanguage: null, browserLanguages: ['zh-CN'] })
  const zhFn = new Function('window', 'document', 'localStorage', 'navigator', languageBootScript)
  zhFn(zhEnv.window, zhEnv.document, zhEnv.globals.localStorage, zhEnv.globals.navigator)
  assert.equal(zhEnv.document.documentElement.getAttribute('data-language'), 'zh')

  const enBrowser = createDomEnvironment({ storedLanguage: null, browserLanguages: ['en-AU', 'zh-CN'] })
  const enFn = new Function('window', 'document', 'localStorage', 'navigator', languageBootScript)
  enFn(enBrowser.window, enBrowser.document, enBrowser.globals.localStorage, enBrowser.globals.navigator)
  assert.equal(enBrowser.document.documentElement.getAttribute('data-language'), 'en')
})

test('i18n runtime: data-i18n-ignore 区域保持原样（法律页双语块）', () => {
  const rig = boot(
    `<div class="legal-lang" data-lang="zh" data-i18n-ignore><p>中文条款</p></div>` +
      `<div class="legal-lang" data-lang="en" data-i18n-ignore hidden><p>English terms</p></div>` +
      `<div><h1>订单详情</h1></div>`,
    { storedLanguage: 'en' },
  )
  const blocks = rig.document.querySelectorAll('.legal-lang')
  // i18n-ignore 的内容不被翻译
  assert.equal(blocks[0].querySelector('p').textContent, '中文条款')
  assert.equal(blocks[1].querySelector('p').textContent, 'English terms')
  // 只切换显示哪一个
  assert.equal(blocks[0].hidden, true)
  assert.equal(blocks[1].hidden, false)
  assert.equal(blocks[0].getAttribute('aria-hidden'), 'true')
  assert.equal(blocks[1].getAttribute('aria-hidden'), 'false')
})
