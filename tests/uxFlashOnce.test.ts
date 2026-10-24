/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 一次性提示（flash）：成功提示渲染一次后消失、URL 不留脏参数、刷新不重复弹出。
import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

const clientScript = readFileSync(new URL('../src/appClient.js.txt', import.meta.url), 'utf8')
const flashScript = clientScript.slice(clientScript.indexOf('  function getNoticeLayer('), clientScript.indexOf('  function prepareImageUploadForms('))

class El {
  dataset: Record<string, string> = {}
  attributes: Record<string, string> = {}
  children: El[] = []
  events: Record<string, () => void> = {}
  parent: El | null = null
  removed = false
  id = ''
  textContent = ''
  className = ''
  constructor(public tagName = 'div') {}
  classList = { add: (name: string) => { this.className += ' ' + name } }
  matches(selector: string): boolean {
    return selector.split(',').some(raw => {
      const value = raw.trim()
      if (value === '[data-flash-notice]') return 'flashNotice' in this.dataset
      return value.startsWith('.') ? this.className.split(' ').includes(value.slice(1)) : this.tagName === value
    })
  }
  querySelectorAll(selector: string): El[] {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)])
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null }
  appendChild(child: El) { child.parent = this; this.children.push(child) }
  setAttribute(key: string, value: string) { this.attributes[key] = value }
  addEventListener(event: string, callback: () => void) { this.events[event] = callback }
  remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
}

function harness(href: string, navigationType: string) {
  const body = new El('body')
  const timers = new Map<number, { callback: () => void, delay: number }>()
  let nextTimer = 0
  const state = { preserved: true }
  const window = {
    location: { href },
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    history: { state, replaceState(nextState: unknown, _title: string, url: string) { assert.equal(nextState, state); window.location.href = url } },
    setTimeout(callback: () => void, delay: number) { timers.set(++nextTimer, { callback, delay }); return nextTimer },
    clearTimeout(id: number) { timers.delete(id) },
    siteToast: null as unknown as (message: string, type: string) => El,
  }
  const context = {
    window, URL,
    document: { body, createElement: (tag: string) => new El(tag), getElementById: (id: string) => body.children.find(child => child.id === id), querySelectorAll: (selector: string) => body.querySelectorAll(selector) }
  }
  runInNewContext(flashScript, context)
  return { body, timers, window, context }
}

function addNotice(body: El, className: string) {
  const notice = new El()
  notice.dataset.flashNotice = ''
  notice.className = className
  notice.textContent = '租赁申请已提交'
  body.appendChild(notice)
  return notice
}

test('下单成功提示被展示一次并替换为自动消失的 toast', () => {
  const { body, timers, context } = harness('https://rent.example/customer/orders/o-1?success=saved', 'navigate')
  const notice = addNotice(body, 'page-notification page-notification--success')
  runInNewContext('prepareFlashNotices(false)', context)
  // 原位提示被消费掉，改由一次性 toast 呈现，避免页面里重复出现两条相同提示。
  assert.equal(notice.removed, true)
  const toasts = body.querySelectorAll('.site-toast')
  assert.equal(toasts.length, 1)
  assert.equal([...timers.values()][0].delay, 10000)
})

test('刷新页面不会重复弹出同一条成功提示', () => {
  const { body, context } = harness('https://rent.example/customer/orders/o-1?success=saved', 'reload')
  addNotice(body, 'page-notification page-notification--success')
  runInNewContext('prepareFlashNotices(true)', context)
  assert.equal(body.querySelectorAll('.site-toast').length, 0, '刷新后不应再次弹出成功提示')
})

test('提示渲染后从 URL 移除 success 参数，但保留其它业务参数', () => {
  const { body, window, context } = harness('https://rent.example/customer/orders/o-1?success=saved&page=2', 'navigate')
  addNotice(body, 'page-notification page-notification--success')
  runInNewContext('prepareFlashNotices(false)', context)
  assert.equal(window.location.href, 'https://rent.example/customer/orders/o-1?page=2')
  assert.ok(!window.location.href.includes('success='))
})

test('错误提示保留在页面上并可关闭，不会被自动隐藏', () => {
  const { body, timers, context } = harness('https://rent.example/customer/rent/d-1?error=bad', 'navigate')
  const notice = addNotice(body, 'page-notification page-notification--error')
  runInNewContext('prepareFlashNotices(false)', context)
  assert.equal(notice.removed, false)
  assert.equal(timers.size, 0)
  const close = notice.querySelector('button')
  assert.equal(close?.attributes['aria-label'], '关闭提示')
})

test('提示内容按纯文本处理，不会把用户输入当 HTML 执行', () => {
  const { window } = harness('https://rent.example/', 'navigate')
  const toast = window.siteToast('<img src=x onerror=alert(1)>', 'success')
  assert.equal(toast.textContent, '<img src=x onerror=alert(1)>')
  assert.equal(toast.querySelector('img'), null)
})
