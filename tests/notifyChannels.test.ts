/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEmailCredentials, sendTransactionalEmail } from '../src/notifyChannels'
import { renderEmailNotificationHtml, renderMarketingEmailHtml } from '../src/lib/html'
import { runConnectivityProbes } from '../src/services/connectivity'

const masterKey = 'test-settings-encryption-key'

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function encrypt(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterKey))
  const cryptoKey = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(value))
  return `${encode(iv)}.${encode(new Uint8Array(data))}`
}

function context(config: Record<string, unknown>, extraEnv: Record<string, unknown> = {}) {
  const db = {
    prepare() {
      return {
        bind() { return this },
        async first() { return { value: JSON.stringify(config) } },
      }
    },
  }
  return { env: { RENT: db, SETTINGS_ENCRYPTION_KEY: masterKey, ...extraEnv } } as any
}

test('selected provider does not fall back to an unrelated Resend environment key', async () => {
  const result = await resolveEmailCredentials(
    context({ emailProvider: 'brevo' }, { RESEND_API_KEY: 're_environment_key', EMAIL_FROM: 'sender@example.com' }),
  )

  assert.deepEqual(result, { provider: 'brevo', apiKey: '', from: 'sender@example.com' })
})

test('transactional email uses the request format required by each provider', async () => {
  const cases = [
    {
      provider: 'resend',
      url: 'https://api.resend.com/emails',
      response: new Response(JSON.stringify({ id: 'resend-id' }), { status: 200 }),
      check(request: RequestInit) {
        assert.equal(request.headers && new Headers(request.headers).get('Authorization'), 'Bearer resend-key')
        const body = JSON.parse(String(request.body))
        assert.equal(body.from, 'PC Rental <sender@example.com>')
        assert.deepEqual(body.to, ['recipient@example.com'])
        assert.equal(body.text, 'test body')
        assert.match(body.html, /PC RENTAL/)
        assert.match(body.html, /账户服务/)
      },
    },
    {
      provider: 'brevo',
      url: 'https://api.brevo.com/v3/smtp/email',
      response: new Response(JSON.stringify({ messageId: 'brevo-id' }), { status: 201 }),
      check(request: RequestInit) {
        assert.equal(request.headers && new Headers(request.headers).get('api-key'), 'brevo-key')
        const body = JSON.parse(String(request.body))
        assert.deepEqual(body.sender, { email: 'sender@example.com', name: 'PC Rental' })
        assert.deepEqual(body.to, [{ email: 'recipient@example.com' }])
        assert.equal(body.textContent, 'test body')
        assert.match(body.htmlContent, /PC RENTAL/)
      },
    },
    {
      provider: 'mailersend',
      url: 'https://api.mailersend.com/v1/email',
      response: new Response(null, { status: 202, headers: { 'x-message-id': 'mailersend-id' } }),
      check(request: RequestInit) {
        assert.equal(request.headers && new Headers(request.headers).get('Authorization'), 'Bearer mailersend-key')
        const body = JSON.parse(String(request.body))
        assert.deepEqual(body.from, { email: 'sender@example.com', name: 'PC Rental' })
        assert.deepEqual(body.to, [{ email: 'recipient@example.com' }])
        assert.equal(body.text, 'test body')
        assert.match(body.html, /PC RENTAL/)
      },
    },
  ] as const

  const originalFetch = globalThis.fetch
  try {
    for (const item of cases) {
      let requestUrl = ''
      let requestInit: RequestInit | undefined
      globalThis.fetch = async (input, init) => {
        requestUrl = String(input)
        requestInit = init
        return item.response.clone()
      }
      const apiKey = await encrypt(`${item.provider}-key`)
      const result = await sendTransactionalEmail(
        context({ emailProvider: item.provider, [`${item.provider}ApiKey`]: apiKey, [`${item.provider}From`]: 'PC Rental <sender@example.com>' }),
        { to: 'recipient@example.com', subject: 'test subject', text: 'test body' },
      )
      assert.equal(requestUrl, item.url)
      assert.equal(result.ok, true)
      assert.equal(result.id, `${item.provider}-id`)
      item.check(requestInit || {})
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('notification and marketing emails share the branded shell while keeping their content rules', () => {
  const notification = renderEmailNotificationHtml('设备已准备好', '<p>请按时取件。</p>', '测试租赁', '#246b61')
  const marketing = renderMarketingEmailHtml('会员专属优惠', '<p>现在下单可享优惠。</p>', '测试租赁', '#246b61', 'https://example.com/unsubscribe?token=a&next=b')

  for (const html of [notification, marketing]) {
    assert.match(html, /PC RENTAL/)
    assert.match(html, /设备租赁 · 账户服务/)
    assert.match(html, /background:#246b61/)
    assert.doesNotMatch(html, /<script/i)
  }
  assert.match(notification, /系统通知邮件/)
  assert.match(marketing, /点击取消订阅/)
  assert.match(marketing, /token=a&amp;next=b/)
})

test('Resend connectivity uses the read-only domains endpoint and rejects non-2xx responses', async () => {
  const apiKey = await encrypt('resend-key')
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  try {
    globalThis.fetch = async (input) => {
      requests.push(String(input))
      return new Response('', { status: 400 })
    }
    const result = await runConnectivityProbes(
      context({ emailProvider: 'resend', resendApiKey: apiKey }),
      'email',
    )
    assert.deepEqual(requests, ['https://api.resend.com/domains'])
    assert.equal(result[0].status, 'error')
    assert.match(result[0].detail, /HTTP 400/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
