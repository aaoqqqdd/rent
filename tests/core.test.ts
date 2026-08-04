import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionOrder, hashPassword, verifyPassword, renderContractVariables, CONTRACT_OPERATIONAL_FIELDS, CONTRACT_COMPUTED_FIELDS, validateHostedImageUrls, sanitizePlainText, sanitizeRichHtml } from '../src/site'

test('PBKDF2 passwords verify without storing plaintext', async () => {
  const hash = await hashPassword('A-secure-password-123')
  assert.match(hash, /^pbkdf2\$210000\$/)
  assert.equal(await verifyPassword('A-secure-password-123', hash), true)
  assert.equal(await verifyPassword('wrong-password', hash), false)
})

test('terminal order states cannot be reopened', () => {
  assert.equal(canTransitionOrder('pending_payment', 'paid'), true)
  assert.equal(canTransitionOrder('completed', 'active'), false)
  assert.equal(canTransitionOrder('cancelled', 'paid'), false)
})

test('all registered contract variables render without leftovers', () => {
  const names = [...CONTRACT_OPERATIONAL_FIELDS, ...CONTRACT_COMPUTED_FIELDS].map(([name]) => name)
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
