/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 通过真实 Worker 入口验证安全边界（响应头、请求体上限、限流、跳转）：
// 这些行为只有在中间件链里才成立，纯函数测试覆盖不到。

import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../src/index'

/** 极简 D1 替身：只为中间件路径服务，任何非预期查询都抛错，避免静默放过。 */
function stubDb(options: { onRateLimit?: (sql: string, values: any[]) => any } = {}) {
  const statements: { sql: string; values: any[] }[] = []
  const db = {
    statements,
    prepare(sql: string) {
      const record = { sql, values: [] as any[] }
      statements.push(record)
      const query: any = {
        bind(...values: any[]) { record.values = values; return query },
        async first() {
          if (sql.includes('auth_sessions')) return null
          if (sql.includes('security_rate_limits')) {
            return options.onRateLimit ? options.onRateLimit(sql, record.values) : { request_count: 1 }
          }
          return null
        },
        async all() { return { results: [] } },
        async run() {
          if (sql.includes('security_rate_limits')) {
            return { success: true, meta: { changes: 1 } }
          }
          return { success: true, meta: { changes: 0 } }
        },
      }
      return query
    },
    async batch(items: any[]) { return items.map(() => ({ success: true, meta: { changes: 0 } })) },
  }
  return db
}

function env(db = stubDb()) {
  return { RENT: db } as any
}

const ctx = { waitUntil() { } } as any

function headersOf(response: Response) {
  return {
    nosniff: response.headers.get('X-Content-Type-Options'),
    frame: response.headers.get('X-Frame-Options'),
    csp: response.headers.get('Content-Security-Policy'),
    referrer: response.headers.get('Referrer-Policy'),
    permissions: response.headers.get('Permissions-Policy'),
    coop: response.headers.get('Cross-Origin-Opener-Policy'),
    corp: response.headers.get('Cross-Origin-Resource-Policy'),
    hsts: response.headers.get('Strict-Transport-Security'),
  }
}

function assertBaselineHeaders(response: Response, label: string) {
  const headers = headersOf(response)
  assert.equal(headers.nosniff, 'nosniff', `${label}: nosniff`)
  assert.equal(headers.frame, 'DENY', `${label}: X-Frame-Options`)
  assert.equal(headers.referrer, 'no-referrer', `${label}: Referrer-Policy`)
  assert.equal(headers.coop, 'same-origin', `${label}: COOP`)
  assert.equal(headers.corp, 'same-origin', `${label}: CORP`)
  assert.ok(headers.permissions && headers.permissions.includes('camera=()'), `${label}: Permissions-Policy`)
  assert.equal(headers.hsts, 'max-age=31536000; includeSubDomains', `${label}: HSTS on https`)
  assert.ok(headers.csp, `${label}: CSP present`)
  assert.doesNotMatch(headers.csp!, /'unsafe-eval'/, `${label}: no unsafe-eval`)
  assert.match(headers.csp!, /object-src 'none'/, `${label}: object-src`)
  assert.match(headers.csp!, /frame-ancestors 'none'/, `${label}: frame-ancestors`)
  assert.match(headers.csp!, /base-uri 'self'/, `${label}: base-uri`)
}

