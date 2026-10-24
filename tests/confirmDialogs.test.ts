/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

const clientScript = readFileSync(new URL('../src/appClient.js.txt', import.meta.url), 'utf8')
// data-site-confirm / data-site-prompt 的提交拦截逻辑独立于弹窗 DOM，可以单独测试。
const start = clientScript.indexOf('    // 授权只对确认后同步触发的这一次提交生效')
const end = clientScript.indexOf('    // 表单提交时的加载指示')
const submitScript = clientScript.slice(start, end)

class FakeElement {
  type = ''
  name = ''
  value = ''
  dataset: Record<string, string> = {}
  attributes: Record<string, string> = {}
  form: unknown = undefined
  parent: FakeForm | null = null
  constructor(public tagName = 'input') {}
  setAttribute(key: string, value: string) { this.attributes[key] = value }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
}

class FakeFormElement {}

class FakeForm extends FakeFormElement {
  dataset: Record<string, string> = {}
  children: FakeElement[] = []
  isConnected = true
  requests: Array<unknown> = []
  onRequestSubmit: ((submitter?: unknown) => void) | null = null
  appendChild(child: FakeElement) { child.parent = this; this.children.push(child); return child }
  requestSubmit(submitter?: unknown) { this.requests.push(submitter); this.onRequestSubmit?.(submitter) }
  querySelector(selector: string) {
    const [tagName, ...rawAttrs] = selector.split('[')
    const attrs = rawAttrs.map(raw => raw.replace(/\]$/, ''))
    return this.children.find(child => {
      if (tagName && child.tagName !== tagName) return false
      return attrs.every(attr => {
        if (attr === 'type="hidden"') return child.type === 'hidden'
        if (attr.startsWith('name="')) return child.name === attr.slice(6, -1)
        if (attr === 'data-site-prompt-value') return 'sitePromptValue' in child.dataset
        return false
      })
    }) || null
  }
}

interface ConfirmCall { message: string, onConfirm: () => void, options: Record<string, unknown> }
interface PromptCall { message: string, onSubmit: (value: string) => void, options: Record<string, unknown> }

function setup() {
  let submitListener: ((event: any) => void) | null = null
  const calls = { confirm: [] as ConfirmCall[], prompt: [] as PromptCall[] }
  const timers: Array<{ callback: () => void, delay: number }> = []
  const window = {
    siteConfirm(message: string, onConfirm: () => void, options: Record<string, unknown>) {
      calls.confirm.push({ message, onConfirm, options: options || {} })
    },
    sitePrompt(message: string, onSubmit: (value: string) => void, options: Record<string, unknown>) {
      calls.prompt.push({ message, onSubmit, options: options || {} })
    },
    setTimeout(callback: () => void, delay: number) { timers.push({ callback, delay }); return timers.length },
    clearTimeout() {},
  }
  const document = {
    addEventListener(type: string, callback: (event: any) => void, capture?: boolean) {
      if (type === 'submit' && capture) submitListener = callback
    },
    createElement(tagName: string) { return new FakeElement(tagName) },
  }
  runInNewContext(submitScript, { window, document, HTMLFormElement: FakeFormElement })

  const dispatch = (form: FakeForm, submitter?: unknown) => {
    const event = { target: form, submitter, prevented: false, stopped: false, preventDefault() { event.prevented = true }, stopImmediatePropagation() { event.stopped = true } }
    assert.ok(submitListener, 'submit listener should be registered')
    submitListener!(event)
    return event
  }
  return { calls, dispatch, timers, window, document }
}

test('danger confirm intercepts the first submit and replays it only after approval', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  const submitter = new FakeElement('button')
  submitter.form = form
  form.onRequestSubmit = (nextSubmitter) => { dispatch(form, nextSubmitter) }
  form.dataset.siteConfirm = '将删除此设备。此操作不可恢复。'
  form.dataset.confirmVariant = 'danger'
  form.dataset.confirmTitle = '删除设备？'
  form.dataset.confirmLabel = '删除设备'
  form.dataset.confirmText = '删除设备'

  const event = dispatch(form, submitter)
  assert.equal(event.prevented, true)
  assert.equal(event.stopped, true)
  assert.equal(form.requests.length, 0)
  assert.equal(calls.confirm.length, 1)
  assert.equal(calls.confirm[0].message, '将删除此设备。此操作不可恢复。')
  assert.deepEqual({ ...calls.confirm[0].options }, { danger: true, title: '删除设备？', confirmLabel: '删除设备', requireText: '删除设备' })

  calls.confirm[0].onConfirm()
  assert.equal(form.requests.length, 1)
  assert.equal(form.requests[0], submitter)
  // requestSubmit 同步触发的新 submit 事件不应再次弹窗。
  assert.equal(calls.confirm.length, 1)
})

