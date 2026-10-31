/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { URL } from 'node:url'
import worker from '../src/index'
import { createAuthSession, updateOrderStatus } from '../src/site'
import { resolveRentalApplicationConflicts } from '../src/services/rentalApplications'

async function setup(t: any) {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
  }
  sqlite.exec(`INSERT INTO users (id, name, email, role, status, account_status) VALUES
    ('a', '客户甲', 'a@example.test', 'CUSTOMER', 'active', 'active'),
    ('b', '客户乙', 'b@example.test', 'CUSTOMER', 'active', 'active'),
    ('admin', '管理员', 'admin@example.test', 'ADMIN', 'active', 'active');
    INSERT INTO devices (id, name, model, serialNumber, pricePerDay, depositAmount, status, lifecycle_status)
    VALUES ('device', '电脑', 'Test', 'SN', 20, 100, 'available', 'READY');`)
  let raceChecks = false
  let pendingChecks: Array<() => void> = []
  const db = {
    prepare(sql: string) {
      let values: any[] = []
      const statement = {
        bind(...args: any[]) { values = args; return statement },
        async first() { return sqlite.prepare(sql).get(...values) || null },
        async all() {
          const result = { results: sqlite.prepare(sql).all(...values) }
          // 两个请求都先取得空档期快照，再允许任一请求插入订单。
          if (raceChecks && sql.startsWith('SELECT startDate, endDate, startPeriod, endPeriod FROM orders')) {
            await new Promise<void>(resolve => {
              pendingChecks.push(resolve)
              if (pendingChecks.length === 2) { raceChecks = false; pendingChecks.forEach(done => done()); pendingChecks = [] }
            })
          }
          return result
        },
        async run() { return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } } },
      }
      return statement
    },
    async batch(statements: any[]) {
      const result = []
      for (const statement of statements) result.push(await statement.run())
      return result
    },
  }
  const context = { env: { RENT: db }, req: { url: 'https://rent.example.test/', header() { return undefined } } } as any
  const sessions = { a: await createAuthSession(context, 'a'), b: await createAuthSession(context, 'b'), admin: await createAuthSession(context, 'admin') }
  const request = (user: 'a' | 'b' | 'admin', path: string, form: Record<string, string>) => worker.fetch(new Request(`https://rent.example.test${path}`, {
    method: 'POST', body: new URLSearchParams(form),
    headers: { Cookie: `session=${sessions[user].token}`, Origin: 'https://rent.example.test', 'Sec-Fetch-Site': 'same-origin' },
  }), context.env, { waitUntil() {} } as any)
  const submit = (user: 'a' | 'b', form = dates) => request(user, '/customer/rent/device', { deliveryMethod: 'Delivery', deliveryAddress: '测试地址', ...form })
  const insert = (id: string, fields: { start?: string; end?: string; startPeriod?: string; endPeriod?: string; created?: string; status?: string } = {}) => {
    sqlite.prepare(`INSERT INTO orders (id, userId, deviceId, startDate, endDate, startPeriod, endPeriod, rentalPeriod, totalAmount, depositAmount, status, createdAt)
      VALUES (?, 'a', 'device', ?, ?, ?, ?, 7, 240, 100, ?, ?)`)
      .run(id, fields.start || '2090-01-02', fields.end || '2090-01-09', fields.startPeriod || 'AM', fields.endPeriod || 'AM', fields.status || 'pending_approval', fields.created || '2026-10-31T00:00:00.000Z')
  }
  const status = (id: string) => sqlite.prepare('SELECT status FROM orders WHERE id = ?').get(id)?.status
  return { sqlite, context, insert, status, submit, request, race() { raceChecks = true } }
}

const dates = { startDate: '2090-01-02', endDate: '2090-01-09', startPeriod: 'AM', endPeriod: 'AM' }

test('ordinary later submissions remain blocked by the existing availability check', async t => {
  const { sqlite, submit } = await setup(t)
  assert.equal((await submit('a')).status, 302)
  const response = await submit('b', { ...dates, endDate: '2090-01-20' })
  assert.equal(response.status, 200)
  assert.match(await response.text(), /请选择可用设备和正确的租赁日期/)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get()?.n, 1)
  assert.equal(sqlite.prepare('SELECT status FROM orders').get()?.status, 'pending_approval')
})

for (const scenario of [
  { name: 'longer rental wins even when starting later', form: { ...dates, startDate: '2090-01-03', endDate: '2090-01-20' }, winner: 'b' },
  { name: 'equal duration prefers earlier rental start over submission time', form: { ...dates, startDate: '2090-01-01', endDate: '2090-01-08' }, winner: 'b' },
  { name: 'shorter rental loses even when starting earlier', form: { ...dates, startDate: '2090-01-01', endDate: '2090-01-04' }, winner: 'a' },
]) {
  test(`concurrent submissions: ${scenario.name}`, { timeout: 10000 }, async t => {
    const { sqlite, submit, race } = await setup(t)
    race()
    const responses = await Promise.all([submit('a'), submit('b', scenario.form)])
    assert.ok(responses.every(response => response.status === 302))
    const rows = sqlite.prepare('SELECT id, userId, status, order_status, rental_status FROM orders').all()
    assert.equal(rows.length, 2)
    assert.equal(rows.find(row => row.status === 'pending_approval')?.userId, scenario.winner)
    const loser = rows.find(row => row.status === 'cancelled')!
    assert.ok(loser)
    assert.equal(loser.order_status, 'CANCELLED')
    assert.equal(loser.rental_status, 'CANCELLED')
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE order_id = ? AND type = 'rental_application_rejected'").get(loser.id)?.n, 1)
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM rental_status_history WHERE rental_id = ? AND new_status = 'CANCELLED'").get(loser.id)?.n, 1)
  })
}

