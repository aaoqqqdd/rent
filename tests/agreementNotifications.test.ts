/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { notifyAgreementUpdate } from '../src/actions/admin/saveSettings'
import { deliverPendingAgreementNotifications } from '../src/services/notifications'

function makeDb(options: { queueRows?: any[]; customers?: any[] } = {}) {
  const statements: Array<{ sql: string; args: unknown[] }> = []
  const batches: Array<Array<{ sql: string; args: unknown[] }>> = []
  const queueRows = options.queueRows || []
  const customers = options.customers || []
  const db = {
    prepare(sql: string) {
      const state = { args: [] as unknown[] }
      const statement = {
        sql,
        state,
        bind(...args: unknown[]) { state.args = args; return this },
        async run() { statements.push({ sql, args: state.args }); return { meta: { changes: 1 } } },
        async all() {
          if (/FROM agreement_update_queue/i.test(sql)) return { results: queueRows }
          if (/SELECT (?:id, )?name, email FROM users/i.test(sql)) return { results: customers }
          return { results: [] }
        },
        async first() {
          if (/FROM systemSettings/i.test(sql)) return { value: JSON.stringify({ name: '测试租赁', email: 'support@example.com' }) }
          if (/FROM email_templates/i.test(sql)) return { subject: '协议内容已更新 - {company_name}', body: '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请登录后查看最新版本。', enabled: 1 }
          return null
        },
      }
      return statement
    },
    async batch(batch: any[]) {
      const captured = batch.map((statement: any) => ({ sql: statement.sql, args: statement.state?.args || [] }))
      batches.push(captured)
      return []
    },
  }
  return { db, statements, batches }
}

test('saving an agreement only queues changed agreement keys and deduplicates keys', async () => {
  const { db, statements, batches } = makeDb()
  await notifyAgreementUpdate({ env: { RENT: db } } as any, [['userTerms', '用户协议'], ['userTerms', '用户协议'], ['rentalTerms', '租赁协议']])

  assert.equal(statements.filter(({ sql }) => /notifications/i.test(sql)).length, 0)
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 2)
  assert.match(batches[0][0].sql, /ON CONFLICT\(agreement_key\)/i)
})

test('scheduled delivery combines queued agreements into one customer notification', async () => {
  const { db, statements, batches } = makeDb({
    queueRows: [
      { agreement_key: 'userTerms', agreement_label: '用户协议', revision: 'rev-1', queued_at: '2026-09-12 00:01:00' },
      { agreement_key: 'rentalTerms', agreement_label: '租赁协议', revision: 'rev-2', queued_at: '2026-09-12 00:02:00' },
    ],
    customers: [
      { id: 'customer-1', name: '客 户甲', email: 'a@example.com' },
      { id: 'customer-2', name: '客户乙', email: 'b@example.com' },
    ],
  })

  assert.equal(await deliverPendingAgreementNotifications({ env: { RENT: db } } as any), 2)
  const notificationBatches = batches.filter((batch) => batch.some(({ sql }) => /notifications/i.test(sql)))
  const notificationWrites = notificationBatches.flat()
  assert.equal(notificationBatches.length, 1)
  assert.equal(notificationWrites.length, 2)
  assert.ok(notificationWrites.every(({ args }) => args.some((value) => String(value).includes('用户协议、租赁协议'))))
  assert.ok(notificationWrites.some(({ args }) => args.some((value) => String(value).includes('尊敬的 客户甲：'))))
  assert.ok(notificationWrites.every(({ args }) => args.every((value) => !String(value).includes('请登录后查看'))))
  assert.equal(batches.filter((batch) => batch.some(({ sql }) => /email_events/i.test(sql))).length, 1)
  assert.equal(batches.filter((batch) => batch.some(({ sql }) => /DELETE FROM agreement_update_queue/i.test(sql))).length, 1)
})
