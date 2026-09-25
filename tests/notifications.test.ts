/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNotificationOrderDetailUrl, createDueDateNotifications } from '../src/services/notifications'

test('notification order detail URLs follow the recipient workspace', () => {
  assert.equal(
    buildNotificationOrderDetailUrl('https://rent.example.test/notifications', 'order/1', 'CUSTOMER'),
    'https://rent.example.test/customer/orders/order%2F1',
  )
  assert.equal(
    buildNotificationOrderDetailUrl('https://rent.example.test/notifications', 'order-1', 'ADMIN'),
    'https://rent.example.test/admin/orders/order-1',
  )
  assert.equal(buildNotificationOrderDetailUrl('https://rent.example.test/notifications', '', 'CUSTOMER'), '')
})

test('due-date notifications are inserted once per order and reminder type', async () => {
  const inserted = new Set<string>()
  const statements: string[] = []
  const db = {
    prepare(sql: string) {
      statements.push(sql)
      const state = { args: [] as unknown[] }
      return {
        bind(...args: unknown[]) { state.args = args; return this },
        async run() {
          if (!/INSERT OR IGNORE INTO notifications/i.test(sql)) return { meta: { changes: 0 } }
          const key = `${state.args[1]}:${state.args[2]}:${state.args[5]}`
          if (inserted.has(key)) return { meta: { changes: 0 } }
          inserted.add(key)
          return { meta: { changes: 1 } }
        },
        async all() {
          if (/SELECT o\.id/i.test(sql) && /o\.endDate/i.test(sql)) return { results: [{ id: 'order-1', userId: 'customer-1', orderNo: 'ORD-1' }] }
          if (/SELECT o\.id/i.test(sql) && /o\.startDate/i.test(sql)) return { results: [{ id: 'order-2', userId: 'customer-1', orderNo: 'ORD-2' }] }
          return { results: [] }
        },
      }
    },
  }
  const context = { env: { RENT: db } } as any

  assert.equal(await createDueDateNotifications(context), 3)
  assert.equal(await createDueDateNotifications(context), 0)
  assert.equal(statements.filter(sql => /INSERT OR IGNORE INTO notifications/i.test(sql)).length, 6)
})
