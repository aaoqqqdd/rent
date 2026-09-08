/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../src/index'

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function monitorDb(tokenHash: string) {
  return {
    prepare(sql: string) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes("key = 'monitorApiTokenHash'")) return { value: tokenHash }
          if (sql.includes('FROM error_logs')) return { total: 0, critical: 0 }
          if (sql.includes('FROM scheduled_job_runs')) return { failures: 0, stuck: 0, last_run: new Date().toISOString().replace('T', ' ').replace('Z', '') }
          if (sql.includes('FROM email_events')) return { failures: 0, stuck: 0 }
          if (sql.includes('FROM device_commands')) return { failures: 0, overdue: 0 }
          throw new Error(`Unexpected monitor query: ${sql}`)
        },
      }
    },
  }
}

test('Monitorflare endpoint requires its configured Bearer token', async () => {
  const token = 'monitor-test-token'
  const env = { RENT: monitorDb(await sha256(token)) } as any

  const unauthorized = await worker.fetch(new Request('https://rent.example/api/monitor'), env)
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.headers.get('WWW-Authenticate'), 'Bearer realm="monitor"')

  const wrongToken = await worker.fetch(new Request('https://rent.example/api/monitor', {
    headers: { Authorization: 'Bearer wrong-token' },
  }), env)
  assert.equal(wrongToken.status, 401)

  const response = await worker.fetch(new Request('https://rent.example/api/monitor', {
    headers: { Authorization: `Bearer ${token}` },
  }), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  const body = await response.json() as any
  assert.equal(body.status, 'ok')
  assert.equal(body.checks.deviceAgentChannel, undefined)
})
