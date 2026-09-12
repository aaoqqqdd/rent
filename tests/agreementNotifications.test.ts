/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { notifyAgreementUpdate } from '../src/actions/admin/saveSettings'

test('agreement update notifications use a stable idempotency key', async () => {
  const notificationBinds: unknown[][] = []
  const db = {
    prepare(sql: string) {
      const state = { args: [] as unknown[] }
      return {
        bind(...args: unknown[]) { state.args = args; return this },
        async run() {
          if (/INSERT OR IGNORE INTO notifications/i.test(sql)) notificationBinds.push(state.args)
          return { meta: { changes: 1 } }
        },
        async first() {
          if (/FROM email_templates/i.test(sql)) return { subject: '协议已更新 - {company_name}', body: '变更：{changed_agreements}', enabled: 1 }
          return null
        },
        async all() {
          if (/SELECT name, email FROM users/i.test(sql)) return { results: [{ name: '客户', email: 'customer@example.com' }] }
          return { results: [] }
        },
      }
    },
    async batch() { return [] },
  }
  const context = { env: { RENT: db } } as any

  await notifyAgreementUpdate(context, [['serviceTerms', '服务条款']], { name: 'PC Rental', email: 'support@example.com' }, '<p>v2</p>')
  await notifyAgreementUpdate(context, [['serviceTerms', '服务条款']], { name: 'PC Rental', email: 'support@example.com' }, '<p>v2</p>')

  assert.equal(notificationBinds.length, 2)
  assert.equal(notificationBinds[0][2], notificationBinds[1][2])
  assert.match(String(notificationBinds[0][2]), /^agreement_update:[0-9a-f]{64}$/)
})
