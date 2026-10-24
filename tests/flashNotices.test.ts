/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

const clientScript = readFileSync(new URL('../src/appClient.js.txt', import.meta.url), 'utf8')
const flashScript = clientScript.slice(clientScript.indexOf('  function getNoticeLayer('), clientScript.indexOf('  function prepareImageUploadForms('))

class NoticeElement {
  dataset: Record<string, string> = {}
  attributes: Record<string, string> = {}
  children: NoticeElement[] = []
  events: Record<string, () => void> = {}
  parent: NoticeElement | null = null
  removed = false
  hovered = false
  focused = false
  id = ''
  textContent = ''
  className = ''
  constructor(public tagName = 'div') {}
  classList = { add: (name: string) => { this.className += ' ' + name } }
  matches(selector: string): boolean {
    return selector.split(',').some(raw => {
      const value = raw.trim()
      if (value === ':hover') return this.hovered
      if (value === ':focus-within') return this.focused
      if (value === '[data-flash-notice]') return 'flashNotice' in this.dataset
      return value.startsWith('.') ? this.className.split(' ').includes(value.slice(1)) : this.tagName === value
    })
  }
  querySelectorAll(selector: string): NoticeElement[] {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)])
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null }
  appendChild(child: NoticeElement) { child.parent = this; this.children.push(child) }
  setAttribute(key: string, value: string) { this.attributes[key] = value }
  addEventListener(event: string, callback: () => void) { this.events[event] = callback }
  remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
}

function loadNotices(href: string, type = 'navigate', classes = ['page-notification page-notification--success'], critical = false) {
  const body = new NoticeElement('body')
  const notices = classes.map(className => {
    const notice = new NoticeElement()
    notice.dataset.flashNotice = ''
    if (critical) notice.dataset.noticePriority = 'critical'
    notice.className = className
    notice.textContent = '操作结果'
    body.appendChild(notice)
    return notice
  })
  const timers = new Map<number, { callback: () => void, delay: number }>()
  let nextTimer = 0
  const state = { preserved: true }
  const window = {
    location: { href },
    performance: { getEntriesByType: () => [{ type }] },
    history: { state, replaceState(nextState: unknown, _title: string, url: string) { assert.equal(nextState, state); window.location.href = url } },
    setTimeout(callback: () => void, delay: number) { timers.set(++nextTimer, { callback, delay }); return nextTimer },
    clearTimeout(id: number) { timers.delete(id) },
    siteToast: null as unknown as (message: string, type: string) => NoticeElement,
  }
  const context = { window, URL, document: { body, createElement: (tag: string) => new NoticeElement(tag), getElementById: (id: string) => body.children.find(child => child.id === id), querySelectorAll: (selector: string) => body.querySelectorAll(selector) } }
  runInNewContext(flashScript, context)
  return { notices, timers, window, context, body, toasts: () => body.querySelectorAll('.site-toast') }
}

test('success feedback moves into a stack, expires in ten seconds and consumes only feedback parameters', () => {
  const { notices, timers, window, toasts } = loadNotices('https://rent.example/admin/rental-links?created=1&error=old&status=active&page=2#links', 'navigate', ['alert-success', 'page-notification--success'])
  assert.equal(window.location.href, 'https://rent.example/admin/rental-links?status=active&page=2#links')
  assert.equal(notices.every(notice => notice.removed), true)
  assert.equal(toasts().length, 2)
  assert.equal(toasts()[0].attributes.role, 'status')
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [10000, 10000])
  ;[...timers.values()].forEach(timer => timer.callback())
  assert.equal(toasts().length, 0)
})

test('errors remain inline without an expiry timer and can be dismissed', () => {
  const { notices, timers, toasts } = loadNotices('https://rent.example/login?error=invalid', 'navigate', ['page-notification--error', 'alert-danger'])
  assert.equal(toasts().length, 0)
  assert.equal(timers.size, 0)
  notices.forEach(notice => {
    assert.equal(notice.removed, false)
    assert.equal(notice.attributes.role, 'alert')
    const close = notice.querySelector('button')!
    assert.equal(close.attributes['aria-label'], '关闭提示')
    close.events.click()
    assert.equal(notice.removed, true)
  })
})

