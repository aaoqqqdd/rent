/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLayout, canTransitionOrder, ensureOrderNumber, findUserBySession, getContractBySignToken, hashPassword, verifyPassword, isStrongPassword, generateTemporaryPassword, isContractExpired, isContractFinalized, renderContractVariables, CONTRACT_VARIABLE_GROUPS, CONTRACT_VARIABLE_NAMES, validateHostedImageUrls, sanitizePlainText, sanitizeRichHtml, updateOrder, loadSystemSettingsFromDB, splitPersonName, canUseAccountBalance } from '../src/site'
import { renderAdminSettings } from '../src/pages/admin/settings'
import { renderAdminDeviceCalendar } from '../src/pages/admin/deviceCalendar'
import { renderAdminContracts } from '../src/pages/admin/contracts'
import { renderAdminAgreementEditor, renderAdminTemplateHub } from '../src/pages/admin/templates'
import { renderAdminUserNew } from '../src/pages/admin/userNew'
import { renderAdminUserEdit } from '../src/pages/admin/userEdit'
import { renderAdminDeviceNew } from '../src/pages/admin/deviceNew'
import { renderAdminDeviceEdit } from '../src/pages/admin/deviceEdit'
import { renderStaffCustomerNew } from '../src/pages/staff/customerNew'
import { renderRegister } from '../src/pages/public/register'
import { renderNewContractPage } from '../src/pages/staff/newContract'
import { renderStaffContracts } from '../src/pages/staff/contracts'
import { renderStaffCustomerDetail } from '../src/pages/staff/customerDetail'
import { renderStaffOrdersOngoing } from '../src/pages/staff/ordersPending'
import { renderStaffDevices } from '../src/pages/staff/devices'
import { renderStaffCustomerEdit } from '../src/pages/staff/customerEdit'
import { refundableDepositFee, stripeCheckoutItems, stripePaymentAmounts } from '../src/actions/stripePayments'
import { renderCustomerReferral } from '../src/pages/customer/referral'
import { getBankRefundPrefill, readContractSignDraft, renderSigningProgress } from '../src/pages/public/contractSign'
import { paymentResultState } from '../src/pages/public/paymentResult'
import { renderOrderStatusFeedback } from '../src/pages/admin/orderStatusFeedback'

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

test('new account passwords require letters, numbers, symbols, and eight characters', () => {
  assert.equal(isStrongPassword('Abcd123!'), true)
  assert.equal(isStrongPassword('abcdefg!'), false)
  assert.equal(isStrongPassword('1234567!'), false)
  assert.equal(isStrongPassword('Abcd1234'), false)
  assert.equal(isStrongPassword('Ab1!'), false)
  assert.equal(isStrongPassword('Abcd123 '), false)
})

test('only logged-in formal customers can use account balance', () => {
  assert.equal(canUseAccountBalance(undefined), false)
  assert.equal(canUseAccountBalance({ role: 'CUSTOMER', accountType: 'guest' }), false)
  assert.equal(canUseAccountBalance({ role: 'CUSTOMER', account_type: 'deleted_guest' }), false)
  assert.equal(canUseAccountBalance({ role: 'STAFF', accountType: 'formal' }), false)
  assert.equal(canUseAccountBalance({ role: 'CUSTOMER', accountType: 'formal' }), true)
  assert.equal(canUseAccountBalance({ role: 'CUSTOMER' }), true)
  assert.equal(canUseAccountBalance({ role: 'customer', account_type: 'FORMAL' }), true)
})

test('session lookup loads the complete user without schema probes', async () => {
  const statements: string[] = []
  const db = { prepare(sql: string) { statements.push(sql); return { bind() { return this }, async run() { return { success: true } }, async first() { return sql.includes('auth_sessions') ? { user_id: 'guest-1' } : { id: 'guest-1', name: 'Guest', email: 'guest@example.com', role: 'CUSTOMER', status: 'active', account_type: 'guest', guest_order_id: 'order-1', bsb: '062-001', account: '12345678' } } } } }
  const user = await findUserBySession({ env: { RENT: db } } as any, `session=${'a'.repeat(32)}`)
  assert.equal(user?.accountType, 'guest')
  assert.equal(user?.guestOrderId, 'order-1')
  assert.equal(user?.accountNumber, '12345678')
  assert.equal(statements.some(sql => /PRAGMA table_info/i.test(sql)), false)
  assert.equal(statements.filter(sql => /SELECT \* FROM users/i.test(sql)).length, 1)
})

