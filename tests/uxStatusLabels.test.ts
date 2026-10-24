/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 操作逻辑（UX）回归测试：只断言用户可观察的行为，不绑定具体渲染实现细节。
import test from 'node:test'
import assert from 'node:assert/strict'
import { orderStatusBadge, orderStatusLabel, renderOrderStatusBadge } from '../src/pages/partials/orderStatusBadge'

test('订单状态码映射为简体中文标签', () => {
  const expected: Record<string, string> = {
    pending_payment: '待付款',
    awaiting_signature: '待签合同',
    active: '租赁中',
    completed: '已完成',
    cancelled: '已取消',
    overdue: '已逾期',
  }
  for (const [code, label] of Object.entries(expected)) {
    assert.equal(orderStatusLabel(code), label, `${code} 应显示为 ${label}`)
  }
})

test('状态标签不会把英文状态码直接暴露给用户', () => {
  // 这些是最常出现在列表里的状态码，任何一个原样输出都是用户不可读的。
  for (const code of ['pending_payment', 'pending_approval', 'pending_pickup', 'pending_return', 'extended', 'returned', 'suspended', 'paid', 'approved']) {
    const label = orderStatusLabel(code)
    assert.notEqual(label, code, `${code} 不应原样显示`)
    assert.match(label, /[\u4e00-\u9fa5]/, `${code} 应包含中文`)
  }
})

test('状态映射对大小写与空白容错', () => {
  assert.equal(orderStatusLabel('ACTIVE'), '租赁中')
  assert.equal(orderStatusLabel('  Active  '), '租赁中')
})

test('未知状态回落到原值且带 badge-neutral，不会抛错', () => {
  assert.deepEqual(orderStatusBadge('some_future_status'), { label: 'some_future_status', badgeClass: 'badge-neutral' })
  assert.deepEqual(orderStatusBadge(''), { label: '未知', badgeClass: 'badge-neutral' })
  assert.deepEqual(orderStatusBadge(null), { label: '未知', badgeClass: 'badge-neutral' })
  assert.deepEqual(orderStatusBadge(undefined), { label: '未知', badgeClass: 'badge-neutral' })
})

test('不同状态给出区分度足够的颜色 badge', () => {
  assert.equal(orderStatusBadge('active').badgeClass, 'badge-success')
  assert.equal(orderStatusBadge('overdue').badgeClass, 'badge-danger')
  assert.equal(orderStatusBadge('pending_payment').badgeClass, 'badge-warning')
  assert.equal(orderStatusBadge('completed').badgeClass, 'badge-neutral')
})

test('渲染出的 badge 片段包含中文标签与 class，且转义为纯文本', () => {
  const html = renderOrderStatusBadge('active')
  assert.match(html, /class="badge badge-success"/)
  assert.match(html, /租赁中/)
  // 未知状态里的尖括号必须被转义，不能变成可执行的 HTML。
  const escaped = renderOrderStatusBadge('<img src=x onerror=alert(1)>')
  assert.ok(!escaped.includes('<img'), '未知状态不能原样插入 HTML')
  assert.ok(escaped.includes('&lt;img'))
})
