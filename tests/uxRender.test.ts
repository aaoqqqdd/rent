/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 渲染层 UX 回归测试：断言用户真正看得见的文本/链接/属性，
// 不绑定具体的分页条或表格结构（那些由各自 owner 改动）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderCustomerOrders } from '../src/pages/customer/orders'
import { renderCustomerRentals } from '../src/pages/customer/rentals'
import type { RentFormPrefill } from '../src/pages/customer/rent'

const customer = { id: 'u-1', name: '测试客户', email: 'c@example.com', role: 'CUSTOMER', balance: 0 }

/**
 * 极简 D1 桩：按 SQL 里的表名分发预置行，足以驱动客户订单/租赁列表渲染。
 */
function makeContext(tables: { orders?: any[], deliveryBookings?: any[] } = {}) {
  const queries: string[] = []
  const db = {
    prepare(sql: string) {
      queries.push(sql)
      const bound = {
        async all() {
          if (/delivery_bookings/i.test(sql)) return { results: tables.deliveryBookings || [] }
          if (/FROM orders/i.test(sql)) return { results: tables.orders || [] }
          return { results: [] }
        },
        async first() { return null },
        async run() { return { success: true } }
      }
      return { bind: (..._args: unknown[]) => bound, ...bound }
    }
  }
  return {
    env: { RENT: db },
    queries,
    get: (key: string) => (key === 'user' ? customer : undefined),
    req: { query: (_k?: string) => undefined, param: () => undefined, header: () => undefined },
    html: (value: string) => value
  } as any
}

test('客户订单列表把英文状态码显示为中文，而不是原样输出', async () => {
  const c = makeContext({
    orders: [
      { id: 'o-1', orderNo: 'OD-1', deviceName: 'MacBook', startDate: '2026-01-01', endDate: '2026-01-07', totalAmount: 100, status: 'pending_payment' },
      { id: 'o-2', orderNo: 'OD-2', deviceName: 'ThinkPad', startDate: '2026-02-01', endDate: '2026-02-07', totalAmount: 200, status: 'active' },
      { id: 'o-3', orderNo: 'OD-3', deviceName: 'Dell', startDate: '2026-03-01', endDate: '2026-03-07', totalAmount: 300, status: 'completed' }
    ]
  })
  const html = await renderCustomerOrders(c, customer)
  assert.match(html, /待付款/)
  assert.match(html, /租赁中/)
  assert.match(html, /已完成/)
  // 关键：这些内部状态码不应出现在可见文本里。
  assert.ok(!/>pending_payment</.test(html), '状态码不应原样显示')
  assert.ok(!/>active</.test(html), '状态码不应原样显示')
})

test('客户订单空状态给出下一步操作链接', async () => {
  const c = makeContext({ orders: [] })
  const html = await renderCustomerOrders(c, customer)
  // 空状态仍是可行动的，而不是死胡同。
  assert.match(html, /empty-state/)
  assert.match(html, /href="\/customer\/devices"/)
  assert.match(html, /挑选设备|浏览可租设备/)
})

test('客户租赁页空状态也给出浏览设备的入口', async () => {
  const c = makeContext({ orders: [] })
  const html = await renderCustomerRentals(c, customer)
  assert.match(html, /href="\/customer\/devices"/)
})

test('客户租赁页不同状态各自显示中文标签与颜色', async () => {
  const c = makeContext({
    orders: [
      { id: 'o-a', deviceId: 'd-1', status: 'active', totalAmount: 100, depositAmount: 50, startDate: '2026-01-01', endDate: '2026-01-07' },
      { id: 'o-b', deviceId: 'd-2', status: 'cancelled', totalAmount: 100, depositAmount: 50, startDate: '2026-02-01', endDate: '2026-02-07' }
    ]
  })
  const html = await renderCustomerRentals(c, customer)
  assert.match(html, /租赁中/)
  assert.match(html, /已取消/)
  assert.match(html, /badge-danger/)
})

test('RentFormPrefill 类型允许承载用户已填写的各字段（失败回填契约）', () => {
  // 该类型是「提交失败后保留输入」的契约；只要字段齐全并能通过编译即视为满足。
  const prefill: RentFormPrefill = {
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    startPeriod: 'AM',
    endPeriod: 'PM',
    deliveryMethod: 'Delivery',
    pickupTimeSlot: 'morning',
    returnTimeSlot: 'evening_service',
    deliveryAddress: '1 Test St, Melbourne VIC 3000',
    rentalNote: '请下午送达',
    couponCode: 'SAVE10'
  }
  assert.equal(prefill.startDate, '2026-05-01')
  assert.deepEqual(Object.keys(prefill).sort(), [
    'couponCode', 'deliveryAddress', 'deliveryMethod', 'endDate', 'endPeriod',
    'pickupTimeSlot', 'rentalNote', 'returnTimeSlot', 'startDate', 'startPeriod'
  ])
})