test('guest passwords are strong and generated independently', () => {
  const first = generateTemporaryPassword()
  const second = generateTemporaryPassword()
  assert.equal(isStrongPassword(first), true)
  assert.equal(isStrongPassword(second), true)
  assert.notEqual(first, second)
})

test('guest sessions show their deletion date and only the guest workspace navigation', () => {
  const html = buildLayout('访客合同中心', '<p>guest</p>', {
    id: 'guest-1', name: 'Guest User', email: 'guest@example.com', role: 'CUSTOMER',
    balance: 0, commissionBalance: 0, accountType: 'guest', guestOrderId: 'order-1', guestExpiresAt: '2026-09-30',
  } as any)
  assert.match(html, /访客（2026-09-30删除）/)
  assert.match(html, /访客合同中心/)
  assert.doesNotMatch(html, /推荐计划/)
  assert.doesNotMatch(html, /个人资料/)
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
  assert.equal(isContractFinalized({ ...base, status: 'completed', signedAt: '2026-08-06T00:00:00.000Z', signed_content: '<p>signed</p>' }), true)
  assert.equal(isContractFinalized({ ...base, status: 'cancelled', signedAt: '2026-08-06T00:00:00.000Z', signed_content: '<p>signed</p>' }), false)
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
  let preparedSql = ''
  const statement = { bind(...values: unknown[]) { bound = values; return this }, async run() { return { success: true } } }
  const context = { env: { RENT: { prepare: (sql: string) => { preparedSql = sql; return statement } } } } as any
  await updateOrder(context, {
    id: 'o1', userId: 'u1', deviceId: 'd1', startDate: '2026-08-08', endDate: '2026-08-10',
    status: 'pending_payment', paymentMethod: 'card', totalAmount: 100, depositAmount: 50,
  } as any)
  assert.equal(bound.includes(undefined), false)
  assert.equal(bound.at(-1), 'o1')
  assert.doesNotMatch(preparedSql, /signedAt/)
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

test('saved customer bank details prefill an editable bank refund form', () => {
  assert.deepEqual(getBankRefundPrefill(undefined), { accountName: '', bsb: '', accountNumber: '' })
  assert.deepEqual(getBankRefundPrefill({ name: 'Alice Zhang', bsb: '062-001', account: '12345678' }), {
    accountName: 'Alice Zhang', bsb: '062-001', accountNumber: '12345678',
  })
  assert.deepEqual(getBankRefundPrefill({ name: 'Alice Zhang', account_name: 'A Zhang', account_number: '87654321' }), {
    accountName: 'A Zhang', bsb: '', accountNumber: '87654321',
  })
})

test('contract signing progress renders readable step labels and one current step', () => {
  const html = renderSigningProgress(2)
  assert.match(html, /signing-step--complete[^>]*>[\s\S]*同意协议/)
  assert.match(html, /signing-step--current" aria-current="step"[\s\S]*确认资料/)
  assert.match(html, /signing-step--upcoming[^>]*>[\s\S]*选择支付/)
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1)
  assert.doesNotMatch(html, /\*\*/)
})

test('Stripe adds 2.5% to the full order principal without changing the refundable base', () => {
  assert.deepEqual(stripePaymentAmounts(1100), { baseCents: 110000, feeCents: 2750, chargedCents: 112750 })
  assert.deepEqual(stripePaymentAmounts(99.99), { baseCents: 9999, feeCents: 250, chargedCents: 10249 })
})

test('Stripe checkout separates rent, deposit, and processing fee', () => {
  assert.deepEqual(stripeCheckoutItems({ totalAmount: 1100, depositAmount: 1000, rentalPeriod: 5, startDate: '2026-08-10', endDate: '2026-08-15' }), [
    { name: '设备租金（5 天，2026-08-10 至 2026-08-15）', amountCents: 10000 },
    { name: '设备押金', amountCents: 100000 },
    { name: 'Stripe 支付手续费（2.5%）', amountCents: 2750 },
  ])
})

test('payment results distinguish Stripe, bank transfer, and immediate balance payment', () => {
  assert.equal(paymentResultState({ paymentMethod: 'card', status: 'pending_payment' }, { status: 'pending' }), 'stripe_pending')
  assert.equal(paymentResultState({ paymentMethod: 'bank_transfer', status: 'pending_payment' }, { status: 'pending' }), 'bank_pending')
  assert.equal(paymentResultState({ paymentMethod: 'balance', status: 'paid' }, { status: 'paid' }), 'success')
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
  assert.doesNotMatch(settingsHtml, /id="userTermsEditor"/)
  assert.doesNotMatch(settingsHtml, /id="rentalTermsEditor"/)
  assert.match(settingsHtml, /href="\/admin\/templates"/)
  assert.match(settingsHtml, /完整邮件变量索引/)
  assert.doesNotMatch(settingsHtml, /邮件通知模板可用变量/)

  const hubHtml = renderAdminTemplateHub(user)
  assert.match(hubHtml, /href="\/admin\/templates\/user"/)
  assert.match(hubHtml, /href="\/admin\/templates\/rental"/)
  assert.match(hubHtml, /href="\/admin\/templates\/contract"/)
  assert.match(hubHtml, /href="\/admin\/templates\/service"/)
  assert.match(hubHtml, /href="\/admin\/templates\/privacy"/)
  assert.match(hubHtml, /href="\/admin\/templates\/copyright"/)
  assertInlineScriptsParse(renderAdminAgreementEditor(user, 'user'))
  assertInlineScriptsParse(renderAdminAgreementEditor(user, 'rental'))
  assertInlineScriptsParse(renderAdminAgreementEditor(user, 'service'))
  assertInlineScriptsParse(renderAdminAgreementEditor(user, 'privacy'))
  assertInlineScriptsParse(renderAdminAgreementEditor(user, 'copyright'))

  const statement = {
    bind() { return this },
    async first() { return null },
  }
  const context = { env: { RENT: { prepare: () => statement } } } as any
  const contractTemplateHtml = await renderAdminContracts(context, user)
  assert.match(contractTemplateHtml, /返回协议与模板/)
  assert.match(contractTemplateHtml, /完整合同变量索引/)
  assert.doesNotMatch(contractTemplateHtml, /合同模板可用变量/)
  assertInlineScriptsParse(contractTemplateHtml)
})

test('site layout loads the external stylesheet and resolves template slots', () => {
  const html = buildLayout('测试页面', '<section id="test-content">内容</section>')
  assert.match(html, /<link rel="stylesheet" href="\/styles\.css">/)
  assert.doesNotMatch(html, /<style(?:\s|>)/i)
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/)
  assert.match(html, /<section id="test-content">内容<\/section>/)
  assert.match(html, /class="legal-footer"/)
  assert.match(html, /href="\/service-terms"/)
  assert.match(html, /href="\/privacy"/)
  assert.match(html, /href="\/copyright"/)
})

test('order status failures stay on the page and use a modal dialog', () => {
  const html = renderOrderStatusFeedback()
  assert.match(html, /data-order-status-dialog/)
  assert.match(html, /\.js-order-status-form/)
  assert.match(html, /Accept: 'application\/json'/)
  assert.match(html, /showModal/)
  assertInlineScriptsParse(html)
})

test('user management forms use the shared identity record design', async () => {
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

  const registrationHtml = renderRegister()
  assert.match(registrationHtml, /name="firstName"/)
  assert.match(registrationHtml, /name="lastName"/)
  assert.doesNotMatch(registrationHtml, /name="name"/)
  assert.match(registrationHtml, /minlength="8"/)
  assert.match(registrationHtml, /pattern="\(\?=\.\*\[A-Za-z\]\).*\[0-9\].*\{8,\}"/)
  assert.match(registrationHtml, /href="\/service-terms"/)
  assert.match(registrationHtml, /href="\/privacy"/)

  const rows = [
    { id: 'customer-1', name: 'Kai Chen', email: 'kai@example.com', role: 'CUSTOMER', status: 'active', account_status: 'active', staff_id: 'staff-1' },
    { id: 'staff-1', name: 'Alex Wu', email: 'alex@example.com', role: 'STAFF', status: 'active', account_status: 'active' },
    { id: 'staff-departed', name: 'Former Staff', email: 'former@example.com', role: 'STAFF', status: 'inactive', account_status: 'departed' },
  ]
  const context = { env: { RENT: { prepare(sql: string) { return { bind(...values: unknown[]) { return { async first() { return sql.includes('WHERE id = ?') ? rows.find(row => row.id === values[0]) ?? null : null } } }, async all() { return { results: rows } } } } } } } as any
  const editHtml = await renderAdminUserEdit(context, { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }, 'customer-1')
  assert.match(editHtml, /name="accountStatus"/)
  for (const status of ['active', 'banned', 'inactive', 'departed']) assert.match(editHtml, new RegExp(`value="${status}"`))
  assert.match(editHtml, /name="staffId"/)
  assert.match(editHtml, /Alex Wu/)
  assert.doesNotMatch(editHtml, /Former Staff/)
  assertInlineScriptsParse(editHtml)

  const currentAdminRows = [{ id: 'admin', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', status: 'active', account_status: 'active' }]
  const currentAdminContext = { env: { RENT: { prepare(sql: string) { return { bind(...values: unknown[]) { return { async first() { return sql.includes('WHERE id = ?') ? currentAdminRows.find(row => row.id === values[0]) ?? null : null } } }, async all() { return { results: currentAdminRows } } } } } } } as any
  const currentAdminHtml = await renderAdminUserEdit(currentAdminContext, currentAdminRows[0], 'admin')
  assert.match(currentAdminHtml, /id="user-role" name="role" disabled/)
  assert.match(currentAdminHtml, /id="account-status" name="accountStatus" disabled/)
  assert.match(currentAdminHtml, /当前正在使用的管理员账号不能更改账户状态/)
})

test('admin device forms edit every field used by staff device search', () => {
  const user = { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }
  const newHtml = renderAdminDeviceNew(user)
  for (const field of ['name', 'brand', 'model', 'assetTag', 'serialNumber', 'cpu', 'ram', 'storage', 'gpu', 'os', 'description']) {
    assert.match(newHtml, new RegExp(`name="${field}"`))
  }
  const editHtml = renderAdminDeviceEdit(user, { id: 'd1', name: 'MacBook Pro', brand: 'Apple', model: 'A2918', asset_tag: 'RENT-001', serialNumber: 'SN1', cpu: 'M3 Pro', ram: '18GB', storage: '512GB SSD', gpu: '18-core', os: 'macOS 15', description: '14 inch', pricePerDay: 50, depositAmount: 1000, status: 'available' })
  for (const expected of ['Apple', 'RENT-001', 'M3 Pro', '18GB', '512GB SSD', '18-core', 'macOS 15']) assert.match(editHtml, new RegExp(expected))
})

test('new contract delivery form emits valid autocomplete JavaScript', async () => {
  const context = { env: { RENT: { prepare(sql: string) { return { bind() { return this }, async first() { return null }, async all() { return { results: sql.includes('FROM devices') ? [{ id: 'device-rented', name: 'MacBook', brand: 'Apple', model: 'Pro', asset_tag: 'RENT-001', serialNumber: 'SN1', cpu: 'M3 Pro', ram: '18GB', storage: '512GB SSD', gpu: '18-core', os: 'macOS 15', pricePerDay: 20, depositAmount: 500, status: 'rented' }] : [] } } } } } } } as any
  const html = await renderNewContractPage(context, { id: 'staff', name: 'Staff', email: 'staff@example.com', role: 'STAFF' })
  assertInlineScriptsParse(html)
  assert.match(html, /id="delivery-address-search"/)
  assert.match(html, /<select id="pickup-location"/)
  assert.match(html, /id="delivery-fee"[^>]*required/)
  assert.match(html, /id="return-method"/)
  assert.match(html, /value="CourierPickup"/)
  assert.match(html, /value="StoreReturn"/)
  assert.match(html, /value="device-rented"/)
  assert.match(html, /id="device-search"/)
  assert.match(html, /data-group-pagination/)
  assert.match(html, /data-group-toggle/)
  assert.match(html, /devicePageSize = 4/)
  assert.match(html, /data-device-search=/)
  assert.match(html, /SN1/)
  assert.match(html, /M3 Pro · 18GB · 512GB SSD · 18-core · macOS 15/)
  assert.match(html, /RENT-001/)
  assert.match(html, /id="booking-calendar"/)
  assert.match(html, /id="booking-prev"/)
  assert.match(html, /selectBookingDate/)
  assert.match(html, /setCustomValidity/)
  assert.match(html, /请手动选择设备/)

  const adminHtml = await renderNewContractPage(context, { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
  assertInlineScriptsParse(adminHtml)
  assert.match(adminHtml, /id="booking-calendar"/)
  assert.match(adminHtml, /selectBookingDate/)
  assert.doesNotMatch(html, /GOOGLE_MAPS_API_KEY/)
})

test('admin rental calendar filters all devices or a single device', async () => {
  const context = { env: { RENT: { prepare(sql: string) { return { async all() { return { results: sql.includes('FROM orders') ? [{ id: 'o1', deviceId: 'd1', deviceName: 'MacBook', customerName: 'Customer', startDate: '2026-08-10', endDate: '2026-08-12', status: 'paid' }] : [{ id: 'd1', name: 'MacBook', serialNumber: 'SN1', status: 'rented' }] } } } } } } } as any
  const html = await renderAdminDeviceCalendar(context, { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
  assertInlineScriptsParse(html)
  assert.match(html, /全部出租设备/)
  assert.match(html, /value="d1"/)
  assert.match(html, /id="fleet-calendar"/)
  assert.match(html, /id="calendar-prev"/)
  assert.match(html, /id="calendar-next"/)
  assert.doesNotMatch(html, /type="month"/)
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
  assert.match(html, /等待客户签署/)
  assert.doesNotMatch(html, />签署进度</)
  assert.match(html, /contract-list-action copy-sign-link/)
  assert.match(html, /contract-list-action contract-cancel-action/)

  const adminHtml = await renderStaffContracts({ env: { RENT: db } } as any, { id: 'admin', name: 'Admin', role: 'ADMIN' })
  assert.match(adminHtml, /OWN-CONTRACT/)
  assert.match(adminHtml, /OTHER-CONTRACT/)
  assert.match(adminHtml, /href="\/admin\/templates"/)
  assert.match(adminHtml, /action="\/admin\/contracts"/)

  const filteredAdminHtml = await renderStaffContracts({ env: { RENT: db } } as any, { id: 'admin', name: 'Admin', role: 'ADMIN' }, undefined, undefined, undefined, undefined, 'staff-1')
  assert.match(filteredAdminHtml, /id="contract-staff-filter"/)
  assert.match(filteredAdminHtml, /负责员工/)
  assert.match(filteredAdminHtml, /员工账户请前往用户管理创建或停用/)
  assert.match(filteredAdminHtml, /value="staff-1" selected/)
  assert.match(filteredAdminHtml, /OWN-CONTRACT/)
  assert.doesNotMatch(filteredAdminHtml, /OTHER-CONTRACT/)
})

test('terminal contracts hide progress and editing while only finalized contracts can be viewed', async () => {
  const rows: Record<string, any[]> = {
    contracts: [
      { id: 'ct-pending', orderId: 'o1', contractNumber: 'PENDING', status: 'pending_sign', created_by: 'staff-1' },
      { id: 'ct-cancelled', orderId: 'o2', contractNumber: 'CANCELLED', status: 'cancelled', created_by: 'staff-1' },
      { id: 'ct-completed', orderId: 'o3', contractNumber: 'COMPLETED', status: 'completed', signedAt: '2026-08-01', signed_content: '<p>signed</p>', created_by: 'staff-1' },
    ],
    orders: ['o1','o2','o3'].map(id => ({ id, userId: 'u1', deviceId: 'd1', status: 'active', startDate: '2026-08-01', endDate: '2026-08-02' })),
    users: [{ id: 'staff-1', name: 'Staff', role: 'STAFF' }, { id: 'u1', name: 'Customer', role: 'CUSTOMER' }], devices: [{ id: 'd1', name: 'Laptop' }],
  }
  const db = { prepare(sql: string) { const table = /FROM\s+(contracts|orders|users|devices)/i.exec(sql)?.[1].toLowerCase() || ''; return { async all() { return { results: rows[table] || [] } } } } }
  const html = await renderStaffContracts({ env: { RENT: db } } as any, { id: 'staff-1', name: 'Staff', email: 'staff@example.com', role: 'STAFF' }, 'completed')
  assert.match(html, /COMPLETED/)
  assert.match(html, /contract\/view\/ct-completed/)
  assert.doesNotMatch(html, /ct-completed\/data/)
  assert.doesNotMatch(html, /ct-completed\/progress/)
})

test('staff cannot open a customer assigned to another employee', async () => {
  const statement = { bind() { return this }, async first() { return { id: 'customer', name: 'Other Customer', email: 'other@example.com', role: 'CUSTOMER', staff_id: 'staff-2' } } }
  const html = await renderStaffCustomerDetail({ env: { RENT: { prepare: () => statement } } } as any, { id: 'staff-1', name: 'Staff One', email: 'staff@example.com', role: 'STAFF' }, 'customer')
  assert.match(html, /客户未找到/)
  assert.doesNotMatch(html, /other@example\.com/)
})

test('staff ongoing orders are read-only and limited to assigned customers', async () => {
  const rows: Record<string, any[]> = {
    orders: [
      { id: 'own-active', orderNo: 'OWN-1', userId: 'own-customer', deviceId: 'd1', status: 'active', startDate: '2026-08-01', endDate: '2026-08-10', totalAmount: 100 },
      { id: 'other-active', orderNo: 'OTHER-1', userId: 'other-customer', deviceId: 'd1', status: 'active', startDate: '2026-08-01', endDate: '2026-08-10', totalAmount: 100 },
      { id: 'own-pending-review', orderNo: 'REVIEW-1', userId: 'own-customer', deviceId: 'd1', status: 'pending_approval', startDate: '2026-08-01', endDate: '2026-08-10', totalAmount: 100 },
    ],
    users: [{ id: 'own-customer', name: 'Own', staff_id: 'staff-1' }, { id: 'other-customer', name: 'Other', staff_id: 'staff-2' }],
    devices: [{ id: 'd1', name: 'Laptop' }],
  }
  const db = { prepare(sql: string) { const table = /FROM\s+(orders|users|devices)/i.exec(sql)?.[1].toLowerCase() || ''; return { async all() { return { results: rows[table] || [] } } } } }
  const html = await renderStaffOrdersOngoing({ env: { RENT: db } } as any, { id: 'staff-1', name: 'Staff', email: 'staff@example.com', role: 'STAFF' })
  assert.match(html, /OWN-1/)
  assert.doesNotMatch(html, /OTHER-1|REVIEW-1/)
  assert.doesNotMatch(html, />批准<|>拒绝<|approve|reject/)
  assert.match(html, /归还验机/)
})

test('staff device and customer pages hide administrator-only mutations', async () => {
  const db = { prepare(sql: string) { return { bind() { return this }, async first() { return { id: 'customer', name: 'Customer One', email: 'customer@example.com', role: 'CUSTOMER', staff_id: 'staff-1', balance: 50 } }, async all() { return { results: sql.includes('FROM devices') ? [{ id: 'd1', name: 'Laptop', model: 'Pro', serialNumber: 'SN1', pricePerDay: 20, status: 'available' }] : [] } } } } }
  const user = { id: 'staff-1', name: 'Staff', email: 'staff@example.com', role: 'STAFF' }
  const devicesHtml = await renderStaffDevices({ env: { RENT: db } } as any, user)
  assert.doesNotMatch(devicesHtml, /添加设备|\/staff\/devices\/new|\/staff\/devices\/d1\/edit/)
  const customerHtml = await renderStaffCustomerEdit({ env: { RENT: db } } as any, user, 'customer')
  assert.doesNotMatch(customerHtml, /name="balance"/)
  assert.match(customerHtml, /name="bsb"/)
})