test('security headers are present on dynamic, static, 404 and error responses', async () => {
  const db = stubDb()
  const dynamic = await worker.fetch(new Request('https://rent.example.test/login'), env(db), ctx)
  assertBaselineHeaders(dynamic, 'dynamic /login')
  assert.equal(dynamic.headers.get('Cache-Control'), 'private, no-store')

  // 静态资源必须同时满足两件事：带全套安全头 + 保留自己的 public 缓存策略。
  // 注意 /styles.css 等路由注册在安全头中间件之后，历史上因此完全跳过了所有中间件。
  const staticAsset = await worker.fetch(new Request('https://rent.example.test/styles.css'), env(db), ctx)
  assertBaselineHeaders(staticAsset, 'static /styles.css')
  assert.match(staticAsset.headers.get('Content-Type') || '', /text\/css/)
  const staticCache = staticAsset.headers.get('Cache-Control') || ''
  assert.match(staticCache, /^public/, 'static asset keeps a public cache policy')
  assert.match(staticCache, /max-age=\d+/, 'static asset keeps max-age')
  assert.doesNotMatch(staticCache, /no-store/, 'static asset must not be downgraded to no-store')

  for (const [path, expectedType] of [['/app.js', /javascript/], ['/i18n.js', /javascript/], ['/favicon.svg', /svg/]] as const) {
    const asset = await worker.fetch(new Request(`https://rent.example.test${path}`), env(db), ctx)
    assertBaselineHeaders(asset, `static ${path}`)
    assert.match(asset.headers.get('Content-Type') || '', expectedType)
    assert.match(asset.headers.get('Cache-Control') || '', /^public/)
  }

  // 静态资源短路仍然在鉴权之前：加载 CSS 不能产生会话查询。
  assert.equal(db.statements.some((statement) => statement.sql.includes('auth_sessions')), false, 'static asset must not query the session table')

  // 未匹配路由由 app.notFound（或末尾的 GET '*' 兜底 404 页）直接产出，不经过任何
  // 业务路由；这类响应在过去完全丢头，是中间件前移的主要动机。
  const missing = await worker.fetch(new Request('https://rent.example.test/no-such-route'), env(db), ctx)
  assert.ok([200, 404].includes(missing.status), `unmatched route status: ${missing.status}`)
  assertBaselineHeaders(missing, 'unmatched route')

  // 413 由请求体上限中间件直接产出，也必须带头。
  const tooLarge = await worker.fetch(new Request('https://rent.example.test/login', {
    method: 'POST',
    headers: { 'Content-Length': String(512 * 1024), Origin: 'https://rent.example.test', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'a=1',
  }), env(db), ctx)
  assert.equal(tooLarge.status, 413)
  assertBaselineHeaders(tooLarge, '413 body limit')

  // 限流 429 同样必须带头。
  const limitedDb = stubDb({ onRateLimit: () => ({ request_count: 10_000 }) })
  const limited = await worker.fetch(new Request('https://rent.example.test/login', {
    method: 'POST',
    headers: { Origin: 'https://rent.example.test', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'account=a&password=b',
  }), env(limitedDb), ctx)
  assert.equal(limited.status, 429)
  assertBaselineHeaders(limited, '429 rate limit')
})

test('static asset short-circuit still runs before the session lookup for every static path', async () => {
  for (const path of ['/styles.css', '/app.js', '/i18n.js', '/favicon.svg']) {
    const db = stubDb()
    const response = await worker.fetch(new Request(`https://rent.example.test${path}`), env(db), ctx)
    assert.notEqual(response.status, 500, `${path} should render`)
    assert.equal(db.statements.some((statement) => statement.sql.includes('auth_sessions')), false, `${path} must not query sessions`)
  }
})

test('oversized bodies are rejected for ordinary form posts and multipart uploads', async () => {
  const db = stubDb()
  const oversizedForm = await worker.fetch(new Request('https://rent.example.test/customer/profile', {
    method: 'POST',
    headers: { 'Content-Length': String(2 * 1024 * 1024), Origin: 'https://rent.example.test', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=test',
  }), env(db), ctx)
  assert.equal(oversizedForm.status, 413)
  assert.equal(await oversizedForm.text(), 'Request body too large')

  const oversizedUpload = await worker.fetch(new Request('https://rent.example.test/customer/orders/o1/bank-transfer-proof', {
    method: 'POST',
    headers: { 'Content-Length': String(8 * 1024 * 1024), Origin: 'https://rent.example.test', 'Content-Type': 'multipart/form-data; boundary=x' },
    body: '--x--',
  }), env(db), ctx)
  assert.equal(oversizedUpload.status, 413)

  // webhook 额度（512KB）比普通表单（128KB）更大：200KB 的合法表单提交会被拒，
  // 同体积的 webhook 不会被 413（后面会走到签名校验并被拒）。
  const midSize = String(200 * 1024)
  const midForm = await worker.fetch(new Request('https://rent.example.test/customer/profile', {
    method: 'POST',
    headers: { 'Content-Length': midSize, Origin: 'https://rent.example.test', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=test',
  }), env(db), ctx)
  assert.equal(midForm.status, 413)
  const webhook = await worker.fetch(new Request('https://rent.example.test/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Length': midSize, 'Content-Type': 'application/json' },
    body: '{}',
  }), env(db), ctx)
  assert.notEqual(webhook.status, 413, 'webhook body limit is larger than the form limit')
})

test('login redirect never becomes an open redirect', async () => {
  const db = stubDb()
  for (const attack of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '/%2f%2fevil.example']) {
    const response = await worker.fetch(new Request(`https://rent.example.test/login?redirect=${encodeURIComponent(attack)}`), env(db), ctx)
    assert.equal(response.status, 200, `${attack}: page renders`)
    const html = await response.text()
    // 登录页把 redirect 放进隐藏字段；攻击值不能出现在表单里。
    const hidden = html.match(/<input type="hidden" name="redirect" value="([^"]*)"/)
    assert.ok(hidden, `${attack}: hidden field exists`)
    assert.equal(hidden![1], '', `${attack}: must be stripped from the form`)
  }
  const sameOrigin = await worker.fetch(new Request(`https://rent.example.test/login?redirect=${encodeURIComponent('/customer/orders/abc')}`), env(db), ctx)
  const html = await sameOrigin.text()
  assert.match(html, /name="redirect" value="\/customer\/orders\/abc"/)
})

test('high-risk write endpoints are rate limited and payment webhooks are exempt', async () => {
  const db = stubDb({ onRateLimit: () => ({ request_count: 10_000 }) })
  const limited = async (path: string, method = 'GET', body?: string) => worker.fetch(new Request(`https://rent.example.test${path}`, {
    method,
    ...(body ? { body } : {}),
    headers: {
      Origin: 'https://rent.example.test',
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': body ? 'application/x-www-form-urlencoded' : 'text/plain',
    },
  }), env(db), ctx)

  for (const [path, method, body] of [
    ['/login', 'POST', 'account=a&password=b'],
    ['/register', 'POST', 'email=a@example.test'],
    ['/forgot-password', 'POST', 'email=a@example.test'],
    ['/customer/profile/password', 'POST', 'currentPassword=a&newPassword=b'],
    ['/customer/balance/top-up', 'POST', 'amount=10'],
    ['/customer/profile/delete-account', 'POST', 'confirmDelete=on'],
    ['/admin/orders/export', 'GET', undefined],
    // /api/search 需要登录（未登录直接 401），但限流在鉴权之前，所以仍然先撞 429。
    ['/contract/sign?token=abc', 'POST', 'step=1'],
    ['/verify?number=a&token=b', 'GET', undefined],
  ] as const) {
    const response = await limited(path, method as any, body as any)
    assert.equal(response.status, 429, `${path} should be rate limited`)
  }

  // webhook 不能被限流：Stripe/Square 会重放同一事件，429 会变成「已收款未入账」。
  for (const path of ['/webhooks/stripe', '/webhooks/square', '/webhooks/tally']) {
    const response = await worker.fetch(new Request(`https://rent.example.test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
      body: '{}',
    }), env(db), ctx)
    assert.notEqual(response.status, 429, `${path} must never be rate limited`)
  }
})
