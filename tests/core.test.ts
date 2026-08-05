/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLayout, canTransitionOrder, ensureOrderNumber, getContractBySignToken, hashPassword, verifyPassword, isContractExpired, isContractFinalized, renderContractVariables, CONTRACT_VARIABLE_GROUPS, CONTRACT_VARIABLE_NAMES, validateHostedImageUrls, sanitizePlainText, sanitizeRichHtml, updateOrder, loadSystemSettingsFromDB, splitPersonName } from '../src/site'
import { renderAdminSettings } from '../src/pages/admin/settings'
import { renderAdminContracts } from '../src/pages/admin/contracts'
import { renderAdminUserNew } from '../src/pages/admin/userNew'
import { renderStaffCustomerNew } from '../src/pages/staff/customerNew'
import { renderNewContractPage } from '../src/pages/staff/newContract'
import { renderStaffContracts } from '../src/pages/staff/contracts'
import { renderStaffCustomerDetail } from '../src/pages/staff/customerDetail'
import { refundableDepositFee, stripePaymentAmounts } from '../src/actions/stripePayments'
import { renderCustomerReferral } from '../src/pages/customer/referral'
import { readContractSignDraft } from '../src/pages/public/contractSign'

function assertInlineScriptsParse(html: string) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean)
  assert.ok(scripts.length > 0)
  for (const script of scripts) assert.doesNotThrow(() => new Function(script))
}

test('PBKDF2 passwords verify without storing plaintext', async () => {
  const hash = await hashPassword('A-secure-password-123')
  assert.match(hash, /^pbkdf2\$100000\$/)
  assert.equal(await verifyPassword('A-secure-password-123', hash), true)
  assert.equal(await verifyPassword('wrong-password', hash), false)
  assert.equal(await verifyPassword('A-secure-password-123', 'pbkdf2$210000$salt$hash'), false)
})

test('terminal order states cannot be reopened', () => {
  assert.equal(canTransitionOrder('pending_payment', 'paid'), true)
  assert.equal(canTransitionOrder('completed', 'active'), false)
  assert.equal(canTransitionOrder('cancelled', 'paid'), false)
})

test('unsigned contracts display as expired after their signing deadline', () => {
  const base = { id: 'c1', rentalId: 'o1', contractNumber: 'CT1', content: '', signedAt: null, status: 'pending_sign' as const }
  assert.equal(isContractExpired({ ...base, signExpiresAt: '2026-01-01T00:00:00.000Z' }, Date.parse('2026-01-02T00:00:00.000Z')), true)
  assert.equal(isContractExpired({ ...base, signExpiresAt: '2026-01-03T00:00:00.000Z' }, Date.parse('2026-01-02T00:00:00.000Z')), false)
  assert.equal(isContractExpired({ ...base, status: 'signed', signedAt: '2026-01-01T00:00:00.000Z', signExpiresAt: '2026-01-01T00:00:00.000Z' }, Date.parse('2026-01-02T00:00:00.000Z')), false)
})

test('contract downloads require a completed signed snapshot', () => {
  const base = { id: 'c1', rentalId: 'o1', contractNumber: 'CT1', content: '', status: 'signed' as const }
  assert.equal(isContractFinalized({ ...base, signedAt: null, signed_content: null }), false)
  assert.equal(isContractFinalized({ ...base, signedAt: '2026-08-06T00:00:00.000Z', signed_content: '<p>signed</p>' }), true)
})

test('contract links resolve the database orderId field', async () => {
  const row = { id: 'ct1', orderId: 'o1', contractNumber: 'CN1', content: '', signedAt: null, status: 'pending_sign', signToken: 'token' }
  const statement = { bind() { return this }, async first() { return row } }
  const contract = await getContractBySignToken({ env: { RENT: { prepare: () => statement } } } as any, 'token')
  assert.equal(contract?.rentalId, 'o1')
  assert.equal(contract?.rental_id, 'o1')
})

test('order numbers are created once after payment and can include Stripe reference', async () => {
  let orderNo: string | null = null
  const db = {
    prepare(sql: string) {
      let values: any[] = []
      return {
        bind(...args: any[]) { values = args; return this },
        async first() { return { orderNo } },
        async run() { if (sql.startsWith('UPDATE orders SET orderNo')) orderNo ||= values[0]; return { success: true } },
      }
    }
  }
  const context = { env: { RENT: db } } as any
  const generated = await ensureOrderNumber(context, 'o1', 'pi_123abc')
  assert.match(generated, /^OD\d{8}PI123ABC$/)
  assert.equal(await ensureOrderNumber(context, 'o1', 'pi_different'), generated)
})

test('order updates never bind undefined values into D1', async () => {
  let bound: unknown[] = []
  const statement = { bind(...values: unknown[]) { bound = values; return this }, async run() { return { success: true } } }
  const context = { env: { RENT: { prepare: () => statement } } } as any
  await updateOrder(context, {
    id: 'o1', userId: 'u1', deviceId: 'd1', startDate: '2026-08-08', endDate: '2026-08-10',
    status: 'pending_payment', paymentMethod: 'card', totalAmount: 100, depositAmount: 50,
  } as any)
  assert.equal(bound.includes(undefined), false)
  assert.equal(bound.at(-1), 'o1')
})