test('critical feedback stays visible and has no dismiss button or timer', () => {
  const { notices, timers, toasts } = loadNotices('https://rent.example/admin/users/1', 'reload', ['page-notification--error'], true)
  assert.equal(notices[0].removed, false)
  assert.equal(notices[0].querySelector('button'), null)
  assert.equal(timers.size, 0)
  assert.equal(toasts().length, 0)
})

test('reload suppresses transient success but retains actionable errors', () => {
  const { notices, timers, toasts, window } = loadNotices('https://rent.example/customer/orders/1?success=saved&token=keep', 'reload', ['alert-success', 'alert-error'])
  assert.equal(notices[0].removed, true)
  assert.equal(notices[1].removed, false)
  assert.equal(timers.size, 0)
  assert.equal(toasts().length, 0)
  assert.equal(window.location.href, 'https://rent.example/customer/orders/1?token=keep')
})

test('hover and keyboard focus pause expiry; manual close cancels the timer', () => {
  const { timers, toasts } = loadNotices('https://rent.example/')
  const notice = toasts()[0]
  notice.hovered = true
  notice.events.mouseenter()
  assert.equal(timers.size, 0)
  notice.focused = true
  notice.hovered = false
  notice.events.mouseleave()
  assert.equal(timers.size, 0)
  notice.focused = false
  notice.events.focusout()
  assert.equal(timers.size, 1)
  notice.querySelector('button')!.events.click()
  assert.equal(notice.removed, true)
  assert.equal(timers.size, 0)
})

test('partial navigation initializes new feedback once after initial reload', () => {
  const { timers, window, context, body, toasts } = loadNotices('https://rent.example/admin/orders', 'reload', [])
  const notice = new NoticeElement()
  notice.dataset.flashNotice = ''
  notice.className = 'alert-success'
  body.appendChild(notice)
  window.location.href = 'https://rent.example/admin/orders?success=saved&searchTerm=abc'
  runInNewContext('prepareFlashNotices(false); prepareFlashNotices(false);', context)
  assert.equal(toasts().length, 1)
  assert.equal(timers.size, 1)
  assert.equal(window.location.href, 'https://rent.example/admin/orders?searchTerm=abc')
})

test('success containing an action remains inline, and plain text feedback cannot inject HTML', () => {
  const { context, body, window, toasts, timers } = loadNotices('https://rent.example/', 'navigate', [])
  const notice = new NoticeElement()
  notice.dataset.flashNotice = ''
  notice.className = 'alert-success'
  notice.appendChild(new NoticeElement('a'))
  body.appendChild(notice)
  runInNewContext('prepareFlashNotices(false)', context)
  assert.equal(notice.removed, false)
  assert.equal(toasts().length, 0)
  assert.equal(timers.size, 0)
  const toast = window.siteToast('<img src=x onerror=alert(1)>', 'success')
  assert.equal(toast.textContent, '<img src=x onerror=alert(1)>')
  assert.equal(toast.querySelector('img'), null)
})

test('toast stack is bounded and failed copy feedback remains until dismissed', () => {
  const { window, toasts, timers } = loadNotices('https://rent.example/', 'navigate', [])
  for (let i = 0; i < 4; i++) window.siteToast('已复制 ' + i, 'success')
  assert.equal(toasts().length, 3)
  assert.equal(timers.size, 3)
  const failed = window.siteToast('复制失败，请手工复制', 'error')
  assert.equal(failed.attributes.role, 'alert')
  assert.equal(timers.size, 3)
  assert.equal(toasts().length, 4)
  window.siteToast('又一次复制成功', 'success')
  assert.equal(failed.removed, false)
  assert.equal(toasts().length, 4)
})

test('pages without feedback preserve their URL and the full script parses', () => {
  const href = 'https://rent.example/contract/sign?token=keep&step=2'
  const { window, timers } = loadNotices(href, 'navigate', [])
  assert.equal(window.location.href, href)
  assert.equal(timers.size, 0)
  assert.doesNotThrow(() => new Function(clientScript))
})