test('equal dates and duration prefer earlier submission, including mixed timestamp formats', async t => {
  const { insert, status, context } = await setup(t)
  insert('later', { created: '2026-10-31T01:00:00.001Z' })
  insert('earlier', { created: '2026-10-31 01:00:00' })
  assert.deepEqual(await resolveRentalApplicationConflicts(context, 'device', 'later'), ['later'])
  assert.equal(status('earlier'), 'pending_approval')
  assert.deepEqual(await resolveRentalApplicationConflicts(context, 'device', 'later'), [])
  assert.equal(await updateOrderStatus(context, 'later', 'approved', { expectedStatus: 'pending_approval' }), false)
  assert.equal(status('later'), 'cancelled')
})

test('half-day duration decides priority and exactly adjacent rentals remain available', async t => {
  const { insert, status, context } = await setup(t)
  insert('short')
  insert('long', { endPeriod: 'PM', created: '2026-11-01T00:00:00Z' })
  insert('adjacent', { start: '2090-01-09', end: '2090-01-12', startPeriod: 'PM' })
  await resolveRentalApplicationConflicts(context, 'device', 'long')
  assert.equal(status('short'), 'cancelled')
  assert.equal(status('long'), 'pending_approval')
  assert.equal(status('adjacent'), 'pending_approval')
})

test('existing approved bookings are protected and unrelated conflicts are untouched', async t => {
  const { insert, status, context } = await setup(t)
  insert('approved', { status: 'approved' })
  insert('new', { end: '2090-01-20' })
  insert('unrelated-a', { start: '2091-01-01', end: '2091-01-08' })
  insert('unrelated-b', { start: '2091-01-01', end: '2091-01-08' })
  await resolveRentalApplicationConflicts(context, 'device', 'new')
  assert.equal(status('approved'), 'approved')
  assert.equal(status('new'), 'cancelled')
  assert.equal(status('unrelated-a'), 'pending_approval')
  assert.equal(status('unrelated-b'), 'pending_approval')
})

test('simultaneous conflict resolution rejects and notifies each loser once', async t => {
  const { sqlite, insert, context, status } = await setup(t)
  insert('first')
  insert('second')
  await Promise.all([resolveRentalApplicationConflicts(context, 'device', 'first'), resolveRentalApplicationConflicts(context, 'device', 'second')])
  assert.equal(status('first'), 'pending_approval')
  assert.equal(status('second'), 'cancelled')
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type = 'rental_application_rejected'").get()?.n, 1)
})

test('rejection cancels contracts, clears review notifications and releases the reserved coupon', async t => {
  const { sqlite, insert, context } = await setup(t)
  insert('winner')
  insert('loser', { end: '2090-01-05' })
  sqlite.exec(`INSERT INTO contracts (id, orderId, contractNumber, content, status) VALUES ('contract', 'loser', 'C1', '<p>合同</p>', 'draft');
    INSERT INTO notifications (id, recipient_id, type, title, message, order_id) VALUES ('review', 'admin', 'rental_application', '租赁申请', '待审核', 'loser');
    INSERT INTO coupons (id, code, discount_type, discount_value, used_count) VALUES ('coupon', 'TEST', 'fixed', 10, 1);
    INSERT INTO coupon_redemptions (id, coupon_id, coupon_code, customer_id, order_id, discount_amount, status)
    VALUES ('redemption', 'coupon', 'TEST', 'a', 'loser', 10, 'RESERVED');`)
  await resolveRentalApplicationConflicts(context, 'device', 'loser')
  assert.equal(sqlite.prepare("SELECT status FROM contracts WHERE id = 'contract'").get()?.status, 'cancelled')
  assert.ok(sqlite.prepare("SELECT deleted_at FROM notifications WHERE id = 'review'").get()?.deleted_at)
  assert.equal(sqlite.prepare("SELECT status FROM coupon_redemptions WHERE id = 'redemption'").get()?.status, 'RELEASED')
  assert.equal(sqlite.prepare("SELECT used_count FROM coupons WHERE id = 'coupon'").get()?.used_count, 0)
  assert.equal(sqlite.prepare("SELECT lifecycle_status FROM devices WHERE id = 'device'").get()?.lifecycle_status, 'READY')
})

test('buffer days participate in race conflict detection', async t => {
  const { insert, context, status } = await setup(t)
  insert('longer')
  insert('shorter', { start: '2090-01-10', end: '2090-01-12' })
  assert.deepEqual(await resolveRentalApplicationConflicts(context, 'device', 'shorter', 2), ['shorter'])
  assert.equal(status('longer'), 'pending_approval')
})

test('completed, cancelled and deleted applications do not compete', async t => {
  const { sqlite, insert, context, status } = await setup(t)
  insert('completed', { status: 'completed' })
  insert('cancelled', { status: 'cancelled' })
  insert('deleted')
  sqlite.exec("UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = 'deleted'")
  insert('new', { end: '2090-01-03' })
  assert.deepEqual(await resolveRentalApplicationConflicts(context, 'device', 'new'), [])
  assert.equal(status('new'), 'pending_approval')
})