test('system settings load in one D1 query instead of eight serial queries', async () => {
  let queryCount = 0
  const context = { env: { RENT: { prepare() { queryCount += 1; return { async all() { return { results: [{ key: 'paymentMethods', value: JSON.stringify({ stripe: true, bankTransfer: true, balancePayment: false }) }] } } } } } } } as any
  const settings = await loadSystemSettingsFromDB(context)
  assert.equal(queryCount, 1)
  assert.equal(settings.paymentMethods.stripe, true)
})

test('contract signing drafts restore only non-sensitive fields for the matching token', () => {
  const value = encodeURIComponent(JSON.stringify({ token: 'sign-1', firstName: 'Alice', lastName: 'Chen', email: 'alice@example.com', phone: '0412345678', password: 'secret', esignSignature: 'Alice Chen' }))
  assert.deepEqual(readContractSignDraft(`session=x; contract_sign_draft=${value}`, 'sign-1'), { firstName: 'Alice', lastName: 'Chen', email: 'alice@example.com', phone: '0412345678' })
  assert.deepEqual(readContractSignDraft(`contract_sign_draft=${value}`, 'another-contract'), {})
})

test('existing account names are prefilled into separate given and family name fields', () => {
  assert.deepEqual(splitPersonName('Alice Chen'), { firstName: 'Alice', lastName: 'Chen' })
  assert.deepEqual(splitPersonName('何敏康'), { firstName: '敏康', lastName: '何' })
})

test('Stripe adds 2.5% to the full order principal without changing the refundable base', () => {
  assert.deepEqual(stripePaymentAmounts(1100), { baseCents: 110000, feeCents: 2750, chargedCents: 112750 })
  assert.deepEqual(stripePaymentAmounts(99.99), { baseCents: 9999, feeCents: 250, chargedCents: 10249 })
})

test('only deposit refunds return the fee attributable to the refunded deposit principal', () => {
  const stripePayment = { payment_method: 'card', processing_fee: 27.5 }
  assert.equal(refundableDepositFee(1000, stripePayment), 25)
  assert.equal(refundableDepositFee(499.99, stripePayment), 12.5)
  assert.equal(refundableDepositFee(1000, { payment_method: 'bank_transfer', processing_fee: 0 }), 0)
  assert.equal(refundableDepositFee(1000, { payment_method: 'card', processing_fee: 0 }), 0)
})

test('all registered contract variables render without leftovers', () => {
  const names = [...CONTRACT_VARIABLE_NAMES]
  const groupedNames = CONTRACT_VARIABLE_GROUPS.flatMap(([, groupNames]) => [...groupNames])
  assert.equal(new Set(names).size, names.length)
  assert.deepEqual(new Set(groupedNames), new Set(names))
  const values = Object.fromEntries(names.map(name => [name, 'TEST']))
  const template = names.map(name => `\${${name}}`).join('|')
  const result = renderContractVariables(template, { id: 'c', rentalId: 'o', contractNumber: 'CN1', content: template, signedAt: null, status: 'signed', contract_data: values }, {}, {}, {}, values, true)
  assert.equal(result.includes('${'), false)
})

test('hosted image links require public HTTPS URLs', () => {
  assert.deepEqual(validateHostedImageUrls('https://images.example.com/proof.jpg', 1), ['https://images.example.com/proof.jpg'])
  assert.throws(() => validateHostedImageUrls('http://images.example.com/proof.jpg', 1))
  assert.throws(() => validateHostedImageUrls('https://127.0.0.1/proof.jpg', 1))
  assert.throws(() => validateHostedImageUrls('https://a.example/1.jpg\nhttps://a.example/2.jpg', 1))
})

test('plain text and contract HTML reject script injection', () => {
  assert.equal(sanitizePlainText('<img src=x onerror=alert(1)>Alice'), 'Alice')
  const cleaned = sanitizeRichHtml('<p>Hello ${contract_number}</p><script>alert(1)</script><a href="javascript:alert(2)" onclick="alert(3)">link</a>')
  assert.match(cleaned, /Hello \$\{contract_number\}/)
  assert.doesNotMatch(cleaned, /script|javascript:|onclick/i)
  assert.match(cleaned, /<a rel="noopener noreferrer">link<\/a>/)
})

test('rich text editor pages emit valid browser JavaScript', async () => {
  const user = { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }
  const settingsHtml = renderAdminSettings(user)
  assertInlineScriptsParse(settingsHtml)
  assert.match(settingsHtml, /id="userTermsEditor"/)
  assert.match(settingsHtml, /id="rentalTermsEditor"/)
  assert.match(settingsHtml, /合同管理 → 合同模板编辑/)

  const statement = {
    bind() { return this },
    async first() { return null },
  }
  const context = { env: { RENT: { prepare: () => statement } } } as any
  assertInlineScriptsParse(await renderAdminContracts(context, user))
})