test('cancelling the confirm keeps the form unsubmitted and a later attempt asks again', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  form.dataset.siteConfirm = '确定取消订单吗？'
  form.onRequestSubmit = (submitter) => { dispatch(form, submitter) }

  dispatch(form)
  assert.equal(calls.confirm.length, 1)
  assert.equal(form.requests.length, 0)

  dispatch(form)
  assert.equal(calls.confirm.length, 2)
  assert.equal(form.requests.length, 0)
})

test('site prompt injects the reason into the form before replaying the submit', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  const submitter = new FakeElement('button')
  submitter.form = form
  form.dataset.sitePrompt = '该订单将移出待退款列表，请填写忽略原因。'
  form.dataset.promptVariant = 'danger'
  form.dataset.promptTitle = '忽略这笔退款？'
  form.dataset.promptLabel = '忽略原因（必填）'
  form.dataset.promptPlaceholder = '例如：客户已取消订单，无需退款'
  form.dataset.promptConfirmLabel = '确认忽略'
  form.dataset.promptName = 'note'
  form.dataset.promptMaxlength = '300'
  form.onRequestSubmit = (nextSubmitter) => { dispatch(form, nextSubmitter) }

  const event = dispatch(form, submitter)
  assert.equal(event.prevented, true)
  assert.equal(calls.prompt.length, 1)
  assert.equal(calls.confirm.length, 0)
  assert.equal(calls.prompt[0].options.danger, true)
  assert.equal(calls.prompt[0].options.title, '忽略这笔退款？')
  assert.equal(calls.prompt[0].options.label, '忽略原因（必填）')
  assert.equal(calls.prompt[0].options.placeholder, '例如：客户已取消订单，无需退款')
  assert.equal(calls.prompt[0].options.confirmLabel, '确认忽略')
  assert.equal(calls.prompt[0].options.maxLength, '300')
  assert.equal(calls.prompt[0].options.required, true)

  calls.prompt[0].onSubmit('客户已取消订单')
  assert.equal(form.children.length, 1)
  assert.equal(form.children[0].type, 'hidden')
  assert.equal(form.children[0].name, 'note')
  assert.equal(form.children[0].value, '客户已取消订单')
  assert.equal(form.requests.length, 1)
  assert.equal(form.requests[0], submitter)
  assert.equal(calls.prompt.length, 1)
})

test('site prompt reuses an existing hidden reason field instead of duplicating it', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  const hidden = new FakeElement('input')
  hidden.type = 'hidden'
  hidden.name = 'note'
  form.appendChild(hidden)
  form.dataset.sitePrompt = '请填写忽略原因。'
  form.dataset.promptName = 'note'
  form.onRequestSubmit = (submitter) => { dispatch(form, submitter) }

  dispatch(form)
  calls.prompt[0].onSubmit('重复退款风险')
  assert.equal(form.children.length, 1)
  assert.equal(hidden.value, '重复退款风险')
  assert.equal(form.requests.length, 1)
})

test('prompt options default to a required multiline reason with a 300 character cap', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  form.dataset.sitePrompt = '请填写原因。'
  dispatch(form)
  assert.equal(calls.prompt[0].options.required, true)
  assert.equal(calls.prompt[0].options.multiline, true)
  assert.equal(calls.prompt[0].options.maxLength, undefined)
})

test('plain forms are not intercepted by the shared dialog handler', () => {
  const { calls, dispatch } = setup()
  const form = new FakeForm()
  const event = dispatch(form)
  assert.equal(event.prevented, false)
  assert.equal(event.stopped, false)
  assert.equal(calls.confirm.length, 0)
  assert.equal(calls.prompt.length, 0)
})

test('the full client script still parses after adding the shared dialog helpers', () => {
  assert.doesNotThrow(() => new Function(clientScript))
})
