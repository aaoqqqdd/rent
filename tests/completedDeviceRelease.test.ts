/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { URL } from 'node:url'
import worker from '../src/index'
import { createAuthSession, updateOrderStatus } from '../src/site'

async function setup(t: any, depositStatus = 'HELD', mode = 'PAID') {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
  sqlite.exec("INSERT INTO users (id, name, email, role) VALUES ('release-admin', '管理员', 'release-admin@example.test', 'ADMIN'), ('release-customer', '客户', 'release-customer@example.test', 'CUSTOMER'); INSERT INTO devices (id, name, model, serialNumber, pricePerDay, depositAmount, status, lifecycle_status) VALUES ('release-device', '电脑', 'Test', 'RELEASE-SN', 20, 200, 'rented', 'RENTED');")
  sqlite.prepare("INSERT INTO orders (id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, status, rental_status, deposit_status, deposit_payment_mode) VALUES ('release-order', 'release-customer', 'release-device', '2026-01-01', '2026-01-02', 1, 220, 200, 'active', 'ACTIVE', ?, ?)").run(depositStatus, mode)
  const db = {
    prepare(sql: string) {
      let values: any[] = []
      const query = {
        bind(...input: any[]) { values = input; return query },
        async first() { return sqlite.prepare(sql).get(...values) || null },
        async all() { return { results: sqlite.prepare(sql).all(...values) } },
        async run() { return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } } },
      }
      return query
    },
    async batch(statements: any[]) { const result = []; for (const statement of statements) result.push(await statement.run()); return result },
  }
  const context = { env: { RENT: db } } as any
  const session = await createAuthSession(context, 'release-admin')
  const request = (path: string, form: Record<string, string>) => worker.fetch(new Request(`https://rent.example.test${path}`, {
    method: 'POST', body: new URLSearchParams(form), headers: { Cookie: `session=${session.token}`, Origin: 'https://rent.example.test', 'Sec-Fetch-Site': 'same-origin' },
  }), context.env, { waitUntil() {} } as any)
  return { sqlite, context, request }
}

for (const depositStatus of ['HELD', 'REFUND_PENDING', 'REFUNDED']) test(`completion releases the device with deposit ${depositStatus}`, async t => {
  const { sqlite, context } = await setup(t, depositStatus)
  await updateOrderStatus(context, 'release-order', 'completed')
  const device = sqlite.prepare("SELECT status, lifecycle_status FROM devices WHERE id = 'release-device'").get()!
  assert.equal(device.status, 'available')
  assert.equal(device.lifecycle_status, 'READY')
  const order = sqlite.prepare("SELECT status, deposit_status FROM orders WHERE id = 'release-order'").get()!
  assert.equal(order.status, 'completed')
  assert.equal(order.deposit_status, depositStatus)
})

test('normal return inspection releases the device while the deposit is still held', async t => {
  const { sqlite, request } = await setup(t)
  sqlite.exec("INSERT INTO contracts (id, orderId, contractNumber, content) VALUES ('release-contract', 'release-order', 'RELEASE-CONTRACT', '<p>合同</p>')")
  const response = await request('/staff/orders/release-order/inspection', {
    screenCondition: '正常', keyboardCondition: '正常', trackpadCondition: '正常', bodyCondition: '正常', cameraCondition: '正常', wifiCondition: '正常', powerTest: '正常', replacementCost: '0',
  })
  assert.equal(response.status, 302)
  assert.equal(sqlite.prepare("SELECT deposit_status FROM orders WHERE id = 'release-order'").get()?.deposit_status, 'HELD')
  assert.equal(sqlite.prepare("SELECT lifecycle_status FROM devices WHERE id = 'release-device'").get()?.lifecycle_status, 'READY')
})

test('completion also clears a stale rented status when the lifecycle is already ready', async t => {
  const { sqlite, context } = await setup(t)
  sqlite.exec("UPDATE devices SET lifecycle_status = 'READY' WHERE id = 'release-device'")
  await updateOrderStatus(context, 'release-order', 'completed')
  assert.equal(sqlite.prepare("SELECT status FROM devices WHERE id = 'release-device'").get()?.status, 'available')
})

test('failed authorization settlement cannot prevent force completion from releasing the device', async t => {
  const { sqlite, request } = await setup(t, 'HELD', 'PREAUTH')
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream unavailable', { status: 503 }))
  const response = await request('/admin/orders/release-order/update', { status: 'completed', force: '1' })
  assert.ok(response.status >= 400)
  assert.equal(sqlite.prepare("SELECT status FROM orders WHERE id = 'release-order'").get()?.status, 'completed')
  assert.equal(sqlite.prepare("SELECT deposit_status FROM orders WHERE id = 'release-order'").get()?.deposit_status, 'REFUND_PENDING')
  assert.equal(sqlite.prepare("SELECT lifecycle_status FROM devices WHERE id = 'release-device'").get()?.lifecycle_status, 'READY')
})

for (const status of ['extended', 'overdue', 'suspended']) test(`another ${status} rental still holds the device`, async t => {
  const { sqlite, context } = await setup(t)
  sqlite.prepare("INSERT INTO orders (id, userId, deviceId, rentalPeriod, totalAmount, depositAmount, status, is_manual) VALUES ('other-rental', 'release-customer', 'release-device', 0, 0, 0, ?, 1)").run(status)
  await updateOrderStatus(context, 'release-order', 'completed')
  assert.equal(sqlite.prepare("SELECT status FROM devices WHERE id = 'release-device'").get()?.status, 'rented')
})