test('site layout loads the external stylesheet and resolves template slots', () => {
  const html = buildLayout('测试页面', '<section id="test-content">内容</section>')
  assert.match(html, /<link rel="stylesheet" href="\/styles\.css">/)
  assert.doesNotMatch(html, /<style(?:\s|>)/i)
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/)
  assert.match(html, /<section id="test-content">内容<\/section>/)
})

test('user management forms use the shared identity record design', () => {
  const html = renderAdminUserNew({ id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
  assert.match(html, /class="identity-strip mono"/)
  assert.match(html, /class="record-form"/)
  assert.match(html, /name="firstName"/)
  assert.match(html, /name="lastName"/)
  assert.doesNotMatch(html, /name="name"/)
  assert.doesNotMatch(html, /onfocus=|linear-gradient\(135deg|👤|🎭|✅/)

  const staffHtml = renderStaffCustomerNew({ id: 'staff', name: 'Staff', email: 'staff@example.com', role: 'STAFF' })
  assert.match(staffHtml, /name="firstName"/)
  assert.match(staffHtml, /name="lastName"/)
  assert.doesNotMatch(staffHtml, /name="role"/)
})

test('new contract delivery form emits valid autocomplete JavaScript', async () => {
  const statement = { bind() { return this }, async first() { return null }, async all() { return { results: [] } } }
  const context = { env: { RENT: { prepare: () => statement } } } as any
  const html = await renderNewContractPage(context, { id: 'staff', name: 'Staff', email: 'staff@example.com', role: 'STAFF' })
  assertInlineScriptsParse(html)
  assert.match(html, /id="delivery-address-search"/)
  assert.match(html, /<select id="pickup-location"/)
  assert.match(html, /id="delivery-fee"[^>]*required/)
  assert.match(html, /id="return-method"/)
  assert.match(html, /value="CourierPickup"/)
  assert.match(html, /value="StoreReturn"/)
  assert.doesNotMatch(html, /GOOGLE_MAPS_API_KEY/)
})

test('joined referral users see their referral workspace instead of the join prompt', async () => {
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM users WHERE id')) return { id: 'customer', name: 'Customer', email: 'customer@example.com', role: 'CUSTOMER', referral_code: 'REFER123', commission_balance: 25 }
          return null
        },
        async all() {
          if (sql.includes('PRAGMA table_info(users)')) return { results: [{ name: 'referrer_id' }] }
          return { results: [] }
        },
      }
    },
  }
  const html = await renderCustomerReferral({ env: { RENT: db } } as any, { id: 'customer', name: 'Customer', email: 'customer@example.com', role: 'CUSTOMER' })
  assert.match(html, /value="REFER123"/)
  assert.match(html, /佣金提现/)
  assert.doesNotMatch(html, />立即加入</)
})

test('staff contract lists exclude contracts created by other employees', async () => {
  const rows: Record<string, any[]> = {
    contracts: [
      { id: 'ct-own', orderId: 'o-own', contractNumber: 'OWN-CONTRACT', status: 'pending_sign', created_by: 'staff-1', signToken: 'own-token' },
      { id: 'ct-other', orderId: 'o-other', contractNumber: 'OTHER-CONTRACT', status: 'pending_sign', created_by: 'staff-2', signToken: 'other-token' },
    ],
    orders: [
      { id: 'o-own', userId: 'u-own', deviceId: 'd1', status: 'active', startDate: '2026-08-01', endDate: '2026-08-02', totalAmount: 10, depositAmount: 5 },
      { id: 'o-other', userId: 'u-other', deviceId: 'd1', status: 'active', startDate: '2026-08-01', endDate: '2026-08-02', totalAmount: 10, depositAmount: 5 },
    ],
    users: [{ id: 'staff-1', name: 'Staff One', role: 'STAFF' }, { id: 'u-own', name: 'Own Customer', role: 'CUSTOMER' }, { id: 'u-other', name: 'Other Customer', role: 'CUSTOMER' }],
    devices: [{ id: 'd1', name: 'Laptop' }],
  }
  const db = { prepare(sql: string) { const table = /FROM\s+(contracts|orders|users|devices)/i.exec(sql)?.[1].toLowerCase() || ''; return { async all() { return { results: rows[table] || [] } } } } }
  const html = await renderStaffContracts({ env: { RENT: db } } as any, { id: 'staff-1', name: 'Staff One', role: 'STAFF' })
  assert.match(html, /OWN-CONTRACT/)
  assert.doesNotMatch(html, /OTHER-CONTRACT/)
})

test('staff cannot open a customer assigned to another employee', async () => {
  const statement = { bind() { return this }, async first() { return { id: 'customer', name: 'Other Customer', email: 'other@example.com', role: 'CUSTOMER', staff_id: 'staff-2' } } }
  const html = await renderStaffCustomerDetail({ env: { RENT: { prepare: () => statement } } } as any, { id: 'staff-1', name: 'Staff One', email: 'staff@example.com', role: 'STAFF' }, 'customer')
  assert.match(html, /客户未找到/)
  assert.doesNotMatch(html, /other@example\.com/)
})
